"""
Admin endpoints for internal management & testing.
Protected by X-Admin-Key header (set ADMIN_SECRET_KEY in Railway env vars).

Usage examples (curl):
  # Set user plan
  curl -X POST https://<railway-url>/api/v1/admin/set-plan \\
       -H "X-Admin-Key: <secret>" \\
       -H "Content-Type: application/json" \\
       -d '{"email": "demo@chronoshield.eu", "plan": "business"}'

  # Add credits
  curl -X POST https://<railway-url>/api/v1/admin/add-credits \\
       -H "X-Admin-Key: <secret>" \\
       -H "Content-Type: application/json" \\
       -d '{"email": "demo@chronoshield.eu", "credits": 50}'

  # Full demo setup (plan + credits at once)
  curl -X POST https://<railway-url>/api/v1/admin/setup-demo \\
       -H "X-Admin-Key: <secret>" \\
       -H "Content-Type: application/json" \\
       -d '{"email": "demo@chronoshield.eu", "plan": "business", "credits": 50}'
"""

from fastapi import APIRouter, Depends, HTTPException, Header, Query
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.core.config import settings
from app.db.supabase import get_db
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/admin", tags=["admin"])

PLAN_LIMITS = {
    "starter":  {"max_domains": 1,  "max_emails": 10},
    "business": {"max_domains": 3,  "max_emails": 30},
    "trial":    {"max_domains": 0,  "max_emails": 0},
}
PLAN_CREDITS = {"starter": 5, "business": 20, "trial": 0}


# ── Auth dependency ───────────────────────────────────────────────────────────

def require_admin(
    x_admin_key: str = Header(None),
    key: str = Query(None, description="Admin key via query param (alternative to X-Admin-Key header)"),
):
    provided = x_admin_key or key
    if not provided or provided != settings.ADMIN_SECRET_KEY:
        raise HTTPException(status_code=403, detail="Invalid or missing admin key")


# ── Schemas ───────────────────────────────────────────────────────────────────

class SetPlanRequest(BaseModel):
    email: EmailStr
    plan: str   # starter | business | trial


class AddCreditsRequest(BaseModel):
    email: EmailStr
    credits: int


class SetupDemoRequest(BaseModel):
    email: EmailStr
    plan: str = "business"
    credits: int = 50


# ── Helpers ───────────────────────────────────────────────────────────────────

def _resolve_user_id(email: str, db) -> str:
    """Look up user_id from auth.users via profiles or subscriptions."""
    # profiles stores email in auth.users; query via supabase admin
    result = db.auth.admin.list_users()
    users = result if isinstance(result, list) else getattr(result, "users", [])
    for u in users:
        if getattr(u, "email", None) == email:
            return str(u.id)
    raise HTTPException(status_code=404, detail=f"User not found: {email}")


def _set_plan(user_id: str, plan: str, db) -> dict:
    if plan not in PLAN_LIMITS:
        raise HTTPException(status_code=400, detail=f"Invalid plan '{plan}'. Valid: {list(PLAN_LIMITS)}")
    limits = PLAN_LIMITS[plan]
    # Upsert subscription
    existing = db.table("subscriptions").select("id").eq("user_id", user_id).execute()
    if existing.data:
        result = db.table("subscriptions").update({
            "plan": plan,
            "status": "active",
            **limits,
        }).eq("user_id", user_id).execute()
    else:
        result = db.table("subscriptions").insert({
            "user_id": user_id,
            "plan": plan,
            "status": "active",
            **limits,
        }).execute()
    return result.data[0] if result.data else {}


def _set_credits(user_id: str, credits: int, plan: str | None, db) -> dict:
    from app.services.credits_service import _next_reset_date
    existing = db.table("credits").select("id").eq("user_id", user_id).execute()
    data = {
        "credits_available": credits,
        "credits_used": 0,
        "reset_date": _next_reset_date(),
    }
    if plan:
        data["plan"] = plan
    if existing.data:
        result = db.table("credits").update(data).eq("user_id", user_id).execute()
    else:
        result = db.table("credits").insert({"user_id": user_id, **data}).execute()
    return result.data[0] if result.data else {}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/set-plan")
async def set_user_plan(
    payload: SetPlanRequest,
    _: None = Depends(require_admin),
    db=Depends(get_db),
):
    """Change a user's subscription plan."""
    user_id = _resolve_user_id(payload.email, db)
    sub = _set_plan(user_id, payload.plan, db)
    logger.info("Admin: plan changed", email=payload.email, plan=payload.plan)
    return {
        "ok": True,
        "user_id": user_id,
        "plan": payload.plan,
        "subscription": sub,
    }


@router.post("/add-credits")
async def add_user_credits(
    payload: AddCreditsRequest,
    _: None = Depends(require_admin),
    db=Depends(get_db),
):
    """Set a user's credits_available to the given amount (absolute, not additive)."""
    user_id = _resolve_user_id(payload.email, db)
    # Get current plan
    sub = db.table("subscriptions").select("plan").eq("user_id", user_id).execute()
    plan = sub.data[0]["plan"] if sub.data else "trial"
    credits_row = _set_credits(user_id, payload.credits, plan, db)
    logger.info("Admin: credits set", email=payload.email, credits=payload.credits)
    return {
        "ok": True,
        "user_id": user_id,
        "credits_available": payload.credits,
        "credits_row": credits_row,
    }


@router.post("/setup-demo")
async def setup_demo_user(
    payload: SetupDemoRequest,
    _: None = Depends(require_admin),
    db=Depends(get_db),
):
    """One-shot: set plan + credits for a demo/test user."""
    user_id = _resolve_user_id(payload.email, db)
    sub      = _set_plan(user_id, payload.plan, db)
    credits  = _set_credits(user_id, payload.credits, payload.plan, db)
    logger.info("Admin: demo user setup", email=payload.email,
                plan=payload.plan, credits=payload.credits)
    return {
        "ok": True,
        "user_id": user_id,
        "email": payload.email,
        "plan": payload.plan,
        "credits_available": payload.credits,
        "subscription": sub,
        "credits_row": credits,
    }


@router.get("/test-insecureweb")
async def test_insecureweb(
    _: None = Depends(require_admin),
):
    """
    Diagnostic: test InsecureWeb connectivity and auth.
    Returns the exact status codes for api-key and JWT methods.

    curl https://<railway-url>/api/v1/admin/test-insecureweb \
         -H "X-Admin-Key: <ADMIN_SECRET_KEY>"
    """
    from app.services.insecureweb_service import ping
    result = ping()
    return result


@router.get("/user-info")
async def get_user_info(
    email: str,
    _: None = Depends(require_admin),
    db=Depends(get_db),
):
    """Inspect a user's current plan and credits."""
    user_id = _resolve_user_id(email, db)
    sub     = db.table("subscriptions").select("*").eq("user_id", user_id).execute()
    credits = db.table("credits").select("*").eq("user_id", user_id).execute()
    return {
        "user_id": user_id,
        "email": email,
        "subscription": sub.data[0] if sub.data else None,
        "credits": credits.data[0] if credits.data else None,
    }
