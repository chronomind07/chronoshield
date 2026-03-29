"""
History endpoint — unified timeline of all security events.

Sources (all read-only):
  1. domains           → domain_added events
  2. monitored_emails  → email_added events + manual email DNS scans
  3. alerts            → alert_generated events
  4. dark_web_results  → darkweb_scan events
  5. security_scores   → domain_scan events (aggregated scan results)
  6. email_security_results → email_security events (per-domain DNS scans)
"""
from fastapi import APIRouter, Depends
from app.core.security import get_current_user_id
from app.db.supabase import get_db
from typing import Optional, List, Any
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/history", tags=["history"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class HistoryEntry(BaseModel):
    id: str
    event_type: str        # domain_scan | email_dns | darkweb_scan | alert_generated | domain_added | email_added
    category: str          # domain | email | darkweb | system
    icon: str              # emoji icon
    title: str
    subject: str           # domain name or email address scanned
    occurred_at: str
    scan_mode: str         # auto | manual | system
    status: str            # ok | warning | critical
    status_label: str
    details: dict          # scan-specific details for expanded view


class HistoryResponse(BaseModel):
    total: int
    page: int
    per_page: int
    entries: List[HistoryEntry]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _cutoff(date_filter: str) -> Optional[str]:
    now = datetime.now(timezone.utc)
    if date_filter == "week":
        return (now - timedelta(days=7)).isoformat()
    if date_filter == "month":
        return (now - timedelta(days=30)).isoformat()
    return None  # "all"


def _dns_status(spf: Any, dkim: Any, dmarc: Any) -> tuple[str, str]:
    """Return (status, label) based on DNS check results."""
    all_valid = (spf == "valid" and dkim == "valid" and dmarc == "valid")
    any_bad   = any(v in ("invalid", "missing") for v in [spf, dkim, dmarc] if v)
    if all_valid:
        return "ok", "Todo OK"
    if any_bad:
        return "warning", "Atención"
    return "ok", "Verificado"


