"""
Uptime Monitor
Checks if a domain is reachable and measures response time.
No external API — uses httpx directly.
"""
import httpx
import time
import structlog
from app.db.supabase import get_supabase_client
from app.services.alert_service import create_alert

logger = structlog.get_logger()

TIMEOUT_SECONDS = 15
DOWN_THRESHOLD_MS = 5000


def scan_uptime(domain_id: str, domain: str, user_id: str):
    db = get_supabase_client()
    logger.info("Checking uptime", domain=domain)

    url = f"https://{domain}"
    start = time.monotonic()
    status = "error"
    status_code = None
    error_msg = None
    response_time_ms = None

    try:
        response = httpx.get(
            url,
            follow_redirects=True,
            timeout=TIMEOUT_SECONDS,
            headers={"User-Agent": "Mozilla/5.0 (compatible; ChronoShield/1.0)"},
        )
        elapsed_ms = int((time.monotonic() - start) * 1000)
        response_time_ms = elapsed_ms
        status_code = response.status_code

        if response.status_code < 500:
            # 2xx/3xx = normal, 4xx = server/CDN is responding (e.g. Cloudflare 403)
            if elapsed_ms > DOWN_THRESHOLD_MS:
                status = "degraded"
            else:
                status = "up"
        else:
            status = "down"
            error_msg = f"HTTP {response.status_code}"

    except httpx.ConnectError:
        status = "down"
        error_msg = "Connection refused"
    except httpx.TimeoutException:
        status = "down"
        error_msg = f"Timeout after {TIMEOUT_SECONDS}s"
    except Exception as e:
        status = "error"
        error_msg = str(e)

    db.table("uptime_results").insert(
        {
            "domain_id": domain_id,
            "user_id": user_id,
            "status": status,
            "status_code": status_code,
            "response_time_ms": response_time_ms,
            "error_msg": error_msg,
            "notified": False,
        }
    ).execute()

    # Alert only on down (not on every degraded)
    if status == "down":
        # Check if already alerted recently (last 30 min)
        recent_alert = (
            db.table("alerts")
            .select("id")
            .eq("domain_id", domain_id)
            .eq("alert_type", "downtime")
            .gte("sent_at", "now() - interval '30 minutes'")
            .execute()
            .data
        )
        if not recent_alert:
            create_alert(
                user_id=user_id,
                alert_type="downtime",
                severity="critical",
                title=f"🔴 Web caída: {domain}",
                message=f"Tu web {domain} no está respondiendo. {error_msg or ''}. Los clientes no pueden acceder.",
                domain_id=domain_id,
                metadata={"error": error_msg, "status_code": status_code},
            )

    logger.info("Uptime check complete", domain=domain, status=status, response_ms=response_time_ms)
