from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from typing import List
from uuid import UUID
from app.core.security import get_current_user_id
from app.db.supabase import get_db
from app.schemas.email import EmailCreate, EmailResponse, EmailWithBreaches
from app.workers.breach.scanner import scan_email_breaches
from app.services.credits_service import consume_credit

router = APIRouter(prefix="/emails", tags=["emails"])


@router.get("", response_model=List[EmailWithBreaches])
async def list_emails(
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    emails = (
        db.table("monitored_emails")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
        .data
    )

    enriched = []
    for e in emails:
        breaches = (
            db.table("breach_results")
            .select("*")
            .eq("email_id", e["id"])
            .order("scanned_at", desc=True)
            .limit(1)
            .execute()
            .data
        )
        total = (
            db.table("breach_results")
            .select("breaches_found")
            .eq("email_id", e["id"])
            .order("scanned_at", desc=True)
            .limit(1)
            .execute()
            .data
        )
        enriched.append(
            EmailWithBreaches(
                **e,
                latest_breach=breaches[0] if breaches else None,
                total_breaches=total[0]["breaches_found"] if total else 0,
            )
        )
    return enriched


@router.post("", response_model=EmailResponse, status_code=201)
async def add_email(
    payload: EmailCreate,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    sub = db.table("subscriptions").select("max_emails").eq("user_id", user_id).single().execute()
    if not sub.data:
        raise HTTPException(status_code=402, detail="No active subscription")

    current_count = (
        db.table("monitored_emails")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
        .count
    )
    if current_count >= sub.data["max_emails"]:
        raise HTTPException(
            status_code=402,
            detail=f"Plan limit reached ({sub.data['max_emails']} emails). Please upgrade.",
        )

    existing = (
        db.table("monitored_emails")
        .select("id, is_active")
        .eq("user_id", user_id)
        .eq("email", str(payload.email))
        .execute()
        .data
    )
    if existing:
        record = existing[0]
        if record["is_active"]:
            raise HTTPException(status_code=409, detail="Email already monitored")
        # Email was previously deleted — reactivate instead of inserting
        result = (
            db.table("monitored_emails")
            .update({"is_active": True})
            .eq("id", record["id"])
            .execute()
        )
        email = result.data[0]
        background_tasks.add_task(scan_email_breaches, email["id"], str(payload.email), user_id)
        return EmailResponse(**email)

    result = (
        db.table("monitored_emails")
        .insert({"user_id": user_id, "email": str(payload.email)})
        .execute()
    )
    email = result.data[0]
    background_tasks.add_task(scan_email_breaches, email["id"], str(payload.email), user_id)
    return EmailResponse(**email)


@router.post("/{email_id}/scan", status_code=202)
async def trigger_email_scan(
    email_id: UUID,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Manually trigger a breach scan for an email. Costs 1 credit."""
    email_row = (
        db.table("monitored_emails")
        .select("id,email")
        .eq("id", str(email_id))
        .eq("user_id", user_id)
        .eq("is_active", True)
        .single()
        .execute()
    )
    if not email_row.data:
        raise HTTPException(status_code=404, detail="Email not found")

    # Consume 1 credit — raises HTTP 402 with code NO_CREDITS if insufficient
    credits = consume_credit(user_id, db)

    background_tasks.add_task(
        scan_email_breaches,
        str(email_id),
        email_row.data["email"],
        user_id,
    )
    return {"message": "Scan initiated", "credits_remaining": credits["credits_available"]}


@router.delete("/{email_id}", status_code=204)
async def remove_email(
    email_id: UUID,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    result = (
        db.table("monitored_emails")
        .update({"is_active": False})
        .eq("id", str(email_id))
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Email not found")
