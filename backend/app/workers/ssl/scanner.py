"""
SSL Certificate Monitor
Checks SSL validity, expiry, and grade without external APIs.
Uses Python's ssl + socket standard library.
"""
import ssl
import socket
import structlog
from datetime import datetime, timezone, timedelta
from cryptography import x509
from cryptography.hazmat.backends import default_backend
from app.db.supabase import get_supabase_client
from app.services.alert_service import create_alert

logger = structlog.get_logger()

WARNING_DAYS = 30
CRITICAL_DAYS = 7


def _get_certificate(hostname: str, port: int = 443) -> dict:
    ctx = ssl.create_default_context()
    conn = ctx.wrap_socket(socket.socket(socket.AF_INET), server_hostname=hostname)
    conn.settimeout(10)
    conn.connect((hostname, port))
    cert_bin = conn.getpeercert(True)
    conn.close()

    cert = x509.load_der_x509_certificate(cert_bin, default_backend())

    not_after = cert.not_valid_after_utc
    not_before = cert.not_valid_before_utc
    now = datetime.now(timezone.utc)
    days_remaining = (not_after - now).days

    issuer = cert.issuer.rfc4514_string()
    subject = cert.subject.rfc4514_string()

    return {
        "issuer": issuer,
        "subject": subject,
        "valid_from": not_before.isoformat(),
        "valid_until": not_after.isoformat(),
        "days_remaining": days_remaining,
    }


def _assess_status(days_remaining: int) -> str:
    if days_remaining < 0:
        return "expired"
    elif days_remaining <= CRITICAL_DAYS:
        return "expiring_soon"
    elif days_remaining <= WARNING_DAYS:
        return "expiring_soon"
    return "valid"


def _grade_certificate(days_remaining: int, issuer: str) -> str:
    if days_remaining > 60:
        return "A"
    elif days_remaining > 30:
        return "B"
    elif days_remaining > 7:
        return "C"
    elif days_remaining > 0:
        return "D"
    return "F"


def scan_ssl(domain_id: str, domain: str, user_id: str):
    db = get_supabase_client()
    logger.info("Scanning SSL", domain=domain)

    try:
        cert_info = _get_certificate(domain)
        days = cert_info["days_remaining"]
        status = _assess_status(days)
        grade = _grade_certificate(days, cert_info["issuer"])

        db.table("ssl_results").insert(
            {
                "domain_id": domain_id,
                "user_id": user_id,
                "status": status,
                "issuer": cert_info["issuer"],
                "subject": cert_info["subject"],
                "valid_from": cert_info["valid_from"],
                "valid_until": cert_info["valid_until"],
                "days_remaining": days,
                "grade": grade,
                "error_msg": None,
                "notified": False,
            }
        ).execute()

        # Alert if expiring or expired
        if status == "expired":
            create_alert(
                user_id=user_id,
                alert_type="ssl_invalid",
                severity="critical",
                title=f"🔴 SSL expirado: {domain}",
                message=f"El certificado SSL de {domain} ha expirado. Tu web muestra advertencias de seguridad a los visitantes.",
                domain_id=domain_id,
            )
        elif days <= CRITICAL_DAYS:
            create_alert(
                user_id=user_id,
                alert_type="ssl_expiry",
                severity="critical",
                title=f"⏰ SSL expira en {days} días: {domain}",
                message=f"El certificado SSL de {domain} expira en {days} días. Renuévalo urgentemente.",
                domain_id=domain_id,
            )
        elif days <= WARNING_DAYS:
            create_alert(
                user_id=user_id,
                alert_type="ssl_expiry",
                severity="warning",
                title=f"⚠️ SSL expira pronto: {domain}",
                message=f"El certificado SSL de {domain} expira en {days} días.",
                domain_id=domain_id,
            )

        logger.info("SSL scan complete", domain=domain, status=status, days=days)

    except ssl.SSLError as e:
        _store_ssl_error(db, domain_id, user_id, "invalid", str(e))
        create_alert(
            user_id=user_id,
            alert_type="ssl_invalid",
            severity="critical",
            title=f"🔴 SSL inválido: {domain}",
            message=f"No se pudo verificar el certificado SSL de {domain}: {str(e)}",
            domain_id=domain_id,
        )
    except ConnectionRefusedError:
        _store_ssl_error(db, domain_id, user_id, "no_ssl", "Port 443 not open")
        create_alert(
            user_id=user_id,
            alert_type="ssl_invalid",
            severity="warning",
            title=f"⚠️ Sin SSL: {domain}",
            message=f"{domain} no tiene HTTPS activo. Los visitantes no tienen conexión segura.",
            domain_id=domain_id,
        )
    except Exception as e:
        _store_ssl_error(db, domain_id, user_id, "error", str(e))
        logger.error("SSL scan error", domain=domain, error=str(e))


def _store_ssl_error(db, domain_id: str, user_id: str, status: str, error_msg: str):
    db.table("ssl_results").insert(
        {
            "domain_id": domain_id,
            "user_id": user_id,
            "status": status,
            "error_msg": error_msg,
        }
    ).execute()
