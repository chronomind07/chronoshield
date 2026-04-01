"""
Security Score Calculator
Weights: Breach 30% | SSL 25% | Uptime 25% | Email Security 20%
"""

import dns.resolver
from app.db.supabase import get_supabase_client
from datetime import datetime, timezone, timedelta
import structlog

logger = structlog.get_logger()

GRADE_THRESHOLDS = [
    (95, "A+"), (90, "A"), (80, "B"), (70, "C"), (60, "D"), (0, "F")
]


def _score_to_grade(score: int) -> str:
    for threshold, grade in GRADE_THRESHOLDS:
        if score >= threshold:
            return grade
    return "F"


def _has_mx(domain: str) -> bool:
    """Return True if the domain has at least one MX record (i.e. it receives email).
    Uses public resolvers for consistency with the email security scanner.
    Defaults to True on any error so we don't accidentally skip DKIM/DMARC checks."""
    try:
        r = dns.resolver.Resolver()
        r.nameservers = ["8.8.8.8", "8.8.4.4", "1.1.1.1"]
        r.timeout = 5
        r.lifetime = 8
        r.resolve(domain, "MX")
        return True
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
        return False
    except Exception as e:
        logger.warning("MX check error — assuming MX exists", domain=domain, error=str(e))
        return True  # fail-safe: assume email is configured so we don't skip DKIM/DMARC


def calculate_domain_score(domain_id: str, user_id: str) -> dict:
    db = get_supabase_client()

    # Resolve domain name (needed for breach filtering and MX check)
    domain_row = (
        db.table("domains")
        .select("domain")
        .eq("id", domain_id)
        .single()
        .execute()
        .data
    )
    domain_name: str | None = domain_row["domain"] if domain_row else None

    # ── SSL score (25%) ───────────────────────────────────────────────────────
    ssl = (
        db.table("ssl_results")
        .select("status,days_remaining")
        .eq("domain_id", domain_id)
        .order("scanned_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
    ssl_score = 0
    if ssl:
        s = ssl[0]
        if s["status"] == "valid":
            days = s.get("days_remaining") or 0
            if days > 60:
                ssl_score = 100
            elif days > 30:
                ssl_score = 75
            elif days > 7:
                ssl_score = 40
            else:
                ssl_score = 10
        elif s["status"] == "expiring_soon":
            ssl_score = 30
        elif s["status"] in ("expired", "invalid", "no_ssl"):
            ssl_score = 0

    # ── Uptime score (25%) ────────────────────────────────────────────────────
    # Worker writes: "up" | "down" | "degraded" | "error"
    # With 5-min checks, use a 30-day time window (~8 640 checks) for an
    # accurate SLA percentage instead of a fixed record count.
    cutoff_30d = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    uptime_records = (
        db.table("uptime_results")
        .select("status")
        .eq("domain_id", domain_id)
        .gte("checked_at", cutoff_30d)
        .limit(9000)   # safety cap; 30 d × 288 checks/d = 8 640 max
        .execute()
        .data
    )
    uptime_score = 100  # default when no records yet (new domain)
    if uptime_records:
        up_count = sum(1 for r in uptime_records if r["status"] == "up")
        uptime_pct = up_count / len(uptime_records)
        if uptime_pct >= 0.99:
            uptime_score = 100
        elif uptime_pct >= 0.95:
            uptime_score = 80
        elif uptime_pct >= 0.90:
            uptime_score = 60
        else:
            uptime_score = max(0, int(uptime_pct * 100))

    # ── Email security score (20%) ────────────────────────────────────────────
    email_sec = (
        db.table("email_security_results")
        .select("spf_status,dkim_status,dmarc_status")
        .eq("domain_id", domain_id)
        .order("scanned_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
    email_sec_score = 0
    if email_sec:
        e = email_sec[0]
        spf_s  = e.get("spf_status")
        dkim_s = e.get("dkim_status")
        dmarc_s = e.get("dmarc_status")

        # If domain has no MX records it doesn't send email → DKIM and DMARC
        # are irrelevant. Only penalise for missing SPF (spoofing risk still applies).
        if domain_name and not _has_mx(domain_name):
            valid_count = 1 if spf_s == "valid" else 0
            email_sec_score = int((valid_count / 1) * 100)
        else:
            checks = [spf_s, dkim_s, dmarc_s]
            valid_count = sum(1 for c in checks if c == "valid")
            email_sec_score = int((valid_count / 3) * 100)

    # ── Breach score (30%) ────────────────────────────────────────────────────
    # Scope: only dark-web results that directly relate to THIS domain.
    #   1. scan_type="domain_breach" → query_value is a domain name
    #   2. scan_type="email_breach"  → query_value is an email; only include
    #      emails whose domain part matches this monitored domain.
    # Breaches belonging to other user domains or unrelated emails are excluded.
    breach_score = 100
    if domain_name:
        domain_dw = (
            db.table("dark_web_results")
            .select("query_value,total_results,scanned_at")
            .eq("user_id", user_id)
            .eq("scan_type", "domain_breach")
            .eq("query_value", domain_name)
            .order("scanned_at", desc=True)
            .execute()
            .data
        ) or []

        email_dw = (
            db.table("dark_web_results")
            .select("query_value,total_results,scanned_at")
            .eq("user_id", user_id)
            .eq("scan_type", "email_breach")
            .ilike("query_value", f"%@{domain_name}")
            .order("scanned_at", desc=True)
            .execute()
            .data
        ) or []

        dw_rows = domain_dw + email_dw

        # Keep only the latest result per query_value (deduplication)
        seen_dw: dict = {}
        for r in dw_rows:
            qv = r["query_value"]
            if qv not in seen_dw:
                seen_dw[qv] = r

        total_breaches = sum(r.get("total_results", 0) or 0 for r in seen_dw.values())
        if total_breaches > 0:
            if total_breaches <= 2:
                breach_score = 70
            elif total_breaches <= 5:
                breach_score = 40
            else:
                breach_score = max(0, 100 - total_breaches * 8)

    # ── Overall score ─────────────────────────────────────────────────────────
    overall = int(
        breach_score * 0.30
        + ssl_score * 0.25
        + uptime_score * 0.25
        + email_sec_score * 0.20
    )

    grade = _score_to_grade(overall)

    # ── Upsert into security_scores ───────────────────────────────────────────
    existing = (
        db.table("security_scores")
        .select("id")
        .eq("domain_id", domain_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
        .data
    )
    payload = {
        "user_id":         user_id,
        "domain_id":       domain_id,
        "overall_score":   overall,
        "breach_score":    breach_score,
        "ssl_score":       ssl_score,
        "uptime_score":    uptime_score,
        "email_sec_score": email_sec_score,
        "grade":           grade,
        "details": {
            "weights": {"breach": 0.30, "ssl": 0.25, "uptime": 0.25, "email_sec": 0.20}
        },
    }
    if existing:
        db.table("security_scores").update(payload).eq("id", existing[0]["id"]).execute()
    else:
        db.table("security_scores").insert(payload).execute()

    logger.info(
        "Score calculated",
        domain_id=domain_id,
        domain=domain_name,
        overall=overall,
        grade=grade,
        ssl=ssl_score,
        uptime=uptime_score,
        email_sec=email_sec_score,
        breach=breach_score,
    )
    return {"overall": overall, "grade": grade}
