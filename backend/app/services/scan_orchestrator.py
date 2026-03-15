"""Orchestrates all scans for a domain in sequence."""
import structlog
from datetime import datetime, timezone
from app.workers.ssl.scanner import scan_ssl
from app.workers.uptime.scanner import scan_uptime
from app.workers.email_security.scanner import scan_email_security
from app.services.score_calculator import calculate_domain_score
from app.db.supabase import get_supabase_client

logger = structlog.get_logger()


async def trigger_domain_scan(domain_id: str, user_id: str):
    """Run all domain-level scans and recalculate score."""
    db = get_supabase_client()
    domain_row = db.table("domains").select("domain").eq("id", domain_id).single().execute()
    if not domain_row.data:
        logger.warning("Domain not found for scan", domain_id=domain_id)
        return

    domain = domain_row.data["domain"]
    logger.info("Starting domain scan", domain=domain, domain_id=domain_id)

    scan_ssl(domain_id, domain, user_id)
    scan_uptime(domain_id, domain, user_id)
    scan_email_security(domain_id, domain, user_id)
    calculate_domain_score(domain_id, user_id)

    # Stamp the last_scanned_at timestamp on the domain record
    db.table("domains").update(
        {"last_scanned_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", domain_id).execute()

    logger.info("Domain scan complete", domain=domain)
