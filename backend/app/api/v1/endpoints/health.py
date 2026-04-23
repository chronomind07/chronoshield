"""
ChronoShield — Health Check Endpoint
Returns real-time status of all infrastructure components.
"""
from fastapi import APIRouter
from app.core.config import settings
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def health_check():
    """
    Full health check: DB, Redis, external APIs.
    Returns 200 if all critical components are healthy, 503 otherwise.
    """
    from fastapi.responses import JSONResponse
    import time

    checks: dict[str, dict] = {}
    overall_ok = True

    # ── Supabase / PostgreSQL ─────────────────────────────────────────────────
    t0 = time.monotonic()
    try:
        from app.db.supabase import get_supabase_client
        db = get_supabase_client()
        db.table("profiles").select("id").limit(1).execute()
        checks["database"] = {"status": "ok", "latency_ms": int((time.monotonic() - t0) * 1000)}
    except Exception as e:
        checks["database"] = {"status": "error", "error": str(e)[:100]}
        overall_ok = False

    # ── Redis ─────────────────────────────────────────────────────────────────
    t0 = time.monotonic()
    try:
        import redis as redis_lib
        r = redis_lib.from_url(settings.REDIS_URL, socket_connect_timeout=2)
        r.ping()
        checks["redis"] = {"status": "ok", "latency_ms": int((time.monotonic() - t0) * 1000)}
    except Exception as e:
        checks["redis"] = {"status": "error", "error": str(e)[:100]}
        # Redis failure doesn't block the API — workers degrade gracefully
        # overall_ok = False  # uncomment if Redis is critical

    # ── Stripe ────────────────────────────────────────────────────────────────
    t0 = time.monotonic()
    try:
        if settings.STRIPE_SECRET_KEY:
            import stripe
            stripe.api_key = settings.STRIPE_SECRET_KEY
            stripe.Balance.retrieve()
            checks["stripe"] = {"status": "ok", "latency_ms": int((time.monotonic() - t0) * 1000)}
        else:
            checks["stripe"] = {"status": "unconfigured"}
    except Exception as e:
        checks["stripe"] = {"status": "error", "error": str(e)[:100]}
        # Stripe down = can't process new payments but existing users still work

    # ── Anthropic / Claude AI ─────────────────────────────────────────────────
    checks["ai"] = {
        "status": "configured" if settings.ANTHROPIC_API_KEY else "unconfigured"
    }

    # ── InsecureWeb ───────────────────────────────────────────────────────────
    checks["insecureweb"] = {
        "status": "configured" if settings.INSECUREWEB_API_KEY else "unconfigured"
    }

    status_code = 200 if overall_ok else 503
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ok" if overall_ok else "degraded",
            "version": settings.APP_VERSION,
            "checks": checks,
        },
    )
