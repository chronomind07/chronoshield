"""
Dark Web monitoring endpoints — granular per-item scans.

GET  /darkweb/summary                       — credits + per-email + per-domain + impersonation
POST /darkweb/scan/email/{email_id}         — scan 1 email (1 credit)
POST /darkweb/scan/domain/{domain_id}       — scan 1 domain breach (1 credit)
POST /darkweb/scan/impersonation/{domain_id}— company impersonation (1 credit, Business only)
POST /darkweb/scan/all                      — scan everything (N credits)
GET  /darkweb/results                       — paginated history
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from app.core.security import get_current_user_id
from app.db.supabase import get_db
from app.services.credits_service import consume_credit, consume_credits, get_or_init_credits
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/darkweb", tags=["darkweb"])


# ── helpers ────────────────────────────────────────────────────────────────────

def _get_plan(user_id: str, db) -> str:
    sub = db.table("subscriptions").select("plan").eq("user_id", user_id).execute().data
    return sub[0]["plan"] if sub else "trial"


def _latest_result(user_id: str, scan_type: str, query_value: str, db) -> dict | None:
    rows = (
        db.table("dark_web_results")
        .select("id,total_results,results,is_manual,scanned_at")
        .eq("user_id", user_id)
        .eq("scan_type", scan_type)
        .eq("query_value", query_value)
        .order("scanned_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
    return rows[0] if rows else None


def _build_email_item(user_id: str, row: dict, db) -> dict:
    result = _latest_result(user_id, "email_breach", row["email"], db)
    if result:
        count = result["total_results"]
        status = "breached" if count > 0 else "clean"
        last_scan_at = result["scanned_at"]
        latest_breaches = (result.get("results") or [])[:5]
    else:
        count = 0
        status = "never_scanned"
        last_scan_at = None
        latest_breaches = []
    return {
        "id": row["id"],
        "email": row["email"],
        "last_scan_at": last_scan_at,
        "breach_count": count,
        "status": status,
        "latest_breaches": latest_breaches,
        "quarantine_status": row.get("quarantine_status") or "active",
    }


def _build_domain_item(user_id: str, row: dict, db) -> dict:
    result = _latest_result(user_id, "domain_breach", row["domain"], db)
    if result:
        count = result["total_results"]
        status = "found" if count > 0 else "clean"
        last_scan_at = result["scanned_at"]
        latest_results = (result.get("results") or [])[:5]
    else:
        count = 0
        status = "never_scanned"
        last_scan_at = None
        latest_results = []
    return {
        "id": row["id"],
        "domain": row["domain"],
        "last_scan_at": last_scan_at,
        "breach_count": count,
        "status": status,
        "latest_results": latest_results,
    }


def _build_impersonation_item(user_id: str, row: dict, db) -> dict:
    result = _latest_result(user_id, "typosquatting", row["domain"], db)
    if result:
        count = result["total_results"]
        status = "threatened" if count > 0 else "clean"
        last_scan_at = result["scanned_at"]
        latest_threats = (result.get("results") or [])[:5]
    else:
        count = 0
        status = "never_scanned"
        last_scan_at = None
        latest_threats = []
    return {
        "id": row["id"],
        "domain": row["domain"],
        "last_scan_at": last_scan_at,
        "threats_count": count,
        "status": status,
        "latest_threats": latest_threats,
    }


def _last_scan_at(user_id: str, db) -> str | None:
    row = (
        db.table("dark_web_results")
        .select("scanned_at")
        .eq("user_id", user_id)
        .order("scanned_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
    return row[0]["scanned_at"] if row else None


# ── background scan functions ──────────────────────────────────────────────────

def _scan_email_bg(user_id: str, email: str, db):
    from app.services import insecureweb_service as iw
    try:
        data = iw.search_dark_web(emails=[email])
        db.table("dark_web_results").insert({
            "user_id": user_id,
            "scan_type": "email_breach",
            "query_value": email,
            "total_results": data.get("totalResults", 0),
            "results": data.get("results", []),
            "is_manual": True,
        }).execute()
        logger.info("Email scan complete", email=email, results=data.get("totalResults", 0))
    except Exception as e:
        logger.error("Email breach scan error", email=email, error=str(e))


def _scan_domain_bg(user_id: str, domain: str, db):
    from app.services import insecureweb_service as iw
    try:
        data = iw.search_dark_web(domains=[domain])
        db.table("dark_web_results").insert({
            "user_id": user_id,
            "scan_type": "domain_breach",
            "query_value": domain,
            "total_results": data.get("totalResults", 0),
            "results": data.get("results", []),
            "is_manual": True,
        }).execute()
        logger.info("Domain scan complete", domain=domain, results=data.get("totalResults", 0))
    except Exception as e:
        logger.error("Domain breach scan error", domain=domain, error=str(e))


def _scan_impersonation_bg(user_id: str, domain: str, db):
    from app.services import insecureweb_service as iw
    try:
        profile = db.table("profiles").select("company_name").eq("id", user_id).execute().data
        org_name = (profile[0].get("company_name") or "ChronoShield Org") if profile else "ChronoShield Org"
        emails_rows = (
            db.table("monitored_emails").select("email")
            .eq("user_id", user_id).eq("is_active", True).execute().data
        ) or []
        domains_rows = (
            db.table("domains").select("domain")
            .eq("user_id", user_id).eq("is_active", True).execute().data
        ) or []
        org_id = iw.ensure_org(user_id, org_name,
                               [r["domain"] for r in domains_rows],
                               [r["email"] for r in emails_rows], db)
        typo_data = iw.get_typosquatting_threats(org_id)
        threats = typo_data.get("content", typo_data.get("results", []))
        db.table("dark_web_results").insert({
            "user_id": user_id,
            "scan_type": "typosquatting",
            "query_value": domain,
            "total_results": len(threats),
            "results": threats,
            "is_manual": True,
        }).execute()
        logger.info("Impersonation scan complete", domain=domain, threats=len(threats))
    except Exception as e:
        logger.error("Impersonation scan error", domain=domain, error=str(e))


def _scan_all_bg(user_id: str, plan: str, email_items: list, domain_items: list, db):
    """Run all scans sequentially in the background."""
    for item in email_items:
        _scan_email_bg(user_id, item["email"], db)
    for item in domain_items:
        _scan_domain_bg(user_id, item["domain"], db)
    if plan == "business":
        for item in domain_items:
            _scan_impersonation_bg(user_id, item["domain"], db)


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/summary")
async def get_darkweb_summary(
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """
    Returns per-email and per-domain dark web status, credits, and scan cost preview.
    """
    credits = get_or_init_credits(user_id, db)
    plan = _get_plan(user_id, db)

    emails_rows = (
        db.table("monitored_emails")
        .select("id,email,quarantine_status")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
        .data
    ) or []

    domains_rows = (
        db.table("domains")
        .select("id,domain")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
        .data
    ) or []

    emails = [_build_email_item(user_id, r, db) for r in emails_rows]
    domains = [_build_domain_item(user_id, r, db) for r in domains_rows]
    impersonation = (
        [_build_impersonation_item(user_id, r, db) for r in domains_rows]
        if plan == "business" else []
    )

    n_emails = len(emails_rows)
    n_domains = len(domains_rows)
    n_impersonation = n_domains if plan == "business" else 0
    scan_all_cost = n_emails + n_domains + n_impersonation

    return {
        "plan": plan,
        "credits": credits,
        "emails": emails,
        "domains": domains,
        "impersonation": impersonation,
        "impersonation_available": plan == "business",
        "scan_all_cost": scan_all_cost,
        "scan_all_breakdown": {
            "emails": n_emails,
            "domains": n_domains,
            "impersonation": n_impersonation,
        },
        "last_scan_at": _last_scan_at(user_id, db),
        "next_auto_scan": "03:15 UTC (diario)",
    }


@router.post("/scan/email/{email_id}", status_code=202)
async def scan_email(
    email_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Scan a single email for dark web breaches. Costs 1 credit."""
    # Plan check: free/trial users cannot trigger scans
    if _get_plan(user_id, db) in ("trial", "free"):
        raise HTTPException(status_code=403, detail="plan_upgrade_required")

    row = (
        db.table("monitored_emails")
        .select("id,email,quarantine_status")
        .eq("id", email_id)
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
        .data
    )
    if not row:
        raise HTTPException(status_code=404, detail="Email no encontrado")

    updated_credits = consume_credit(user_id, db)
    background_tasks.add_task(_scan_email_bg, user_id, row[0]["email"], get_db())

    return {
        "message": f"Escaneo iniciado para {row[0]['email']}",
        "credits_remaining": updated_credits["credits_available"],
    }


