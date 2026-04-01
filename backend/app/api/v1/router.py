from fastapi import APIRouter
from app.api.v1.endpoints import (
    domains, emails, billing, dashboard, ai_analysis,
    darkweb, credits, admin, alerts, history, settings, contact, extension,
    mitigation, uptime,
)

api_router = APIRouter()

# ── Public endpoints (no auth required) ───────────────────────────────────────
api_router.include_router(contact.router)

# ── Protected endpoints (auth enforced per-route via get_current_user_id) ─────
api_router.include_router(dashboard.router)
api_router.include_router(domains.router)
api_router.include_router(emails.router)
api_router.include_router(billing.router)
api_router.include_router(ai_analysis.router)
api_router.include_router(darkweb.router)
api_router.include_router(credits.router)
api_router.include_router(admin.router)
api_router.include_router(alerts.router)
api_router.include_router(history.router)
api_router.include_router(settings.router)
api_router.include_router(extension.router)
api_router.include_router(mitigation.router)
api_router.include_router(uptime.router)
