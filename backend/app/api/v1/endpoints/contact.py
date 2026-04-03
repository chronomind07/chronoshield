"""
Public contact-form endpoint.
No authentication required — any visitor can send a message.
"""
import html
import time
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr
import resend
import structlog

from app.core.config import settings

logger = structlog.get_logger()
router = APIRouter(prefix="/contact", tags=["contact"])

# ── In-memory rate limiting: max 3 requests per IP per hour ──────────────────
_contact_rate_limit: dict[str, list[float]] = {}


class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    message: str


class WaitlistRequest(BaseModel):
    email: EmailStr


@router.post("")
async def send_contact_email(req: ContactRequest, request: Request):
    """Receive a contact-form submission and forward it via Resend."""
    # Rate limiting: max 3 requests per IP per hour
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    timestamps = _contact_rate_limit.get(client_ip, [])
    # Remove timestamps older than 1 hour
    timestamps = [t for t in timestamps if now - t < 3600]
    if len(timestamps) >= 3:
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Maximum 3 contact requests per hour.",
        )
    timestamps.append(now)
    _contact_rate_limit[client_ip] = timestamps

    # Escape user-provided data before interpolating into HTML
    safe_name = html.escape(str(req.name))
    safe_email = html.escape(str(req.email))
    safe_message = html.escape(str(req.message))

    try:
        resend.api_key = settings.RESEND_API_KEY
        resend.Emails.send({
            "from": "ChronoShield Web <noreply@chronoshield.eu>",
            "to": ["hola@chronoshield.eu"],
            "reply_to": req.email,
            "subject": f"Contacto web: {safe_name}",
            "html": f"""
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0D1218;color:#E8EDF2;padding:32px;border-radius:12px;">
              <h2 style="color:#00C2FF;margin-top:0;">Nuevo mensaje de contacto</h2>
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:6px 0;color:#9AACBA;width:100px;">Nombre</td><td style="padding:6px 0;">{safe_name}</td></tr>
                <tr><td style="padding:6px 0;color:#9AACBA;">Email</td><td style="padding:6px 0;"><a href="mailto:{safe_email}" style="color:#00C2FF;">{safe_email}</a></td></tr>
              </table>
              <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:20px 0;">
              <p style="color:#9AACBA;margin:0 0 8px 0;">Mensaje:</p>
              <p style="margin:0;line-height:1.6;">{safe_message}</p>
            </div>
            """,
        })
    except Exception as e:
        logger.error("Contact email failed", error=str(e))

    return {"ok": True}


@router.post("/waitlist/enterprise", status_code=201)
async def join_enterprise_waitlist(req: WaitlistRequest):
    """Save visitor email to the enterprise waitlist. No auth required."""
    from app.db.supabase import get_supabase_client
    db = get_supabase_client()
    try:
        db.table("enterprise_waitlist").insert({
            "email": str(req.email),
        }).execute()
    except Exception:
        # Unique constraint violation (already registered) — still return ok silently
        pass
    return {"ok": True}
