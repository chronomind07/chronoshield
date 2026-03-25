"""
ChronoShield Extension API — Phishing detection for Gmail.

Level-1 analysis (free, no credits):
  - SPF / DMARC DNS checks on sender domain
  - Domain age via RDAP (< 30 days → phishing signal)
  - Typosquatting detection vs user's monitored domains (Levenshtein)
  - Risky TLDs in email URLs (.tk, .xyz, etc.)
  - Brand spoofing in email URLs (paypal-verify.tk vs paypal.com)
  - HTTP (non-HTTPS) URLs
  - IP-based URLs
  - Risky TLD on sender domain
  - URL scan via Google Safe Browsing v4

Level-2 deep analysis (1 credit):
  - InsecureWeb domain breach scan
  - Returns detailed dark web results

Daily limits (enforced per plan):
  - Starter:  20 level-1 analyses / day
  - Business: 100 level-1 analyses / day
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import httpx
import dns.resolver
import re
from datetime import datetime
from urllib.parse import urlparse

from app.core.security import get_current_user_id
from app.db.supabase import get_db
from app.services.credits_service import consume_credit
from app.core.config import settings
import structlog

logger = structlog.get_logger()

router = APIRouter(prefix="/extension", tags=["extension"])

# ── Daily limits per plan ──────────────────────────────────────────────────────
DAILY_LIMITS = {"starter": 20, "business": 100, "trial": 5}

# ── Risky TLDs & brand keywords ───────────────────────────────────────────────
RISKY_TLDS = frozenset({
    ".tk", ".ml", ".ga", ".cf", ".gq", ".xyz", ".top", ".buzz",
    ".click", ".link", ".surf", ".rest", ".icu", ".cam", ".quest",
})

BRAND_KEYWORDS = [
    "paypal", "amazon", "google", "microsoft", "apple", "netflix",
    "banco", "bank", "instagram", "facebook", "meta", "whatsapp",
    "telegram", "coinbase", "binance", "stripe",
]

_IP_URL_RE = re.compile(r"https?://\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}")


# ── Request / Response Models ──────────────────────────────────────────────────
class EmailAnalyzeRequest(BaseModel):
    sender_email: str
    sender_name: Optional[str] = None
    sender_domain: str
    urls: List[str] = []


class AnalysisSignal(BaseModel):
    type: str
    severity: str   # "info" | "warning" | "high" | "critical"
    message: str


class EmailAnalyzeResponse(BaseModel):
    risk_score: int          # 0–100
    recommendation: str      # "safe" | "suspicious" | "danger"
    signals: List[dict]
    sender_domain: str
    checks_performed: List[str]


# ── Daily limit helpers ────────────────────────────────────────────────────────
def _check_daily_limit(user_id: str, db) -> bool:
    """
    Return True if user is within their daily analysis limit.
    Uses a simple Supabase upsert counter keyed by (user_id, date).
    Gracefully returns True (allow) on any DB error to not block the user.
    """
    try:
        today = datetime.utcnow().date().isoformat()
        row = (
            db.table("extension_daily_usage")
            .select("count")
            .eq("user_id", user_id)
            .eq("date", today)
            .execute()
            .data
        )
        current_count = row[0]["count"] if row else 0

        # Get plan limit
        sub = (
            db.table("subscriptions")
            .select("plan")
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        plan = sub.data["plan"] if sub.data else "trial"
        limit = DAILY_LIMITS.get(plan, 5)

        if current_count >= limit:
            return False

        # Increment counter
        if row:
            db.table("extension_daily_usage").update(
                {"count": current_count + 1}
            ).eq("user_id", user_id).eq("date", today).execute()
        else:
            db.table("extension_daily_usage").insert(
                {"user_id": user_id, "date": today, "count": 1}
            ).execute()

        return True
    except Exception as e:
        logger.warning("Daily limit check failed (allowing)", error=str(e))
        return True  # Fail open — don't block on DB errors


# ── DNS Security Checks ────────────────────────────────────────────────────────
def _check_dns_security(domain: str) -> List[AnalysisSignal]:
    """Verify SPF and DMARC presence for sender domain."""
    signals: List[AnalysisSignal] = []

    # SPF check
    try:
        txts = dns.resolver.resolve(domain, "TXT", lifetime=5)
        if not any("v=spf1" in str(r) for r in txts):
            signals.append(AnalysisSignal(
                type="spf_missing", severity="warning",
                message=f"El dominio '{domain}' no tiene registro SPF"
            ))
    except dns.resolver.NXDOMAIN:
        signals.append(AnalysisSignal(
            type="domain_not_found", severity="critical",
            message=f"El dominio '{domain}' no existe en DNS"
        ))
    except Exception:
        signals.append(AnalysisSignal(
            type="spf_error", severity="warning",
            message=f"No se pudo verificar SPF de '{domain}'"
        ))

    # DMARC check
    try:
        dmarc = dns.resolver.resolve(f"_dmarc.{domain}", "TXT", lifetime=5)
        if not any("v=DMARC1" in str(r) for r in dmarc):
            signals.append(AnalysisSignal(
                type="dmarc_missing", severity="high",
                message=f"El dominio '{domain}' no tiene política DMARC"
            ))
    except Exception:
        signals.append(AnalysisSignal(
            type="dmarc_missing", severity="high",
            message=f"No se detectó registro DMARC en '{domain}'"
        ))

    return signals


# ── Domain Age (RDAP) ─────────────────────────────────────────────────────────
async def _check_domain_age(domain: str) -> Optional[AnalysisSignal]:
    """Check domain registration date via RDAP. Returns a signal if young."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"https://rdap.org/domain/{domain}",
                follow_redirects=True,
                headers={"Accept": "application/rdap+json"},
            )
            if resp.status_code != 200:
                return None

            data = resp.json()
            for event in data.get("events", []):
                if event.get("eventAction") == "registration":
                    reg_str = event.get("eventDate", "")
                    if not reg_str:
                        continue
                    reg_dt = datetime.fromisoformat(reg_str.replace("Z", "+00:00"))
                    age_days = (datetime.now(reg_dt.tzinfo) - reg_dt).days
                    if age_days < 30:
                        return AnalysisSignal(
                            type="new_domain", severity="critical",
                            message=(
                                f"Dominio registrado hace solo {age_days} día(s) — "
                                "señal fuerte de phishing"
                            ),
                        )
                    if age_days < 90:
                        return AnalysisSignal(
                            type="young_domain", severity="high",
                            message=f"Dominio registrado hace {age_days} días (relativamente nuevo)",
                        )
    except Exception:
        pass  # RDAP failure is non-critical
    return None