def _score_status(score: int) -> tuple[str, str]:
    if score >= 80:
        return "ok", f"Score {score}"
    if score >= 60:
        return "warning", f"Score {score}"
    return "critical", f"Score {score}"


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.get("", response_model=HistoryResponse)
async def get_history(
    date_filter: str = "month",          # week | month | all
    category: Optional[str] = None,      # domain | email | darkweb | system
    problems_only: bool = False,         # if true, only warning + critical
    page: int = 1,
    per_page: int = 30,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    cutoff = _cutoff(date_filter)
    entries: List[HistoryEntry] = []

    # ── 1. Domains added ──────────────────────────────────────────────────────
    if not category or category == "system":
        q = db.table("domains").select("id,domain,created_at").eq("user_id", user_id)
        if cutoff:
            q = q.gte("created_at", cutoff)
        rows = q.order("created_at", desc=True).limit(100).execute().data or []
        for r in rows:
            entries.append(HistoryEntry(
                id=f"da_{r['id']}",
                event_type="domain_added",
                category="system",
                icon="🌐",
                title="Dominio añadido",
                subject=r["domain"],
                occurred_at=r["created_at"],
                scan_mode="system",
                status="ok",
                status_label="Configurado",
                details={"domain": r["domain"]},
            ))

    # ── 2. Emails added ───────────────────────────────────────────────────────
    if not category or category == "system":
        q = db.table("monitored_emails").select("id,email,created_at").eq("user_id", user_id)
        if cutoff:
            q = q.gte("created_at", cutoff)
        rows = q.order("created_at", desc=True).limit(100).execute().data or []
        for r in rows:
            entries.append(HistoryEntry(
                id=f"ea_{r['id']}",
                event_type="email_added",
                category="system",
                icon="📧",
                title="Email añadido",
                subject=r["email"],
                occurred_at=r["created_at"],
                scan_mode="system",
                status="ok",
                status_label="Configurado",
                details={"email": r["email"]},
            ))

    # ── 3. Alerts ─────────────────────────────────────────────────────────────
    if not category or category == "system":
        q = (
            db.table("alerts")
            .select("id,alert_type,severity,title,message,sent_at,metadata")
            .eq("user_id", user_id)
        )
        if cutoff:
            q = q.gte("sent_at", cutoff)
        rows = q.order("sent_at", desc=True).limit(200).execute().data or []
        for r in rows:
            sev = r.get("severity", "low")
            status = "critical" if sev == "critical" else "warning"
            meta = r.get("metadata") or {}
            entries.append(HistoryEntry(
                id=f"al_{r['id']}",
                event_type="alert_generated",
                category="system",
                icon="⚡",
                title=r.get("title") or "Alerta de seguridad",
                subject=meta.get("domain") or meta.get("email") or "—",
                occurred_at=r["sent_at"],
                scan_mode="auto",
                status=status,
                status_label=sev.capitalize(),
                details={
                    "alert_type": r.get("alert_type"),
                    "severity":   sev,
                    "message":    r.get("message", ""),
                    "metadata":   meta,
                },
            ))

    # ── 4. Dark Web scans ─────────────────────────────────────────────────────
    if not category or category == "darkweb":
        q = (
            db.table("dark_web_results")
            .select("id,scan_type,query_value,total_results,results,is_manual,scanned_at")
            .eq("user_id", user_id)
        )
        if cutoff:
            q = q.gte("scanned_at", cutoff)
        rows = q.order("scanned_at", desc=True).limit(200).execute().data or []
        SCAN_TYPE_LABELS = {
            "email_breach":  "Filtración de email",
            "domain_breach": "Dominio en dark web",
            "typosquatting": "Suplantación de empresa",
        }
        for r in rows:
            total    = r.get("total_results", 0)
            is_man   = r.get("is_manual", False)
            st_label = SCAN_TYPE_LABELS.get(r.get("scan_type", ""), "Escaneo Dark Web")
            status   = "critical" if total > 0 else "ok"
            entries.append(HistoryEntry(
                id=f"dw_{r['id']}",
                event_type="darkweb_scan",
                category="darkweb",
                icon="🕵️",
                title=f"Dark Web — {st_label}",
                subject=r.get("query_value", "—"),
                occurred_at=r["scanned_at"],
                scan_mode="manual" if is_man else "auto",
                status=status,
                status_label=f"{total} hallazgo{'s' if total != 1 else ''}" if total > 0 else "Limpio",
                details={
                    "scan_type":     r.get("scan_type"),
                    "total_results": total,
                    "findings":      (r.get("results") or [])[:5],  # first 5 findings
                },
            ))

    # ── 5. Domain scan completions (from security_scores) ─────────────────────
    if not category or category == "domain":
        sq = (
            db.table("security_scores")
            .select("id,domain_id,overall_score,ssl_score,uptime_score,email_sec_score,breach_score,grade,calculated_at")
            .eq("user_id", user_id)
        )
        if cutoff:
            sq = sq.gte("calculated_at", cutoff)
        score_rows = sq.order("calculated_at", desc=True).limit(500).execute().data or []

        # Batch-fetch domain names
        d_ids = list({str(r["domain_id"]) for r in score_rows if r.get("domain_id")})
        d_map: dict = {}
        if d_ids:
            d_rows = db.table("domains").select("id,domain").in_("id", d_ids).execute().data or []
            d_map = {str(r["id"]): r["domain"] for r in d_rows}

        for r in score_rows:
            score      = r.get("overall_score", 0)
            ssl_s      = r.get("ssl_score", 0)
            up_s       = r.get("uptime_score", 0)
            em_s       = r.get("email_sec_score", 0)
            br_s       = r.get("breach_score", 0)
            grade      = r.get("grade", "")
            dname      = d_map.get(str(r.get("domain_id", "")), "dominio")

            status, status_label = _score_status(score)

            entries.append(HistoryEntry(
                id=f"sc_{r['id']}",
                event_type="domain_scan",
                category="domain",
                icon="🌐",
                title=f"Escaneo completado — {dname}",
                subject=dname,
                occurred_at=r["calculated_at"],
                scan_mode="auto",
                status=status,
                status_label=f"{grade} · {score}/100" if grade else f"{score}/100",
                details={
                    "overall_score":  score,
                    "grade":          grade,
                    "ssl_score":      ssl_s,
                    "uptime_score":   up_s,
                    "email_sec_score": em_s,
                    "breach_score":   br_s,
                    # Human-readable summaries
                    "ssl_label":    "SSL válido" if ssl_s >= 100 else ("SSL expirando" if ssl_s >= 40 else "SSL inválido"),
                    "uptime_label": f"Uptime {up_s}%",
                    "email_label":  "DNS OK" if em_s >= 100 else ("DNS parcial" if em_s >= 34 else "DNS sin configurar"),
                    "breach_label": "Sin brechas" if br_s >= 100 else "Brechas detectadas",
                },
            ))

    # ── 6. Email DNS scans (from email_security_results) ──────────────────────
    if not category or category == "email":
        # Batch-fetch domain names mapping id→domain for context
        dom_rows = (
            db.table("domains")
            .select("id,domain")
            .eq("user_id", user_id)
            .execute()
            .data
        ) or []
        dom_id_map = {str(r["id"]): r["domain"] for r in dom_rows}

        eq = (
            db.table("email_security_results")
            .select("id,domain_id,spf_status,dkim_status,dmarc_status,spf_record,dkim_record,dmarc_record,scanned_at")
            .eq("user_id", user_id)
        )
        if cutoff:
            eq = eq.gte("scanned_at", cutoff)
        erows = eq.order("scanned_at", desc=True).limit(300).execute().data or []
        for r in erows:
            spf   = r.get("spf_status")
            dkim  = r.get("dkim_status")
            dmarc = r.get("dmarc_status")
            dname = dom_id_map.get(str(r.get("domain_id", "")), "dominio")
            status, status_label = _dns_status(spf, dkim, dmarc)
            entries.append(HistoryEntry(
                id=f"es_{r['id']}",
                event_type="email_dns",
                category="email",
                icon="📧",
                title=f"DNS verificado — {dname}",
                subject=dname,
                occurred_at=r["scanned_at"],
                scan_mode="auto",
                status=status,
                status_label=status_label,
                details={
                    "spf_status":   spf,
                    "dkim_status":  dkim,
                    "dmarc_status": dmarc,
                    "spf_record":   r.get("spf_record"),
                    "dkim_record":  r.get("dkim_record"),
                    "dmarc_record": r.get("dmarc_record"),
                },
            ))

    # ── 7. Manual email DNS scans (from monitored_emails.last_email_sec_scan_at) ─
    if not category or category == "email":
        me_q = (
            db.table("monitored_emails")
            .select("id,email,spf_status,dkim_status,dmarc_status,last_email_sec_scan_at")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .not_.is_("last_email_sec_scan_at", "null")
        )
        if cutoff:
            me_q = me_q.gte("last_email_sec_scan_at", cutoff)
        me_rows = me_q.execute().data or []
        for r in me_rows:
            spf   = r.get("spf_status")
            dkim  = r.get("dkim_status")
            dmarc = r.get("dmarc_status")
            email = r.get("email", "—")
            status, status_label = _dns_status(spf, dkim, dmarc)
            entries.append(HistoryEntry(
                id=f"me_{r['id']}",
                event_type="email_dns",
                category="email",
                icon="📧",
                title=f"DNS verificado — {email}",
                subject=email,
                occurred_at=r["last_email_sec_scan_at"],
                scan_mode="manual",
                status=status,
                status_label=status_label,
                details={
                    "email":        email,
                    "spf_status":   spf,
                    "dkim_status":  dkim,
                    "dmarc_status": dmarc,
                },
            ))

    # ── Sort, filter, paginate ─────────────────────────────────────────────────
    entries.sort(key=lambda e: e.occurred_at, reverse=True)

    if problems_only:
        entries = [e for e in entries if e.status in ("warning", "critical")]

    total = len(entries)
    offset = (page - 1) * per_page
    page_entries = entries[offset: offset + per_page]

    return HistoryResponse(total=total, page=page, per_page=per_page, entries=page_entries)
