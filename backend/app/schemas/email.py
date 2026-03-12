from pydantic import BaseModel, EmailStr
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class EmailCreate(BaseModel):
    email: EmailStr


class EmailResponse(BaseModel):
    id: UUID
    email: str
    is_active: bool
    created_at: datetime


class BreachResult(BaseModel):
    id: UUID
    email: str
    scanned_at: datetime
    breaches_found: int
    breach_data: Optional[dict] = None
    is_new: bool


class EmailWithBreaches(EmailResponse):
    latest_breach: Optional[BreachResult] = None
    total_breaches: int = 0
