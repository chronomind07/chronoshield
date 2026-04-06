from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # App
    APP_NAME: str = "ChronoShield"
    APP_VERSION: str = "1.1.1"
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
    STRIPE_STARTER_COUPON_ID: str = ""   # Launch discount: 11.99€ off month 1
    STRIPE_BUSINESS_COUPON_ID: str = ""  # Launch discount: 13.99€ off month 1

    # InsecureWeb
    # Auth method 1 (API-key plan): set INSECUREWEB_API_KEY in Railway
    # Auth method 2 (user/pass plan): set INSECUREWEB_USERNAME + INSECUREWEB_PASSWORD
    # The service tries method 1 first; falls back to method 2 automatically.
    INSECUREWEB_API_KEY: str = ""
    INSECUREWEB_USERNAME: str = ""   # your InsecureWeb login email
    INSECUREWEB_PASSWORD: str = ""   # your InsecureWeb login password
    INSECUREWEB_BASE_URL: str = "https://app.insecureweb.com"

    # Stripe — Credit packs (one-time payments)
    STRIPE_CREDITS_S_PRICE_ID: str = ""   # Pack S: 6.99€ → 5 credits
    STRIPE_CREDITS_M_PRICE_ID: str = ""   # Pack M: 10.99€ → 12 credits
    STRIPE_CREDITS_L_PRICE_ID: str = ""   # Pack L: 20.99€ → 30 credits

    # Free / trial plan limits
    PLAN_FREE_DOMAINS: int = 1
    PLAN_FREE_EMAILS: int = 1

    # Plan credits per month
    PLAN_STARTER_CREDITS: int = 5
    PLAN_BUSINESS_CREDITS: int = 15

    # Admin — set ADMIN_SECRET_KEY in Railway env vars
    ADMIN_SECRET_KEY: str = "change-me-in-railway"

    # Claude AI
    ANTHROPIC_API_KEY: str = ""

    # Email (Resend)
    RESEND_API_KEY: str = ""
    FROM_EMAIL: str = "alerts@chronoshield.eu"

    # CORS — do NOT set CORS_ORIGINS in Railway; delete that var if it exists.
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "https://chronoshield-brown.vercel.app",
        "https://chronoshield-9e4lqlu9h-chronomind07s-projects.vercel.app",
        "https://chronoshield-8zfsq6oz4-chronomind07s-projects.vercel.app",
        "https://chronoshield.eu",
        "https://www.chronoshield.eu",
    ]

    # Plans config
    PLAN_STARTER_DOMAINS: int = 1
    PLAN_STARTER_EMAILS: int = 5
    PLAN_BUSINESS_DOMAINS: int = 2
    PLAN_BUSINESS_EMAILS: int = 15

    # Google Safe Browsing API (Chrome extension phishing detection)
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
