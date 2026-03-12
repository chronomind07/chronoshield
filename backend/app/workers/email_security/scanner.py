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


def _check_spf(domain: str) -> tuple[str, str]:
    """Returns (status, record_text)"""
    try:
        answers = resolver.resolve(domain, "TXT")
        for rdata in answers:
            txt = b"".join(rdata.strings).decode("utf-8", errors="ignore")
            if txt.startswith("v=spf1"):
                # Basic validation: must have a mechanism
                if "~all" in txt or "-all" in txt or "+all" in txt or "?all" in txt:
                    return "valid", txt
                else:
                    return "invalid", txt
        return "missing", ""
    except Exception as e:
        return "error", str(e)


def _check_dmarc(domain: str) -> tuple[str, str]:
    """Returns (status, record_text)"""
    try:
        answers = resolver.resolve(f"_dmarc.{domain}", "TXT")
        for rdata in answers:
            txt = b"".join(rdata.strings).decode("utf-8", errors="ignore")
            if txt.startswith("v=DMARC1"):
                # Must have a policy
                if "p=none" in txt or "p=quarantine" in txt or "p=reject" in txt:
                    policy = txt
                    if "p=reject" in txt or "p=quarantine" in txt:
                        return "valid", policy
                    else:
                        return "invalid", policy  # p=none is not protective
        return "missing", ""
    except Exception as e:
        return "error", str(e)


def _check_dkim(domain: str, selector: str = "default") -> tuple[str, str]:
    """
    DKIM check: tries common selectors.
    Returns (status, record_text)
    """
    selectors = [selector, "google", "mail", "smtp", "dkim", "k1", "s1", "s2"]
    for sel in selectors:
        try:
            answers = resolver.resolve(f"{sel}._domainkey.{domain}", "TXT")
            for rdata in answers:
                txt = b"".join(rdata.strings).decode("utf-8", errors="ignore")
                if "p=" in txt:  # DKIM public key present
                    return "valid", txt
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
