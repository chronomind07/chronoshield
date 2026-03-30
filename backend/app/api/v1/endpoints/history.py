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

    # Pre-fetch domain map (id → domain name) — reused by sources 5 and 6
    domain_map: dict = {
        str(d["id"]): d["domain"]
        for d in (
            db.table("domains")
            .select("id,domain")
            .eq("user_id", user_id)
            .execute()
            .data or []
        )
    }

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

    # ── 5. Domain scan completions (from ssl_results as scan anchor) ────────────
    # ssl_results has one row per scan — using it as the history anchor instead of
    # security_scores (which is now a single UPSERT row per domain, not a log).
    if not category or category == "domain":
        ssl_q = (
            db.table("ssl_results")
            .select("id,domain_id,status,valid_until,scanned_at")
            .eq("user_id", user_id)
        )
        if date_filter and cutoff:
            ssl_q = ssl_q.gte("scanned_at", cutoff)
        ssl_rows = ssl_q.order("scanned_at", desc=True).limit(200).execute().data or []

        # Current scores keyed by domain_id
        score_map: dict = {}
        score_rows = (
            db.table("security_scores")
            .select("domain_id,overall_score,grade,ssl_score,uptime_score,email_sec_score,breach_score")
            .eq("user_id", user_id)
            .execute()
            .data or []
        )
        for sr in score_rows:
            score_map[sr["domain_id"]] = sr

        for r in ssl_rows:
            did = r.get("domain_id")
            if not did or str(did) not in domain_map:
                continue
            if category and category != "domain":
                continue
            dname = domain_map[str(did)]
            sc = score_map.get(did, {})
            overall = sc.get("overall_score")
            grade = sc.get("grade", "—")
            score_label = f"{grade} · {overall}/100" if overall is not None else "Sin score"
            ssl_ok = r.get("status") == "valid"
            has_problem = not ssl_ok
            if problems_only and not has_problem:
                continue
            entries.append(HistoryEntry(
                id=r["id"],
                event_type="domain_scan",
                category="domain",
                icon="🌐",
                title=f"Escaneo completado — {dname}",
                subject=dname,
                occurred_at=r["scanned_at"],
                scan_mode="auto",
                status="ok" if not has_problem else "warning",
                status_label=score_label,
                details={
                    "ssl_status":       r.get("status"),
                    "ssl_valid_until":  r.get("valid_until"),
                    "overall_score":    overall,
                    "grade":            grade,
                    "ssl_score":        sc.get("ssl_score", 0),
                    "uptime_score":     sc.get("uptime_score", 0),
                    "email_sec_score":  sc.get("email_sec_score", 0),
                    "breach_score":     sc.get("breach_score", 0),
                    # Human-readable labels for the chip row
                    "ssl_label":        r.get("status", "—"),
                    "uptime_label":     f"{sc.get('uptime_score', 0)}/100",
                    "email_label":      f"{sc.get('email_sec_score', 0)}/100",
                    "breach_label":     f"{sc.get('breach_score', 0)}/100",
                },
            ))

    # ── 6. Email DNS scans (from email_security_results) ──────────────────────
    if not category or category == "email":
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
            dname = domain_map.get(str(r.get("domain_id", "")), "dominio")
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
