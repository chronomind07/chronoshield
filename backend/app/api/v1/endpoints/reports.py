"""
Security Reports endpoint.

GET  /reports                   – list user reports
POST /reports/generate          – generate manual report (costs 1 credit)
GET  /reports/nis2              – NIS2 compliance evaluation (free)
GET  /reports/{id}              – get report data (JSON)
GET  /reports/{id}/pdf          – download as PDF
"""
from __future__ import annotations

import io
import json
from datetime import datetime, timedelta, timezone
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.security import get_current_user_id
from app.db.supabase import get_db

router = APIRouter(prefix="/reports", tags=["reports"])
logger = structlog.get_logger()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _get_plan(db, user_id: str) -> str:
    r = db.table("subscriptions").select("plan").eq("user_id", user_id).single().execute()
    return r.data["plan"] if r.data else "starter"



# NOTE: credits_remaining column not yet in subscriptions schema – deduction disabled
# Add ALTER TABLE public.subscriptions ADD COLUMN credits_remaining INT DEFAULT 5;
# to Supabase SQL editor when ready to enable credit limits.

# ── Report data builder ───────────────────────────────────────────────────────

def _build_report_data(db, user_id: str, period_start: datetime, period_end: datetime) -> dict:
    """Collect all security data for the given period."""
    ps = period_start.isoformat()
    pe = period_end.isoformat()

    # Domains
    domains_res = db.table("domains").select("id,domain").eq("user_id", user_id).execute()
    domains = domains_res.data or []
    domain_map = {d["id"]: d["domain"] for d in domains}

    # Monitored emails
    emails_res = db.table("monitored_emails").select("id,email").eq("user_id", user_id).execute()
    emails = emails_res.data or []

    # Security scores
    scores = []
    for d in domains:
        r = db.table("security_scores").select(
            "overall_score,ssl_score,uptime_score,email_sec_score,breach_score,grade,calculated_at"
        ).eq("domain_id", d["id"]).order("calculated_at", desc=True).limit(1).execute()
        if r.data:
            scores.append({"domain": d["domain"], **r.data[0]})

    avg_score = round(sum(s["overall_score"] for s in scores) / len(scores), 1) if scores else 0

    # SSL results
    ssl_results = []
    for d in domains:
        r = db.table("ssl_results").select(
            "status,valid_until,issuer,scanned_at"
        ).eq("domain_id", d["id"]).order("scanned_at", desc=True).limit(1).execute()
        if r.data:
            ssl_results.append({"domain": d["domain"], **r.data[0]})

    # Uptime stats for period
    uptime_stats = []
    for d in domains:
        r = db.table("uptime_results").select(
            "status,response_time_ms,checked_at"
        ).eq("domain_id", d["id"]).gte("checked_at", ps).lte("checked_at", pe).execute()
        checks = r.data or []
        total = len(checks)
        up_count = sum(1 for c in checks if c["status"] in ("up", "degraded"))
        pct = round(up_count / total * 100, 2) if total > 0 else None
        valid_resp = [c["response_time_ms"] for c in checks if c.get("response_time_ms") is not None]
        avg_resp = round(sum(valid_resp) / len(valid_resp), 0) if valid_resp else None
        uptime_stats.append({
            "domain": d["domain"],
            "uptime_pct": pct,
            "avg_response_ms": avg_resp,
            "total_checks": total,
            "downtime_count": total - up_count if total > 0 else 0,
        })

    # Email security
    email_security = []
    for d in domains:
        r = db.table("email_security_results").select(
            "spf_status,dkim_status,dmarc_status,scanned_at"
        ).eq("domain_id", d["id"]).order("scanned_at", desc=True).limit(1).execute()
        if r.data:
            email_security.append({"domain": d["domain"], **r.data[0]})

    # Alerts in period
    alerts_res = db.table("alerts").select(
        "severity,title,alert_type,sent_at"
    ).eq("user_id", user_id).gte("sent_at", ps).lte("sent_at", pe).order("sent_at", desc=True).execute()
    alerts = (alerts_res.data or [])[:20]

    # Breach count
    breach_count = 0
    for em in emails:
        r = db.table("breach_results").select("id").eq("email_id", em["id"]).execute()
        breach_count += len(r.data or [])

    # Scan count
    scan_count = 0
    for d in domains:
        r = db.table("ssl_results").select("id").eq("domain_id", d["id"]).gte(
            "scanned_at", ps
        ).lte("scanned_at", pe).execute()
        scan_count += len(r.data or [])

    recommendations = _build_recommendations(ssl_results, email_security, scores, uptime_stats)

    return {
        "summary": {
            "period_start": ps,
            "period_end": pe,
            "average_score": avg_score,
            "grade": scores[0]["grade"] if scores else "N/A",
            "domains_count": len(domains),
            "emails_count": len(emails),
            "alerts_count": len(alerts),
            "scan_count": scan_count,
            "breach_count": breach_count,
        },
        "scores": scores,
        "ssl": ssl_results,
        "uptime": uptime_stats,
        "email_security": email_security,
        "alerts": alerts,
        "recommendations": recommendations,
    }


