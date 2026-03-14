import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from app.core.security import get_current_user_id
from app.core.config import settings as cfg
from app.db.supabase import get_db, get_supabase_client
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone

stripe.api_key = cfg.STRIPE_SECRET_KEY

router = APIRouter(prefix="/settings", tags=["settings"])


# ── Schemas ───────────────────────────────────────────────────────────────────
class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    language: Optional[str] = None   # "es" | "en"
    timezone: Optional[str] = None


class NotificationPrefsUpdate(BaseModel):
    email_alerts: bool = True         # critical alerts by email
    alert_medium: bool = True         # medium severity alerts
    weekly_report: bool = True        # weekly security summary
    alert_breach: bool = True
    alert_ssl_expiry: bool = True
    alert_ssl_invalid: bool = True
    alert_downtime: bool = True
    alert_email_security: bool = True


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


class DeleteAccountRequest(BaseModel):
    confirmation: str   # must be exactly "ELIMINAR"


# ── PROFILE ───────────────────────────────────────────────────────────────────
@router.get("/profile")
async def get_profile(
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    profile_rows = db.table("profiles").select("*").eq("id", user_id).execute().data
    profile = profile_rows[0] if profile_rows else {}

    user_resp = db.auth.admin.get_user_by_id(user_id)
    email = user_resp.user.email if user_resp and user_resp.user else None

    return {
        "full_name":    profile.get("full_name") or "",
        "company_name": profile.get("company_name") or "",
        "email":        email,
        "org_id":       user_id,
        "language":     profile.get("language") or "es",
        "timezone":     profile.get("timezone") or "Europe/Madrid",
        "created_at":   profile.get("created_at"),
    }


@router.put("/profile")
async def update_profile(
    body: ProfileUpdate,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    if update_data:
        db.table("profiles").upsert({"id": user_id, **update_data}).execute()
    return {"success": True}


# ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
@router.get("/notifications")
async def get_notifications(
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    rows = (
        db.table("notification_preferences")
        .select("*")
        .eq("user_id", user_id)
        .execute()
        .data
    )
    prefs = rows[0] if rows else {}
    return {
        "email_alerts":        prefs.get("email_alerts", True),
        "alert_medium":        prefs.get("alert_medium", True),
        "weekly_report":       prefs.get("weekly_report", True),
        "alert_breach":        prefs.get("alert_breach", True),
        "alert_ssl_expiry":    prefs.get("alert_ssl_expiry", True),
        "alert_ssl_invalid":   prefs.get("alert_ssl_invalid", True),
        "alert_downtime":      prefs.get("alert_downtime", True),
        "alert_email_security": prefs.get("alert_email_security", True),
    }


@router.put("/notifications")
async def update_notifications(
    body: NotificationPrefsUpdate,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    db.table("notification_preferences").upsert(
        {"user_id": user_id, **body.model_dump()}
    ).execute()
    return {"success": True}


# ── CHANGE PASSWORD ───────────────────────────────────────────────────────────
@router.post("/change-password")
async def change_password(
    body: PasswordChangeRequest,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    if len(body.new_password) < 8:
        raise HTTPException(
            status_code=400,
            detail="La nueva contraseña debe tener al menos 8 caracteres",
        )

    # Verify current password by attempting sign-in
    user_resp = db.auth.admin.get_user_by_id(user_id)
    email = user_resp.user.email if user_resp and user_resp.user else None
    if not email:
        raise HTTPException(status_code=400, detail="No se pudo recuperar el usuario")

    try:
        anon_client = get_supabase_client()
        result = anon_client.auth.sign_in_with_password(
            {"email": email, "password": body.current_password}
        )
        if not result.user:
            raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")
    except HTTPException:
        raise
    except Exception as exc:
        msg = str(exc).lower()
        if any(w in msg for w in ("invalid", "credentials", "wrong", "incorrect")):
            raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")
        raise HTTPException(status_code=400, detail="Error al verificar la contraseña")

    # Update password via admin API
    db.auth.admin.update_user_by_id(user_id, {"password": body.new_password})
    return {"success": True}


# ── SESSIONS ──────────────────────────────────────────────────────────────────
@router.get("/sessions")
async def get_sessions(
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    ua = request.headers.get("User-Agent", "")

    # Rough device/browser detection
    device = "Móvil" if any(w in ua for w in ("Mobile", "Android", "iPhone", "iPad")) else "Escritorio"
    if "Edg/" in ua:
        browser = "Edge"
    elif "Firefox/" in ua:
        browser = "Firefox"
    elif "Chrome/" in ua:
        browser = "Chrome"
    elif "Safari/" in ua:
        browser = "Safari"
    else:
        browser = "Navegador"

    return {
        "sessions": [
            {
                "id":          "current",
                "device":      device,
                "browser":     browser,
                "is_current":  True,
                "last_active": datetime.now(timezone.utc).isoformat(),
            }
        ],
    }


@router.post("/sessions/sign-out-others", status_code=200)
async def sign_out_others(
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    try:
        db.auth.admin.sign_out(user_id, scope="others")
    except Exception:
        pass  # older SDK versions may not support scope param
    return {"success": True}


# ── SUBSCRIPTION INFO ─────────────────────────────────────────────────────────
@router.get("/subscription")
async def get_subscription_settings(
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    sub_rows = (
        db.table("subscriptions").select("*").eq("user_id", user_id).execute().data
    )
    sub = sub_rows[0] if sub_rows else {}

    credits_rows = (
        db.table("credits").select("*").eq("user_id", user_id).execute().data
    )
    credits = credits_rows[0] if credits_rows else {}

    # Billing history from Stripe
    billing_history: List[dict] = []
    stripe_customer_id = sub.get("stripe_customer_id")
    if stripe_customer_id and cfg.STRIPE_SECRET_KEY:
        try:
            invoices = stripe.Invoice.list(
                customer=stripe_customer_id, limit=5, status="paid"
            )
            for inv in invoices.data:
                desc = "Pago"
                if inv.get("lines") and inv["lines"].get("data"):
                    desc = inv["lines"]["data"][0].get("description") or "Pago"
                billing_history.append(
                    {
                        "date": datetime.fromtimestamp(
                            inv["created"], tz=timezone.utc
                        ).isoformat(),
                        "amount":      inv["amount_paid"] / 100,
                        "currency":    inv["currency"].upper(),
                        "description": desc,
                        "invoice_url": inv.get("hosted_invoice_url"),
                    }
                )
        except Exception:
            pass  # Stripe not configured or no invoices

    return {
        "plan":                 sub.get("plan", "trial"),
        "status":               sub.get("status", "trialing"),
        "current_period_end":   sub.get("current_period_end"),
        "cancel_at_period_end": sub.get("cancel_at_period_end", False),
        "has_stripe":           bool(stripe_customer_id),
        "credits_available":    credits.get("credits_available", 0),
        "credits_used":         credits.get("credits_used", 0),
        "credits_reset_date":   str(credits.get("reset_date", "")),
        "billing_history":      billing_history,
    }


# ── DELETE ACCOUNT ────────────────────────────────────────────────────────────
@router.post("/delete-account")
async def delete_account(
    body: DeleteAccountRequest,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    if body.confirmation != "ELIMINAR":
        raise HTTPException(
            status_code=400,
            detail="Escribe exactamente: ELIMINAR",
        )

    # Cancel any active Stripe subscription
    sub_rows = (
        db.table("subscriptions")
        .select("stripe_subscription_id")
        .eq("user_id", user_id)
        .execute()
        .data
    )
    if sub_rows and sub_rows[0].get("stripe_subscription_id") and cfg.STRIPE_SECRET_KEY:
        try:
            stripe.Subscription.cancel(sub_rows[0]["stripe_subscription_id"])
        except Exception:
            pass

    # Delete user from Supabase Auth — cascades to all DB rows via FK
    db.auth.admin.delete_user(user_id)
    return {"success": True}
