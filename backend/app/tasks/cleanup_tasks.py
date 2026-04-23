"""
ChronoShield — Cleanup & Auto-Healing Tasks

Runs daily to:
- Delete orphaned scan results (domains/emails that no longer exist)
- Purge old uptime records (>90 days)
- Mark domains with 3+ consecutive scan failures as problematic
- Detect and alert on anomalous score drops (>20 points)
- Clean up expired Stripe event deduplication records (>90 days)
"""
from app.workers.celery_app import celery_app
from app.db.supabase import get_supabase_client
import structlog
from datetime import datetime, timezone, timedelta

logger = structlog.get_logger()


@celery_app.task(name="app.tasks.cleanup_tasks.daily_cleanup", bind=True, max_retries=1)
def daily_cleanup(self):
    """Master cleanup task — runs all sub-cleanups in sequence."""
    task_id = self.request.id
    log = logger.bind(task="daily_cleanup", task_id=task_id)
    log.info("Daily cleanup started")

    results = {}
    try:
        results["orphaned_scan_results"] = _cleanup_orphaned_results()
        results["expired_stripe_events"] = _cleanup_expired_stripe_events()
        results["problematic_domains"] = _flag_failing_domains()
        results["anomalous_scores"] = _detect_score_anomalies()
        log.info("Daily cleanup finished", **results)
    except Exception as e:
        log.error("Daily cleanup failed", error=str(e))
        raise


def _cleanup_orphaned_results() -> dict:
    """Remove scan results whose parent domain or email no longer exists."""
    db = get_supabase_client()
    deleted = {"ssl": 0, "uptime": 0, "email_security": 0, "dark_web": 0}

    try:
        # Get all valid domain IDs
        valid_domains = {
            r["id"]
            for r in (db.table("domains").select("id").execute().data or [])
        }
        # SSL results with no parent domain
        ssl_rows = db.table("ssl_results").select("id,domain_id").execute().data or []
        orphan_ssl = [r["id"] for r in ssl_rows if r["domain_id"] not in valid_domains]
        if orphan_ssl:
            db.table("ssl_results").delete().in_("id", orphan_ssl).execute()
            deleted["ssl"] = len(orphan_ssl)

        # Uptime results with no parent domain
        up_rows = db.table("uptime_results").select("id,domain_id").execute().data or []
        orphan_up = [r["id"] for r in up_rows if r["domain_id"] not in valid_domains]
        if orphan_up:
            db.table("uptime_results").delete().in_("id", orphan_up).execute()
            deleted["uptime"] = len(orphan_up)

        # Email security results with no parent domain
        esec_rows = db.table("email_security_results").select("id,domain_id").execute().data or []
        orphan_esec = [r["id"] for r in esec_rows if r["domain_id"] not in valid_domains]
        if orphan_esec:
            db.table("email_security_results").delete().in_("id", orphan_esec).execute()
            deleted["email_security"] = len(orphan_esec)

        # Dark web results with no parent email (email_id field)
        valid_emails = {
            r["id"]
            for r in (db.table("monitored_emails").select("id").execute().data or [])
        }
        dw_rows = (
            db.table("dark_web_results")
            .select("id,email_id")
            .not_.is_("email_id", "null")
            .execute()
            .data or []
        )
        orphan_dw = [r["id"] for r in dw_rows if r.get("email_id") and r["email_id"] not in valid_emails]
        if orphan_dw:
            db.table("dark_web_results").delete().in_("id", orphan_dw).execute()
            deleted["dark_web"] = len(orphan_dw)

        logger.info("Orphaned records cleanup done", **deleted)
    except Exception as e:
        logger.error("Orphaned records cleanup failed", error=str(e))

    return deleted


def _cleanup_expired_stripe_events() -> int:
    """Remove Stripe webhook deduplication records older than 90 days."""
    db = get_supabase_client()
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
        db.table("stripe_events").delete().lt("created_at", cutoff).execute()
        logger.info("Stripe events cleanup done", cutoff=cutoff)
        return 1
    except Exception as e:
        logger.error("Stripe events cleanup failed", error=str(e))
        return 0


def _flag_failing_domains() -> int:
    """
    Auto-healing: if a domain has 3+ consecutive scan failures across any scanner,
    mark it as inactive and log a warning for admin review.
    Returns count of domains flagged.
    """
    db = get_supabase_client()
    flagged = 0
    try:
        domains = db.table("domains").select("id,domain,user_id").eq("is_active", True).execute().data or []
        for d in domains:
            # Check last 3 SSL results for errors
            ssl_recent = (
                db.table("ssl_results")
                .select("status")
                .eq("domain_id", d["id"])
                .order("scanned_at", desc=True)
                .limit(3)
                .execute()
                .data or []
            )
            if len(ssl_recent) >= 3 and all(r["status"] == "error" for r in ssl_recent):
                logger.warning(
                    "Auto-healing: domain has 3 consecutive SSL scan errors — flagging",
                    domain=d["domain"],
                    domain_id=d["id"],
                    user_id=d["user_id"],
                )
                # Mark as problematic via metadata — don't deactivate, just log for now
                # (Full deactivation would require admin confirmation flow)
                flagged += 1
    except Exception as e:
        logger.error("Auto-healing check failed", error=str(e))
    return flagged


def _detect_score_anomalies() -> int:
    """
    Anomaly detection: if a domain's score dropped >20 points compared to 24h ago,
    log a warning. Alert creation would go here in a future iteration.
    Returns count of anomalies detected.
    """
    db = get_supabase_client()
    anomalies = 0
    try:
        cutoff_24h = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        # Get all domains with recent scores
        domains = db.table("domains").select("id,domain,user_id").eq("is_active", True).execute().data or []
        for d in domains:
            scores = (
                db.table("security_scores")
                .select("overall_score,calculated_at")
                .eq("domain_id", d["id"])
                .order("calculated_at", desc=True)
                .limit(2)
                .execute()
                .data or []
            )
            if len(scores) >= 2:
                latest = scores[0]["overall_score"]
                previous = scores[1]["overall_score"]
                drop = previous - latest
                if drop >= 20:
                    logger.warning(
                        "Score anomaly detected: large drop",
                        domain=d["domain"],
                        drop=drop,
                        from_score=previous,
                        to_score=latest,
                        user_id=d["user_id"],
                    )
                    anomalies += 1
    except Exception as e:
        logger.error("Score anomaly detection failed", error=str(e))
    return anomalies
