"""
Breach Detection Worker
Uses InsecureWeb API to check if emails appear in data breaches.
"""
import httpx
import structlog
from app.core.config import settings
from app.db.supabase import get_supabase_client
from app.services.alert_service import create_alert

logger = structlog.get_logger()

INSECUREWEB_URL = "https://api.insecureweb.com/v1/breach/email"


def scan_email_breaches(email_id: str, email_address: str, user_id: str):
    """Check a single email address for breaches via InsecureWeb."""
    db = get_supabase_client()
    logger.info("Scanning email for breaches", email=email_address)

    try:
        response = httpx.get(
            INSECUREWEB_URL,
            params={"email": email_address},
            headers={"X-API-Key": settings.INSECUREWEB_API_KEY},
            timeout=15.0,
        )
        response.raise_for_status()
        data = response.json()

        breaches = data.get("breaches", [])
        breaches_found = len(breaches)

        # Get previous scan to detect new breaches
        prev = (
            db.table("breach_results")
            .select("breaches_found")
            .eq("email_id", email_id)
            .order("scanned_at", desc=True)
            .limit(1)
            .execute()
            .data
        )
        prev_count = prev[0]["breaches_found"] if prev else 0
        is_new = breaches_found > prev_count

        # Store result
        db.table("breach_results").insert(
            {
                "email_id": email_id,
                "user_id": user_id,
                "breaches_found": breaches_found,
                "breach_data": data,
                "is_new": is_new,
                "notified": False,
            }
        ).execute()

        # Alert if new breaches found
        if is_new and breaches_found > 0:
            new_count = breaches_found - prev_count
            create_alert(
                user_id=user_id,
                alert_type="breach",
                severity="critical",
                title=f"🚨 Brecha detectada: {email_address}",
                message=(
                    f"Se detectaron {breaches_found} brechas de seguridad para {email_address}. "
                    f"{new_count} nueva(s) desde el último análisis. "
                    "Recomendamos cambiar la contraseña de inmediato."
                ),
                email_id=email_id,
                metadata={"email": email_address, "breaches_found": breaches_found, "new_count": new_count},
            )

        logger.info("Breach scan complete", email=email_address, breaches=breaches_found)

    except httpx.HTTPError as e:
        logger.error("InsecureWeb API error", error=str(e), email=email_address)
    except Exception as e:
        logger.error("Breach scan failed", error=str(e), email=email_address)


def scan_all_user_emails(user_id: str):
    """Scan all active emails for a user — used by scheduler."""
    db = get_supabase_client()
    emails = (
        db.table("monitored_emails")
        .select("id,email")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
        .data
    )
    for e in emails:
        scan_email_breaches(e["id"], e["email"], user_id)
