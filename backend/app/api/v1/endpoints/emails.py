from fastapi import APIRouter, Depends, HTTPException
from typing import List
from uuid import UUID
from datetime import datetime, timezone
from app.core.security import get_current_user_id
from app.db.supabase import get_db
from app.schemas.email import EmailCreate, EmailResponse, EmailWithSecurity
from app.services.email_security_service import run_email_dns_check

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
    # Block free/trial — email security requires a paid plan
    try:
        sub_check = db.table("subscriptions").select("plan, status").eq("user_id", user_id).single().execute()
        _plan   = (sub_check.data or {}).get("plan", "free")
        _status = (sub_check.data or {}).get("status", "")
    except Exception:
        _plan, _status = "free", ""
    if _plan in ("free", "trial") or _status == "trialing":
        raise HTTPException(status_code=403, detail="PLAN_UPGRADE_REQUIRED")

    # Check plan limits — fall back to free tier (1 email) if no subscription row exists
    sub = db.table("subscriptions").select("max_emails").eq("user_id", user_id).single().execute()
    max_emails = sub.data["max_emails"] if sub.data and sub.data.get("max_emails") is not None else 1

    current_count = (
        db.table("monitored_emails")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
        .count
    )
    if current_count >= max_emails:
        raise HTTPException(
            status_code=402,
            detail=f"Plan limit reached ({max_emails} emails). Please upgrade.",
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
    Always uses the unified email_security_service for consistent results.
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

    # DNS checks — uses the same unified service as the Celery task
    result = run_email_dns_check(domain)
    now_iso = datetime.now(timezone.utc).isoformat()

    # ── 1. Persist to monitored_emails (display source) ───────────────────────
    db.table("monitored_emails").update({
        "spf_status":             result["spf_status"],
        "dkim_status":            result["dkim_status"],
        "dmarc_status":           result["dmarc_status"],
        "last_email_sec_scan_at": now_iso,
    }).eq("id", str(email_id)).eq("user_id", user_id).execute()

    # ── 2. Also write to email_security_results if domain is monitored ────────
    # This keeps email_security_results (used for scoring) in sync.
    domain_row = (
        db.table("domains")
        .select("id")
        .eq("user_id", user_id)
        .eq("domain", domain)
        .eq("is_active", True)
        .execute()
        .data
    )
    if domain_row:
        domain_id = domain_row[0]["id"]
        try:
            db.table("email_security_results").insert({
                "domain_id":    domain_id,
                "user_id":      user_id,
                **result,
                "notified":     False,
            }).execute()
            # Recalculate domain score so the dashboard reflects the new DNS status
            from app.services.score_calculator import calculate_domain_score
            calculate_domain_score(domain_id, user_id)
        except Exception:
            pass  # Non-critical — display was already updated above

    return {
        "domain":                 domain,
        "spf_status":             result["spf_status"],
        "dkim_status":            result["dkim_status"],
        "dmarc_status":           result["dmarc_status"],
        "last_email_sec_scan_at": now_iso,
    }


@router.patch("/{email_id}/recover", status_code=200)
async def recover_email(
    email_id: UUID,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """
    User declares they've changed credentials after a breach.
    Sets quarantine_status → 'recovered' so the auto-scanner resumes
    at double interval before eventually returning to 'active'.
    """
    email_row = (
        db.table("monitored_emails")
        .select("id")
        .eq("id", str(email_id))
        .eq("user_id", user_id)
        .eq("is_active", True)
        .single()
        .execute()
    )
    if not email_row.data:
        raise HTTPException(status_code=404, detail="Email not found")

    db.table("monitored_emails").update({
        "quarantine_status": "recovered",
    }).eq("id", str(email_id)).eq("user_id", user_id).execute()

    return {"ok": True, "quarantine_status": "recovered"}


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