# ── Typosquatting Detection ───────────────────────────────────────────────────
def _levenshtein(a: str, b: str) -> int:
    """Compute Levenshtein edit distance."""
    if len(a) < len(b):
        return _levenshtein(b, a)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a):
        curr = [i + 1]
        for j, cb in enumerate(b):
            curr.append(min(prev[j + 1] + 1, curr[j] + 1, prev[j] + (ca != cb)))
        prev = curr
    return prev[len(b)]


def _check_typosquatting(
    sender_domain: str,
    user_domains: List[str],
) -> Optional[AnalysisSignal]:
    """Check if sender domain is a typosquat of any user-monitored domain."""
    sender_base = sender_domain.lower().split(".")[0]
    for d in user_domains:
        user_base = d.lower().split(".")[0]
        if sender_base == user_base:
            continue  # Exact match — not suspicious
        dist = _levenshtein(sender_base, user_base)
        if dist <= 2 and len(user_base) > 3:
            return AnalysisSignal(
                type="typosquatting", severity="critical",
                message=(
                    f"'{sender_domain}' es muy similar a tu dominio '{d}' "
                    "(typosquatting detectado)"
                ),
            )
        if dist <= 3 and len(user_base) > 6:
            return AnalysisSignal(
                type="typosquatting", severity="high",
                message=f"'{sender_domain}' podría ser un typosquat de tu dominio '{d}'",
            )
    return None


# ── Risky TLDs in URLs ────────────────────────────────────────────────────────
def _check_risky_tlds(urls: List[str]) -> List[AnalysisSignal]:
    """Flag URLs whose domain uses a high-risk TLD."""
    signals: List[AnalysisSignal] = []
    for url in urls:
        try:
            host = urlparse(url).hostname or ""
            for tld in RISKY_TLDS:
                if host.lower().endswith(tld):
                    signals.append(AnalysisSignal(
                        type="risky_tld", severity="high",
                        message=f"URL con dominio de alto riesgo: {url}",
                    ))
                    break
        except Exception:
            pass
    return signals


