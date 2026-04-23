from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # App
    APP_NAME: str = "ChronoShield"
    APP_VERSION: str = "1.2.0"
    DEBUG: bool = False
    API_V1_STR: str = "/api/v1"

    # Supabase
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_KEY: str
    SUPABASE_JWT_SECRET: str = ""
    DATABASE_URL: str = ""

    # Redis (for Celery and rate limiting)
    REDIS_URL: str = "redis://localhost:6379/0"

    # Stripe — Subscription plans
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_SOLO_PRICE_ID: str = ""          # Solo plan: 19€+IVA/mes
    STRIPE_BUSINESS_PRICE_ID: str = ""      # Business plan: 49€+IVA/mes
    STRIPE_PROFESSIONAL_PRICE_ID: str = ""  # Professional plan: 99€+IVA/mes

    # Stripe — Credit packs (one-time payments)
    STRIPE_CREDITS_S_PRICE_ID: str = ""   # Pack S: 6.99€ → 5 credits
    STRIPE_CREDITS_M_PRICE_ID: str = ""   # Pack M: 10.99€ → 12 credits
    STRIPE_CREDITS_L_PRICE_ID: str = ""   # Pack L: 20.99€ → 30 credits

    # InsecureWeb
    INSECUREWEB_API_KEY: str = ""
    INSECUREWEB_USERNAME: str = ""
    INSECUREWEB_PASSWORD: str = ""
    INSECUREWEB_BASE_URL: str = "https://app.insecureweb.com"

    # Admin
    ADMIN_SECRET_KEY: str = "change-me-in-railway"

    # Claude AI
    ANTHROPIC_API_KEY: str = ""

    # Email (Resend)
    RESEND_API_KEY: str = ""
    FROM_EMAIL: str = "alerts@chronoshield.eu"

    # Telegram (future)
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_ADMIN_CHAT_ID: str = ""

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "https://chronoshield-brown.vercel.app",
        "https://chronoshield-9e4lqlu9h-chronomind07s-projects.vercel.app",
        "https://chronoshield-8zfsq6oz4-chronomind07s-projects.vercel.app",
        "https://chronoshield.eu",
        "https://www.chronoshield.eu",
    ]

    # Google Safe Browsing API (Chrome extension)
    GOOGLE_SAFE_BROWSING_API_KEY: str = ""

    # Scan intervals (minutes) — used by Celery beat schedule
    BREACH_SCAN_INTERVAL: int = 1440   # daily
    SSL_SCAN_INTERVAL: int = 60         # hourly
    UPTIME_SCAN_INTERVAL: int = 5       # every 5 min
    EMAIL_SEC_SCAN_INTERVAL: int = 720  # twice daily


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
