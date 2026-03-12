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

    # Breached emails
    breached = (
        db.table("breach_results")
        .select("email_id")
        .eq("user_id", user_id)
        .gt("breaches_found", 0)
        .execute()
        .data
    )
    breached_count = len({r["email_id"] for r in breached})

    # Average score
    scores = (
        db.table("security_scores")
        .select("overall_score")
        .eq("user_id", user_id)
        .execute()
        .data
    )
    avg_score = int(sum(s["overall_score"] for s in scores) / len(scores)) if scores else 0

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
