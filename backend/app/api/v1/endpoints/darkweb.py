"""
Dark Web monitoring endpoints.

GET  /darkweb/summary         — latest results + credits + next scan
POST /darkweb/scan/manual     — manual scan (consumes 1 credit)
GET  /darkweb/results         — paginated history
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from app.core.security import get_current_user_id
from app.db.supabase import get_db
from app.services.credits_service import consume_credit, get_or_init_credits
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/darkweb", tags=["darkweb"])


# ── helpers ───────────────────────────────────────────────────────────────────

def _latest_results(user_id: str, scan_type: str, db) -> list[dict]:
    """Get the most recent scan results of a given type."""
    rows = (
        db.table("dark_web_results")
        .select("id,scan_type,query_value,total_results,results,is_manual,scanned_at")
        .eq("user_id", user_id)
        .eq("scan_type", scan_type)
        .order("scanned_at", desc=True)
        .limit(50)
        .execute()
        .data
    )
    return rows or []


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


def _run_darkweb_scan(user_id: str, is_manual: bool, db):
    """
    Core scan logic: search all user's emails + domains in InsecureWeb.
    Saves results per email and per domain into dark_web_results.
    For Business plan, also runs typosquatting.
    """
    from app.services import insecureweb_service as iw

    # Get all active emails
    emails_rows = (
        db.table("monitored_emails")
        .select("id,email")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
        .data
    ) or []

    # Get all active domains
    domains_rows = (
        db.table("domains")
        .select("id,domain")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
        .data
    ) or []

    emails = [r["email"] for r in emails_rows]
    domains = [r["domain"] for r in domains_rows]

    # ── Email breach scan ──────────────────────────────────────────────────────
    for email in emails:
        try:
            data = iw.search_dark_web(emails=[email])
            db.table("dark_web_results").insert({
                "user_id": user_id,
                "scan_type": "email_breach",
                "query_value": email,
                "total_results": data.get("totalResults", 0),
                "results": data.get("results", []),
                "is_manual": is_manual,
            }).execute()
        except Exception as e:
            logger.error("Email breach scan error", email=email, error=str(e))

    # ── Domain breach scan ─────────────────────────────────────────────────────
    for domain in domains:
        try:
            data = iw.search_dark_web(domains=[domain])
            db.table("dark_web_results").insert({
                "user_id": user_id,
                "scan_type": "domain_breach",
                "query_value": domain,
                "total_results": data.get("totalResults", 0),
                "results": data.get("results", []),
                "is_manual": is_manual,
            }).execute()
        except Exception as e:
            logger.error("Domain breach scan error", domain=domain, error=str(e))

    # ── Typosquatting (Business only) ──────────────────────────────────────────
    sub = db.table("subscriptions").select("plan").eq("user_id", user_id).execute().data
    plan = sub[0]["plan"] if sub else "trial"
    if plan == "business" and domains:
        try:
            profile = db.table("profiles").select("company_name").eq("id", user_id).execute().data
            org_name = (profile[0].get("company_name") or "ChronoShield Org") if profile else "ChronoShield Org"
            org_id = iw.ensure_org(user_id, org_name, domains, emails, db)
            typo_data = iw.get_typosquatting_threats(org_id)
            threats = typo_data.get("content", typo_data.get("results", []))
            db.table("dark_web_results").insert({
                "user_id": user_id,
                "scan_type": "typosquatting",
                "query_value": domains[0],
                "total_results": len(threats),
                "results": threats,
                "is_manual": is_manual,
            }).execute()
        except Exception as e:
            logger.error("Typosquatting scan error", user_id=user_id, error=str(e))


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/summary")
async def get_darkweb_summary(
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """
    Returns:
    - credits (available, used, reset_date)
    - email_breaches: latest results per email
    - domain_breaches: latest results per domain
    - typosquatting: latest (Business only)
    - last_scan_at, next_auto_scan
    """
    credits = get_or_init_credits(user_id, db)

    # Get latest unique result per query_value for each type
    email_breaches = _latest_results(user_id, "email_breach", db)
    domain_breaches = _latest_results(user_id, "domain_breach", db)
    typo_results = _latest_results(user_id, "typosquatting", db)

    # Deduplicate: keep only most recent per query_value
    def latest_per_query(rows: list[dict]) -> list[dict]:
        seen: set[str] = set()
        out = []
        for r in rows:
            key = r.get("query_value", "")
            if key not in seen:
                seen.add(key)
                out.append(r)
        return out

    sub = db.table("subscriptions").select("plan").eq("user_id", user_id).execute().data
    plan = sub[0]["plan"] if sub else "trial"

    return {
        "plan": plan,
        "credits": credits,
        "email_breaches": latest_per_query(email_breaches),
        "domain_breaches": latest_per_query(domain_breaches),
        "typosquatting": latest_per_query(typo_results) if plan == "business" else [],
        "typosquatting_available": plan == "business",
        "last_scan_at": _last_scan_at(user_id, db),
        "next_auto_scan": "03:00 UTC (diario)",
    }


@router.post("/scan/manual", status_code=202)
async def manual_scan(
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """
    Trigger a manual Dark Web scan. Consumes 1 credit.
    Returns immediately; scan runs in background.
    """
    # Check & consume credit first (raises 402 if none)
    updated_credits = consume_credit(user_id, db)

    background_tasks.add_task(_run_darkweb_scan, user_id, True, get_db())

    return {
        "message": "Escaneo iniciado",
        "credits_remaining": updated_credits["credits_available"],
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
