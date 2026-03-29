"""
Celery application configuration with periodic tasks.

Schedule (all times UTC, Madrid = UTC+1 winter / UTC+2 summer):
  SSL + Uptime + Email Security  →  05:00 UTC (07:00 Madrid summer) and 20:00 UTC (22:00 Madrid summer)
  Score finalization             →  05:30 UTC and 20:30 UTC (after all 3 scans complete)
  Dark Web (breach + typosquatting) →  07:00 UTC (09:00 Madrid summer), gated by plan interval
  Monthly credit reset            →  00:00 UTC daily
"""
# ──────────────────────────────────────────────────────────────────────────────
# ⚠️  IMPORTANT — Celery Beat persisted schedule
# ──────────────────────────────────────────────────────────────────────────────
# Celery Beat stores its schedule in a local file (celerybeat-schedule or
# celerybeat-schedule.db). When you change beat_schedule in this file, the
# old schedule persists on disk and keeps running until you:
#
#   1. Stop celery-beat
#   2. Delete the persisted schedule file:
#        rm celerybeat-schedule celerybeat-schedule.db 2>/dev/null || true
#   3. Restart celery-beat
#
# To avoid this problem in production, use Django DB Scheduler or
# Redis-backed redbeat (pip install celery-redbeat) instead of the
# default file-based scheduler.
#
# For Railway/Docker deployments: the file is recreated fresh on each deploy
# if the filesystem is ephemeral (stateless containers). If you use a
# persistent volume, you must delete the file manually on schedule changes.
# ──────────────────────────────────────────────────────────────────────────────
from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "chronoshield",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.workers.tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
)

# ── Periodic tasks schedule ───────────────────────────────────────────────────
celery_app.conf.beat_schedule = {

    # ── SSL scan: twice daily ─────────────────────────────────────────────────
    "scan-ssl-all": {
        "task": "app.workers.tasks.scan_ssl_all_domains",
        "schedule": crontab(hour="5,20", minute=0),
    },

    # ── Uptime scan: twice daily (10-min offset to avoid DB contention) ───────
    "scan-uptime-all": {
        "task": "app.workers.tasks.scan_uptime_all_domains",
        "schedule": crontab(hour="5,20", minute=10),
    },

    # ── Email security (SPF/DKIM/DMARC): twice daily ──────────────────────────
    "scan-email-security-all": {
        "task": "app.workers.tasks.scan_email_security_all_domains",
        "schedule": crontab(hour="5,20", minute=20),
    },

    # ── Score finalization: runs after all 3 scans complete ───────────────────
    # SSL at :00, uptime at :10, email at :20 → finalize at :30
    "finalize-domain-scores": {
        "task": "app.workers.tasks.finalize_domain_scores",
        "schedule": crontab(hour="5,20", minute=30),
    },

    # ── Dark Web (breach + typosquatting): daily at 07:00 UTC ─────────────────
    # Frequency is gated inside the task:
    #   Starter → runs only if ≥7 days since last auto scan
    #   Business → runs only if ≥2 days since last auto scan
    "darkweb-scan-all-users": {
        "task": "app.workers.tasks.darkweb_scan_all_users",
        "schedule": crontab(hour=7, minute=0),
    },

    # ── Monthly credit reset: every day at midnight UTC ───────────────────────
    # The task itself checks whether it's the 1st of the month.
    "reset-monthly-credits": {
        "task": "app.workers.tasks.reset_monthly_credits",
        "schedule": crontab(hour=0, minute=0),
    },

    # NOTE: recalculate-scores intentionally removed from schedule.
    # Scores are recalculated at the end of each scan task (ssl / uptime / email_security).
}
