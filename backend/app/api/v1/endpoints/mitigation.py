from collections import Counter
from datetime import date
from typing import List, Optional, Any
from uuid import UUID

import anthropic
import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.config import settings
from app.core.security import get_current_user_id
from app.db.supabase import get_db

logger = structlog.get_logger()

router = APIRouter(prefix="/mitigation", tags=["mitigation"])

# ── Plan limits ────────────────────────────────────────────────────────────────
MITIGATION_LIMITS: dict[str, int] = {
    "starter":    5,
    "business":   20,
    "enterprise": 50,
    "free":       0,
    "trial":      5,
}

MAX_CHAT_SESSIONS = 3  # per user

# ── System prompt ─────────────────────────────────────────────────────────────
_BASE_SYSTEM = (
    "Eres ChronoAI, el asistente de ciberseguridad de ChronoShield. "
    "Responde en el mismo idioma que el usuario. Sé breve y directo.\n\n"
    "REGLAS:\n"
    "- NUNCA recomiendes herramientas externas ni competencia "
    "(no menciones SSL Labs, SecurityHeaders, MXToolbox, Qualys, VirusTotal, Shodan, etc.)\n"
    "- Usa SOLO los datos de ChronoShield para responder\n"
    "- Si el usuario pregunta sobre sus datos, usa el contexto que tienes abajo\n"
    "- No pidas información que ya tienes en el contexto del usuario\n"
    "- Da recomendaciones accionables basadas en los datos reales\n"
    "- Usa pasos numerados cuando expliques cómo arreglar algo\n"
    "- Para DNS (SPF/DKIM/DMARC): da los valores exactos del registro a crear\n"
    "- Para SSL: indica si es renovación automática o manual según el proveedor\n"
    "- Proveedores comunes: Namecheap, GoDaddy, Cloudflare, Ionos, OVH, Hostinger, Arsys, Dinahosting\n"
    "- No hagas introducciones largas, ve al grano\n"
    "- Usa emojis con moderación para claridad"
)


# ── Schemas ────────────────────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str    # "user" | "assistant"
    content: str


class MitigationChatRequest(BaseModel):
    alert_id: Optional[str] = None
    message: str
    conversation_history: List[ChatMessage] = []


class MitigationChatResponse(BaseModel):
    response: str
    usage_count: int
    usage_limit: int


class ChatSessionSave(BaseModel):
    session_id: Optional[str] = None   # None = create new
    title: str
    messages: List[Any]                # list of {role, content, timestamp?}


