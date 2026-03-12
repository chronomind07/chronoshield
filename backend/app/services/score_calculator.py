"""
Security Score Calculator
Weights: Breach 30% | SSL 25% | Uptime 25% | Email Security 20%
"""

from app.db.supabase import get_supabase_client
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


def calculate_domain_score(domain_id: str, user_id: str) -> dict:
    db = get_supabase_client()

    # SSL score (25%)
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
            days = s.get("days_remaining", 0)
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
        elif s["status"] in ("expired", "invalid"):
            ssl_score = 0
        elif s["status"] == "no_ssl":
            ssl_score = 0

    # Uptime score (25%)
    uptime_records = (
        db.table("uptime_results")
        .select("status")
        .eq("domain_id", domain_id)
        .order("checked_at", desc=True)
        .limit(100)
        .execute()
        .data
    )
    uptime_score = 100
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

    # Email security score (20%)
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
        checks = [e["spf_status"], e["dkim_status"], e["dmarc_status"]]
        valid_count = sum(1 for c in checks if c == "valid")
        email_sec_score = int((valid_count / 3) * 100)

    # Breach score for associated emails (30%) — domain-level: use full user breach score
    breach_results = (
        db.table("breach_results")
        .select("breaches_found")
        .eq("user_id", user_id)
        .order("scanned_at", desc=True)
        .limit(50)
        .execute()
        .data
    )
    breach_score = 100
    if breach_results:
        total_breaches = sum(r["breaches_found"] for r in breach_results)
        if total_breaches == 0:
            breach_score = 100
        elif total_breaches <= 2:
            breach_score = 70
        elif total_breaches <= 5:
            breach_score = 40
        else:
            breach_score = max(0, 100 - total_breaches * 8)

    overall = int(
        breach_score * 0.30
        + ssl_score * 0.25
        + uptime_score * 0.25
        + email_sec_score * 0.20
    )

    grade = _score_to_grade(overall)

    # Upsert score
    db.table("security_scores").insert(
        {
            "user_id": user_id,
            "domain_id": domain_id,
            "overall_score": overall,
            "breach_score": breach_score,
            "ssl_score": ssl_score,
            "uptime_score": uptime_score,
            "email_sec_score": email_sec_score,
            "grade": grade,
            "details": {
                "weights": {"breach": 0.30, "ssl": 0.25, "uptime": 0.25, "email_sec": 0.20}
            },
        }
    ).execute()

    logger.info(
        "Score calculated",
        domain_id=domain_id,
        overall=overall,
        grade=grade,
    )
    return {"overall": overall, "grade": grade}
