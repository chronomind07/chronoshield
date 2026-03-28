"""
Celery task definitions for all scan workers.
"""
from app.workers.celery_app import celery_app
from app.db.supabase import get_supabase_client
import structlog

logger = structlog.get_logger()


def _get_all_active_domains():
    db = get_supabase_client()
    return (
        db.table("domains")
        .select("id,domain,user_id")
        .eq("is_active", True)
        .execute()
        .data
    )


def _get_all_active_emails():
    db = get_supabase_client()
    return (
        db.table("monitored_emails")
        .select("id,email,user_id")
        .eq("is_active", True)
        .execute()
        .data
    )


@celery_app.task(name="app.workers.tasks.scan_uptime_all_domains", bind=True, max_retries=2)
def scan_uptime_all_domains(self):
    from app.workers.uptime.scanner import scan_uptime
    domains = _get_all_active_domains()
    logger.info("Uptime scan started", count=len(domains))
    for d in domains:
        try:
            scan_uptime(d["id"], d["domain"], d["user_id"])
        except Exception as e:
            logger.error("Uptime scan failed", domain=d["domain"], error=str(e))
    logger.info("Uptime scan finished", count=len(domains))


@celery_app.task(name="app.workers.tasks.scan_ssl_all_domains", bind=True, max_retries=2)
def scan_ssl_all_domains(self):
    from app.workers.ssl.scanner import scan_ssl
    domains = _get_all_active_domains()
    logger.info("SSL scan started", count=len(domains))
    for d in domains:
        try:
            scan_ssl(d["id"], d["domain"], d["user_id"])
        except Exception as e:
            logger.error("SSL scan failed", domain=d["domain"], error=str(e))
    logger.info("SSL scan finished", count=len(domains))


@celery_app.task(name="app.workers.tasks.scan_email_security_all_domains", bind=True, max_retries=2)
def scan_email_security_all_domains(self):
    from app.workers.email_security.scanner import scan_email_security
    domains = _get_all_active_domains()
    logger.info("Email security scan started", count=len(domains))
    for d in domains:
        try:
            scan_email_security(d["id"], d["domain"], d["user_id"])
        except Exception as e:
            logger.error("Email security scan failed", domain=d["domain"], error=str(e))
    logger.info("Email security scan finished", count=len(domains))


@celery_app.task(name="app.workers.tasks.scan_breaches_all_emails", bind=True, max_retries=2)
def scan_breaches_all_emails(self):
    from app.workers.breach.scanner import scan_email_breaches
    emails = _get_all_active_emails()
    logger.info("Breach scan started", count=len(emails))
    for e in emails:
        try:
            scan_email_breaches(e["id"], e["email"], e["user_id"])
        except Exception as e_err:
            logger.error("Breach scan failed", email=e["email"], error=str(e_err))
    logger.info("Breach scan finished", count=len(emails))


@celery_app.task(name="app.workers.tasks.recalculate_all_scores", bind=True, max_retries=2)
def recalculate_all_scores(self):
    from app.services.score_calculator import calculate_domain_score
    domains = _get_all_active_domains()
    logger.info("Score recalculation started", count=len(domains))
    for d in domains:
        try:
            calculate_domain_score(d["id"], d["user_id"])
        except Exception as e:
            logger.error("Score calculation failed", domain=d["domain"], error=str(e))
    logger.info("Score recalculation finished", count=len(domains))


@celery_app.task(name="app.workers.tasks.darkweb_scan_all_users", bind=True, max_retries=2)
def darkweb_scan_all_users(self):
    """
    Daily automatic Dark Web scan for all users.
    No credit cost — automatic scan included in plan.
    Starter: email breach + domain breach.
    Business: same + typosquatting.
    """
    from app.services import insecureweb_service as iw
    from app.core.config import settings

    if not settings.INSECUREWEB_API_KEY:
        logger.warning("INSECUREWEB_API_KEY not configured — skipping dark web scan")
        return

    db = get_supabase_client()

    # Get distinct user_ids with active subscriptions (starter or business)
    subs = (
        db.table("subscriptions")
        .select("user_id,plan")
        .in_("plan", ["starter", "business"])
        .eq("status", "active")
        .execute()
        .data
    ) or []

    logger.info("Dark web auto-scan started", users=len(subs))

    from datetime import datetime, timezone, timedelta
    now_utc = datetime.now(timezone.utc)

    for sub in subs:
        user_id = sub["user_id"]
        plan = sub["plan"]

        # ── Frequency gate: Starter=7 days, Business=2 days ────────────────
        days_interval = 7 if plan == "starter" else 2
        cutoff_iso = (now_utc - timedelta(days=days_interval)).isoformat()
        last_auto = (
            db.table("dark_web_results")
            .select("scanned_at")
            .eq("user_id", user_id)
            .eq("is_manual", False)
            .order("scanned_at", desc=True)
            .limit(1)
            .execute()
            .data
        )
        if last_auto and last_auto[0]["scanned_at"] >= cutoff_iso:
            logger.info(
                "Skipping dark web auto-scan — interval not yet reached",
                user_id=user_id, plan=plan, interval_days=days_interval,
            )
            continue

        try:
            # Active emails
            emails_rows = (
                db.table("monitored_emails")
                .select("email")
                .eq("user_id", user_id)
                .eq("is_active", True)
                .execute()
                .data
            ) or []
            emails = [r["email"] for r in emails_rows]

            # Active domains
            domains_rows = (
                db.table("domains")
                .select("domain")
                .eq("user_id", user_id)
                .eq("is_active", True)
                .execute()
                .data
            ) or []
            domains = [r["domain"] for r in domains_rows]

            # Email breach scans
            for email in emails:
                try:
                    data = iw.search_dark_web(emails=[email])
                    db.table("dark_web_results").insert({
                        "user_id": user_id,
                        "scan_type": "email_breach",
                        "query_value": email,
                        "total_results": data.get("totalResults", 0),
                        "results": data.get("results", []),
                        "is_manual": False,
                    }).execute()
                except Exception as e:
                    logger.error("Auto email breach scan failed", email=email, error=str(e))

            # Domain breach scans
            for domain in domains:
                try:
                    data = iw.search_dark_web(domains=[domain])
                    db.table("dark_web_results").insert({
                        "user_id": user_id,
                        "scan_type": "domain_breach",
                        "query_value": domain,
                        "total_results": data.get("totalResults", 0),
                        "results": data.get("results", []),
                        "is_manual": False,
                    }).execute()
                except Exception as e:
                    logger.error("Auto domain breach scan failed", domain=domain, error=str(e))

            # Typosquatting — Business only
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
                        "is_manual": False,
                    }).execute()
                except Exception as e:
                    logger.error("Auto typosquatting scan failed", user_id=user_id, error=str(e))

        except Exception as e:
            logger.error("Dark web auto-scan failed for user", user_id=user_id, error=str(e))

    logger.info("Dark web auto-scan finished", users=len(subs))


@celery_app.task(name="app.workers.tasks.reset_monthly_credits", bind=True, max_retries=2)
def reset_monthly_credits(self):
    """Reset monthly credits for all users on the 1st of each month."""
    from app.services.credits_service import reset_monthly_credits_all
    db = get_supabase_client()
    count = reset_monthly_credits_all(db)
    logger.info("Monthly credit reset complete", users_reset=count)
