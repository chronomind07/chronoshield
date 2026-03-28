from fastapi import APIRouter, Depends, HTTPException
from typing import List
from uuid import UUID
from datetime import datetime, timezone
from app.core.security import get_current_user_id
from app.db.supabase import get_db
from app.schemas.email import EmailCreate, EmailResponse, EmailWithSecurity

router = APIRouter(prefix="/emails", tags=["emails"])


@router.get("", response_model=List[EmailWithSecurity])
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
    return [EmailWithSecurity(**e) for e in (emails or [])]


@router.post("", response_model=EmailResponse, status_code=201)
async def add_email(
    payload: EmailCreate,
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
        # Reactivate previously deleted email
        result = (
            db.table("monitored_emails")
            .update({"is_active": True})
            .eq("id", record["id"])
            .execute()
        )
        return EmailResponse(**result.data[0])

    result = (
        db.table("monitored_emails")
        .insert({"user_id": user_id, "email": str(payload.email)})
        .execute()
    )
    return EmailResponse(**result.data[0])


@router.post("/{email_id}/scan")
async def trigger_email_scan(
    email_id: UUID,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """
    DNS security check for the email's domain (SPF/DKIM/DMARC).
    Free — does NOT consume credits.
    """
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

    email_addr = email_row.data["email"]
    domain = email_addr.split("@")[-1].lower()

    # DNS checks — synchronous, fast (~1-2s)
    from app.workers.email_security.scanner import _check_spf, _check_dkim, _check_dmarc
    spf_status, _   = _check_spf(domain)
    dkim_status, _  = _check_dkim(domain)
    dmarc_status, _ = _check_dmarc(domain)

    now = datetime.now(timezone.utc).isoformat()

    # Persist results to monitored_emails row
    db.table("monitored_emails").update({
        "spf_status":           spf_status,
        "dkim_status":          dkim_status,
        "dmarc_status":         dmarc_status,
        "last_email_sec_scan_at": now,
    }).eq("id", str(email_id)).eq("user_id", user_id).execute()

    return {
        "domain":               domain,
        "spf_status":           spf_status,
        "dkim_status":          dkim_status,
        "dmarc_status":         dmarc_status,
        "last_email_sec_scan_at": now,
    }


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
