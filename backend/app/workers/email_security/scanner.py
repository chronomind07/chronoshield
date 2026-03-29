"""
Email Security Scanner
Uses the unified email_security_service for DNS checks (SPF/DKIM/DMARC).
After scanning a domain this module:
  1. Inserts into email_security_results (for score calculation).
  2. Syncs results to any monitored_emails rows whose address belongs to this domain.
"""
import structlog
from datetime import datetime, timezone
from app.db.supabase import get_supabase_client
from app.services.alert_service import create_alert
from app.services.email_security_service import run_email_dns_check

logger = structlog.get_logger()

# Re-export individual check functions so the emails endpoint can still import them
# (backwards-compat; new code should use run_email_dns_check directly)
from app.services.email_security_service import check_spf as _check_spf  # noqa: F401
from app.services.email_security_service import check_dkim as _check_dkim  # noqa: F401
from app.services.email_security_service import check_dmarc as _check_dmarc  # noqa: F401


def scan_email_security(domain_id: str, domain: str, user_id: str) -> dict:
    """
    Full email-security scan for a monitored domain.
    Returns the result dict {spf_status, dkim_status, dmarc_status, ...}.
    """
    db = get_supabase_client()
    logger.info("Scanning email security", domain=domain)

    result = run_email_dns_check(domain)
    now_iso = datetime.now(timezone.utc).isoformat()

    # ── 1. Write to email_security_results ────────────────────────────────────
    db.table("email_security_results").insert({
        "domain_id":    domain_id,
        "user_id":      user_id,
        **result,
        "notified":     False,
    }).execute()

    # ── 2. Sync to matching monitored_emails rows ─────────────────────────────
    # Fetch all active emails for this user, filter in Python (safe across all DB drivers)
    all_emails = (
        db.table("monitored_emails")
        .select("id, email")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
        .data
    ) or []
    matching = [e for e in all_emails if e["email"].lower().endswith(f"@{domain.lower()}")]
    for em in matching:
        try:
            db.table("monitored_emails").update({
                "spf_status":             result["spf_status"],
                "dkim_status":            result["dkim_status"],
                "dmarc_status":           result["dmarc_status"],
                "last_email_sec_scan_at": now_iso,
            }).eq("id", em["id"]).execute()
        except Exception as sync_err:
            logger.warning("Failed to sync email DNS to monitored_emails",
                           email=em["email"], error=str(sync_err))

    # ── 3. Create alerts for problems ─────────────────────────────────────────
    issues = []
    if result["spf_status"]   in ("missing", "invalid"): issues.append(f"SPF {result['spf_status']}")
    if result["dkim_status"]  in ("missing", "invalid"): issues.append(f"DKIM {result['dkim_status']}")
    if result["dmarc_status"] in ("missing", "invalid"): issues.append(f"DMARC {result['dmarc_status']}")

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
            metadata={"spf": result["spf_status"], "dkim": result["dkim_status"],
                      "dmarc": result["dmarc_status"], "issues": issues},
        )

    logger.info("Email security scan complete", domain=domain,
                spf=result["spf_status"], dkim=result["dkim_status"], dmarc=result["dmarc_status"])
    return result