def _build_recommendations(ssl_results, email_security, scores, uptime_stats) -> list:
    recs = []
    for s in ssl_results:
        st = s.get("status")
        if st == "expired":
            recs.append({"priority": "critical", "category": "SSL", "title": f"Certificado SSL caducado en {s['domain']}", "action": "Renueva el certificado SSL inmediatamente"})
        elif st == "expiring_soon":
            recs.append({"priority": "warning", "category": "SSL", "title": f"SSL próximo a caducar en {s['domain']}", "action": "Renueva el certificado antes de que caduque"})
    for e in email_security:
        if e.get("spf_status") not in ("valid", "ok"):
            recs.append({"priority": "medium", "category": "Email", "title": f"SPF no configurado en {e['domain']}", "action": "Configura un registro SPF válido en el DNS"})
        if e.get("dmarc_status") not in ("valid", "ok"):
            recs.append({"priority": "medium", "category": "Email", "title": f"DMARC no configurado en {e['domain']}", "action": "Configura una política DMARC en el DNS"})
    for u in uptime_stats:
        if u.get("uptime_pct") is not None and u["uptime_pct"] < 99:
            recs.append({"priority": "warning", "category": "Uptime", "title": f"Disponibilidad baja en {u['domain']}", "action": f"Disponibilidad actual: {u['uptime_pct']}%. Revisa el servidor."})
    if not recs:
        recs.append({"priority": "info", "category": "General", "title": "Sin problemas críticos detectados", "action": "Continúa monitorizando regularmente"})
    return recs


# ── PDF generation ────────────────────────────────────────────────────────────

