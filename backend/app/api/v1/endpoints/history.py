from fastapi import APIRouter, Depends
from app.core.security import get_current_user_id
from app.db.supabase import get_db
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/history", tags=["history"])

# ── Schemas ───────────────────────────────────────────────────────────────────
class HistoryEntry(BaseModel):
    id: str
    event_type: str          # domain_added | email_added | alert_generated | darkweb_scan | credit_purchase | auto_scan
    icon: str
    title: str
    description: str
    result: str              # "clean" | "findings" | "ok" | "info"
    result_label: str
    origin: str              # "automatic" | "manual" | "system"
    origin_label: str
    occurred_at: str


class HistoryResponse(BaseModel):
    total: int
    page: int
    per_page: int
    entries: List[HistoryEntry]


# ── Helpers ───────────────────────────────────────────────────────────────────
EVENT_ICONS = {
    "domain_added":       "◎",
    "email_added":        "✉",
    "alert_generated":    "⚡",
    "darkweb_scan":       "🕸",
    "auto_scan":          "⟳",
    "credit_purchase":    "💳",
    "scan_success":       "✓",
    "scan_warning":       "⚠",
}

RESULT_COLORS = {
    "clean":    "#00E5A0",
    "findings": "#FF4D6A",
    "ok":       "#00C2FF",
    "info":     "#5A6B7A",
}

ORIGIN_LABELS = {
    "automatic": "Automático",
    "manual":    "Manual",
    "system":    "Sistema",
}

SEVERITY_EMOJI = {
    "critical": "🔴",
    "high":     "🟠",
    "medium":   "🟡",
    "low":      "🔵",
}


def _cutoff(date_filter: str) -> Optional[str]:
    now = datetime.now(timezone.utc)
    if date_filter == "week":
        return (now - timedelta(days=7)).isoformat()
    if date_filter == "month":
        return (now - timedelta(days=30)).isoformat()
    return None  # "all"