@router.post("/scan/domain/{domain_id}", status_code=202)
async def scan_domain(
    domain_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Scan a single domain for dark web breaches. Costs 1 credit."""
    # Plan check: free/trial users cannot trigger scans
    if _get_plan(user_id, db) in ("trial", "free"):
        raise HTTPException(status_code=403, detail="plan_upgrade_required")

    row = (
        db.table("domains")
        .select("id,domain")
        .eq("id", domain_id)
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
        .data
    )
    if not row:
        raise HTTPException(status_code=404, detail="Dominio no encontrado")

    updated_credits = consume_credit(user_id, db)
    background_tasks.add_task(_scan_domain_bg, user_id, row[0]["domain"], get_db())

    return {
        "message": f"Escaneo iniciado para {row[0]['domain']}",
        "credits_remaining": updated_credits["credits_available"],
    }


@router.post("/scan/impersonation/{domain_id}", status_code=202)
async def scan_impersonation(
    domain_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Scan company impersonation / typosquatting for a domain. Costs 1 credit. Business only."""
    plan = _get_plan(user_id, db)
    if plan != "business":
        raise HTTPException(
            status_code=403,
            detail="La detección de suplantación requiere el plan Business",
        )

    row = (
        db.table("domains")
        .select("id,domain")
        .eq("id", domain_id)
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
        .data
    )
    if not row:
        raise HTTPException(status_code=404, detail="Dominio no encontrado")

    updated_credits = consume_credit(user_id, db)
    background_tasks.add_task(_scan_impersonation_bg, user_id, row[0]["domain"], get_db())

    return {
        "message": f"Escaneo de suplantación iniciado para {row[0]['domain']}",
        "credits_remaining": updated_credits["credits_available"],
    }


@router.post("/scan/all", status_code=202)
async def scan_all(
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """
    Scan all emails + domains + impersonation (Business only).
    Costs 1 credit per item.
    """
    plan = _get_plan(user_id, db)
    # Plan check: free/trial users cannot trigger scans
    if plan in ("trial", "free"):
        raise HTTPException(status_code=403, detail="plan_upgrade_required")

    emails_rows = (
        db.table("monitored_emails")
        .select("id,email,quarantine_status")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
        .data
    ) or []

    domains_rows = (
        db.table("domains")
        .select("id,domain")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
        .data
    ) or []

    n_impersonation = len(domains_rows) if plan == "business" else 0
    total_cost = len(emails_rows) + len(domains_rows) + n_impersonation

    if total_cost == 0:
        raise HTTPException(
            status_code=400,
            detail="No hay emails ni dominios activos para escanear",
        )

    updated_credits = consume_credits(user_id, total_cost, db)
    background_tasks.add_task(_scan_all_bg, user_id, plan, emails_rows, domains_rows, get_db())

    return {
        "message": f"Escaneo general iniciado",
        "credits_consumed": total_cost,
        "credits_remaining": updated_credits["credits_available"],
        "breakdown": {
            "emails": len(emails_rows),
            "domains": len(domains_rows),
            "impersonation": n_impersonation,
        },
    }


@router.get("/results")
async def get_darkweb_results(
    scan_type: str | None = None,
    limit: int = 50,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Paginated history of all dark web scans."""
    query = (
        db.table("dark_web_results")
        .select("*")
        .eq("user_id", user_id)
        .order("scanned_at", desc=True)
        .limit(min(limit, 200))
    )
    if scan_type:
        query = query.eq("scan_type", scan_type)
    return query.execute().data or []
