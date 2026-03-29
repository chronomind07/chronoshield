"""
Unified Email Security Service — SPF / DKIM / DMARC DNS checks.
Single source of truth used by both Celery tasks and manual scan endpoints.

IMPORTANT: Never use a module-level resolver singleton. Each call to
run_email_dns_check() creates a fresh resolver with no cached state.
This prevents stale NXDOMAIN/timeout results from being reused across
scans (a known issue when running inside long-lived Celery worker processes).
"""
import dns.resolver
import structlog

logger = structlog.get_logger()

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

_TIMEOUT  = 8   # seconds per individual DNS query
_LIFETIME = 12  # seconds total for a single resolve() call


def _make_resolver() -> dns.resolver.Resolver:
    """
    Create a fresh DNS resolver with no cache for every scan.
    Avoids stale NXDOMAIN/timeout entries being reused in long-lived workers.
    """
    r = dns.resolver.Resolver()
    r.timeout  = _TIMEOUT
    r.lifetime = _LIFETIME
    # Explicitly disable caching so each query hits DNS fresh.
    # Creating a new resolver per call already avoids cross-scan cache pollution.
    # No need to touch r.cache — the fresh object has its own empty cache.
    return r


def check_spf(domain: str, resolver: dns.resolver.Resolver | None = None) -> tuple[str, str]:
    """
    Check SPF TXT records on the bare domain.
    Returns (status, record_text).
    Status: 'valid' | 'invalid' | 'missing' | 'error'
    """
    r = resolver or _make_resolver()
    try:
        answers = r.resolve(domain, "TXT")
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


def check_dmarc(domain: str, resolver: dns.resolver.Resolver | None = None) -> tuple[str, str]:
    """
    Check DMARC at _dmarc.{domain}.
    p=none is treated as 'valid' (monitoring mode — record IS configured).
    Returns (status, record_text).
    Status: 'valid' | 'invalid' | 'missing' | 'error'
    """
    r = resolver or _make_resolver()
    try:
        answers = r.resolve(f"_dmarc.{domain}", "TXT")
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


def check_dkim(domain: str, resolver: dns.resolver.Resolver | None = None) -> tuple[str, str]:
    """
    Try DKIM_SELECTORS in order; return on first selector with a valid public key.
    Each selector that fails with a timeout is retried once before moving on.
    Returns (status, record_text) where record_text includes the matched selector.
    Status: 'valid' | 'missing'
    """
    r = resolver or _make_resolver()
    selector_errors: dict[str, str] = {}

    for sel in DKIM_SELECTORS:
        fqdn = f"{sel}._domainkey.{domain}"
        last_error: str | None = None

        # Attempt + 1 retry on timeout/generic error (NXDOMAIN never retried)
        for attempt in range(2):
            try:
                answers = r.resolve(fqdn, "TXT")
                for rdata in answers:
                    txt = b"".join(rdata.strings).decode("utf-8", errors="ignore")
                    if "p=" in txt:
                        logger.info("DKIM found", domain=domain, selector=sel, attempt=attempt)
                        return "valid", f"selector={sel}; {txt}"
                # Record exists but has no p= key — treat as not this selector
                break
            except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
                # Definitive "not here" — no point retrying
                break
            except Exception as e:
                last_error = str(e)
                if attempt == 0:
                    logger.debug(
                        "DKIM selector timeout/error — retrying",
                        domain=domain, selector=sel, error=last_error,
                    )
                # On attempt 1 (retry), fall through and log below
                continue

        if last_error and attempt == 1:
            selector_errors[sel] = last_error

    if selector_errors:
        logger.warning(
            "DKIM: some selectors failed after retry",
            domain=domain,
            failed_selectors=list(selector_errors.keys()),
            errors=selector_errors,
        )

    logger.info("DKIM not found — all selectors exhausted", domain=domain)
    return "missing", ""


def run_email_dns_check(domain: str) -> dict:
    """
    Run SPF / DKIM / DMARC checks for a domain using a single fresh resolver.
    All three checks share the same resolver instance (created here) so that
    any DNS server selection is consistent within one scan, but there is zero
    shared state between separate scan calls.
    """
    resolver = _make_resolver()
    logger.info("DNS check started", domain=domain)

    spf_status,   spf_record   = check_spf(domain,   resolver)
    dkim_status,  dkim_record  = check_dkim(domain,  resolver)
    dmarc_status, dmarc_record = check_dmarc(domain, resolver)

    logger.info(
        "DNS check complete",
        domain=domain,
        spf=spf_status,
        dkim=dkim_status,
        dmarc=dmarc_status,
    )

    return {
        "spf_status":   spf_status,
        "spf_record":   spf_record   or None,
        "dkim_status":  dkim_status,
        "dkim_record":  dkim_record  or None,
        "dmarc_status": dmarc_status,
        "dmarc_record": dmarc_record or None,
    }
