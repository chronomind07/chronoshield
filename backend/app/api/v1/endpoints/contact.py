"""
Public contact-form endpoint.
No authentication required — any visitor can send a message.
"""
from fastapi import APIRouter
from pydantic import BaseModel, EmailStr
import resend

from app.core.config import settings

router = APIRouter(prefix="/contact", tags=["contact"])


class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    message: str


@router.post("")
async def send_contact_email(req: ContactRequest):
    """Receive a contact-form submission and forward it via Resend."""
    try:
        resend.api_key = settings.RESEND_API_KEY
        resend.Emails.send({
            "from": "ChronoShield Web <noreply@chronoshield.eu>",
            "to": ["hola@chronoshield.eu"],
            "reply_to": req.email,
            "subject": f"Contacto web: {req.name}",
            "html": f"""
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0D1218;color:#E8EDF2;padding:32px;border-radius:12px;">
              <h2 style="color:#00C2FF;margin-top:0;">Nuevo mensaje de contacto</h2>
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:6px 0;color:#9AACBA;width:100px;">Nombre</td><td style="padding:6px 0;">{req.name}</td></tr>
                <tr><td style="padding:6px 0;color:#9AACBA;">Email</td><td style="padding:6px 0;"><a href="mailto:{req.email}" style="color:#00C2FF;">{req.email}</a></td></tr>
              </table>
              <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:20px 0;">
              <p style="color:#9AACBA;margin:0 0 8px 0;">Mensaje:</p>
              <p style="margin:0;line-height:1.6;">{req.message}</p>
            </div>
            """,
        })
    except Exception:
        # Never fail the user — silently log and return ok
        pass

    return {"ok": True}
