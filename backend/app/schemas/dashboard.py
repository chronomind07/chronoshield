from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID
from datetime import datetime


class SecurityScoreResponse(BaseModel):
    domain_id: Optional[UUID] = None
    overall_score: int
    breach_score: int
    ssl_score: int
    uptime_score: int
    email_sec_score: int
    grade: Optional[str] = None
    calculated_at: datetime


class AlertResponse(BaseModel):
    id: UUID
    alert_type: str
    severity: str
    title: str
    message: str
    sent_at: datetime
    read_at: Optional[datetime] = None
    domain_id: Optional[UUID] = None


class DashboardSummary(BaseModel):
    domains_monitored: int
    emails_monitored: int
    active_alerts: int
    average_score: int
    domains_with_ssl_issues: int
    domains_down: int
    breached_emails: int
    recent_alerts: List[AlertResponse]
    # Individual score components (average of latest score per domain)
    avg_ssl_score: int = 0
    avg_uptime_score: int = 0
    avg_email_sec_score: int = 0
    avg_breach_score: int = 0