# ── Brand spoofing in URLs ────────────────────────────────────────────────────
def _check_brand_spoofing(urls: List[str]) -> List[AnalysisSignal]:
    """Detect brand keywords in URL domains that are NOT the official site."""
    signals: List[AnalysisSignal] = []
    for url in urls:
        try:
            host = (urlparse(url).hostname or "").lower()
            # Strip www. prefix for comparison
            bare = host[4:] if host.startswith("www.") else host
            for brand in BRAND_KEYWORDS:
                if brand not in bare:
                    continue
                # Legitimate if the bare domain IS brand.com / brand.es
                # or a direct subdomain of those (e.g. mail.paypal.com)
                if (
                    bare == f"{brand}.com"
                    or bare == f"{brand}.es"
                    or bare.endswith(f".{brand}.com")
                    or bare.endswith(f".{brand}.es")
                ):
                    continue
                signals.append(AnalysisSignal(
                    type="brand_spoofing", severity="critical",
                    message=f"Posible suplantación de {brand} detectada en URL: {url}",
                ))
                break  # One signal per URL is enough
        except Exception:
            pass
    return signals


# ── HTTP (no HTTPS) URLs ──────────────────────────────────────────────────────
def _check_http_urls(urls: List[str]) -> List[AnalysisSignal]:
    """Flag unencrypted HTTP links."""
    return [
        AnalysisSignal(
            type="http_no_tls", severity="warning",
            message=f"Enlace sin cifrado HTTPS: {url}",
        )
        for url in urls
        if url.startswith("http://")
    ]


# ── IP-based URLs ─────────────────────────────────────────────────────────────
def _check_ip_urls(urls: List[str]) -> List[AnalysisSignal]:
    """Flag URLs that use a raw IP address instead of a domain."""
    return [
        AnalysisSignal(
            type="ip_url", severity="critical",
            message=f"URL sospechosa con dirección IP directa: {url}",
        )
        for url in urls
        if _IP_URL_RE.match(url)
    ]


# ── Risky TLD on sender domain ────────────────────────────────────────────────
def _check_sender_tld(sender_domain: str) -> Optional[AnalysisSignal]:
    """Flag sender domains that use a high-risk TLD."""
    domain = sender_domain.lower()
    for tld in RISKY_TLDS:
        if domain.endswith(tld):
            return AnalysisSignal(
                type="risky_sender_tld", severity="high",
                message=f"El remitente usa un dominio de alto riesgo ({sender_domain})",
            )
    return None


# ── Google Safe Browsing ──────────────────────────────────────────────────────
async def _check_safe_browsing(urls: List[str]) -> List[AnalysisSignal]:
    """Check URLs against Google Safe Browsing v4 API."""
    if not urls or not settings.GOOGLE_SAFE_BROWSING_API_KEY:
        return []
    signals: List[AnalysisSignal] = []
    try:
        payload = {
            "client": {"clientId": "chronoshield", "clientVersion": "1.0"},
            "threatInfo": {
                "threatTypes": [
                    "MALWARE",
                    "SOCIAL_ENGINEERING",
                    "UNWANTED_SOFTWARE",
                    "POTENTIALLY_HARMFUL_APPLICATION",
                ],
                "platformTypes": ["ANY_PLATFORM"],
                "threatEntryTypes": ["URL"],
                "threatEntries": [{"url": u} for u in urls[:20]],
            },
        }
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(
                "https://safebrowsing.googleapis.com/v4/threatMatches:find"
                f"?key={settings.GOOGLE_SAFE_BROWSING_API_KEY}",
                json=payload,
            )
            if resp.status_code == 200:
                for match in resp.json().get("matches", [])[:3]:
                    threat = match.get("threatType", "THREAT")
                    url = match.get("threat", {}).get("url", "")
                    signals.append(AnalysisSignal(
                        type="malicious_url", severity="critical",
                        message=f"URL marcada como {threat} por Google: {url[:80]}",
                    ))
    except Exception as e:
        logger.warning("Safe Browsing API error", error=str(e))
    return signals


# ── Risk Score Calculation ────────────────────────────────────────────────────
def _calc_risk(signals: List[AnalysisSignal]) -> tuple:
    """Compute 0–100 risk score and recommendation label from signal list."""
    weights = {"info": 5, "warning": 20, "high": 40, "critical": 70}
    score = min(100, sum(weights.get(s.severity, 0) for s in signals))
    if score >= 60:
        return score, "danger"
    if score >= 25:
        return score, "suspicious"
    return score, "safe"


# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.post("/analyze", response_model=EmailAnalyzeResponse)
async def analyze_email(
    payload: EmailAnalyzeRequest,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """
    Level-1 phishing analysis — free, no credits consumed.
    Performs DNS, domain age, typosquatting, and Safe Browsing checks.
    Subject to daily limits: Starter 20/day · Business 100/day.
    """
    # Daily limit check (non-blocking on failure)
    if not _check_daily_limit(user_id, db):
        sub = (
            db.table("subscriptions")
            .select("plan")
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        plan = sub.data["plan"] if sub.data else "trial"
        raise HTTPException(
            status_code=429,
            detail={
                "code": "DAILY_LIMIT_REACHED",
                "message": f"Has alcanzado el límite diario de análisis para el plan {plan}.",
                "daily_limit": DAILY_LIMITS.get(plan, 5),
            },
        )

    signals: List[AnalysisSignal] = []
    checks: List[str] = []

    # 1. DNS security (SPF + DMARC)
    signals.extend(_check_dns_security(payload.sender_domain))
    checks.append("spf_dmarc")

    # 2. Domain age via RDAP
    age_sig = await _check_domain_age(payload.sender_domain)
    if age_sig:
        signals.append(age_sig)
    checks.append("domain_age")

    # 3. Typosquatting vs user's monitored domains
    user_domain_rows = (
        db.table("domains")
        .select("domain")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
        .data
    )
    if user_domain_rows:
        typo_sig = _check_typosquatting(
            payload.sender_domain,
            [r["domain"] for r in user_domain_rows],
        )
        if typo_sig:
            signals.append(typo_sig)
    checks.append("typosquatting")

    # 4. Risky TLDs in email URLs
    if payload.urls:
        signals.extend(_check_risky_tlds(payload.urls))
    checks.append("risky_tlds")

    # 5. Brand spoofing in email URLs
    if payload.urls:
        signals.extend(_check_brand_spoofing(payload.urls))
    checks.append("brand_spoofing")

    # 6. HTTP (non-HTTPS) URLs
    if payload.urls:
        signals.extend(_check_http_urls(payload.urls))
    checks.append("http_urls")

    # 7. IP-based URLs
    if payload.urls:
        signals.extend(_check_ip_urls(payload.urls))
    checks.append("ip_urls")

    # 8. Risky TLD on sender domain
    sender_tld_sig = _check_sender_tld(payload.sender_domain)
    if sender_tld_sig:
        signals.append(sender_tld_sig)
    checks.append("sender_tld")

    # 9. Google Safe Browsing URL check
    if payload.urls:
        sb_sigs = await _check_safe_browsing(payload.urls)
        signals.extend(sb_sigs)
    checks.append("safe_browsing")

    risk_score, recommendation = _calc_risk(signals)

    logger.info(
        "Extension level-1 analysis",
        user_id=user_id,
        domain=payload.sender_domain,
        score=risk_score,
        recommendation=recommendation,
    )

    return EmailAnalyzeResponse(
        risk_score=risk_score,
        recommendation=recommendation,
        signals=[s.dict() for s in signals],
        sender_domain=payload.sender_domain,
        checks_performed=checks,
    )


@router.post("/analyze-deep")
async def analyze_email_deep(
    payload: EmailAnalyzeRequest,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """
    Level-2 deep analysis — costs 1 credit.
    Queries InsecureWeb for domain breach / dark web exposure data.
    """
    # Consume 1 credit — raises HTTP 402 with NO_CREDITS if insufficient
    credits = consume_credit(user_id, db)

    result: dict = {
        "domain": payload.sender_domain,
        "credits_remaining": credits["credits_available"],
        "breaches_found": 0,
        "breach_data": [],
        "dark_web": None,
        "error": None,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{settings.INSECUREWEB_BASE_URL}/api/v1/breach/domain",
                params={"domain": payload.sender_domain},
                headers={"X-API-Key": settings.INSECUREWEB_API_KEY},
            )
            if resp.status_code == 200:
                data = resp.json()
                breaches = data.get("breaches", [])
                result["breaches_found"] = len(breaches)
                result["breach_data"] = breaches[:10]
                result["dark_web"] = data
            else:
                result["error"] = f"InsecureWeb returned {resp.status_code}"
    except Exception as e:
        logger.error("InsecureWeb deep scan failed", error=str(e), domain=payload.sender_domain)
        result["error"] = "No se pudo contactar con el servicio de dark web"

    logger.info(
        "Extension level-2 analysis",
        user_id=user_id,
        domain=payload.sender_domain,
        breaches=result["breaches_found"],
    )

    return result
