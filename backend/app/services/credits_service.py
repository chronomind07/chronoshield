"""
Credits service — manages monthly scan credits per user.

Plan allowances:
  starter  → 5 credits / month
  business → 20 credits / month
  trial    → 0 credits / month

Credit packs (one-time Stripe purchase):
  Pack S → 5 credits  (9.99€)
  Pack M → 10 credits (18.99€)
  Pack L → 20 credits (34.99€)
"""

from datetime import date, datetime
from fastapi import HTTPException
from app.core.config import settings
import structlog

logger = structlog.get_logger()

PLAN_MONTHLY_CREDITS = {
    "starter": settings.PLAN_STARTER_CREDITS,    # 5
    "business": settings.PLAN_BUSINESS_CREDITS,  # 20
    "trial": 0,
}

CREDIT_PACKS = {
    "s": {"credits": 5,  "amount_eur": 6.99,  "price_id": settings.STRIPE_CREDITS_S_PRICE_ID},
    "m": {"credits": 12, "amount_eur": 10.99, "price_id": settings.STRIPE_CREDITS_M_PRICE_ID},
    "l": {"credits": 30, "amount_eur": 20.99, "price_id": settings.STRIPE_CREDITS_L_PRICE_ID},
}


def _next_reset_date() -> str:
    """First day of next month as ISO date string."""
    today = date.today()
    if today.month == 12:
        return date(today.year + 1, 1, 1).isoformat()
    return date(today.year, today.month + 1, 1).isoformat()


def get_or_init_credits(user_id: str, db) -> dict:
    """
    Return credits row for user, creating it if it doesn't exist.
    Also auto-resets if reset_date has passed.
    """
    result = db.table("credits").select("*").eq("user_id", user_id).execute()
    row = result.data[0] if result.data else None

    if not row:
        # Get plan from subscriptions
        sub = db.table("subscriptions").select("plan").eq("user_id", user_id).execute()
        plan = sub.data[0]["plan"] if sub.data else "trial"
        monthly = PLAN_MONTHLY_CREDITS.get(plan, 0)
        new_row = {
            "user_id": user_id,
            "plan": plan,
            "credits_available": monthly,
            "credits_used": 0,
            "reset_date": _next_reset_date(),
        }
        inserted = db.table("credits").insert(new_row).execute()
        return inserted.data[0]

    # Check if reset is due
    reset_date = date.fromisoformat(row["reset_date"])
    if date.today() >= reset_date:
        plan = row.get("plan", "trial")
        monthly = PLAN_MONTHLY_CREDITS.get(plan, 0)
        updated = db.table("credits").update({
            "credits_available": monthly,
            "credits_used": 0,
            "reset_date": _next_reset_date(),
        }).eq("user_id", user_id).execute()
        return updated.data[0]

    return row


def consume_credit(user_id: str, db) -> dict:
    """
    Deduct 1 credit atomically using optimistic locking (compare-and-swap).
    Raises HTTP 402 if none available. Returns updated credits row.
    """
    return consume_credits(user_id, 1, db)


def consume_credits(user_id: str, amount: int, db) -> dict:
    """
    Deduct `amount` credits atomically using optimistic locking (compare-and-swap).
    Retries up to 3 times on concurrent modification.
    Raises HTTP 402 if insufficient credits. Returns updated credits row.
    """
    for attempt in range(3):
        row = get_or_init_credits(user_id, db)
        current_available = row["credits_available"]
        current_used = row["credits_used"]

        if current_available < amount:
            raise HTTPException(
                status_code=402,
                detail={
                    "code": "NO_CREDITS",
                    "message": (
                        f"Necesitas {amount} crédito(s) pero solo tienes {current_available} disponibles."
                        if amount > 1
                        else "No tienes créditos disponibles. Compra un pack para continuar."
                    ),
                    "credits_available": current_available,
                    "credits_needed": amount,
                },
            )

        # Compare-and-swap: update only if credits_available hasn't changed since we read it
        result = (
            db.table("credits")
            .update({
                "credits_available": current_available - amount,
                "credits_used": current_used + amount,
            })
            .eq("user_id", user_id)
            .eq("credits_available", current_available)  # only update if still same value
            .execute()
        )

        if result.data:
            logger.info(
                "Credits consumed",
                user_id=user_id,
                amount=amount,
                remaining=result.data[0]["credits_available"],
                attempt=attempt,
            )
            return result.data[0]

        # result.data is empty → concurrent modification detected, retry
        logger.warning(
            "Credit CAS conflict, retrying",
            user_id=user_id,
            attempt=attempt,
        )

    raise HTTPException(
        status_code=429,
        detail={
            "code": "CREDITS_CONFLICT",
            "message": "No se pudo procesar el crédito. Inténtalo de nuevo.",
        },
    )


def add_credits(user_id: str, amount: int, plan: str | None, db) -> dict:
    """Add credits to a user (from Stripe purchase or plan upgrade)."""
    row = get_or_init_credits(user_id, db)
    update_data: dict = {"credits_available": row["credits_available"] + amount}
    if plan:
        update_data["plan"] = plan
    updated = db.table("credits").update(update_data).eq("user_id", user_id).execute()
    logger.info("Credits added", user_id=user_id, amount=amount,
                new_total=updated.data[0]["credits_available"])
    return updated.data[0]


def reset_monthly_credits_all(db) -> int:
    """
    Reset credits for all users whose reset_date <= today.
    Called by Celery beat on the 1st of each month.
    Returns number of users reset.
    """
    today = date.today().isoformat()
    due = db.table("credits").select("user_id,plan").lte("reset_date", today).execute().data
    count = 0
    for row in due:
        plan = row.get("plan", "trial")
        monthly = PLAN_MONTHLY_CREDITS.get(plan, 0)
        db.table("credits").update({
            "credits_available": monthly,
            "credits_used": 0,
            "reset_date": _next_reset_date(),
        }).eq("user_id", row["user_id"]).execute()
        count += 1
    logger.info("Monthly credits reset", users_reset=count)
    return count
