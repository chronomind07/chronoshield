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

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    # Hardcoded regex covers Chrome extensions + chronoshield.eu (www and apex).
    # This ensures CORS works even if Railway has a stale CORS_ORIGINS env var.
    # TODO: Replace chrome-extension://.* with your specific Chrome extension ID once published.
    #       e.g. chrome-extension://abcdefghijklmnopabcdefghijklmnop
    allow_origin_regex=r"(chrome-extension://.*|https://(www\.)?chronoshield\.eu)",
    allow_credentials=True,
    allow_methods=["*"],
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
