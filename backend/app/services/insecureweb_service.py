"""
InsecureWeb API client — dual authentication support.

Docs: https://app.insecureweb.com/swagger-ui/index.html?urls.primaryName=v2

Auth (two methods, tried in order):
  1. API-key header:  api-key: <INSECUREWEB_API_KEY>        <- for API-key plan
  2. JWT Bearer:      POST /api/authenticate -> id_token    <- for username/password plan

Set in Railway env vars:
  INSECUREWEB_API_KEY    -- if your account uses API-key auth
  INSECUREWEB_USERNAME   -- your InsecureWeb login email (fallback)
  INSECUREWEB_PASSWORD   -- your InsecureWeb login password (fallback)

Endpoints used:
  POST /api/dark-web/advanced-search        -- email / domain breach lookup
  POST /api/authenticate                    -- get JWT (username/password flow)
  GET  /api/authenticate                    -- verify auth status
  POST /api/organizations                   -- create org (for typosquatting)
  PUT  /api/organizations                   -- update org
  GET  /api/typosquatting/{orgId}/threats   -- company impersonation (Business)
"""

import time
import threading
import httpx
import structlog
from app.core.config import settings

logger = structlog.get_logger()

BASE_URL = settings.INSECUREWEB_BASE_URL
TIMEOUT  = 30.0

# ── JWT token cache (thread-safe) ─────────────────────────────────────────────
_jwt_lock       = threading.Lock()
_jwt_token: str | None = None
_jwt_expires_at: float = 0.0          # unix timestamp
_JWT_TTL_SECONDS = 23 * 3600          # refresh before 24h expiry


def _clear_jwt_cache():
    global _jwt_token, _jwt_expires_at
    with _jwt_lock:
        _jwt_token = None
        _jwt_expires_at = 0.0


def _fetch_jwt() -> str:
    """
    POST /api/authenticate with username/password.
    Returns the id_token string.
    Raises RuntimeError if credentials are missing or login fails.
    """
    username = settings.INSECUREWEB_USERNAME
    password = settings.INSECUREWEB_PASSWORD
    if not username or not password:
        raise RuntimeError(
            "InsecureWeb username/password not configured. "
            "Set INSECUREWEB_USERNAME and INSECUREWEB_PASSWORD in Railway."
        )
    resp = httpx.post(
        f"{BASE_URL}/api/authenticate",
        json={"username": username, "password": password, "rememberMe": True},
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        timeout=TIMEOUT,
    )
    if resp.status_code != 200:
        raise RuntimeError(
            f"InsecureWeb login failed: HTTP {resp.status_code} — "
            f"check INSECUREWEB_USERNAME / INSECUREWEB_PASSWORD. "
            f"Body: {resp.text[:300]}"
        )
    data = resp.json()
    token = data.get("id_token") or data.get("token") or data.get("access_token")
    if not token:
        raise RuntimeError(
            f"InsecureWeb login OK but response missing token field. Body: {data}"
        )
    logger.info("InsecureWeb JWT obtained via username/password")
    return token


def _get_cached_jwt() -> str:
    global _jwt_token, _jwt_expires_at
    with _jwt_lock:
        if _jwt_token and time.time() < _jwt_expires_at:
            return _jwt_token
        token = _fetch_jwt()
        _jwt_token = token
        _jwt_expires_at = time.time() + _JWT_TTL_SECONDS
        return token


# ── Auth headers ──────────────────────────────────────────────────────────────

def _base_headers() -> dict:
    return {"Content-Type": "application/json", "Accept": "application/json"}


def _api_key_headers() -> dict:
    return {**_base_headers(), "api-key": settings.INSECUREWEB_API_KEY}


def _jwt_headers() -> dict:
    token = _get_cached_jwt()
    return {**_base_headers(), "Authorization": f"Bearer {token}"}


def _request(method: str, path: str, **kwargs) -> httpx.Response:
    """
    Make an authenticated request.
    Tries api-key header first; falls back to JWT if 401 or api-key not set.
    """
    url = f"{BASE_URL}{path}"

    # Attempt 1: api-key header
    if settings.INSECUREWEB_API_KEY:
        resp = httpx.request(method, url, headers=_api_key_headers(),
                             timeout=TIMEOUT, **kwargs)
        if resp.status_code != 401:
            if resp.status_code >= 400:
                resp.raise_for_status()
            return resp
        logger.warning("InsecureWeb api-key returned 401 — trying JWT fallback", path=path)

    # Attempt 2: username/password JWT
    if settings.INSECUREWEB_USERNAME and settings.INSECUREWEB_PASSWORD:
        resp = httpx.request(method, url, headers=_jwt_headers(),
                             timeout=TIMEOUT, **kwargs)
        if resp.status_code == 401:
            logger.warning("InsecureWeb JWT returned 401 — clearing cache and retrying")
            _clear_jwt_cache()
            resp = httpx.request(method, url, headers=_jwt_headers(),
                                 timeout=TIMEOUT, **kwargs)
        if resp.status_code >= 400:
            resp.raise_for_status()
        return resp

    raise RuntimeError(
        "InsecureWeb: no credentials configured. "
        "Set INSECUREWEB_API_KEY or "
        "(INSECUREWEB_USERNAME + INSECUREWEB_PASSWORD) in Railway."
    )


# ── Diagnostics (used by GET /admin/test-insecureweb) ────────────────────────

