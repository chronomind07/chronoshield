from jose import JWTError, jwt
from jose.backends import ECKey
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings
import httpx
import base64
import time

bearer_scheme = HTTPBearer(auto_error=False)
# auto_error=False: returns None instead of raising 403 when Authorization header
# is missing. We raise 401 explicitly below so the client gets the correct status.

# Cache de JWKS para no llamar al endpoint en cada request
_jwks_cache: dict | None = None
_jwks_cache_timestamp: float = 0.0
_JWKS_TTL_SECONDS: float = 3600.0  # Refresh JWKS every hour

async def _get_jwks() -> dict:
    global _jwks_cache, _jwks_cache_timestamp
    if _jwks_cache is None or time.time() - _jwks_cache_timestamp > _JWKS_TTL_SECONDS:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
            )
            _jwks_cache = resp.json()
            _jwks_cache_timestamp = time.time()
    return _jwks_cache


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
):
    """Validate Supabase JWT (ES256 or HS256) and return user payload."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = credentials.credentials
    try:
        # Detectar algoritmo del header sin verificar
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")

        if alg == "ES256":
            # Validar con clave pública JWKS
            jwks = await _get_jwks()
            kid = header.get("kid")
            key_data = next(
                (k for k in jwks["keys"] if k.get("kid") == kid),
                jwks["keys"][0]
            )
            # Construir clave pública EC desde JWK
            public_key = ECKey(key_data, algorithm="ES256")
            payload = jwt.decode(
                token,
                public_key,
                algorithms=["ES256"],
                audience="authenticated",
            )
        else:
            # Fallback HS256 con JWT secret
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )

        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return payload

    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )


async def get_current_user_id(
    current_user: dict = Depends(get_current_user),
) -> str:
    return current_user["sub"]


# ── Admin role dependencies ────────────────────────────────────────────────────

async def get_current_user_with_role(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    """Validate JWT and enrich payload with role from profiles table."""
    from app.db.supabase import get_supabase_client
    payload = await get_current_user(credentials)
    user_id = payload["sub"]
    try:
        db = get_supabase_client()
        result = db.table("profiles").select("role").eq("id", user_id).execute()
        role = result.data[0]["role"] if result.data else "user"
    except Exception:
        role = "user"
    payload["role"] = role
    return payload


async def require_admin(
    user: dict = Depends(get_current_user_with_role),
) -> dict:
    """Allow access only to admin or superadmin roles."""
    if user.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def require_superadmin(
    user: dict = Depends(get_current_user_with_role),
) -> dict:
    """Allow access only to superadmin role."""
    if user.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="Superadmin access required")
    return user
