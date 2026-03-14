"""
InsecureWeb API client.

Docs: https://app.insecureweb.com/swagger-ui/index.html?urls.primaryName=v2
Auth: header  api-key: <key>

Key endpoints used:
  POST /api/dark-web/advanced-search  — email / domain breach lookup
  POST /api/organizations             — create org (needed for typosquatting)
  PUT  /api/organizations             — update org
  GET  /api/typosquatting/{orgId}/threats — company impersonation threats (Business)
"""

import httpx
import structlog
from typing import Optional
from app.core.config import settings

logger = structlog.get_logger()

BASE_URL = settings.INSECUREWEB_BASE_URL
HEADERS = {
    "api-key": settings.INSECUREWEB_API_KEY,
    "Content-Type": "application/json",
    "Accept": "application/json",
}
TIMEOUT = 30.0


# ─── Dark Web / Breach search ─────────────────────────────────────────────────

def search_dark_web(
    emails: list[str] | None = None,
    domains: list[str] | None = None,
    max_results: int = 100,
) -> dict:
    """
    POST /api/dark-web/advanced-search
    Returns { hasMore, totalResults, results: [BreachIndexDocument] }
    HTTP 204 = no results (empty).
    """
    payload: dict = {"maxResults": min(max_results, 100)}
    if emails:
        payload["emails"] = emails
    if domains:
        payload["domains"] = domains

    try:
        resp = httpx.post(
            f"{BASE_URL}/api/dark-web/advanced-search",
            headers=HEADERS,
            json=payload,
            timeout=TIMEOUT,
        )
        if resp.status_code == 204:
            return {"hasMore": False, "totalResults": 0, "results": []}
        resp.raise_for_status()
        data = resp.json()
        # API may return list directly or wrapped object
        if isinstance(data, list):
            return {"hasMore": False, "totalResults": len(data), "results": data}
        return data
    except httpx.HTTPStatusError as e:
        logger.error("InsecureWeb dark web search failed", status=e.response.status_code, error=str(e))
        raise
    except Exception as e:
        logger.error("InsecureWeb dark web search error", error=str(e))
        raise


# ─── Organization management (needed for Typosquatting) ──────────────────────

def create_org(org_name: str, domains: list[str], emails: list[str]) -> dict:
    """POST /api/organizations — returns org object with id."""
    payload = {
        "orgName": org_name,
        "domains": domains,
        "emails": emails,
    }
    resp = httpx.post(
        f"{BASE_URL}/api/organizations",
        headers=HEADERS,
        json=payload,
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()


def update_org(org_id: int, org_name: str, domains: list[str], emails: list[str]) -> dict:
    """PUT /api/organizations — update existing org."""
    payload = {
        "id": org_id,
        "orgName": org_name,
        "domains": domains,
        "emails": emails,
    }
    resp = httpx.put(
        f"{BASE_URL}/api/organizations",
        headers=HEADERS,
        json=payload,
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()


def ensure_org(user_id: str, org_name: str, domains: list[str], emails: list[str], db) -> int:
    """
    Get or create the InsecureWeb org for a user.
    Returns the insecureweb_org_id (int).
    """
    row = db.table("insecureweb_orgs").select("insecureweb_org_id").eq("user_id", user_id).execute().data
    if row:
        org_id = row[0]["insecureweb_org_id"]
        # Keep org in sync with latest domains/emails
        update_org(org_id, org_name, domains, emails)
        return org_id

    org = create_org(org_name, domains, emails)
    org_id = org["id"]
    db.table("insecureweb_orgs").insert({
        "user_id": user_id,
        "insecureweb_org_id": org_id,
        "org_name": org_name,
    }).execute()
    return org_id


# ─── Typosquatting (Company Impersonation) ────────────────────────────────────

def get_typosquatting_threats(org_id: int, page: int = 0, size: int = 50) -> dict:
    """
    GET /api/typosquatting/{organizationId}/threats
    Returns paginated list of impersonation domains.
    """
    resp = httpx.get(
        f"{BASE_URL}/api/typosquatting/{org_id}/threats",
        headers=HEADERS,
        params={"page": page, "size": size},
        timeout=TIMEOUT,
    )
    if resp.status_code == 204:
        return {"content": [], "totalElements": 0}
    resp.raise_for_status()
    return resp.json()
