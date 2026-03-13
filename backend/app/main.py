from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from app.core.config import settings
from app.api.v1.router import api_router
import structlog
import traceback

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("ChronoShield API starting", version=settings.APP_VERSION)
    yield
    logger.info("ChronoShield API shutting down")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    logger.error("Unhandled exception", path=str(request.url), error=str(exc), traceback=tb)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal error: {type(exc).__name__}: {str(exc)}"},
    )


@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.APP_VERSION}


@app.get("/debug-config")
async def debug_config():
    """Temporary: show masked config to diagnose Railway env var issues."""
    sk = settings.SUPABASE_SERVICE_KEY
    url = settings.SUPABASE_URL
    return {
        "supabase_url": url,
        "service_key_length": len(sk),
        "service_key_prefix": sk[:20] if sk else "",
        "service_key_suffix": sk[-10:] if sk else "",
        "service_key_has_spaces": " " in sk or sk != sk.strip(),
    }
