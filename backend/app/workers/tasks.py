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
