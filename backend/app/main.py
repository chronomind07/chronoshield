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
    sk = settings.SUPABASE_SERVICE_KEY
    return {
        "status": "ok",
        "version": settings.APP_VERSION,
        "supabase_url": settings.SUPABASE_URL,
        "service_key_len": len(sk),
        "service_key_tail": sk[-8:] if sk else "",
        "service_key_stripped": sk == sk.strip(),
    }
