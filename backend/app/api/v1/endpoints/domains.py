from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from typing import List
from uuid import UUID
from app.core.security import get_current_user_id
from app.db.supabase import get_db
from app.schemas.domain import DomainCreate, DomainResponse, DomainWithMetrics
from app.services.scan_orchestrator import trigger_domain_scan
from app.services.credits_service import consume_credit

router = APIRouter(prefix="/domains", tags=["domains"])


@router.get("", response_model=List[DomainWithMetrics])
async def list_domains(
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """List all monitored domains with latest metrics."""
    result = db.table("domains").select("*").eq("user_id", user_id).eq("is_active", True).execute()
    domains = result.data

    enriched = []
    for d in domains:
        domain_id = d["id"]

        ssl = (
            db.table("ssl_results")
            .select("status,days_remaining")
            .eq("domain_id", domain_id)
            .order("scanned_at", desc=True)
            .limit(1)
            .execute()
            .data
        )
        uptime = (
            db.table("uptime_results")
            .select("status,response_time_ms")
            .eq("domain_id", domain_id)
            .order("checked_at", desc=True)
            .limit(1)
            .execute()
            .data
        )
        email_sec = (
            db.table("email_security_results")
            .select("spf_status,dkim_status,dmarc_status")
            .eq("domain_id", domain_id)
            .order("scanned_at", desc=True)
            .limit(1)
            .execute()
            .data
        )
        score = (
            db.table("security_scores")
            .select("overall_score")
            .eq("domain_id", domain_id)
            .order("calculated_at", desc=True)
            .limit(1)
            .execute()
            .data
        )

        enriched.append(
            DomainWithMetrics(
                **d,
                ssl_status=ssl[0]["status"] if ssl else None,
                ssl_days_remaining=ssl[0]["days_remaining"] if ssl else None,
                uptime_status=uptime[0]["status"] if uptime else None,
                last_response_ms=uptime[0]["response_time_ms"] if uptime else None,
                spf_status=email_sec[0]["spf_status"] if email_sec else None,
                dkim_status=email_sec[0]["dkim_status"] if email_sec else None,
                dmarc_status=email_sec[0]["dmarc_status"] if email_sec else None,
                security_score=score[0]["overall_score"] if score else None,
            )
        )

    return enriched


@router.post("", response_model=DomainResponse, status_code=201)
async def add_domain(
    payload: DomainCreate,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Add a new domain to monitor."""
    # Check plan limits
    sub = db.table("subscriptions").select("max_domains").eq("user_id", user_id).single().execute()
    if not sub.data:
        raise HTTPException(status_code=402, detail="No active subscription")

    current_count = (
        db.table("domains")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
        .count
    )
    if current_count >= sub.data["max_domains"]:
        raise HTTPException(
            status_code=402,
            detail=f"Plan limit reached ({sub.data['max_domains']} domains). Please upgrade.",
        )

    # Check duplicate
    existing = (
        db.table("domains")
        .select("id")
        .eq("user_id", user_id)
        .eq("domain", payload.domain)
        .execute()
        .data
    )
    if existing:
        raise HTTPException(status_code=409, detail="Domain already being monitored")

    result = db.table("domains").insert({"user_id": user_id, "domain": payload.domain}).execute()
    domain = result.data[0]

    # Kick off initial scans in background
    background_tasks.add_task(trigger_domain_scan, domain["id"], user_id)

    return DomainResponse(**domain)


@router.delete("/{domain_id}", status_code=204)
async def remove_domain(
    domain_id: UUID,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    result = (
        db.table("domains")
        .update({"is_active": False})
        .eq("id", str(domain_id))
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Domain not found")


@router.post("/{domain_id}/scan", status_code=202)
async def trigger_scan(
    domain_id: UUID,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Manually trigger a full scan for a domain. Costs 1 credit."""
    domain = (
        db.table("domains")
        .select("id")
        .eq("id", str(domain_id))
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not domain.data:
        raise HTTPException(status_code=404, detail="Domain not found")

    # Consume 1 credit — raises HTTP 402 with code NO_CREDITS if insufficient
    credits = consume_credit(user_id, db)

    background_tasks.add_task(trigger_domain_scan, str(domain_id), user_id)
    return {"message": "Scan initiated", "credits_remaining": credits["credits_available"]}
