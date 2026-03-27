"""
Email Security Scanner
Checks SPF, DKIM, and DMARC DNS records without external APIs.
Uses dnspython for DNS resolution.
"""
import dns.resolver
import structlog
from app.db.supabase import get_supabase_client
from app.services.alert_service import create_alert

logger = structlog.get_logger()

resolver = dns.resolver.Resolver()
resolver.timeout = 5
resolver.lifetime = 10

# All DKIM selectors to try, in priority order.
# Extend this list freely — any selector with a valid "p=" key will be accepted.
DKIM_SELECTORS = [
    "default",       # generic fallback
    "protonmail",    # Proton Mail
    "protonmail2",   # Proton Mail (secondary)
    "protonmail3",   # Proton Mail (tertiary)
    "google",        # Google Workspace
    "selector1",     # Microsoft 365
    "selector2",     # Microsoft 365
    "k1",            # Mailchimp
    "mail",          # generic
    "smtp",          # generic
    "dkim",          # generic
    "s1",            # generic
    "s2",            # generic
    "mandrill",      # Mailchimp / Mandrill
    "resend",        # Resend
]


def _check_spf(domain: str) -> tuple[str, str]:
    """
    Check SPF: search ALL TXT records on the bare domain for v=spf1.
    Returns (status, record_text).
    Status values: "valid" | "invalid" | "missing" | "error"
    """
    try:
        answers = resolver.resolve(domain, "TXT")
        for rdata in answers:
            txt = b"".join(rdata.strings).decode("utf-8", errors="ignore")
            if txt.lower().startswith("v=spf1"):
                if "~all" in txt or "-all" in txt or "+all" in txt or "?all" in txt:
                    return "valid", txt
                else:
                    return "invalid", txt
        return "missing", ""
    except Exception as e:
        logger.warning("SPF check error", domain=domain, error=str(e))
        return "error", str(e)


def _check_dmarc(domain: str) -> tuple[str, str]:
    """
    Check DMARC: look for TXT record at _dmarc.{domain} containing v=DMARC1.
    p=none is treated as "valid" (monitoring mode — the record IS configured).
    Returns (status, record_text).
    Status values: "valid" | "invalid" | "missing" | "error"
    """
    try:
        answers = resolver.resolve(f"_dmarc.{domain}", "TXT")
        for rdata in answers:
            txt = b"".join(rdata.strings).decode("utf-8", errors="ignore")
            if txt.lower().startswith("v=dmarc1"):
                if "p=reject" in txt or "p=quarantine" in txt:
                    return "valid", txt
                elif "p=none" in txt:
                    # p=none means monitoring mode — the record IS present and valid.
                    # We mark it valid so the score counts it as configured.
                    return "valid", txt
                else:
                    return "invalid", txt
        return "missing", ""
    except Exception as e:
        logger.warning("DMARC check error", domain=domain, error=str(e))
        return "error", str(e)


def _check_dkim(domain: str) -> tuple[str, str]:
    """
    Check DKIM: iterate DKIM_SELECTORS and try {selector}._domainkey.{domain}.
    Returns on the first selector that has a valid public key ("p=" present).
    Returns (status, record_text) where record_text includes which selector matched.
    Status values: "valid" | "missing"
    """
    for sel in DKIM_SELECTORS:
        try:
            answers = resolver.resolve(f"{sel}._domainkey.{domain}", "TXT")
            for rdata in answers:
                txt = b"".join(rdata.strings).decode("utf-8", errors="ignore")
                if "p=" in txt:  # DKIM public key is present
                    logger.info("DKIM found", domain=domain, selector=sel)
                    return "valid", f"selector={sel}; {txt}"
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
            continue
        except Exception:
            continue
    return "missing", ""


def scan_email_security(domain_id: str, domain: str, user_id: str):
    db = get_supabase_client()
    logger.info("Scanning email security", domain=domain)

    spf_status, spf_record = _check_spf(domain)
    dkim_status, dkim_record = _check_dkim(domain)
    dmarc_status, dmarc_record = _check_dmarc(domain)

    db.table("email_security_results").insert(
        {
            "domain_id": domain_id,
            "user_id": user_id,
            "spf_status": spf_status,
            "spf_record": spf_record or None,
            "dkim_status": dkim_status,
            "dkim_record": dkim_record or None,
            "dmarc_status": dmarc_status,
            "dmarc_record": dmarc_record or None,
            "notified": False,
        }
    ).execute()

    # Only create alerts for genuinely missing/invalid records
    issues = []
    if spf_status in ("missing", "invalid"):
        issues.append(f"SPF {spf_status}")
    if dkim_status in ("missing", "invalid"):
        issues.append(f"DKIM {dkim_status}")
    if dmarc_status in ("missing", "invalid"):
        issues.append(f"DMARC {dmarc_status}")

    if issues:
        severity = "critical" if len(issues) == 3 else "warning"
        create_alert(
            user_id=user_id,
            alert_type="email_security",
            severity=severity,
            title=f"{'🔴' if severity == 'critical' else '⚠️'} Seguridad de email: {domain}",
            message=(
                f"Problemas detectados en {domain}: {', '.join(issues)}. "
                "Sin estas configuraciones, tu dominio puede ser suplantado para enviar emails fraudulentos."
            ),
            domain_id=domain_id,
            metadata={
                "spf": spf_status,
                "dkim": dkim_status,
                "dmarc": dmarc_status,
                "issues": issues,
            },
        )

    logger.info(
        "Email security scan complete",
        domain=domain,
        spf=spf_status,
        dkim=dkim_status,
        dmarc=dmarc_status,
    )