# ── Endpoint ──────────────────────────────────────────────────────────────────
@router.get("", response_model=HistoryResponse)
async def get_history(
    date_filter: str = "month",   # week | month | all
    event_type: Optional[str] = None,  # domain_added | email_added | alert_generated | darkweb_scan | auto_scan
    page: int = 1,
    per_page: int = 20,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    cutoff = _cutoff(date_filter)
    entries: List[HistoryEntry] = []

    # ── 1. Domains added ──────────────────────────────────────────────────────
    if not event_type or event_type == "domain_added":
        q = db.table("domains").select("id, domain, created_at").eq("user_id", user_id)
        if cutoff:
            q = q.gte("created_at", cutoff)
        rows = q.order("created_at", desc=True).limit(50).execute().data or []
        for r in rows:
            entries.append(HistoryEntry(
                id=f"domain_{r['id']}",
                event_type="domain_added",
                icon=EVENT_ICONS["domain_added"],
                title="Dominio añadido",
                description=f"Se añadió {r['domain']} a la monitorización.",
                result="ok",
                result_label="Configurado",
                origin="system",
                origin_label=ORIGIN_LABELS["system"],
                occurred_at=r["created_at"],
            ))

    # ── 2. Emails added ───────────────────────────────────────────────────────
    if not event_type or event_type == "email_added":
        q = db.table("monitored_emails").select("id, email, created_at").eq("user_id", user_id)
        if cutoff:
            q = q.gte("created_at", cutoff)
        rows = q.order("created_at", desc=True).limit(50).execute().data or []
        for r in rows:
            entries.append(HistoryEntry(
                id=f"email_{r['id']}",
                event_type="email_added",
                icon=EVENT_ICONS["email_added"],
                title="Email añadido",
                description=f"Se añadió {r['email']} a la monitorización.",
                result="ok",
                result_label="Configurado",
                origin="system",
                origin_label=ORIGIN_LABELS["system"],
                occurred_at=r["created_at"],
            ))

    # ── 3. Alerts generated ───────────────────────────────────────────────────
    if not event_type or event_type == "alert_generated":
        q = (
            db.table("alerts")
            .select("id, alert_type, severity, title, message, sent_at")
            .eq("user_id", user_id)
        )
        if cutoff:
            q = q.gte("sent_at", cutoff)
        rows = q.order("sent_at", desc=True).limit(100).execute().data or []
        for r in rows:
            sev = r.get("severity", "low")
            emoji = SEVERITY_EMOJI.get(sev, "🔵")
            entries.append(HistoryEntry(
                id=f"alert_{r['id']}",
                event_type="alert_generated",
                icon=EVENT_ICONS["alert_generated"],
                title=f"{emoji} Alerta generada",
                description=r.get("title", "Alerta de seguridad") + " — " + r.get("message", ""),
                result="findings",
                result_label="Atención requerida",
                origin="automatic",
                origin_label=ORIGIN_LABELS["automatic"],
                occurred_at=r["sent_at"],
            ))

    # ── 4. Dark web scans ─────────────────────────────────────────────────────
    if not event_type or event_type in ("darkweb_scan", "auto_scan"):
        q = (
            db.table("dark_web_results")
            .select("id, scan_type, query_value, total_results, is_manual, scanned_at")
            .eq("user_id", user_id)
        )
        if cutoff:
            q = q.gte("scanned_at", cutoff)
        # Filter by event_type if specified
        if event_type == "auto_scan":
            q = q.eq("is_manual", False)
        elif event_type == "darkweb_scan":
            q = q.eq("is_manual", True)
        rows = q.order("scanned_at", desc=True).limit(100).execute().data or []

        scan_type_labels = {
            "email_breach":  "Filtración de email",
            "domain_breach": "Dominio en dark web",
            "typosquatting": "Suplantación de empresa",
        }
        for r in rows:
            is_manual = r.get("is_manual", False)
            total = r.get("total_results", 0)
            scan_label = scan_type_labels.get(r.get("scan_type", ""), "Escaneo Dark Web")
            entries.append(HistoryEntry(
                id=f"dw_{r['id']}",
                event_type="darkweb_scan" if is_manual else "auto_scan",
                icon=EVENT_ICONS["darkweb_scan"],
                title=f"Escaneo Dark Web — {scan_label}",
                description=(
                    f"Escaneado: {r.get('query_value', 'N/A')}. "
                    f"{'Se encontraron ' + str(total) + ' resultado' + ('s' if total != 1 else '') + ' en la dark web.' if total > 0 else 'Sin hallazgos en la dark web.'}"
                ),
                result="findings" if total > 0 else "clean",
                result_label=f"{total} hallazgo{'s' if total != 1 else ''}" if total > 0 else "Limpio",
                origin="manual" if is_manual else "automatic",
                origin_label=ORIGIN_LABELS["manual" if is_manual else "automatic"],
                occurred_at=r["scanned_at"],
            ))

    # ── 5. Scan completions (from security_scores — every score row = one scan) ──
    if not event_type or event_type in ("scan_success", "scan_warning"):
        sq = (
            db.table("security_scores")
            .select("id,domain_id,overall_score,ssl_score,uptime_score,email_sec_score,breach_score,grade,calculated_at")
            .eq("user_id", user_id)
        )
        if cutoff:
            sq = sq.gte("calculated_at", cutoff)
        score_rows = sq.order("calculated_at", desc=True).limit(200).execute().data or []

        # Batch-fetch domain names
        d_ids = list({str(r["domain_id"]) for r in score_rows if r.get("domain_id")})
        d_map: dict = {}
        if d_ids:
            d_rows = db.table("domains").select("id,domain").in_("id", d_ids).execute().data or []
            d_map = {str(r["id"]): r["domain"] for r in d_rows}

        for r in score_rows:
            score   = r.get("overall_score", 0)
            grade   = r.get("grade", "")
            dname   = d_map.get(str(r.get("domain_id", "")), "dominio")
            ssl_s   = r.get("ssl_score", 0)
            up_s    = r.get("uptime_score", 0)
            em_s    = r.get("email_sec_score", 0)
            br_s    = r.get("breach_score", 0)

            parts: list = []
            if ssl_s >= 100:  parts.append("SSL válido")
            elif ssl_s >= 40: parts.append("SSL expirando pronto")
            else:             parts.append("SSL inválido")

            if em_s >= 100:   parts.append("SPF/DKIM/DMARC configurados")
            elif em_s >= 67:  parts.append("email parcialmente configurado")
            else:             parts.append("email sin configurar")

            if up_s >= 100:   parts.append("uptime 100%")
            elif up_s >= 80:  parts.append(f"uptime {up_s}%")
            else:             parts.append(f"uptime bajo ({up_s}%)")

            if br_s >= 100:   parts.append("sin brechas detectadas")
            else:             parts.append("brechas detectadas")

            is_ok = score >= 90 and em_s >= 100
            desc = (
                f"Escaneo completado: {dname} — {', '.join(parts)}. Nivel de seguridad: Excelente."
                if is_ok else
                f"Escaneo completado: {dname} — {', '.join(parts)}. Requiere atención."
            )
            etype = "scan_success" if is_ok else "scan_warning"
            if event_type and event_type != etype:
                continue

            entries.append(HistoryEntry(
                id=f"scan_{r['id']}",
                event_type=etype,
                icon=EVENT_ICONS[etype],
                title=f"Escaneo completado — {dname}",
                description=desc,
                result="clean" if is_ok else "warn",
                result_label=f"Score {score} · {grade}" if grade else f"Score {score}",
                origin="automatic",
                origin_label=ORIGIN_LABELS["automatic"],
                occurred_at=r["calculated_at"],
            ))

    # ── Sort all entries by date desc ─────────────────────────────────────────
    entries.sort(key=lambda e: e.occurred_at, reverse=True)

    # ── Paginate ──────────────────────────────────────────────────────────────
    total = len(entries)
    offset = (page - 1) * per_page
    page_entries = entries[offset: offset + per_page]

    return HistoryResponse(
        total=total,
        page=page,
        per_page=per_page,
        entries=page_entries,
    )