def ping() -> dict:
    """
    Test connectivity and auth. Returns full diagnostic dict.
    Used by the admin test endpoint — call this from Railway logs to debug 401s.
    """
    result: dict = {
        "base_url": BASE_URL,
        "api_key_configured": bool(settings.INSECUREWEB_API_KEY),
        "api_key_length": len(settings.INSECUREWEB_API_KEY),
        "api_key_tail": settings.INSECUREWEB_API_KEY[-6:] if settings.INSECUREWEB_API_KEY else "",
        "username_configured": bool(settings.INSECUREWEB_USERNAME),
        "password_configured": bool(settings.INSECUREWEB_PASSWORD),
    }

    # Test api-key via GET /api/authenticate (cheapest call)
    if settings.INSECUREWEB_API_KEY:
        try:
            r = httpx.get(f"{BASE_URL}/api/authenticate",
                          headers=_api_key_headers(), timeout=10)
            result["api_key_auth_status"] = r.status_code
            result["api_key_auth_body"]   = r.text[:300]
        except Exception as e:
            result["api_key_error"] = str(e)

    # Test JWT via POST /api/authenticate
    if settings.INSECUREWEB_USERNAME and settings.INSECUREWEB_PASSWORD:
        try:
            token = _fetch_jwt()
            r = httpx.get(f"{BASE_URL}/api/authenticate",
                          headers={**_base_headers(),
                                   "Authorization": f"Bearer {token}"},
                          timeout=10)
            result["jwt_obtained"]      = True
            result["jwt_auth_status"]   = r.status_code
            result["jwt_auth_body"]     = r.text[:300]
        except Exception as e:
            result["jwt_obtained"] = False
            result["jwt_error"]    = str(e)

    api_ok = result.get("api_key_auth_status") == 200
    jwt_ok = result.get("jwt_auth_status") == 200
    result["auth_ok"] = api_ok or jwt_ok
    result["working_method"] = (
        "api-key" if api_ok else ("jwt" if jwt_ok else "none")
    )
    result["action_needed"] = (
        None if result["auth_ok"] else
        "Neither auth method works. Check credentials in Railway env vars. "
        "api-key: verify the key in your InsecureWeb account dashboard under Settings > API Keys. "
        "jwt: verify INSECUREWEB_USERNAME (email) and INSECUREWEB_PASSWORD are your app.insecureweb.com login."
    )
    return result


# ── Dark Web / Breach search ──────────────────────────────────────────────────

def search_dark_web(
    emails: list[str] | None = None,
    domains: list[str] | None = None,
    max_results: int = 100,
) -> dict:
    """
    POST /api/dark-web/advanced-search
    Returns { hasMore, totalResults, results: [BreachIndexDocument] }
    HTTP 204 = no results.
    """
    if not emails and not domains:
        return {"hasMore": False, "totalResults": 0, "results": []}

    payload: dict = {"maxResults": min(max_results, 100)}
    if emails:
        payload["emails"] = emails
    if domains:
        payload["domains"] = domains

    try:
        resp = _request("POST", "/api/dark-web/advanced-search", json=payload)
        if resp.status_code == 204:
            return {"hasMore": False, "totalResults": 0, "results": []}
        data = resp.json()
        # Spec declares response as array of AdvancedSearchResponse; normalise
        if isinstance(data, list):
            all_results: list = []
            for item in data:
                if isinstance(item, dict) and "results" in item:
                    all_results.extend(item["results"])
                elif isinstance(item, dict):
                    all_results.append(item)
            return {
                "hasMore": False,
                "totalResults": len(all_results),
                "results": all_results,
            }
        return {
            "hasMore": data.get("hasMore", False),
            "totalResults": data.get("totalResults", 0),
            "results": data.get("results", []),
        }
    except httpx.HTTPStatusError as e:
        logger.error("InsecureWeb dark-web search failed",
                     status=e.response.status_code, body=e.response.text[:300])
        raise
    except RuntimeError as e:
        logger.error("InsecureWeb not configured", error=str(e))
        raise


# ── Organization management (needed for Typosquatting) ───────────────────────

def create_org(org_name: str, domains: list[str], emails: list[str]) -> dict:
    """POST /api/organizations — returns org object with id."""
    resp = _request("POST", "/api/organizations", json={
        "orgName": org_name,
        "domains": domains,
        "emails": emails,
    })
    return resp.json()


def update_org(org_id: int, org_name: str, domains: list[str], emails: list[str]) -> dict:
    """PUT /api/organizations — update existing org."""
    resp = _request("PUT", "/api/organizations", json={
        "id": org_id,
        "orgName": org_name,
        "domains": domains,
        "emails": emails,
    })
    return resp.json()


def ensure_org(user_id: str, org_name: str, domains: list[str],
               emails: list[str], db) -> int:
    """Get or create InsecureWeb org for user. Returns insecureweb_org_id."""
    row = (
        db.table("insecureweb_orgs")
        .select("insecureweb_org_id")
        .eq("user_id", user_id)
        .execute()
        .data
    )
    if row:
        org_id = row[0]["insecureweb_org_id"]
        update_org(org_id, org_name, domains, emails)
        return org_id

    org    = create_org(org_name, domains, emails)
    org_id = org["id"]
    db.table("insecureweb_orgs").insert({
        "user_id": user_id,
        "insecureweb_org_id": org_id,
        "org_name": org_name,
    }).execute()
    return org_id


# ── Typosquatting (Company Impersonation) ─────────────────────────────────────

def get_typosquatting_threats(org_id: int, page: int = 0, size: int = 50) -> dict:
    """GET /api/typosquatting/{orgId}/threats — paginated impersonation domains."""
    resp = _request(
        "GET", f"/api/typosquatting/{org_id}/threats",
        params={"page": page, "size": size},
    )
    if resp.status_code == 204:
        return {"content": [], "totalElements": 0}
    return resp.json()
