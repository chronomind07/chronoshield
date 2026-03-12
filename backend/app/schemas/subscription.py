from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime
from enum import Enum


class PlanType(str, Enum):
    starter = "starter"
    business = "business"
    trial = "trial"


class SubscriptionStatus(str, Enum):
    active = "active"
    past_due = "past_due"
    canceled = "canceled"
    trialing = "trialing"
    incomplete = "incomplete"


class SubscriptionResponse(BaseModel):
    id: UUID
    plan: PlanType
    status: SubscriptionStatus
    max_domains: int
    max_emails: int
    current_period_end: Optional[datetime] = None
    cancel_at_period_end: bool


class CheckoutSession(BaseModel):
    url: str


class BillingPortalSession(BaseModel):
    url: str
