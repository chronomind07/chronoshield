import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from app.core.security import get_current_user_id
from app.core.config import settings
from app.db.supabase import get_db
from app.schemas.subscription import SubscriptionResponse, CheckoutSession, BillingPortalSession
import structlog

logger = structlog.get_logger()

stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter(prefix="/billing", tags=["billing"])

PLAN_PRICES = {
    "starter": settings.STRIPE_STARTER_PRICE_ID,
    "business": settings.STRIPE_BUSINESS_PRICE_ID,
}

PLAN_LIMITS = {
    "starter": {"max_domains": 1, "max_emails": 10},
    "business": {"max_domains": 3, "max_emails": 30},
}


@router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription(
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    result = db.table("subscriptions").select("*").eq("user_id", user_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return SubscriptionResponse(**result.data)


@router.post("/checkout/{plan}", response_model=CheckoutSession)
async def create_checkout_session(
    plan: str,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    if plan not in PLAN_PRICES:
        raise HTTPException(status_code=400, detail="Invalid plan")

    profile = db.table("profiles").select("*").eq("id", user_id).single().execute()
    sub = db.table("subscriptions").select("*").eq("user_id", user_id).single().execute()

    # Get or create Stripe customer
    stripe_customer_id = sub.data.get("stripe_customer_id") if sub.data else None
    if not stripe_customer_id:
        customer = stripe.Customer.create(
            metadata={"supabase_user_id": user_id},
            email=profile.data.get("email") if profile.data else None,
        )
        stripe_customer_id = customer.id
        db.table("subscriptions").update({"stripe_customer_id": stripe_customer_id}).eq(
            "user_id", user_id
        ).execute()

    session = stripe.checkout.Session.create(
        customer=stripe_customer_id,
        payment_method_types=["card"],
        line_items=[{"price": PLAN_PRICES[plan], "quantity": 1}],
        mode="subscription",
        success_url="https://app.chronoshield.io/dashboard?upgrade=success",
        cancel_url="https://app.chronoshield.io/billing?upgrade=canceled",
        metadata={"user_id": user_id, "plan": plan},
    )
    return CheckoutSession(url=session.url)


@router.post("/portal", response_model=BillingPortalSession)
async def create_billing_portal(
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    sub = db.table("subscriptions").select("stripe_customer_id").eq("user_id", user_id).single().execute()
    if not sub.data or not sub.data.get("stripe_customer_id"):
        raise HTTPException(status_code=400, detail="No Stripe customer found")

    session = stripe.billing_portal.Session.create(
        customer=sub.data["stripe_customer_id"],
        return_url="https://app.chronoshield.io/billing",
    )
    return BillingPortalSession(url=session.url)


@router.post("/webhook")
async def stripe_webhook(request: Request, stripe_signature: str = Header(None)):
    """Handle Stripe webhook events."""
    body = await request.body()
    try:
        event = stripe.Webhook.construct_event(
            body, stripe_signature, settings.STRIPE_WEBHOOK_SECRET
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    db = get_db()

    # Idempotency check: ignore duplicate Stripe events
    try:
        db.table("stripe_events").insert({"event_id": event["id"]}).execute()
    except Exception as e:
        # Unique violation means we already processed this event
        if "duplicate" in str(e).lower() or "unique" in str(e).lower() or "23505" in str(e):
            logger.info("Stripe webhook duplicate, skipping", event_id=event["id"])
            return {"status": "ok"}
        # For any other DB error, log but continue processing (don't lose events)
        logger.warning("Stripe events table insert failed", event_id=event["id"], error=str(e))

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session["metadata"].get("user_id")
        if not user_id:
            return {"status": "ok"}

        # ── Credit pack purchase (one-time payment) ──────────────────────────
        credit_pack = session["metadata"].get("credit_pack")
        if credit_pack:
            from app.services.credits_service import add_credits
            credits_to_add = int(session["metadata"].get("credits_to_add", 0))
            if credits_to_add > 0:
                add_credits(user_id, credits_to_add, None, db)
            return {"status": "ok"}

        # ── Subscription upgrade ─────────────────────────────────────────────
        plan = session["metadata"].get("plan")
        if not plan or plan not in PLAN_LIMITS:
            return {"status": "ok"}
        limits = PLAN_LIMITS[plan]

        db.table("subscriptions").update(
            {
                "plan": plan,
                "status": "active",
                "stripe_subscription_id": session.get("subscription"),
                **limits,
            }
        ).eq("user_id", user_id).execute()

        # Sync credits when plan changes
        from app.services.credits_service import add_credits
        add_credits(user_id, 0, plan, db)  # just updates the plan label

    elif event["type"] == "customer.subscription.updated":
        sub = event["data"]["object"]
        stripe_sub_id = sub["id"]
        status = sub["status"]
        period_end = sub["current_period_end"]

        db.table("subscriptions").update(
            {
                "status": status,
                "current_period_end": period_end,
                "cancel_at_period_end": sub.get("cancel_at_period_end", False),
            }
        ).eq("stripe_subscription_id", stripe_sub_id).execute()

    elif event["type"] == "customer.subscription.deleted":
        sub = event["data"]["object"]
        db.table("subscriptions").update(
            {"status": "canceled", "plan": "trial"}
        ).eq("stripe_subscription_id", sub["id"]).execute()

    return {"status": "ok"}
