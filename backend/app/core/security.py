from jose import JWTError, jwt
from jose.backends import ECKey
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings
import httpx
import base64
import time

bearer_scheme = HTTPBearer()

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
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    """Validate Supabase JWT (ES256 or HS256) and return user payload."""
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
