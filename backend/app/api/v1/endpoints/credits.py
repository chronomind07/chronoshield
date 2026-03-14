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

    pack_info = CREDIT_PACKS[pack]
    price_id = pack_info["price_id"]

    if not price_id:
        raise HTTPException(
            status_code=503,
            detail="Los packs de créditos todavía no están configurados. Contacta con soporte.",
        )

    # Get or create Stripe customer
    sub = db.table("subscriptions").select("stripe_customer_id").eq("user_id", user_id).execute()
    stripe_customer_id = sub.data[0].get("stripe_customer_id") if sub.data else None

    if not stripe_customer_id:
        profile = db.table("profiles").select("*").eq("id", user_id).execute()
        customer = stripe.Customer.create(
            metadata={"supabase_user_id": user_id},
            email=profile.data[0].get("email") if profile.data else None,
        )
        stripe_customer_id = customer.id
        db.table("subscriptions").update(
            {"stripe_customer_id": stripe_customer_id}
        ).eq("user_id", user_id).execute()

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
    return {"url": session.url}
