"""Orchestrates all scans for a domain in sequence."""
import structlog
from datetime import datetime, timezone
from app.workers.ssl.scanner import scan_ssl
from app.workers.uptime.scanner import scan_uptime
from app.workers.email_security.scanner import scan_email_security
from app.services.score_calculator import calculate_domain_score
from app.db.supabase import get_supabase_client

logger = structlog.get_logger()


def _auto_resolve_alerts(db, domain_id: str) -> None:
    """
    After a scan completes, automatically mark resolved issues as read.
    This prevents stale alerts from persisting when the underlying problem is fixed.
    """
    now = datetime.now(timezone.utc).isoformat()

    try:
        # ── Email security: resolve if all three checks are now valid ──────────
        email_sec = (
            db.table("email_security_results")
            .select("spf_status,dkim_status,dmarc_status")
            .eq("domain_id", domain_id)
            .order("scanned_at", desc=True)
            .limit(1)
            .execute()
            .data
        )
        if email_sec and all(
            email_sec[0].get(k) == "valid"
            for k in ("spf_status", "dkim_status", "dmarc_status")
        ):
            db.table("alerts").update({"read_at": now}).eq(
                "domain_id", domain_id
            ).eq("alert_type", "email_security").is_("read_at", "null").execute()
            logger.info("Auto-resolved email_security alerts", domain_id=domain_id)

        # ── SSL: resolve if latest scan is valid ───────────────────────────────
        ssl = (
            db.table("ssl_results")
            .select("status")
            .eq("domain_id", domain_id)
            .order("scanned_at", desc=True)
            .limit(1)
            .execute()
            .data
        )
        if ssl and ssl[0].get("status") == "valid":
            db.table("alerts").update({"read_at": now}).eq(
                "domain_id", domain_id
            ).eq("alert_type", "ssl").is_("read_at", "null").execute()
            logger.info("Auto-resolved ssl alerts", domain_id=domain_id)

        # ── Uptime: resolve if domain is back up ───────────────────────────────
        uptime = (
            db.table("uptime_results")
            .select("status")
            .eq("domain_id", domain_id)
            .order("checked_at", desc=True)
            .limit(1)
            .execute()
            .data
        )
        if uptime and uptime[0].get("status") == "up":
            db.table("alerts").update({"read_at": now}).eq(
                "domain_id", domain_id
            ).eq("alert_type", "uptime").is_("read_at", "null").execute()
            logger.info("Auto-resolved uptime alerts", domain_id=domain_id)

    except Exception as e:
        # Never let alert resolution crash the scan orchestrator
        logger.warning("Auto-resolve alerts failed (non-fatal)", domain_id=domain_id, error=str(e))


async def trigger_domain_scan(domain_id: str, user_id: str):
    """Run all domain-level scans and recalculate score."""
    db = get_supabase_client()
    domain_row = (
        db.table("domains")
        .select("domain")
        .eq("id", domain_id)
        .execute()
    )
    if not domain_row.data:
        logger.warning("Domain not found for scan", domain_id=domain_id)
        return

    domain = domain_row.data[0]["domain"]
    logger.info("Starting domain scan", domain=domain, domain_id=domain_id)

    scan_ssl(domain_id, domain, user_id)
    scan_uptime(domain_id, domain, user_id)
    scan_email_security(domain_id, domain, user_id)
    calculate_domain_score(domain_id, user_id)

    # Stamp the last_scanned_at timestamp on the domain record
    db.table("domains").update(
        {"last_scanned_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", domain_id).execute()

    # Auto-resolve any alerts whose underlying issue is now fixed
    _auto_resolve_alerts(db, domain_id)

    logger.info("Domain scan complete", domain=domain)
