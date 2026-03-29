"""
Unified Email Security Service — SPF / DKIM / DMARC DNS checks.
Single source of truth used by both Celery tasks and manual scan endpoints.
"""
import dns.resolver
import structlog

logger = structlog.get_logger()

_resolver = dns.resolver.Resolver()
_resolver.timeout = 5
_resolver.lifetime = 10

# DKIM selectors to try, in priority order.
DKIM_SELECTORS = [
    "default",       # generic fallback
    "protonmail",    # Proton Mail
    "protonmail2",
    "protonmail3",
    "google",        # Google Workspace
    "selector1",     # Microsoft 365
    "selector2",
    "k1",            # Mailchimp
    "mail",
    "smtp",
    "dkim",
    "s1",
    "s2",
    "mandrill",      # Mailchimp / Mandrill
    "resend",        # Resend
]


def check_spf(domain: str) -> tuple[str, str]:
    """
    Check SPF TXT records on the bare domain.
    Returns (status, record_text).
    Status: 'valid' | 'invalid' | 'missing' | 'error'
    """
    try:
        answers = _resolver.resolve(domain, "TXT")
        for rdata in answers:
            txt = b"".join(rdata.strings).decode("utf-8", errors="ignore")
            if txt.lower().startswith("v=spf1"):
                if "~all" in txt or "-all" in txt or "+all" in txt or "?all" in txt:
                    return "valid", txt
                return "invalid", txt
        return "missing", ""
    except Exception as e:
        logger.warning("SPF check error", domain=domain, error=str(e))
        return "error", str(e)


def check_dmarc(domain: str) -> tuple[str, str]:
    """
    Check DMARC at _dmarc.{domain}.
    p=none is treated as 'valid' (monitoring mode — record IS configured).
    Returns (status, record_text).
    Status: 'valid' | 'invalid' | 'missing' | 'error'
    """
    try:
        answers = _resolver.resolve(f"_dmarc.{domain}", "TXT")
        for rdata in answers:
            txt = b"".join(rdata.strings).decode("utf-8", errors="ignore")
            if txt.lower().startswith("v=dmarc1"):
                if "p=reject" in txt or "p=quarantine" in txt or "p=none" in txt:
                    return "valid", txt
                return "invalid", txt
        return "missing", ""
    except Exception as e:
        logger.warning("DMARC check error", domain=domain, error=str(e))
        return "error", str(e)


def check_dkim(domain: str) -> tuple[str, str]:
    """
    Try DKIM_SELECTORS in order; return on first selector with a valid public key.
    Returns (status, record_text) where record_text includes the matched selector.
    Status: 'valid' | 'missing'
    """
    for sel in DKIM_SELECTORS:
        try:
            answers = _resolver.resolve(f"{sel}._domainkey.{domain}", "TXT")
            for rdata in answers:
                txt = b"".join(rdata.strings).decode("utf-8", errors="ignore")
                if "p=" in txt:
                    logger.info("DKIM found", domain=domain, selector=sel)
                    return "valid", f"selector={sel}; {txt}"
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
            continue
        except Exception:
            continue
    return "missing", ""


def run_email_dns_check(domain: str) -> dict:
    """
    Run SPF / DKIM / DMARC checks for a domain.
    Returns a dict with all six fields ready to insert/update DB rows.
    """
    spf_status, spf_record   = check_spf(domain)
    dkim_status, dkim_record = check_dkim(domain)
    dmarc_status, dmarc_record = check_dmarc(domain)
    return {
        "spf_status":   spf_status,
        "spf_record":   spf_record   or None,
        "dkim_status":  dkim_status,
        "dkim_record":  dkim_record  or None,
        "dmarc_status": dmarc_status,
        "dmarc_record": dmarc_record or None,
    }
