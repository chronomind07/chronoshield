"""
ChronoShield — Plan Service
Single source of truth for all plan limits and business logic.
"""
from typing import TypedDict


class PlanLimits(TypedDict):
    max_domains: int
    max_emails: int
    credits_per_month: int
    ai_queries_per_month: int
    darkweb_interval_days: int
    history_days: int
    weekly_reports: bool
    typosquatting: bool


PLAN_LIMITS: dict[str, PlanLimits] = {
    "solo": {
        "max_domains": 1,
        "max_emails": 5,
        "credits_per_month": 5,
        "ai_queries_per_month": 5,
        "darkweb_interval_days": 7,
        "history_days": 30,
        "weekly_reports": False,
        "typosquatting": False,
    },
    "business": {
        "max_domains": 3,
        "max_emails": 15,
        "credits_per_month": 20,
        "ai_queries_per_month": 20,
        "darkweb_interval_days": 3,
        "history_days": 90,
        "weekly_reports": True,
        "typosquatting": True,
    },
    "professional": {
        "max_domains": 5,
        "max_emails": 25,
        "credits_per_month": 40,
        "ai_queries_per_month": 50,
        "darkweb_interval_days": 1,
        "history_days": 180,
        "weekly_reports": True,
        "typosquatting": True,
    },
    "enterprise": {
        "max_domains": 10,
        "max_emails": 50,
        "credits_per_month": 100,
        "ai_queries_per_month": 200,
        "darkweb_interval_days": 1,
        "history_days": 365,
        "weekly_reports": True,
        "typosquatting": True,
    },
}

# Plans that require an active paid subscription
PAID_PLANS: list[str] = list(PLAN_LIMITS.keys())  # solo, business, professional, enterprise

# Monthly Recurring Revenue per plan (€, ex-VAT)
PLAN_MRR: dict[str, int] = {
    "solo": 19,
    "business": 49,
    "professional": 99,
    "enterprise": 199,
}


def get_plan_limits(plan: str) -> PlanLimits:
    """Return limits for a plan. Falls back to solo if plan is unknown."""
    return PLAN_LIMITS.get(plan, PLAN_LIMITS["solo"])


def is_paid_plan(plan: str) -> bool:
    """Return True if the plan is a valid paid plan."""
    return plan in PLAN_LIMITS


def get_ai_query_limit(plan: str) -> int:
    return get_plan_limits(plan)["ai_queries_per_month"]


def get_credits_limit(plan: str) -> int:
    return get_plan_limits(plan)["credits_per_month"]


def get_darkweb_interval(plan: str) -> int:
    return get_plan_limits(plan)["darkweb_interval_days"]
