from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # App
    APP_NAME: str = "ChronoShield"
    APP_VERSION: str = "1.0.0"
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

    # Claude AI
    ANTHROPIC_API_KEY: str = ""

    # Email (Resend)
    RESEND_API_KEY: str = ""
    FROM_EMAIL: str = "alerts@chronoshield.io"

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
