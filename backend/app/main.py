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
    logger.info("ChronoShield API starting", version=settings.APP_VERSION, debug=settings.DEBUG)
    if not settings.ADMIN_SECRET_KEY or settings.ADMIN_SECRET_KEY == "change-me-in-railway":
        logger.warning(
            "SECURITY WARNING: ADMIN_SECRET_KEY is set to the insecure default value. "
            "Admin endpoints will return 503 until a proper key is configured in Railway."
        )
    yield
    logger.info("ChronoShield API shutting down")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# Production origins are hardcoded here so they are NEVER dropped by a stale
# CORS_ORIGINS env var in Railway.  settings.CORS_ORIGINS adds any extra origins
# (local dev, staging, etc.) configured via the environment variable.
_PRODUCTION_ORIGINS: list[str] = [
    "https://chronoshield.eu",
    "https://www.chronoshield.eu",
]
_cors_origins: list[str] = list(
    dict.fromkeys(_PRODUCTION_ORIGINS + list(settings.CORS_ORIGINS))
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    # Regex is a belt-and-suspenders fallback for Chrome extensions and the
    # production domain in case allow_origins is somehow overridden.
    # TODO: Replace chrome-extension://.* with your specific extension ID once published.
    allow_origin_regex=r"https://(www\.)?chronoshield\.eu",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    logger.error(
        "Unhandled exception",
        path=str(request.url),
        error=str(exc),
        exc_type=type(exc).__name__,
        traceback=tb,
        exc_info=exc,
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_error",
            "detail": "Ha ocurrido un error interno. Contacta con soporte si persiste.",
        },
    )


@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.APP_VERSION}
