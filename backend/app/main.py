from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from contextlib import asynccontextmanager
from app.core.config import settings
from app.api.v1.router import api_router
import structlog
import traceback
import re as _re

logger = structlog.get_logger()

# ── Allowed origins ───────────────────────────────────────────────────────────
# Hardcoded so they are NEVER dropped by a stale CORS_ORIGINS env var in Railway.
_PRODUCTION_ORIGINS: list[str] = [
    "https://chronoshield.eu",
    "https://www.chronoshield.eu",
]
_cors_origins: list[str] = list(
    dict.fromkeys(_PRODUCTION_ORIGINS + list(settings.CORS_ORIGINS))
)
_ORIGIN_RE = _re.compile(r"https://(www\.)?chronoshield\.eu")


def _cors_headers(request: Request) -> dict[str, str]:
    """
    Return CORS response headers when the requesting Origin is allowed.

    FastAPI/Starlette exception handlers can bypass CORSMiddleware and return
    responses directly (without going back through the middleware chain), so
    CORS headers must be injected manually in every exception handler.
    """
    origin = request.headers.get("origin", "")
    if origin in _cors_origins or _ORIGIN_RE.fullmatch(origin):
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Vary": "Origin",
        }
    return {}


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

# CORSMiddleware MUST be added first so it wraps the entire app — including
# error responses.  Belt-and-suspenders: exception handlers also inject headers
# manually (see below) because FastAPI exception handlers can bypass middleware.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=r"(https://(www\.)?chronoshield\.eu|chrome-extension://REPLACE_WITH_EXTENSION_ID)",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


# ── Exception handlers ────────────────────────────────────────────────────────
# Each handler injects CORS headers via _cors_headers() so that 4xx/5xx
# responses are never blocked by the browser's CORS check.

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=_cors_headers(request),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
        headers=_cors_headers(request),
    )


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
        headers=_cors_headers(request),
    )


@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.APP_VERSION}
