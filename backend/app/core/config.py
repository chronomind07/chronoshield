from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # App
    APP_NAME: str = "ChronoShield"
    APP_VERSION: str = "1.0.1"
    DEBUG: bool = False
    API_V1_STR: str = "/api/v1"

    # Supabase
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_KEY: str
    SUPABASE_JWT_SECRET: str = ""
    DATABASE_URL: str = ""

    # Redis (for Celery)
    REDIS_URL: str = "redis://localhost:6379/0"

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_STARTER_PRICE_ID: str = ""
    STRIPE_BUSINESS_PRICE_ID: str = ""

    # InsecureWeb
    INSECUREWEB_API_KEY: str = ""
    INSECUREWEB_BASE_URL: str = "https://app.insecureweb.com"

    # Stripe — Credit packs (one-time payments)
    STRIPE_CREDITS_S_PRICE_ID: str = ""   # Pack S: 9.99€ → 5 credits
    STRIPE_CREDITS_M_PRICE_ID: str = ""   # Pack M: 18.99€ → 10 credits
    STRIPE_CREDITS_L_PRICE_ID: str = ""   # Pack L: 34.99€ → 20 credits

    # Plan credits per month
    PLAN_STARTER_CREDITS: int = 5
    PLAN_BUSINESS_CREDITS: int = 20

    # Claude AI
    ANTHROPIC_API_KEY: str = ""

    # Email (Resend)
    RESEND_API_KEY: str = ""
    FROM_EMAIL: str = "alerts@chronoshield.io"

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "https://app.chronoshield.io",
        "https://chronoshield-brown.vercel.app",
        "https://chronoshield-9e4lqlu9h-chronomind07s-projects.vercel.app",
        "https://chronoshield-8zfsq6oz4-chronomind07s-projects.vercel.app",
        "https://chronoshield.eu",
        "https://www.chronoshield.eu",
    ]

    # Plans config
    PLAN_STARTER_DOMAINS: int = 1
    PLAN_STARTER_EMAILS: int = 10
    PLAN_BUSINESS_DOMAINS: int = 3
    PLAN_BUSINESS_EMAILS: int = 30

    # Scan intervals (minutes)
    BREACH_SCAN_INTERVAL: int = 1440   # daily
    SSL_SCAN_INTERVAL: int = 60         # hourly
    UPTIME_SCAN_INTERVAL: int = 5       # every 5 min
    EMAIL_SEC_SCAN_INTERVAL: int = 720  # twice daily


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
