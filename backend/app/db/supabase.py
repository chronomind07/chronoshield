from supabase import create_client, Client
from app.core.config import settings
from functools import lru_cache


@lru_cache
def get_supabase_client() -> Client:
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)


# Alias for dependency injection
def get_db() -> Client:
    return get_supabase_client()
