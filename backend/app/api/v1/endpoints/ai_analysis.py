from fastapi import APIRouter, Depends, HTTPException
from uuid import UUID
from pydantic import BaseModel
from typing import Optional
from app.core.security import get_current_user_id
from app.db.supabase import get_db
from app.services.ai_service import generate_security_analysis

router = APIRouter(prefix="/ai", tags=["ai"])


class AnalysisRequest(BaseModel):
    domain_id: Optional[UUID] = None
    context_type: str = "full_report"


class AnalysisResponse(BaseModel):
    analysis: str
    model: str
    tokens_used: Optional[int] = None


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_security(
    payload: AnalysisRequest,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Generate AI analysis of current security posture."""
    # Gather context
    context = {}

    if payload.domain_id:
        domain = (
            db.table("domains")
            .select("domain")
            .eq("id", str(payload.domain_id))
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        if not domain.data:
            raise HTTPException(status_code=404, detail="Domain not found")
        context["domain"] = domain.data["domain"]

        ssl = (
            db.table("ssl_results")
            .select("*")
            .eq("domain_id", str(payload.domain_id))
            .order("scanned_at", desc=True)
            .limit(1)
            .execute()
            .data
        )
        uptime = (
            db.table("uptime_results")
            .select("*")
            .eq("domain_id", str(payload.domain_id))
            .order("checked_at", desc=True)
            .limit(1)
            .execute()
            .data
        )
        email_sec = (
            db.table("email_security_results")
            .select("*")
            .eq("domain_id", str(payload.domain_id))
            .order("scanned_at", desc=True)
            .limit(1)
            .execute()
            .data
        )
        score = (
            db.table("security_scores")
            .select("*")
            .eq("domain_id", str(payload.domain_id))
            .order("calculated_at", desc=True)
            .limit(1)
            .execute()
            .data
        )

        context["ssl"] = ssl[0] if ssl else None
        context["uptime"] = uptime[0] if uptime else None
        context["email_security"] = email_sec[0] if email_sec else None
        context["score"] = score[0] if score else None

    else:
        # Full account analysis
        scores = (
            db.table("security_scores")
            .select("*")
            .eq("user_id", user_id)
            .order("calculated_at", desc=True)
            .limit(10)
            .execute()
            .data
        )
        breaches = (
            db.table("breach_results")
            .select("*")
            .eq("user_id", user_id)
            .gt("breaches_found", 0)
            .order("scanned_at", desc=True)
            .limit(5)
            .execute()
            .data
        )
        context["scores"] = scores
        context["breaches"] = breaches

    result = await generate_security_analysis(context, payload.context_type, user_id, db)

    return AnalysisResponse(
        analysis=result["analysis"],
        model=result["model"],
        tokens_used=result.get("tokens_used"),
    )
