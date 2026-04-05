"""
Credits endpoints.

GET  /credits              — current credits status
POST /credits/checkout/{pack}  — Stripe checkout for credit pack (s/m/l)
"""

import stripe
from fastapi import APIRouter, Depends, HTTPException
from app.core.security import get_current_user_id
from app.core.config import settings
from app.db.supabase import get_db
from app.services.credits_service import get_or_init_credits, CREDIT_PACKS
import structlog

logger = structlog.get_logger()

stripe.api_key = settings.STRIPE_SECRET_KEY
router = APIRouter(prefix="/credits", tags=["credits"])


@router.get("")
async def get_credits(
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Return current credit balance and reset date."""
    credits = get_or_init_credits(user_id, db)
    return {
        **credits,
        "packs": {
            k: {"credits": v["credits"], "amount_eur": v["amount_eur"]}
            for k, v in CREDIT_PACKS.items()
        },
    }


@router.post("/checkout/{pack}")
async def credits_checkout(
    pack: str,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """
    Create a Stripe Checkout Session for a one-time credit pack purchase.
    pack: s | m | l
    """
    if pack not in CREDIT_PACKS:
        raise HTTPException(status_code=400, detail=f"Pack inválido. Opciones: {', '.join(CREDIT_PACKS)}")

    # Free / trial users cannot purchase credits — they need a paid plan first
    try:
        sub_plan = db.table("subscriptions").select("plan, status, stripe_customer_id").eq("user_id", user_id).single().execute()
        plan_name   = sub_plan.data.get("plan",   "free") if sub_plan.data else "free"
        plan_status = sub_plan.data.get("status", "")     if sub_plan.data else ""
        stripe_customer_id = sub_plan.data.get("stripe_customer_id") if sub_plan.data else None
    except Exception as e:
        logger.warning("credits_checkout: subscription lookup failed", user_id=user_id, error=str(e))
        plan_name, plan_status, stripe_customer_id = "free", "", None

    logger.info("credits_checkout", user_id=user_id, pack=pack, plan=plan_name, status=plan_status)

    if plan_name in ("free", "trial") or plan_status == "trialing":
        raise HTTPException(
            status_code=403,
            detail="Los créditos están disponibles con un plan de pago. Mejora tu plan primero.",
        )

    pack_info = CREDIT_PACKS[pack]
    price_id  = pack_info["price_id"]

    if not price_id:
        logger.error("credits_checkout: price_id not configured", pack=pack)
        raise HTTPException(
            status_code=503,
            detail="Los packs de créditos todavía no están configurados. Contacta con soporte.",
        )

    logger.info("credits_checkout: price_id ok", pack=pack, price_id=price_id)

    # ── Get or create Stripe customer, validating against stale IDs ──────────
    def _create_new_customer() -> str:
        try:
            profile = db.table("profiles").select("email").eq("id", user_id).execute()
            email = profile.data[0].get("email") if profile.data else None
        except Exception:
            email = None
        c = stripe.Customer.create(
            metadata={"supabase_user_id": user_id},
            email=email,
        )
        db.table("subscriptions").update({"stripe_customer_id": c.id}).eq("user_id", user_id).execute()
        logger.info("credits_checkout: created new Stripe customer", customer_id=c.id, user_id=user_id)
        return c.id

    if not stripe_customer_id:
        logger.info("credits_checkout: no customer_id, creating new", user_id=user_id)
        stripe_customer_id = _create_new_customer()
    else:
        # Validate the customer still exists (guard against stale IDs from old Stripe accounts)
        try:
            stripe.Customer.retrieve(stripe_customer_id)
            logger.info("credits_checkout: customer validated", customer_id=stripe_customer_id)
        except stripe.error.InvalidRequestError as e:
            if "No such customer" in str(e):
                logger.warning(
                    "credits_checkout: stale Stripe customer, creating new",
                    old_id=stripe_customer_id, user_id=user_id,
                )
                stripe_customer_id = _create_new_customer()
            else:
                logger.error("credits_checkout: Stripe customer retrieve error", error=str(e))
                raise HTTPException(status_code=502, detail="Error al validar el cliente de pago.")

    # ── Create Stripe Checkout Session ───────────────────────────────────────
    try:
        session = stripe.checkout.Session.create(
            customer=stripe_customer_id,
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            mode="payment",  # one-time, not subscription
            success_url="https://chronoshield.eu/dashboard/darkweb?credits=success",
            cancel_url="https://chronoshield.eu/dashboard/darkweb",
            metadata={
                "user_id": user_id,
                "credit_pack": pack,
                "credits_to_add": str(pack_info["credits"]),
            },
        )
    except stripe.error.StripeError as e:
        logger.error("credits_checkout: Stripe session creation failed", error=str(e), pack=pack, user_id=user_id)
        raise HTTPException(status_code=502, detail=f"Error al crear la sesión de pago: {str(e)}")

    logger.info("credits_checkout: session created", session_id=session.id, user_id=user_id, pack=pack)
    return {"url": session.url}