class ChatSessionOut(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    messages: List[Any] = []


# ── Helpers ────────────────────────────────────────────────────────────────────
def _get_plan_limit(db, user_id: str) -> tuple[str, int]:
    sub = db.table("subscriptions").select("plan").eq("user_id", user_id).execute()
    plan = (sub.data[0] if sub.data else {}).get("plan", "free")
    return plan, MITIGATION_LIMITS.get(plan, 0)


def _get_and_increment_usage(db, user_id: str, current_count: int, month_start: date) -> None:
    db.table("mitigation_usage").upsert(
        {"user_id": user_id, "month": month_start.isoformat(), "count": current_count + 1},
        on_conflict="user_id,month",
    ).execute()


def _build_user_context(db, user_id: str) -> str:
    """Build a compact security-context string to prepend to the system prompt.
    Uses the correct column names from the Supabase schema.
    ssl_results.status  → enum('valid','expiring_soon','expired','invalid','no_ssl','error')
    uptime_results.status → enum('up','down','degraded','error')
    email_security_results.spf_status/dkim_status/dmarc_status → enum('valid','invalid','missing','error')
    """
    parts_log: list[str] = []

    # 1. Active domains (max 5)
    try:
        dom_res = (
            db.table("domains")
            .select("id, domain")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .limit(5)
            .execute()
        )
        domains = dom_res.data or []
    except Exception as exc:
        logger.warning("user_context: domains query failed", error=str(exc))
        domains = []

    if not domains:
        logger.info("user_context: no active domains — skipping context")
        return ""

    # 2. Per-domain latest scan data
    domain_lines: list[str] = []
    for d in domains:
        did, dname = d["id"], d["domain"]
        parts: list[str] = []

        # SSL — status enum + days_remaining int
        try:
            ssl = (
                db.table("ssl_results")
                .select("status, days_remaining")
                .eq("domain_id", did)
                .order("scanned_at", desc=True)
                .limit(1)
                .execute()
                .data
            )
            if ssl:
                s = ssl[0]
                st = s.get("status", "error")
                days = s.get("days_remaining")
                if st == "valid":
                    parts.append(f"SSL:válido({days}d restantes)" if days is not None else "SSL:válido")
                elif st == "expiring_soon":
                    parts.append(f"SSL:expira pronto({days}d)⚠️")
                elif st == "expired":
                    parts.append("SSL:EXPIRADO")
                elif st == "no_ssl":
                    parts.append("SSL:sin certificado")
                else:
                    parts.append(f"SSL:{st}")
        except Exception as exc:
            logger.warning("user_context: ssl query failed", domain=dname, error=str(exc))

        # Email security — spf_status / dkim_status / dmarc_status enums
        try:
            em = (
                db.table("email_security_results")
                .select("spf_status, dkim_status, dmarc_status")
                .eq("domain_id", did)
                .order("scanned_at", desc=True)
                .limit(1)
                .execute()
                .data
            )
            if em:
                e = em[0]
                def _es(v: str | None) -> str:
                    return {"valid": "válido", "missing": "faltante",
                            "invalid": "inválido", "error": "error"}.get(v or "", v or "?")
                parts.append(f"SPF:{_es(e.get('spf_status'))}")
                parts.append(f"DKIM:{_es(e.get('dkim_status'))}")
                parts.append(f"DMARC:{_es(e.get('dmarc_status'))}")
        except Exception as exc:
            logger.warning("user_context: email_security query failed", domain=dname, error=str(exc))

        # Uptime — status enum ('up','down','degraded','error') + response_time_ms
        try:
            up = (
                db.table("uptime_results")
                .select("status, response_time_ms")
                .eq("domain_id", did)
                .order("checked_at", desc=True)
                .limit(1)
                .execute()
                .data
            )
            if up:
                u = up[0]
                st = u.get("status", "error")
                ms = u.get("response_time_ms")
                if st == "up":
                    parts.append(f"uptime:operativo({ms}ms)" if ms else "uptime:operativo")
                elif st == "degraded":
                    parts.append(f"uptime:lento({ms}ms)" if ms else "uptime:lento⚠️")
                elif st == "down":
                    parts.append("uptime:CAÍDO")
                else:
                    parts.append(f"uptime:{st}")
        except Exception as exc:
            logger.warning("user_context: uptime query failed", domain=dname, error=str(exc))

        # Security score — overall + per-category breakdown
        try:
            sc = (
                db.table("security_scores")
                .select("overall_score, ssl_score, uptime_score, email_sec_score, breach_score, grade")
                .eq("domain_id", did)
                .order("calculated_at", desc=True)
                .limit(1)
                .execute()
                .data
            )
            if sc:
                s = sc[0]
                score_detail = (
                    f"puntuación global:{s.get('overall_score','?')}/100"
                    f"(nota:{s.get('grade','?')})"
                    f", SSL:{s.get('ssl_score','?')}"
                    f", uptime:{s.get('uptime_score','?')}"
                    f", email:{s.get('email_sec_score','?')}"
                    f", brechas:{s.get('breach_score','?')}"
                )
                parts.append(score_detail)
        except Exception as exc:
            logger.warning("user_context: scores query failed", domain=dname, error=str(exc))

        domain_lines.append(f"- {dname}: {' | '.join(parts)}" if parts else f"- {dname}: sin datos aún")
        parts_log.append(dname)

    # 3. Active alerts
    try:
        al_res = (
            db.table("alerts")
            .select("severity, alert_type, title")
            .eq("user_id", user_id)
            .is_("read_at", "null")
            .eq("archived", False)
            .limit(50)
            .execute()
        )
        alerts = al_res.data or []
    except Exception as exc:
        logger.warning("user_context: alerts query failed", error=str(exc))
        alerts = []

    if alerts:
        by_sev = Counter(a.get("severity", "low") for a in alerts)
        sev_str = ", ".join(
            f"{by_sev[s]} {s}" for s in ["critical", "high", "medium", "low"] if by_sev.get(s)
        )
        # Also list alert types briefly
        by_type = Counter(a.get("alert_type", "unknown") for a in alerts)
        type_str = ", ".join(f"{v}×{k.replace('_',' ')}" for k, v in by_type.most_common(3))
        alert_line = f"Alertas activas: {len(alerts)} ({sev_str}) — tipos: {type_str}"
    else:
        alert_line = "Alertas activas: 0"

    # 4. Dark web breaches
    try:
        br_res = (
            db.table("breach_results")
            .select("breaches_found")
            .eq("user_id", user_id)
            .gt("breaches_found", 0)
            .execute()
        )
        total_breaches = sum(b.get("breaches_found", 0) for b in (br_res.data or []))
    except Exception as exc:
        logger.warning("user_context: breaches query failed", error=str(exc))
        total_breaches = 0

    # Assemble final context string
    lines = [
        "=== DATOS REALES DEL USUARIO EN CHRONOSHIELD ===",
        "(No pidas esta información al usuario, ya la tienes aquí)",
        "Dominios monitorizados:",
        *domain_lines,
        "",
        alert_line,
        f"Brechas dark web detectadas: {total_breaches}",
        "=== FIN DE DATOS ===",
    ]
    ctx = "\n".join(lines)
    logger.info("user_context: built successfully", domains=parts_log, alerts_count=len(alerts), breaches=total_breaches)
    return ctx


# ── Chat endpoint ───────────────────────────────────────────────────────────────
@router.post("/chat", response_model=MitigationChatResponse)
async def mitigation_chat(
    req: MitigationChatRequest,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    # 1. Check plan
    plan, limit = _get_plan_limit(db, user_id)
    if plan in ("trial", "free"):
        raise HTTPException(status_code=403, detail="plan_upgrade_required")
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

    # 3. Increment usage
    _get_and_increment_usage(db, user_id, current_count, month_start)

    # 4. Fetch alert context (only if alert_id provided)
    alert_context = ""
    if req.alert_id:
        alert_res = (
            db.table("alerts")
            .select("alert_type, severity, title, message, domain_id")
            .eq("id", req.alert_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not alert_res.data:
            raise HTTPException(status_code=404, detail="Alerta no encontrada")

        alert = alert_res.data[0]
        domain_name: str | None = None
        if alert.get("domain_id"):
            dom_res = db.table("domains").select("domain").eq("id", alert["domain_id"]).execute()
            if dom_res.data:
                domain_name = dom_res.data[0].get("domain")

        alert_context = (
            f"ALERTA ACTIVA:\n"
            f"- Tipo: {alert.get('alert_type', 'desconocido')}\n"
            f"- Severidad: {alert.get('severity', 'media')}\n"
            f"- Título: {alert.get('title', '')}\n"
            f"- Descripción: {alert.get('message', '')}"
            + (f"\n- Dominio afectado: {domain_name}" if domain_name else "")
        )

    try:
        # 5. Build dynamic system prompt with user context
        user_ctx = _build_user_context(db, user_id)
        system_prompt = _BASE_SYSTEM + ("\n\n" + user_ctx if user_ctx else "")

        # 6. Build messages (keep last 6 for token efficiency)
        history = req.conversation_history[-6:]
        messages: list[dict] = []

        if not history:
            content = (f"{alert_context}\n\nPregunta: {req.message}" if alert_context else req.message)
            messages.append({"role": "user", "content": content})
        else:
            for msg in history:
                messages.append({"role": msg.role, "content": msg.content})
            messages.append({"role": "user", "content": req.message})

        logger.info("mitigation_chat: calling ChronoAI", messages_count=len(messages))

        # 7. Call Claude Haiku
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        ai_response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            temperature=0,
            system=system_prompt,
            messages=messages,
        )

        logger.info("mitigation_chat: ChronoAI response OK", usage=str(ai_response.usage))

        return MitigationChatResponse(
            response=ai_response.content[0].text,
            usage_count=current_count + 1,
            usage_limit=limit,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Mitigation error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error en el asistente: {str(e)}")


# ── Usage endpoint ─────────────────────────────────────────────────────────────
@router.get("/usage")
async def get_mitigation_usage(
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
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


# ── Alerts summary endpoint ───────────────────────────────────────────────────
@router.get("/alerts-summary")
async def get_alerts_summary(
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    rows = (
        db.table("alerts")
        .select("alert_type, severity, title")
        .eq("user_id", user_id)
        .is_("read_at", "null")
        .neq("archived", True)
        .order("sent_at", desc=True)
        .limit(50)
        .execute()
        .data or []
    )

    if not rows:
        return {"summary": "No hay alertas activas actualmente.", "count": 0}

    by_severity = Counter(r.get("severity", "low") for r in rows)
    by_type = Counter(r.get("alert_type", "unknown") for r in rows)

    lines = [f"El usuario tiene {len(rows)} alerta(s) activa(s):"]
    for sev in ["critical", "high", "medium", "low"]:
        if by_severity.get(sev):
            lines.append(f"- {by_severity[sev]} alerta(s) de severidad {sev}")
    lines.append("Tipos de alertas:")
    for atype, count in by_type.most_common():
        lines.append(f"- {atype.replace('_', ' ')}: {count}")

    return {"summary": "\n".join(lines), "count": len(rows)}


# ── Chat Sessions ──────────────────────────────────────────────────────────────
@router.get("/chat-sessions", response_model=List[ChatSessionOut])
async def list_chat_sessions(
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Return saved chat sessions (without messages) for the sidebar."""
    res = (
        db.table("ai_chat_sessions")
        .select("id, title, created_at, updated_at")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .limit(MAX_CHAT_SESSIONS)
        .execute()
    )
    return [
        ChatSessionOut(
            id=r["id"],
            title=r["title"],
            created_at=r["created_at"],
            updated_at=r["updated_at"],
        )
        for r in (res.data or [])
    ]


@router.get("/chat-sessions/{session_id}", response_model=ChatSessionOut)
async def get_chat_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Load a full chat session including messages."""
    res = (
        db.table("ai_chat_sessions")
        .select("id, title, messages, created_at, updated_at")
        .eq("id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Session not found")
    r = res.data[0]
    return ChatSessionOut(
        id=r["id"],
        title=r["title"],
        messages=r.get("messages", []),
        created_at=r["created_at"],
        updated_at=r["updated_at"],
    )


@router.post("/chat-sessions", response_model=ChatSessionOut)
async def save_chat_session(
    payload: ChatSessionSave,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Create or update a chat session. Enforces MAX_CHAT_SESSIONS limit."""
    if payload.session_id:
        # Update existing
        res = (
            db.table("ai_chat_sessions")
            .update({"title": payload.title, "messages": payload.messages})
            .eq("id", payload.session_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="Session not found")
        r = res.data[0]
    else:
        # Enforce limit: delete oldest if at cap
        existing = (
            db.table("ai_chat_sessions")
            .select("id, updated_at")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .execute()
            .data or []
        )
        if len(existing) >= MAX_CHAT_SESSIONS:
            oldest_id = existing[-1]["id"]
            db.table("ai_chat_sessions").delete().eq("id", oldest_id).execute()

        # Insert new
        res = (
            db.table("ai_chat_sessions")
            .insert({
                "user_id": user_id,
                "title": payload.title[:80],          # cap title length
                "messages": payload.messages,
            })
            .execute()
        )
        r = res.data[0]

    return ChatSessionOut(
        id=r["id"],
        title=r["title"],
        messages=r.get("messages", []),
        created_at=r["created_at"],
        updated_at=r["updated_at"],
    )


@router.delete("/chat-sessions/{session_id}", status_code=204)
async def delete_chat_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    db.table("ai_chat_sessions").delete().eq("id", session_id).eq("user_id", user_id).execute()
