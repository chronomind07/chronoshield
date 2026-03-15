from pydantic import BaseModel, field_validator
from typing import Optional
from uuid import UUID
from datetime import datetime
import re


class DomainCreate(BaseModel):
    domain: str

    @field_validator("domain")
    @classmethod
    def validate_domain(cls, v: str) -> str:
        v = v.lower().strip().removeprefix("https://").removeprefix("http://").rstrip("/")
        pattern = r"^([a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$"
        if not re.match(pattern, v):
            raise ValueError("Invalid domain format")
        return v


class DomainResponse(BaseModel):
    id: UUID
    domain: str
    is_active: bool
    verified: bool
    created_at: datetime
    last_scanned_at: Optional[datetime] = None


class DomainWithMetrics(DomainResponse):
    ssl_status: Optional[str] = None
    ssl_days_remaining: Optional[int] = None
    uptime_status: Optional[str] = None
    last_response_ms: Optional[int] = None
    spf_status: Optional[str] = None
    dkim_status: Optional[str] = None
    dmarc_status: Optional[str] = None
    security_score: Optional[int] = None
