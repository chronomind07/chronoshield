from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from typing import List
from uuid import UUID

import structlog
from app.core.security import get_current_user_id
from app.db.supabase import get_db
from app.schemas.domain import DomainCreate, DomainResponse, DomainWithMetrics
from app.services.scan_orchestrator import trigger_domain_scan
from app.services.credits_service import consume_credit

router = APIRouter(prefix="/domains", tags=["domains"])
logger = structlog.get_logger()


def _strip_domain(raw: str) -> str:
    """Normalise user-supplied domain: remove protocol, www., trailing slash, lowercase."""
    d = raw.strip()
    if d.lower().startswith("https://"):
        d = d[8:]
    elif d.lower().startswith("http://"):
        d = d[7:]
    if d.lower().startswith("www."):
        d = d[4:]
    return d.rstrip("/").lower()


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

        # Compute last_scanned_at: prefer domain's own field, fall back to max of scan result timestamps
        candidates = []
        if d.get("last_scanned_at"):
            candidates.append(d["last_scanned_at"])
        if ssl:
            ssl_ts = (db.table("ssl_results").select("scanned_at").eq("domain_id", domain_id)
                      .order("scanned_at", desc=True).limit(1).execute().data)
            if ssl_ts:
                candidates.append(ssl_ts[0]["scanned_at"])
        if uptime:
            up_ts = (db.table("uptime_results").select("checked_at").eq("domain_id", domain_id)
                     .order("checked_at", desc=True).limit(1).execute().data)
            if up_ts:
                candidates.append(up_ts[0]["checked_at"])
        computed_last_scan = max(candidates) if candidates else None

        enriched.append(
            DomainWithMetrics(
                **{k: v for k, v in d.items() if k != "last_scanned_at"},
                last_scanned_at=computed_last_scan,
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
    # BUG-2: Strip www. prefix and normalise before saving
    clean_domain = _strip_domain(payload.domain)
    if not clean_domain:
        raise HTTPException(status_code=422, detail="Nombre de dominio inválido")

    logger.info("add_domain", raw=payload.domain, clean=clean_domain, user_id=user_id)

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

    # Check duplicate — only among *active* domains for this user.
    # Soft-deleted rows (is_active=False) are not counted; we reactivate them instead.
    existing_active = (
        db.table("domains")
        .select("id")
        .eq("user_id", user_id)
        .eq("domain", clean_domain)
        .eq("is_active", True)
        .execute()
        .data
    )
    if existing_active:
        raise HTTPException(status_code=409, detail="Domain already being monitored")

    # If a soft-deleted row exists for this (user_id, domain) reactivate it
    # instead of inserting a new row (avoids DB unique-constraint conflicts).
    existing_inactive = (
        db.table("domains")
        .select("id")
        .eq("user_id", user_id)
        .eq("domain", clean_domain)
        .eq("is_active", False)
        .execute()
        .data
    )
    if existing_inactive:
        result = (
            db.table("domains")
            .update({"is_active": True})
            .eq("id", existing_inactive[0]["id"])
            .execute()
        )
        domain = result.data[0]
    else:
        result = db.table("domains").insert({"user_id": user_id, "domain": clean_domain}).execute()
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
    did = str(domain_id)

    # Soft-delete the domain row
    result = (
        db.table("domains")
        .update({"is_active": False})
        .eq("id", did)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Domain not found")

    # BUG-1: Cascade-delete all scan results so they don't appear in NIS2/reports
    for scan_table in (
        "ssl_results",
        "email_security_results",
        "uptime_results",
        "security_scores",
        "ai_analyses",
    ):
        try:
            db.table(scan_table).delete().eq("domain_id", did).execute()
        except Exception as exc:
            logger.warning("cascade delete partial failure", table=scan_table, domain_id=did, error=str(exc))

    # Remove domain-specific alerts
    try:
        db.table("alerts").delete().eq("domain_id", did).eq("user_id", user_id).execute()
    except Exception as exc:
        logger.warning("cascade delete alerts failure", domain_id=did, error=str(exc))


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
