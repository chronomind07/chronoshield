from fastapi import APIRouter
from app.api.v1.endpoints import domains, emails, billing, dashboard, ai_analysis, darkweb, credits

api_router = APIRouter()

api_router.include_router(dashboard.router)
api_router.include_router(domains.router)
api_router.include_router(emails.router)
api_router.include_router(billing.router)
api_router.include_router(ai_analysis.router)
api_router.include_router(darkweb.router)
api_router.include_router(credits.router)
