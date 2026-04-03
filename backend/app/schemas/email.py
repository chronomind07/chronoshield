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


class EmailWithSecurity(EmailResponse):
    """Email with DNS security check results (SPF/DKIM/DMARC) and quarantine status."""
    spf_status: Optional[str] = None
    dkim_status: Optional[str] = None
    dmarc_status: Optional[str] = None
    last_email_sec_scan_at: Optional[datetime] = None
    quarantine_status: Optional[str] = "active"   # active | quarantined | recovered
    last_recovered_scan: Optional[datetime] = None
