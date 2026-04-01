"""
Uptime timeline API endpoint.

Returns sampled uptime check history from `uptime_results` for the
History page's Uptime tab. Data is read directly from the table — these
checks are NOT part of the general activity log.
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from app.core.security import get_current_user_id
from app.db.supabase import get_db
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/uptime", tags=["uptime"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class UptimePoint(BaseModel):
    checked_at: str
    status: str                      # up | down | degraded | error
    response_time_ms: Optional[int]


class UptimeDomain(BaseModel):
    id: str
    domain: str


class UptimeTimeline(BaseModel):
    domain_id: str
    domain: str
    uptime_pct: float                # 0.0–100.0
    avg_response_ms: Optional[float]
    total_checks: int
    down_checks: int
    degraded_checks: int
    range: str                       # 24h | 7d | 30d
    points: List[UptimePoint]        # sampled points for the timeline bar


class UptimeDomainsResponse(BaseModel):
    domains: List[UptimeDomain]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _range_cutoff(range_str: str) -> str:
    now = datetime.now(timezone.utc)
    if range_str == "24h":
        return (now - timedelta(hours=24)).isoformat()
    if range_str == "7d":
        return (now - timedelta(days=7)).isoformat()
    return (now - timedelta(days=30)).isoformat()


def _sample(rows: list, max_points: int) -> list:
    """Return at most max_points evenly spaced items from rows."""
    if len(rows) <= max_points:
        return rows
    step = len(rows) / max_points
    return [rows[int(i * step)] for i in range(max_points)]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/domains", response_model=UptimeDomainsResponse)
async def get_uptime_domains(
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """List active domains for the domain selector in the Uptime tab."""
    rows = (
        db.table("domains")
        .select("id,domain")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
        .data
    ) or []
    return UptimeDomainsResponse(domains=[UptimeDomain(**r) for r in rows])


@router.get("/timeline", response_model=UptimeTimeline)
async def get_uptime_timeline(
    domain_id: str = Query(..., description="Domain UUID"),
    range: str = Query("24h", description="Time range: 24h | 7d | 30d"),
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """
    Return uptime check history for one domain over the requested time range.
    Points are sampled to ≤500 for the frontend timeline visualisation.
    """
    if range not in ("24h", "7d", "30d"):
        raise HTTPException(400, "range must be 24h, 7d or 30d")

    # Verify domain belongs to this user
    domain_row = (
        db.table("domains")
        .select("id,domain")
        .eq("id", domain_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
        .data
    )
    if not domain_row:
        raise HTTPException(404, "Domain not found")

    cutoff = _range_cutoff(range)

    # Max DB rows: 24h=288, 7d=2016, 30d=8640 (at 5-min intervals).
    # Fetch up to 9 000 and sample down to 500 for the chart.
    rows = (
        db.table("uptime_results")
        .select("checked_at,status,response_time_ms")
        .eq("domain_id", domain_id)
        .gte("checked_at", cutoff)
        .order("checked_at", desc=False)
        .limit(9000)
        .execute()
        .data
    ) or []

    total        = len(rows)
    down_count   = sum(1 for r in rows if r["status"] == "down")
    degraded_cnt = sum(1 for r in rows if r["status"] == "degraded")
    up_count     = sum(1 for r in rows if r["status"] in ("up", "degraded"))

    uptime_pct = round(up_count / total * 100, 2) if total > 0 else 100.0

    rt_vals = [r["response_time_ms"] for r in rows if r.get("response_time_ms") is not None]
    avg_ms  = round(sum(rt_vals) / len(rt_vals), 0) if rt_vals else None

    # Sample to max 500 points for the frontend bar chart
    sampled = _sample(rows, 500)
    points  = [UptimePoint(**r) for r in sampled]

    return UptimeTimeline(
        domain_id=domain_id,
        domain=domain_row[0]["domain"],
        uptime_pct=uptime_pct,
        avg_response_ms=avg_ms,
        total_checks=total,
        down_checks=down_count,
        degraded_checks=degraded_cnt,
        range=range,
        points=points,
    )
