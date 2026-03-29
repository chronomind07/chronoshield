"""
Celery application configuration with periodic tasks.

Schedule (all times UTC, Madrid = UTC+1 winter / UTC+2 summer):
  SSL + Uptime + Email Security  →  05:00 UTC (07:00 Madrid summer) and 20:00 UTC (22:00 Madrid summer)
  Dark Web (breach + typosquatting) →  07:00 UTC (09:00 Madrid summer), gated by plan interval
  Monthly credit reset            →  00:00 UTC daily

Score recalculation is NOT scheduled here — it runs at the end of each scan task.
"""
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
