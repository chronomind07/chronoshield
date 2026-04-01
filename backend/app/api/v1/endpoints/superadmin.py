"""
SuperAdmin Panel API — JWT-authenticated, role-based access control.

All endpoints require role = 'admin' or 'superadmin' (via require_admin).
Team management endpoints require role = 'superadmin' (via require_superadmin).

Rate limit: 30 requests / minute per IP (in-memory, resets on restart).
Audit log: every mutation is recorded in admin_audit_log.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timezone, timedelta
from collections import defaultdict
import time
import structlog

from app.core.security import require_admin, require_superadmin
from app.db.supabase import get_db

logger = structlog.get_logger()
router = APIRouter(prefix="/superadmin", tags=["superadmin"])

SUPERADMIN_EMAIL = "support@chronoshield.eu"

PLAN_LIMITS = {
    "starter":  {"max_domains": 1,  "max_emails": 10},
    "business": {"max_domains": 3,  "max_emails": 30},
    "trial":    {"max_domains": 0,  "max_emails": 0},
}
PLAN_MRR = {"starter": 29, "business": 59, "trial": 0}

# ── Simple in-memory rate limiter ─────────────────────────────────────────────

_rate_buckets: dict = defaultdict(lambda: {"count": 0, "reset_at": 0.0})

def _check_rate_limit(ip: str, limit: int = 30) -> None:
    now = time.monotonic()
    bucket = _rate_buckets[ip]
    if now > bucket["reset_at"]:
        bucket["count"] = 0
        bucket["reset_at"] = now + 60.0
    bucket["count"] += 1
    if bucket["count"] > limit:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again in a minute.")


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    return forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")


# ── Audit log helper ───────────────────────────────────────────────────────────

def _audit(db, admin_user_id: str, action: str, target_user_id: str | None = None,
           details: dict | None = None, ip_address: str | None = None):
    try:
        db.table("admin_audit_log").insert({
            "admin_user_id": admin_user_id,
            "action": action,
            "target_user_id": target_user_id,
            "details": details or {},
            "ip_address": ip_address,
        }).execute()
    except Exception as e:
        logger.error("Audit log failed", error=str(e))


# ── Schemas ────────────────────────────────────────────────────────────────────

class ChangePlanRequest(BaseModel):
    plan: str  # starter | business | trial

class ChangeCreditsRequest(BaseModel):
    delta: int        # positive = add, negative = subtract
    reason: str = ""

class ChangeAiTokensRequest(BaseModel):
    new_limit: int
    reset_used: bool = False

class ChangeStatusRequest(BaseModel):
    status: str       # active | inactive | suspended
    reason: str = ""

class AddTeamMemberRequest(BaseModel):
    email: EmailStr

class AddLeadRequest(BaseModel):
    company_name: Optional[str] = None
    domain: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    industry: Optional[str] = None
    notes: Optional[str] = None

class UpdateLeadRequest(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    spf_status: Optional[str] = None
    dkim_status: Optional[str] = None
    dmarc_status: Optional[str] = None
    ssl_status: Optional[str] = None
    score: Optional[int] = None


# ── Helper: get user email from auth.users ────────────────────────────────────

def _get_auth_users(db) -> list:
    """Fetch all auth users via admin API."""
    try:
        result = db.auth.admin.list_users()
        users = result if isinstance(result, list) else getattr(result, "users", [])
        return [{"id": str(u.id), "email": getattr(u, "email", ""), "created_at": str(getattr(u, "created_at", "")),
                 "last_sign_in_at": str(getattr(u, "last_sign_in_at", "") or "")}
                for u in users]
    except Exception as e:
        logger.error("Failed to list auth users", error=str(e))
        return []


def _get_user_email(db, user_id: str) -> str:
    try:
        u = db.auth.admin.get_user_by_id(user_id)
        return getattr(u.user if hasattr(u, 'user') else u, "email", "") or ""
    except Exception:
        return ""


# ── Dashboard stats ───────────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats(request: Request, admin=Depends(require_admin), db=Depends(get_db)):
    _check_rate_limit(_client_ip(request))

    now = datetime.now(timezone.utc)
    cutoff_7d  = (now - timedelta(days=7)).isoformat()
    cutoff_30d = (now - timedelta(days=30)).isoformat()

    # All users from auth
    auth_users = _get_auth_users(db)
    total_users = len(auth_users)
    new_7d  = sum(1 for u in auth_users if u.get("created_at", "") >= cutoff_7d)
    new_30d = sum(1 for u in auth_users if u.get("created_at", "") >= cutoff_30d)
    active_7d = sum(1 for u in auth_users if u.get("last_sign_in_at", "") >= cutoff_7d)

    # Plans distribution
    subs = db.table("subscriptions").select("plan,status").execute().data or []
    plan_dist = {"starter": 0, "business": 0, "trial": 0}
    active_subs = {"starter": 0, "business": 0}
    for s in subs:
        plan = s.get("plan", "trial")
        plan_dist[plan] = plan_dist.get(plan, 0) + 1
        if s.get("status") == "active" and plan in active_subs:
            active_subs[plan] += 1

    mrr = active_subs["starter"] * PLAN_MRR["starter"] + active_subs["business"] * PLAN_MRR["business"]

    # Total monitored domains
    domains = db.table("domains").select("id").eq("is_active", True).execute().data or []
    total_domains = len(domains)

    # Growth: users created per day for last 30 days
    growth = {}
    for u in auth_users:
        created = u.get("created_at", "")[:10]
        if created >= cutoff_30d[:10]:
            growth[created] = growth.get(created, 0) + 1

    growth_series = [{"date": d, "users": c} for d, c in sorted(growth.items())]

    # Total alerts in last 7d
    alerts_7d = db.table("alerts").select("id").gte("sent_at", cutoff_7d).execute().data or []

    return {
        "total_users": total_users,
        "active_users_7d": active_7d,
        "new_users_7d": new_7d,
        "new_users_30d": new_30d,
        "total_domains": total_domains,
        "mrr": mrr,
        "plan_distribution": plan_dist,
        "alerts_7d": len(alerts_7d),
        "growth_series": growth_series,
    }


# ── Users list ────────────────────────────────────────────────────────────────

@router.get("/users")
async def list_users(
    request: Request,
    search: str = Query(""),
    plan_filter: str = Query(""),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin=Depends(require_admin),
    db=Depends(get_db),
):
    _check_rate_limit(_client_ip(request))

    auth_users = _get_auth_users(db)

    # Build profile map
    profiles_raw = db.table("profiles").select("id,full_name,role").execute().data or []
    profiles = {p["id"]: p for p in profiles_raw}

    # Build subscription map
    subs_raw = db.table("subscriptions").select("user_id,plan,status").execute().data or []
    subs = {s["user_id"]: s for s in subs_raw}

    # Build credits map
    credits_raw = db.table("credits").select("user_id,credits_available").execute().data or []
    credits = {c["user_id"]: c for c in credits_raw}

    # Domain counts
    domain_counts_raw = db.table("domains").select("user_id").eq("is_active", True).execute().data or []
    domain_counts: dict = {}
    for d in domain_counts_raw:
        uid = d["user_id"]
        domain_counts[uid] = domain_counts.get(uid, 0) + 1

    # Build list
    users = []
    for u in auth_users:
        uid = u["id"]
        email = u["email"]
        profile = profiles.get(uid, {})
        sub = subs.get(uid, {})
        cred = credits.get(uid, {})
        plan = sub.get("plan", "trial")

        # Filters
        if search and search.lower() not in email.lower() and search.lower() not in (profile.get("full_name") or "").lower():
            continue
        if plan_filter and plan != plan_filter:
            continue

        users.append({
            "id": uid,
            "email": email,
            "full_name": profile.get("full_name") or "",
            "role": profile.get("role", "user"),
            "plan": plan,
            "subscription_status": sub.get("status", ""),
            "credits_available": cred.get("credits_available", 0),
            "domains_count": domain_counts.get(uid, 0),
            "created_at": u.get("created_at", ""),
            "last_sign_in_at": u.get("last_sign_in_at", ""),
        })

    # Sort: newest first
    users.sort(key=lambda x: x["created_at"], reverse=True)

    total = len(users)
    start = (page - 1) * per_page
    paginated = users[start:start + per_page]

    return {"total": total, "page": page, "per_page": per_page, "users": paginated}


# ── User detail ───────────────────────────────────────────────────────────────

@router.get("/users/{user_id}")
async def get_user_detail(
    user_id: str,
    request: Request,
    admin=Depends(require_admin),
    db=Depends(get_db),
):
    _check_rate_limit(_client_ip(request))

    email = _get_user_email(db, user_id)

    profile = db.table("profiles").select("*").eq("id", user_id).execute().data
    profile = profile[0] if profile else {}

    sub = db.table("subscriptions").select("*").eq("user_id", user_id).execute().data
    sub = sub[0] if sub else {}

    cred = db.table("credits").select("*").eq("user_id", user_id).execute().data
    cred = cred[0] if cred else {}

    domains = db.table("domains").select("id,domain,is_active,created_at").eq("user_id", user_id).execute().data or []
    emails  = db.table("monitored_emails").select("id,email,is_active,created_at").eq("user_id", user_id).execute().data or []

    # Latest scores
    scores = db.table("security_scores").select("*").eq("user_id", user_id)\
        .order("calculated_at", desc=True).limit(5).execute().data or []

    # Recent alerts
    alerts = db.table("alerts").select("id,title,severity,sent_at").eq("user_id", user_id)\
        .order("sent_at", desc=True).limit(10).execute().data or []

    return {
        "id": user_id,
        "email": email,
        "profile": profile,
        "subscription": sub,
        "credits": cred,
        "domains": domains,
        "emails": emails,
        "scores": scores,
        "alerts": alerts,
    }


# ── Change plan ───────────────────────────────────────────────────────────────

@router.patch("/users/{user_id}/plan")
async def change_user_plan(
    user_id: str,
    body: ChangePlanRequest,
    request: Request,
    admin=Depends(require_admin),
    db=Depends(get_db),
):
    _check_rate_limit(_client_ip(request))
    if body.plan not in PLAN_LIMITS:
        raise HTTPException(400, f"Invalid plan. Valid: {list(PLAN_LIMITS)}")

    limits = PLAN_LIMITS[body.plan]
    existing = db.table("subscriptions").select("id").eq("user_id", user_id).execute().data
    if existing:
        db.table("subscriptions").update({"plan": body.plan, "status": "active", **limits})\
            .eq("user_id", user_id).execute()
    else:
        db.table("subscriptions").insert({"user_id": user_id, "plan": body.plan, "status": "active", **limits}).execute()

    _audit(db, admin["sub"], "change_plan", user_id,
           {"plan": body.plan}, _client_ip(request))
    return {"ok": True, "plan": body.plan}


# ── Change credits ────────────────────────────────────────────────────────────

@router.patch("/users/{user_id}/credits")
async def change_user_credits(
    user_id: str,
    body: ChangeCreditsRequest,
    request: Request,
    admin=Depends(require_admin),
    db=Depends(get_db),
):
    _check_rate_limit(_client_ip(request))

    existing = db.table("credits").select("credits_available").eq("user_id", user_id).execute().data
    current = existing[0]["credits_available"] if existing else 0
    new_val = max(0, current + body.delta)

    if existing:
        db.table("credits").update({"credits_available": new_val}).eq("user_id", user_id).execute()
    else:
        db.table("credits").insert({"user_id": user_id, "credits_available": new_val}).execute()

    _audit(db, admin["sub"], "change_credits", user_id,
           {"delta": body.delta, "new_value": new_val, "reason": body.reason}, _client_ip(request))
    return {"ok": True, "credits_available": new_val}


# ── Change AI tokens ──────────────────────────────────────────────────────────

@router.patch("/users/{user_id}/ai-tokens")
async def change_ai_tokens(
    user_id: str,
    body: ChangeAiTokensRequest,
    request: Request,
    admin=Depends(require_admin),
    db=Depends(get_db),
):
    _check_rate_limit(_client_ip(request))

    update_data: dict = {"monthly_token_limit": body.new_limit}
    if body.reset_used:
        update_data["tokens_used_this_month"] = 0

    existing = db.table("ai_token_usage").select("id").eq("user_id", user_id).execute().data
    if existing:
        db.table("ai_token_usage").update(update_data).eq("user_id", user_id).execute()
    else:
        db.table("ai_token_usage").insert({"user_id": user_id, **update_data}).execute()

    _audit(db, admin["sub"], "change_ai_tokens", user_id,
           {"new_limit": body.new_limit, "reset_used": body.reset_used}, _client_ip(request))
    return {"ok": True, "new_limit": body.new_limit}


# ── Change account status ─────────────────────────────────────────────────────

@router.patch("/users/{user_id}/status")
async def change_account_status(
    user_id: str,
    body: ChangeStatusRequest,
    request: Request,
    admin=Depends(require_admin),
    db=Depends(get_db),
):
    _check_rate_limit(_client_ip(request))
    if body.status not in ("active", "inactive", "suspended"):
        raise HTTPException(400, "status must be active | inactive | suspended")

    # Guard: cannot change superadmin account status
    profile = db.table("profiles").select("role").eq("id", user_id).execute().data
    if profile and profile[0].get("role") == "superadmin":
        raise HTTPException(403, "Cannot change superadmin account status")

    db.table("profiles").update({
        "account_status": body.status,
        "suspension_reason": body.reason if body.status == "suspended" else None,
    }).eq("id", user_id).execute()

    _audit(db, admin["sub"], f"account_{body.status}", user_id,
           {"reason": body.reason}, _client_ip(request))
    return {"ok": True, "status": body.status}


# ── Team management (superadmin only) ────────────────────────────────────────

@router.get("/team")
async def list_team(
    request: Request,
    admin=Depends(require_superadmin),
    db=Depends(get_db),
):
    _check_rate_limit(_client_ip(request))

    admins_raw = db.table("profiles").select("id,role,created_at")\
        .in_("role", ["admin", "superadmin"]).execute().data or []

    # Enrich with emails
    result = []
    for a in admins_raw:
        email = _get_user_email(db, a["id"])
        result.append({
            "id": a["id"],
            "email": email,
            "role": a["role"],
            "added_at": a.get("created_at", ""),
        })
    return {"team": result}


@router.post("/team")
async def add_team_member(
    body: AddTeamMemberRequest,
    request: Request,
    admin=Depends(require_superadmin),
    db=Depends(get_db),
):
    _check_rate_limit(_client_ip(request))

    # Find user by email
    auth_users = _get_auth_users(db)
    target = next((u for u in auth_users if u["email"] == body.email), None)
    if not target:
        raise HTTPException(404, f"User not found: {body.email}")

    # Cannot promote superadmin
    profile = db.table("profiles").select("role").eq("id", target["id"]).execute().data
    if profile and profile[0].get("role") == "superadmin":
        raise HTTPException(403, "Cannot modify superadmin role")

    db.table("profiles").update({"role": "admin"}).eq("id", target["id"]).execute()

    _audit(db, admin["sub"], "add_admin", target["id"],
           {"email": body.email}, _client_ip(request))
    return {"ok": True, "user_id": target["id"], "email": body.email, "role": "admin"}


@router.delete("/team/{target_user_id}")
async def remove_team_member(
    target_user_id: str,
    request: Request,
    admin=Depends(require_superadmin),
    db=Depends(get_db),
):
    _check_rate_limit(_client_ip(request))

    # Cannot demote superadmin
    profile = db.table("profiles").select("role").eq("id", target_user_id).execute().data
    if profile and profile[0].get("role") == "superadmin":
        raise HTTPException(403, "Cannot demote the superadmin")

    # Cannot demote yourself
    if target_user_id == admin["sub"]:
        raise HTTPException(403, "Cannot remove your own admin role")

    db.table("profiles").update({"role": "user"}).eq("id", target_user_id).execute()

    _audit(db, admin["sub"], "remove_admin", target_user_id,
           {}, _client_ip(request))
    return {"ok": True}


# ── Leads ─────────────────────────────────────────────────────────────────────

@router.get("/leads")
async def list_leads(
    request: Request,
    status_filter: str = Query(""),
    search: str = Query(""),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin=Depends(require_admin),
    db=Depends(get_db),
):
    _check_rate_limit(_client_ip(request))

    q = db.table("leads").select("*").order("created_at", desc=True)
    leads = q.execute().data or []

    # Filter
    if status_filter:
        leads = [l for l in leads if l.get("status") == status_filter]
    if search:
        s = search.lower()
        leads = [l for l in leads if s in (l.get("company_name") or "").lower()
                 or s in (l.get("email") or "").lower()
                 or s in (l.get("domain") or "").lower()]

    total = len(leads)
    start = (page - 1) * per_page
    return {"total": total, "page": page, "per_page": per_page, "leads": leads[start:start + per_page]}


@router.post("/leads")
async def add_lead(
    body: AddLeadRequest,
    request: Request,
    admin=Depends(require_admin),
    db=Depends(get_db),
):
    _check_rate_limit(_client_ip(request))
    data = body.model_dump(exclude_none=True)
    result = db.table("leads").insert(data).execute()
    lead = result.data[0] if result.data else {}
    _audit(db, admin["sub"], "add_lead", None, {"lead_id": lead.get("id"), "domain": data.get("domain")}, _client_ip(request))
    return {"ok": True, "lead": lead}


@router.patch("/leads/{lead_id}")
async def update_lead(
    lead_id: str,
    body: UpdateLeadRequest,
    request: Request,
    admin=Depends(require_admin),
    db=Depends(get_db),
):
    _check_rate_limit(_client_ip(request))
    if body.status and body.status not in ("new", "contacted", "interested", "converted", "rejected"):
        raise HTTPException(400, "Invalid status")

    data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(400, "No fields to update")
    data["updated_at"] = datetime.now(timezone.utc).isoformat()

    db.table("leads").update(data).eq("id", lead_id).execute()
    _audit(db, admin["sub"], "update_lead", None, {"lead_id": lead_id, **data}, _client_ip(request))
    return {"ok": True}


# ── Audit log ─────────────────────────────────────────────────────────────────

@router.get("/audit")
async def get_audit_log(
    request: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    admin=Depends(require_admin),
    db=Depends(get_db),
):
    _check_rate_limit(_client_ip(request))

    logs = db.table("admin_audit_log").select("*")\
        .order("created_at", desc=True)\
        .range((page - 1) * per_page, page * per_page - 1)\
        .execute().data or []

    # Enrich with admin emails
    for entry in logs:
        entry["admin_email"] = _get_user_email(db, entry["admin_user_id"]) if entry.get("admin_user_id") else ""

    return {"logs": logs, "page": page, "per_page": per_page}


# ── Platform monitoring ───────────────────────────────────────────────────────

@router.get("/platform/scans")
async def get_recent_scans(
    request: Request,
    range_hours: int = Query(24, ge=1, le=168),
    admin=Depends(require_admin),
    db=Depends(get_db),
):
    _check_rate_limit(_client_ip(request))

    cutoff = (datetime.now(timezone.utc) - timedelta(hours=range_hours)).isoformat()

    ssl_scans   = db.table("ssl_results").select("id,domain_id,status,scanned_at").gte("scanned_at", cutoff).execute().data or []
    uptime_scans= db.table("uptime_results").select("id,domain_id,status,checked_at").gte("checked_at", cutoff).execute().data or []
    email_scans = db.table("email_security_results").select("id,domain_id,spf_status,dkim_status,dmarc_status,scanned_at").gte("scanned_at", cutoff).execute().data or []

    return {
        "range_hours": range_hours,
        "ssl_scans": len(ssl_scans),
        "uptime_scans": len(uptime_scans),
        "email_security_scans": len(email_scans),
        "ssl_errors": sum(1 for s in ssl_scans if s["status"] in ("expired", "invalid", "error")),
        "uptime_downs": sum(1 for s in uptime_scans if s["status"] == "down"),
    }
