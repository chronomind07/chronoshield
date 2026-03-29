from fastapi import APIRouter, Depends
from app.core.security import get_current_user_id
from app.db.supabase import get_db
from app.schemas.dashboard import DashboardSummary, SecurityScoreResponse, AlertResponse
from typing import List
from uuid import UUID

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    domains = (
        db.table("domains")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
    )
    emails = (
        db.table("monitored_emails")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
    )
    active_alerts = (
        db.table("alerts")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .is_("read_at", "null")
        .execute()
    )

    # Domains with SSL issues
    ssl_issues = (
        db.table("ssl_results")
        .select("domain_id")
        .eq("user_id", user_id)
        .in_("status", ["expiring_soon", "expired", "invalid", "no_ssl"])
        .execute()
        .data
    )
    ssl_issue_count = len({r["domain_id"] for r in ssl_issues})

    # Domains currently down
    down_domains = (
        db.table("uptime_results")
        .select("domain_id")
        .eq("user_id", user_id)
        .eq("status", "down")
        .execute()
        .data
    )
    down_count = len({r["domain_id"] for r in down_domains})

    # Breached queries — read from dark_web_results (current scanner).
    # Use only the latest result per query_value; count those with total_results > 0.
    dw_rows = (
        db.table("dark_web_results")
        .select("query_value,total_results,scanned_at")
        .eq("user_id", user_id)
        .in_("scan_type", ["email_breach", "domain_breach"])
        .order("scanned_at", desc=True)
        .execute()
        .data
    ) or []
    seen_dw: dict = {}
    for r in dw_rows:
        qv = r["query_value"]
        if qv not in seen_dw:
            seen_dw[qv] = r
    breached_count = sum(1 for r in seen_dw.values() if (r.get("total_results") or 0) > 0)

    # Average scores — use only the LATEST score per domain (avoid stale historical averages)
    all_scores = (
        db.table("security_scores")
        .select("domain_id,overall_score,ssl_score,uptime_score,email_sec_score,breach_score,calculated_at")
        .eq("user_id", user_id)
        .order("calculated_at", desc=True)
        .execute()
        .data
    ) or []
    # Keep only the most-recent row per domain_id
    seen_domains: set = set()
    latest_scores = []
    for s in all_scores:
        did = str(s.get("domain_id") or "")
        if did not in seen_domains:
            seen_domains.add(did)
            latest_scores.append(s)
    n = len(latest_scores)
    avg_score     = int(sum(s["overall_score"]  for s in latest_scores) / n) if n else 0
    avg_ssl       = int(sum(s["ssl_score"]       for s in latest_scores) / n) if n else 0
    avg_uptime    = int(sum(s["uptime_score"]    for s in latest_scores) / n) if n else 0
    avg_email_sec = int(sum(s["email_sec_score"] for s in latest_scores) / n) if n else 0
    avg_breach    = int(sum(s["breach_score"]    for s in latest_scores) / n) if n else 0

    # Recent alerts
    recent_alerts_data = (
        db.table("alerts")
        .select("*")
        .eq("user_id", user_id)
        .order("sent_at", desc=True)
        .limit(10)
        .execute()
        .data
    )

    return DashboardSummary(
        domains_monitored=domains.count or 0,
        emails_monitored=emails.count or 0,
        active_alerts=active_alerts.count or 0,
        average_score=avg_score,
        domains_with_ssl_issues=ssl_issue_count,
        domains_down=down_count,
        breached_emails=breached_count,
        recent_alerts=[AlertResponse(**a) for a in recent_alerts_data],
        avg_ssl_score=avg_ssl,
        avg_uptime_score=avg_uptime,
        avg_email_sec_score=avg_email_sec,
        avg_breach_score=avg_breach,
    )


@router.get("/scores", response_model=List[SecurityScoreResponse])
async def get_scores(
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    scores = (
        db.table("security_scores")
        .select("*")
        .eq("user_id", user_id)
        .order("calculated_at", desc=True)
        .execute()
        .data
    )
    return [SecurityScoreResponse(**s) for s in scores]


@router.get("/alerts", response_model=List[AlertResponse])
async def get_alerts(
    unread_only: bool = False,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    query = db.table("alerts").select("*").eq("user_id", user_id).order("sent_at", desc=True)
    if unread_only:
        query = query.is_("read_at", "null")
    return [AlertResponse(**a) for a in query.execute().data]


@router.patch("/alerts/{alert_id}/read", status_code=204)
async def mark_alert_read(
    alert_id: UUID,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    from datetime import datetime, timezone
    db.table("alerts").update({"read_at": datetime.now(timezone.utc).isoformat()}).eq(
        "id", str(alert_id)
    ).eq("user_id", user_id).execute()