def _generate_pdf(report_data: dict, report_type: str) -> bytes:
    """Generate a professional PDF using reportlab."""
    try:
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_CENTER
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import mm
        from reportlab.platypus import (
            HRFlowable,
            Paragraph,
            SimpleDocTemplate,
            Spacer,
            Table,
            TableStyle,
        )
    except ImportError:
        raise HTTPException(500, "PDF generation requires reportlab. Run: pip install reportlab")

    ACCENT = colors.HexColor("#3ecf8e")
    GRAY   = colors.HexColor("#71717a")
    WHITE  = colors.HexColor("#f5f5f5")
    DIM    = colors.HexColor("#c0c0c0")
    BG1    = colors.HexColor("#111111")
    BG2    = colors.HexColor("#0d0d0d")
    DARK   = colors.HexColor("#1a1a1a")

    styles = getSampleStyleSheet()
    title_sty   = ParagraphStyle("t",  parent=styles["Normal"], fontSize=22, textColor=WHITE, fontName="Helvetica-Bold", spaceAfter=4)
    sub_sty     = ParagraphStyle("s",  parent=styles["Normal"], fontSize=10, textColor=GRAY, spaceAfter=14)
    h2_sty      = ParagraphStyle("h2", parent=styles["Normal"], fontSize=12, textColor=ACCENT, fontName="Helvetica-Bold", spaceBefore=14, spaceAfter=6)
    body_sty    = ParagraphStyle("b",  parent=styles["Normal"], fontSize=8,  textColor=DIM, spaceAfter=3)
    footer_sty  = ParagraphStyle("f",  parent=styles["Normal"], fontSize=7,  textColor=GRAY, alignment=TA_CENTER)
    rec_hd_sty  = ParagraphStyle("rh", parent=styles["Normal"], fontSize=9,  textColor=WHITE, fontName="Helvetica-Bold", spaceAfter=1)
    rec_ac_sty  = ParagraphStyle("ra", parent=styles["Normal"], fontSize=8,  textColor=DIM, leftIndent=10, spaceAfter=5)

    summary = report_data.get("summary", {})
    ps = (summary.get("period_start") or "")[:10]
    pe = (summary.get("period_end")   or "")[:10]
    type_label = {"weekly": "Informe Semanal", "monthly": "Informe Mensual", "manual": "Informe Manual"}.get(report_type, "Informe de Seguridad")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=20*mm, leftMargin=20*mm, topMargin=22*mm, bottomMargin=20*mm)
    els = []

    # Header
    els.append(Paragraph("ChronoShield", title_sty))
    els.append(Paragraph(f"{type_label}  ·  {ps} — {pe}", sub_sty))
    els.append(HRFlowable(width="100%", thickness=1, color=ACCENT, spaceAfter=14))

    # Executive summary KPIs
    els.append(Paragraph("Resumen Ejecutivo", h2_sty))
    kpi_rows = [
        ["Security Score", "Dominios", "Emails", "Alertas", "Brechas"],
        [
            f"{summary.get('average_score', 0)}/100 ({summary.get('grade', 'N/A')})",
            str(summary.get("domains_count", 0)),
            str(summary.get("emails_count", 0)),
            str(summary.get("alerts_count", 0)),
            str(summary.get("breach_count", 0)),
        ],
    ]
    kpi_tbl = Table(kpi_rows, colWidths=[34*mm] * 5)
    kpi_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), DARK),
        ("BACKGROUND", (0, 1), (-1, 1), BG1),
        ("TEXTCOLOR",  (0, 0), (-1, 0), GRAY),
        ("TEXTCOLOR",  (0, 1), (-1, 1), WHITE),
        ("FONTNAME",   (0, 0), (-1, 0), "Helvetica"),
        ("FONTNAME",   (0, 1), (-1, 1), "Helvetica-Bold"),
        ("FONTSIZE",   (0, 0), (-1, 0), 7),
        ("FONTSIZE",   (0, 1), (-1, 1), 11),
        ("ALIGN",      (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",     (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("GRID",       (0, 0), (-1, -1), 0.4, DARK),
    ]))
    els.append(kpi_tbl)
    els.append(Spacer(1, 10))

    # SSL
    ssl_data = report_data.get("ssl", [])
    if ssl_data:
        els.append(Paragraph("Certificados SSL", h2_sty))
        rows = [["Dominio", "Estado", "Válido hasta", "Emisor"]]
        STATUS_MAP = {"valid": "✓ Válido", "expired": "✗ Caducado", "expiring_soon": "⚠ Por caducar",
                      "error": "Error", "invalid": "Inválido"}
        for s in ssl_data:
            rows.append([
                s.get("domain", ""),
                STATUS_MAP.get(s.get("status", ""), s.get("status", "")),
                (s.get("valid_until") or "")[:10],
                (s.get("issuer") or "")[:32],
            ])
        tbl = Table(rows, colWidths=[48*mm, 32*mm, 28*mm, 57*mm])
        tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0), DARK),
            ("TEXTCOLOR",     (0, 0), (-1, 0), GRAY),
            ("TEXTCOLOR",     (0, 1), (-1, -1), DIM),
            ("FONTSIZE",      (0, 0), (-1, -1), 8),
            ("ROWBACKGROUNDS",(0, 1), (-1, -1), [BG1, BG2]),
            ("GRID",          (0, 0), (-1, -1), 0.3, DARK),
            ("TOPPADDING",    (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        els.append(tbl)
        els.append(Spacer(1, 8))

    # Email security
    email_sec = report_data.get("email_security", [])
    if email_sec:
        els.append(Paragraph("Seguridad de Email (SPF / DKIM / DMARC)", h2_sty))
        rows = [["Dominio", "SPF", "DKIM", "DMARC"]]
        for e in email_sec:
            def _fmt(v: str | None) -> str:
                return "✓" if v in ("valid", "ok") else "✗"
            rows.append([e.get("domain", ""), _fmt(e.get("spf_status")), _fmt(e.get("dkim_status")), _fmt(e.get("dmarc_status"))])
        tbl = Table(rows, colWidths=[73*mm, 24*mm, 24*mm, 24*mm])
        tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0), DARK),
            ("TEXTCOLOR",     (0, 0), (-1, 0), GRAY),
            ("TEXTCOLOR",     (0, 1), (-1, -1), DIM),
            ("FONTSIZE",      (0, 0), (-1, -1), 8),
            ("ALIGN",         (1, 0), (-1, -1), "CENTER"),
            ("ROWBACKGROUNDS",(0, 1), (-1, -1), [BG1, BG2]),
            ("GRID",          (0, 0), (-1, -1), 0.3, DARK),
            ("TOPPADDING",    (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        els.append(tbl)
        els.append(Spacer(1, 8))

    # Uptime
    uptime = report_data.get("uptime", [])
    if uptime:
        els.append(Paragraph("Disponibilidad (Uptime)", h2_sty))
        rows = [["Dominio", "Disponibilidad", "Respuesta media", "Checks", "Caídas"]]
        for u in uptime:
            pct_str = f"{u['uptime_pct']:.2f}%" if u.get("uptime_pct") is not None else "Sin datos"
            resp_str = f"{int(u['avg_response_ms'])} ms" if u.get("avg_response_ms") is not None else "N/A"
            rows.append([u.get("domain",""), pct_str, resp_str, str(u.get("total_checks",0)), str(u.get("downtime_count",0))])
        tbl = Table(rows, colWidths=[48*mm, 28*mm, 32*mm, 23*mm, 22*mm])
        tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0), DARK),
            ("TEXTCOLOR",     (0, 0), (-1, 0), GRAY),
            ("TEXTCOLOR",     (0, 1), (-1, -1), DIM),
            ("FONTSIZE",      (0, 0), (-1, -1), 8),
            ("ROWBACKGROUNDS",(0, 1), (-1, -1), [BG1, BG2]),
            ("GRID",          (0, 0), (-1, -1), 0.3, DARK),
            ("TOPPADDING",    (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        els.append(tbl)
        els.append(Spacer(1, 8))

    # Recommendations
    recs = report_data.get("recommendations", [])
    if recs:
        els.append(Paragraph("Recomendaciones", h2_sty))
        PRIO_HEX = {"critical": "#ef4444", "warning": "#f59e0b", "medium": "#3b82f6", "info": "#3ecf8e"}
        for rec in recs:
            hex_c = PRIO_HEX.get(rec.get("priority", "info"), "#3ecf8e")
            els.append(Paragraph(
                f'<font color="{hex_c}">●</font>  <b>{rec.get("title","")}</b>',
                rec_hd_sty,
            ))
            els.append(Paragraph(f'→ {rec.get("action","")}', rec_ac_sty))

    # Footer
    els.append(Spacer(1, 18))
    els.append(HRFlowable(width="100%", thickness=0.4, color=DARK, spaceAfter=8))
    els.append(Paragraph(
        f"Generado por ChronoShield · {_utcnow().strftime('%Y-%m-%d %H:%M')} UTC · Informe confidencial",
        footer_sty,
    ))

    doc.build(els)
    return buf.getvalue()


# ── NIS2 compliance evaluation ────────────────────────────────────────────────

def _evaluate_nis2(db, user_id: str) -> dict:
    """Evaluate NIS2 technical compliance based on ChronoShield monitoring data."""
    domains_res = db.table("domains").select("id,domain").eq("user_id", user_id).execute()
    domains = domains_res.data or []

    emails_res = db.table("monitored_emails").select("id,email").eq("user_id", user_id).execute()
    emails = emails_res.data or []

    items: list[dict] = []

    # 1. SSL/TLS (Art. 21.2.f – cifrado)
    ssl_issues = 0
    for d in domains:
        r = db.table("ssl_results").select("status").eq("domain_id", d["id"]).order("scanned_at", desc=True).limit(1).execute()
        if r.data and r.data[0]["status"] not in ("valid",):
            ssl_issues += 1
    if not domains:
        ssl_status, ssl_detail = "not_applicable", "No hay dominios configurados."
    elif ssl_issues == 0:
        ssl_status = "compliant"
        ssl_detail = f"Todos los certificados SSL de {len(domains)} dominio(s) son válidos."
    elif ssl_issues < len(domains):
        ssl_status = "partial"
        ssl_detail = f"{ssl_issues} de {len(domains)} dominios tienen problemas con SSL."
    else:
        ssl_status = "non_compliant"
        ssl_detail = "Ningún dominio tiene un certificado SSL válido."
    items.append({
        "id": "ssl_tls", "article": "Art. 21(2)(f)", "category": "Técnico",
        "title": "Cifrado y criptografía (SSL/TLS)",
        "description": "Las comunicaciones deben estar protegidas con TLS actualizado y certificados válidos.",
        "status": ssl_status, "detail": ssl_detail,
    })

    # 2. Email authentication (Art. 21.2.b – supply chain / impersonation)
    spf_ok = dmarc_ok = 0
    for d in domains:
        r = db.table("email_security_results").select("spf_status,dmarc_status").eq("domain_id", d["id"]).order("scanned_at", desc=True).limit(1).execute()
        if r.data:
            if r.data[0].get("spf_status") in ("valid", "ok"):   spf_ok += 1
            if r.data[0].get("dmarc_status") in ("valid", "ok"): dmarc_ok += 1
    if not domains:
        ea_status, ea_detail = "not_applicable", "No hay dominios configurados."
    else:
        ea_pct = (spf_ok + dmarc_ok) / (len(domains) * 2)
        if ea_pct >= 1.0:
            ea_status = "compliant"
            ea_detail = "SPF y DMARC configurados correctamente en todos los dominios."
        elif ea_pct >= 0.5:
            ea_status = "partial"
            ea_detail = f"SPF: {spf_ok}/{len(domains)} · DMARC: {dmarc_ok}/{len(domains)} dominios correctos."
        else:
            ea_status = "non_compliant"
            ea_detail = f"Faltan configuraciones críticas. SPF: {spf_ok}/{len(domains)} · DMARC: {dmarc_ok}/{len(domains)}."
    items.append({
        "id": "email_auth", "article": "Art. 21(2)(b)", "category": "Técnico",
        "title": "Autenticación de correo electrónico (SPF / DMARC)",
        "description": "Protección contra suplantación de identidad y phishing con SPF y DMARC.",
        "status": ea_status, "detail": ea_detail,
    })

    # 3. Service availability (Art. 21.2.a – risk & business continuity)
    uptime_values: list[float] = []
    for d in domains:
        r = db.table("uptime_results").select("status").eq("domain_id", d["id"]).limit(288).execute()
        checks = r.data or []
        if checks:
            up = sum(1 for c in checks if c["status"] in ("up", "degraded"))
            uptime_values.append(up / len(checks) * 100)
    if not domains:
        avail_status, avail_detail = "not_applicable", "No hay dominios configurados."
    elif not uptime_values:
        avail_status, avail_detail = "partial", "Monitoreo activo pero sin datos de uptime suficientes aún."
    else:
        avg_up = sum(uptime_values) / len(uptime_values)
        if avg_up >= 99.5:
            avail_status = "compliant"
            avail_detail = f"Disponibilidad media: {avg_up:.1f}%. Excelente."
        elif avg_up >= 99.0:
            avail_status = "partial"
            avail_detail = f"Disponibilidad media: {avg_up:.1f}%. Recomendado ≥99.5% para NIS2."
        else:
            avail_status = "non_compliant"
            avail_detail = f"Disponibilidad media: {avg_up:.1f}%. Requiere mejora urgente."
    items.append({
        "id": "availability", "article": "Art. 21(2)(a)", "category": "Operativo",
        "title": "Disponibilidad y continuidad del servicio",
        "description": "Los servicios críticos deben mantener alta disponibilidad con plan de continuidad documentado.",
        "status": avail_status, "detail": avail_detail,
    })

    # 4. Breach monitoring (Art. 21.2.b – incident handling)
    total_breaches = 0
    for em in emails:
        r = db.table("breach_results").select("id").eq("email_id", em["id"]).execute()
        total_breaches += len(r.data or [])
    if not emails:
        breach_status, breach_detail = "not_applicable", "No hay emails monitorizados."
    elif total_breaches == 0:
        breach_status = "compliant"
        breach_detail = f"Sin filtraciones detectadas en {len(emails)} email(s) monitorizados."
    else:
        breach_status = "non_compliant"
        breach_detail = f"{total_breaches} filtracion(es) detectadas. Requiere acción inmediata."
    items.append({
        "id": "breach_monitoring", "article": "Art. 21(2)(b)", "category": "Operativo",
        "title": "Detección de filtraciones de credenciales",
        "description": "Monitorización continua para detectar compromisos de credenciales corporativas en dark web.",
        "status": breach_status, "detail": breach_detail,
    })

    # 5. Security risk scoring (Art. 21.2.a – risk analysis)
    scores_data: list[dict] = []
    for d in domains:
        r = db.table("security_scores").select("overall_score,grade").eq("domain_id", d["id"]).order("calculated_at", desc=True).limit(1).execute()
        if r.data:
            scores_data.append(r.data[0])
    if not scores_data:
        risk_status, risk_detail = "partial", "Sin puntuación de seguridad disponible. Realiza un primer escaneo."
    else:
        avg_sc = sum(s["overall_score"] for s in scores_data) / len(scores_data)
        if avg_sc >= 80:
            risk_status = "compliant"
            risk_detail = f"Puntuación de seguridad media: {avg_sc:.0f}/100. Nivel adecuado para NIS2."
        elif avg_sc >= 60:
            risk_status = "partial"
            risk_detail = f"Puntuación de seguridad media: {avg_sc:.0f}/100. Se requieren mejoras."
        else:
            risk_status = "non_compliant"
            risk_detail = f"Puntuación de seguridad media: {avg_sc:.0f}/100. Insuficiente para cumplimiento NIS2."
    items.append({
        "id": "risk_assessment", "article": "Art. 21(2)(a)", "category": "Gestión",
        "title": "Análisis y gestión del riesgo de seguridad",
        "description": "Evaluación continua del nivel de seguridad técnica de los activos digitales.",
        "status": risk_status, "detail": risk_detail,
    })

    # 6. Alert / incident notifications (Art. 21.2.b)
    notif_res = db.table("notification_preferences").select(
        "email_alerts,alert_breach,alert_downtime,alert_ssl_expiry,alert_ssl_invalid"
    ).eq("user_id", user_id).single().execute()
    notif = notif_res.data or {}
    alerts_on = notif.get("email_alerts") or notif.get("alert_breach") or notif.get("alert_downtime") or notif.get("alert_ssl_expiry")
    if alerts_on:
        alert_status = "compliant"
        alert_detail = "Notificaciones de incidentes activas y configuradas."
    else:
        alert_status = "partial"
        alert_detail = "Sistema de alertas disponible pero no completamente configurado. Actívalo en Ajustes."
    items.append({
        "id": "incident_alerts", "article": "Art. 21(2)(b)", "category": "Operativo",
        "title": "Notificación y respuesta a incidentes",
        "description": "Capacidad técnica para detectar y notificar incidentes de seguridad en tiempo real.",
        "status": alert_status, "detail": alert_detail,
    })

    # 7–9. Manual review items
    items.append({
        "id": "policies", "article": "Art. 21(2)(a)", "category": "Gestión",
        "title": "Políticas de seguridad de la información",
        "description": "Políticas documentadas de seguridad, clasificación de activos y gestión de accesos.",
        "status": "manual_review",
        "detail": "Requiere revisión manual. ChronoShield no puede evaluar documentación interna.",
    })
    items.append({
        "id": "access_control", "article": "Art. 21(2)(i)", "category": "Técnico",
        "title": "Control de acceso y autenticación multifactor",
        "description": "Gestión de identidades, privilegio mínimo y autenticación robusta (MFA).",
        "status": "manual_review",
        "detail": "Requiere revisión manual. Verifica que el MFA está habilitado en todos los sistemas críticos.",
    })
    items.append({
        "id": "supply_chain", "article": "Art. 21(2)(d)", "category": "Gestión",
        "title": "Seguridad en la cadena de suministro",
        "description": "Gestión de riesgos de proveedores y terceros con acceso a sistemas o datos.",
        "status": "manual_review",
        "detail": "Requiere revisión manual. Evalúa la seguridad de tus proveedores de software y servicios.",
    })

    # Compliance score (only auto-evaluated items)
    weights = {"compliant": 1.0, "partial": 0.5, "non_compliant": 0.0}
    auto_items = [i for i in items if i["status"] in weights]
    score = round(sum(weights[i["status"]] for i in auto_items) / len(auto_items) * 100, 1) if auto_items else 0.0

    # Per-domain technical breakdown
    domains_breakdown: list[dict] = []
    for d in domains:
        # Latest SSL status
        ssl_r = db.table("ssl_results").select(
            "status,days_remaining"
        ).eq("domain_id", d["id"]).order("scanned_at", desc=True).limit(1).execute()
        ssl_row = ssl_r.data[0] if ssl_r.data else {}

        # Latest email security
        es_r = db.table("email_security_results").select(
            "spf_status,dkim_status,dmarc_status"
        ).eq("domain_id", d["id"]).order("scanned_at", desc=True).limit(1).execute()
        es_row = es_r.data[0] if es_r.data else {}

        # Uptime last 288 checks (~24 h at 5-min intervals)
        up_r = db.table("uptime_results").select("status").eq("domain_id", d["id"]).limit(288).execute()
        up_checks = up_r.data or []
        up_pct: Optional[float] = None
        if up_checks:
            up_count = sum(1 for c in up_checks if c["status"] in ("up", "degraded"))
            up_pct = round(up_count / len(up_checks) * 100, 1)

        # Emails that belong to this domain (match by @domain suffix)
        domain_emails = [em["email"] for em in emails if em["email"].split("@")[-1] == d["domain"]]

        # Breach count for domain emails
        breach_ct = 0
        for em in emails:
            if em["email"].split("@")[-1] == d["domain"]:
                br = db.table("breach_results").select("id").eq("email_id", em["id"]).execute()
                breach_ct += len(br.data or [])

        domains_breakdown.append({
            "domain":        d["domain"],
            "ssl_status":    ssl_row.get("status"),
            "days_remaining": ssl_row.get("days_remaining"),
            "spf_status":    es_row.get("spf_status"),
            "dkim_status":   es_row.get("dkim_status"),
            "dmarc_status":  es_row.get("dmarc_status"),
            "uptime_pct":    up_pct,
            "breach_count":  breach_ct,
            "emails":        domain_emails,
        })

    return {
        "compliance_score": score,
        "items": items,
        "domains_breakdown": domains_breakdown,
        "evaluated_at": _utcnow().isoformat(),
        "disclaimer": "Esta evaluación es orientativa y no constituye una auditoría NIS2 oficial. Consulta con un experto en cumplimiento normativo para una evaluación completa.",
    }


# ── Pydantic models ───────────────────────────────────────────────────────────

class GenerateReportRequest(BaseModel):
    period: str = "7d"            # "24h" | "7d" | "30d" | "custom"
    period_start: Optional[str] = None   # ISO date string (custom only)
    period_end:   Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
async def list_reports(
    report_type: Optional[str] = Query(None, description="weekly|monthly|manual"),
    limit: int = Query(20, ge=1, le=50),
    user_id: str = Depends(get_current_user_id),
):
    db = get_db()
    try:
        q = db.table("reports").select("id,type,period_start,period_end,created_at").eq("user_id", user_id)
        if report_type:
            q = q.eq("type", report_type)
        res = q.order("created_at", desc=True).limit(limit).execute()
        return {"reports": res.data or []}
    except Exception as e:
        logger.warning("reports table unavailable (run migration to create it)", error=str(e))
        return {"reports": []}


@router.post("/generate")
async def generate_report(
    body: GenerateReportRequest,
    user_id: str = Depends(get_current_user_id),
):
    db = get_db()
    # Credits deduction disabled until credits_remaining column added to subscriptions.
    # See migration note near top of file.

    now = _utcnow()
    if body.period == "24h":
        period_start, period_end = now - timedelta(hours=24), now
    elif body.period == "7d":
        period_start, period_end = now - timedelta(days=7), now
    elif body.period == "30d":
        period_start, period_end = now - timedelta(days=30), now
    elif body.period == "custom" and body.period_start and body.period_end:
        period_start = datetime.fromisoformat(body.period_start).replace(tzinfo=timezone.utc)
        period_end   = datetime.fromisoformat(body.period_end).replace(tzinfo=timezone.utc)
    else:
        period_start, period_end = now - timedelta(days=7), now

    data = _build_report_data(db, user_id, period_start, period_end)

    report_meta: dict = {}
    try:
        ins = db.table("reports").insert({
            "user_id":      user_id,
            "type":         "manual",
            "period_start": period_start.isoformat(),
            "period_end":   period_end.isoformat(),
            "data":         json.dumps(data),
        }).execute()
        report_meta = {k: v for k, v in (ins.data[0] if ins.data else {}).items() if k != "data"}
    except Exception as e:
        logger.warning(
            "Could not persist report to DB (reports table may not exist yet). "
            "Run: CREATE TABLE public.reports (...) to enable persistence.",
            error=str(e),
        )

    return {"report": report_meta, "data": data}


@router.get("/nis2")
async def get_nis2_compliance(
    user_id: str = Depends(get_current_user_id),
):
    db = get_db()
    return _evaluate_nis2(db, user_id)


@router.get("/{report_id}")
async def get_report(
    report_id: str,
    user_id: str = Depends(get_current_user_id),
):
    db = get_db()
    res = db.table("reports").select("*").eq("id", report_id).eq("user_id", user_id).single().execute()
    if not res.data:
        raise HTTPException(404, "Informe no encontrado")
    report = res.data
    raw_data = report.get("data")
    data = json.loads(raw_data) if isinstance(raw_data, str) else (raw_data or {})
    return {"report": {k: v for k, v in report.items() if k != "data"}, "data": data}


@router.get("/{report_id}/pdf")
async def download_pdf(
    report_id: str,
    user_id: str = Depends(get_current_user_id),
):
    db = get_db()
    res = db.table("reports").select("*").eq("id", report_id).eq("user_id", user_id).single().execute()
    if not res.data:
        raise HTTPException(404, "Informe no encontrado")

    report = res.data
    raw_data = report.get("data")
    data = json.loads(raw_data) if isinstance(raw_data, str) else (raw_data or {})

    pdf_bytes = _generate_pdf(data, report["type"])
    filename  = f"chronoshield-report-{report_id[:8]}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
