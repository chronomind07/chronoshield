import html as html_module
import resend
from app.core.config import settings
from app.db.supabase import get_supabase_client
import structlog

logger = structlog.get_logger()
resend.api_key = settings.RESEND_API_KEY


def create_alert(
    user_id: str,
    alert_type: str,
    severity: str,
    title: str,
    message: str,
    domain_id: str = None,
    email_id: str = None,
    metadata: dict = None,
    send_email: bool = True,
):
    db = get_supabase_client()

    # Check notification preferences
    prefs = (
        db.table("notification_preferences")
        .select("*")
        .eq("user_id", user_id)
        .single()
        .execute()
        .data
    )

    pref_map = {
        "breach": "alert_breach",
        "ssl_expiry": "alert_ssl_expiry",
        "ssl_invalid": "alert_ssl_invalid",
        "downtime": "alert_downtime",
        "email_security": "alert_email_security",
        "score_drop": "alert_score_drop",
    }

    should_notify = prefs and prefs.get("email_alerts", True) and prefs.get(
        pref_map.get(alert_type, "email_alerts"), True
    )

    # Insert alert record
    alert = db.table("alerts").insert(
        {
            "user_id": user_id,
            "domain_id": domain_id,
            "email_id": email_id,
            "alert_type": alert_type,
            "severity": severity,
            "title": title,
            "message": message,
            "metadata": metadata or {},
            "email_sent": False,
        }
    ).execute().data[0]

    if send_email and should_notify:
        _send_alert_email(user_id, title, message, severity, db)
        db.table("alerts").update({"email_sent": True}).eq("id", alert["id"]).execute()

    return alert


def _send_alert_email(user_id: str, title: str, message: str, severity: str, db):
    try:
        user = db.auth.admin.get_user_by_id(user_id)
        user_email = user.user.email if user else None
        if not user_email:
            return

        severity_colors = {"critical": "#ef4444", "warning": "#f59e0b", "info": "#3b82f6"}
        color = severity_colors.get(severity, "#3b82f6")

        safe_title = html_module.escape(str(title))
        safe_message = html_module.escape(str(message))

        email_html = f"""
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: {color}; padding: 16px; border-radius: 8px 8px 0 0;">
            <h2 style="color: white; margin: 0;">🛡️ ChronoShield Alert</h2>
          </div>
          <div style="border: 1px solid #e5e7eb; padding: 24px; border-radius: 0 0 8px 8px;">
            <h3 style="color: #111827;">{safe_title}</h3>
            <p style="color: #6b7280;">{safe_message}</p>
            <a href="https://app.chronoshield.io/dashboard"
               style="background: #2563eb; color: white; padding: 12px 24px;
                      border-radius: 6px; text-decoration: none; display: inline-block; margin-top: 16px;">
              Ver Dashboard
            </a>
          </div>
        </div>
        """

        resend.Emails.send({
            "from": settings.FROM_EMAIL,
            "to": [user_email],
            "subject": f"[ChronoShield] {safe_title}",
            "html": email_html,
        })
    except Exception as e:
        logger.error("Failed to send alert email", error=str(e), user_id=user_id)
