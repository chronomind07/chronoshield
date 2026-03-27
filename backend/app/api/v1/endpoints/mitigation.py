from datetime import date
from typing import List

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.config import settings
from app.core.security import get_current_user_id
from app.db.supabase import get_db

router = APIRouter(prefix="/mitigation", tags=["mitigation"])

# ── Plan limits ────────────────────────────────────────────────────────────────
MITIGATION_LIMITS: dict[str, int] = {
    "starter":  3,
    "business": 15,
    "free":     0,
    "trial":    3,
}

# ── System prompt (kept short to minimise token cost) ─────────────────────────
SYSTEM_PROMPT = (
    "Eres el asistente de mitigación de ChronoShield. "
    "Tu trabajo es guiar al usuario paso a paso para resolver problemas de seguridad en su dominio.\n"
    "REGLAS:\n"
    "- Respuestas cortas y directas, máximo 150 palabras\n"
    "- Usa pasos numerados\n"
    "- Si necesitas saber el proveedor de dominio/hosting, pregunta\n"
    "- Proveedores comunes: Namecheap, GoDaddy, Cloudflare, Ionos, OVH, Hostinger, Arsys, Dinahosting\n"
    "- Para DNS (SPF/DKIM/DMARC): da los valores exactos del registro a crear\n"
    "- Para SSL: indica si es renovación automática o manual según el proveedor\n"
    "- Para uptime: sugiere verificar DNS y hosting\n"
    "- Habla siempre en español\n"
    "- No hagas introducciones largas, ve al grano"
)

# ── Schemas ────────────────────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str    # "user" | "assistant"
    content: str


class MitigationChatRequest(BaseModel):
    alert_id: str
    message: str
    conversation_history: List[ChatMessage] = []


class MitigationChatResponse(BaseModel):
    response: str
    usage_count: int
    usage_limit: int


# ── Helpers ────────────────────────────────────────────────────────────────────
def _get_plan_limit(db, user_id: str) -> tuple[str, int]:
    """Return (plan_name, monthly_limit) for the user."""
    sub = db.table("subscriptions").select("plan").eq("user_id", user_id).single().execute()
    plan = (sub.data or {}).get("plan", "free")
    return plan, MITIGATION_LIMITS.get(plan, 0)


def _get_and_increment_usage(db, user_id: str, current_count: int, month_start: date) -> None:
    """Upsert mitigation_usage incrementing count by 1."""
    db.table("mitigation_usage").upsert(
        {
            "user_id": user_id,
            "month": month_start.isoformat(),
            "count": current_count + 1,
        },
        on_conflict="user_id,month",
    ).execute()


# ── Endpoints ──────────────────────────────────────────────────────────────────
@router.post("/chat", response_model=MitigationChatResponse)
async def mitigation_chat(
    req: MitigationChatRequest,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    # 1. Check plan
    plan, limit = _get_plan_limit(db, user_id)
    if limit == 0:
        raise HTTPException(
            status_code=402,
            detail="Tu plan no incluye el asistente de mitigación. Actualiza a Starter o Business.",
        )

    # 2. Check monthly usage
    today = date.today()
    month_start = today.replace(day=1)
    usage_res = (
        db.table("mitigation_usage")
        .select("count")
        .eq("user_id", user_id)
        .eq("month", month_start.isoformat())
        .execute()
    )
    current_count: int = (usage_res.data[0]["count"] if usage_res.data else 0)

    if current_count >= limit:
        upgrade_note = " Actualiza a Business para más consultas." if plan == "starter" else ""
        raise HTTPException(
            status_code=429,
            detail=f"Has alcanzado el límite mensual de {limit} consultas.{upgrade_note}",
        )

    # 3. Increment usage immediately (before the AI call to avoid race conditions)
    _get_and_increment_usage(db, user_id, current_count, month_start)

    # 4. Fetch alert context — real columns: alert_type, severity, title, message, domain_id
    alert_res = (
        db.table("alerts")
        .select("alert_type, severity, title, message, domain_id")
        .eq("id", req.alert_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not alert_res.data:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")

    alert = alert_res.data

    # Resolve domain name via separate query if domain_id present
    domain_name: str | None = None
    if alert.get("domain_id"):
        dom_res = (
            db.table("domains")
            .select("domain")
            .eq("id", alert["domain_id"])
            .single()
            .execute()
        )
        if dom_res.data:
            domain_name = dom_res.data.get("domain")

    alert_context = (
        f"ALERTA ACTIVA:\n"
        f"- Tipo: {alert.get('alert_type', 'desconocido')}\n"
        f"- Severidad: {alert.get('severity', 'media')}\n"
        f"- Título: {alert.get('title', '')}\n"
        f"- Descripción: {alert.get('message', '')}"
        + (f"\n- Dominio afectado: {domain_name}" if domain_name else "")
    )

    # 5. Build messages — keep only last 6 history messages to minimise tokens
    history = req.conversation_history[-6:]
    messages: list[dict] = []

    if not history:
        # First turn: inject alert context together with user message
        messages.append({
            "role": "user",
            "content": f"{alert_context}\n\nPregunta: {req.message}",
        })
    else:
        for msg in history:
            messages.append({"role": msg.role, "content": msg.content})
        messages.append({"role": "user", "content": req.message})

    # 6. Call Claude Haiku
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    ai_response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=300,
        temperature=0,
        system=SYSTEM_PROMPT,
        messages=messages,
    )

    return MitigationChatResponse(
        response=ai_response.content[0].text,
        usage_count=current_count + 1,
        usage_limit=limit,
    )


@router.get("/usage")
async def get_mitigation_usage(
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Return current-month usage + limit for the authenticated user."""
    today = date.today()
    month_start = today.replace(day=1)

    plan, limit = _get_plan_limit(db, user_id)
    usage_res = (
        db.table("mitigation_usage")
        .select("count")
        .eq("user_id", user_id)
        .eq("month", month_start.isoformat())
        .execute()
    )
    current_count: int = (usage_res.data[0]["count"] if usage_res.data else 0)

    return {"usage_count": current_count, "usage_limit": limit, "plan": plan}
