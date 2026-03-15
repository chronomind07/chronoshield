"""
Celery application configuration with periodic tasks.
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

# Periodic tasks schedule
celery_app.conf.beat_schedule = {
    # Uptime: every 5 minutes
    "scan-uptime-all": {
        "task": "app.workers.tasks.scan_uptime_all_domains",
        "schedule": crontab(minute="*/5"),
    },
    # SSL: every hour
    "scan-ssl-all": {
        "task": "app.workers.tasks.scan_ssl_all_domains",
        "schedule": crontab(minute=0),
    },
    # Email security: twice daily
    "scan-email-security-all": {
        "task": "app.workers.tasks.scan_email_security_all_domains",
        "schedule": crontab(hour="6,18", minute=0),
    },
    # Breach detection: daily at 3am
    "scan-breaches-all": {
        "task": "app.workers.tasks.scan_breaches_all_emails",
        "schedule": crontab(hour=3, minute=0),
    },
    # Dark Web (email+domain breach + typosquatting): daily at 3:15am
    "darkweb-scan-all-users": {
        "task": "app.workers.tasks.darkweb_scan_all_users",
        "schedule": crontab(hour=3, minute=15),
    },
    # Monthly credit reset check: every day at midnight
    "reset-monthly-credits": {
        "task": "app.workers.tasks.reset_monthly_credits",
        "schedule": crontab(hour=0, minute=0),
    },
    # Recalculate all scores: every 30 min (at :00 and :30)
    "recalculate-scores": {
        "task": "app.workers.tasks.recalculate_all_scores",
        "schedule": crontab(minute="*/30"),
    },
}
