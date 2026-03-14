from fastapi import APIRouter, Depends, HTTPException
from app.core.security import get_current_user_id
from app.db.supabase import get_db
from typing import List, Optional
from datetime import datetime, timezone
from uuid import UUID
from pydantic import BaseModel

router = APIRouter(prefix="/alerts", tags=["alerts"])

# ── Static content per alert type ─────────────────────────────────────────────
ALERT_CONTENT: dict[str, dict] = {
    "dmarc_missing": {
        "human_impact": (
            "Cualquier persona puede enviar emails haciéndose pasar por tu empresa. "
            "Tus clientes pueden recibir fraudes de phishing en tu nombre sin que puedas impedirlo."
        ),
        "fix_steps": [
            "Accede al panel de gestión de DNS de tu dominio (Nominalia, GoDaddy, Cloudflare, etc.).",
            "Crea un nuevo registro TXT con nombre _dmarc.tudominio.com",
            "Añade el valor: v=DMARC1; p=none; rua=mailto:dmarc@tudominio.com",
            "Una vez verificado el funcionamiento durante 1-2 semanas, cambia p=none a p=quarantine y después a p=reject.",
        ],
    },
    "spf_missing": {
        "human_impact": (
            "Tu dominio no tiene protección contra el uso no autorizado de tu email. "
            "Terceros pueden enviar correos fraudulentos suplantando tu identidad y dañar tu reputación."
        ),
        "fix_steps": [
            "Accede al panel DNS de tu dominio.",
            "Añade un registro TXT en la raíz del dominio (@).",
            "Valor: v=spf1 include:_spf.google.com ~all (sustituye _spf.google.com por tu proveedor de email).",
            "Guarda el registro y espera hasta 48h para que se propague.",
        ],
    },
    "dkim_missing": {
        "human_impact": (
            "Tus emails no están firmados digitalmente. "
            "Esto reduce su credibilidad, puede hacer que lleguen a spam y facilita que sean falsificados."
        ),
        "fix_steps": [
            "Accede a la configuración de tu proveedor de email (Gmail Workspace, Microsoft 365, etc.).",
            "Busca la sección 'Autenticación de email' o 'DKIM' y actívala.",
            "Copia el registro TXT generado (será algo como: k=rsa; p=MIGfMA...).",
            "Añade ese registro TXT en tu panel DNS con el nombre indicado (ej: google._domainkey.tudominio.com).",
        ],
    },
    "ssl_expiring": {
        "human_impact": (
            "Tu certificado de seguridad web caduca pronto. "
            "Si caduca, los visitantes verán un aviso de 'sitio no seguro' y abandonarán tu web sin contactarte."
        ),
        "fix_steps": [
            "Accede al panel de tu proveedor de hosting o de tu certificado SSL.",
            "Renueva el certificado antes de la fecha de expiración indicada.",
            "Si usas Let's Encrypt, verifica que la renovación automática (certbot renew) esté activa.",
            "Tras renovar, accede a tu web y confirma que aparece el candado de seguridad.",
        ],
    },
    "ssl_expired": {
        "human_impact": (
            "Tu web NO es segura ahora mismo. "
            "Los clientes ven un aviso de peligro al entrar y es muy probable que abandonen sin contactarte."
        ),
        "fix_steps": [
            "Contacta URGENTEMENTE con tu proveedor de hosting.",
            "Renueva el certificado SSL inmediatamente — el proceso suele tardar solo minutos.",
            "Si usas Let's Encrypt en un servidor propio, ejecuta: sudo certbot renew --force-renewal",
            "Verifica que el certificado está activo antes de comunicar que el servicio está operativo.",
        ],
    },
    "uptime_down": {
        "human_impact": (
            "Tu página web no está accesible en este momento. "
            "Estás perdiendo clientes potenciales y dañando tu reputación online."
        ),
        "fix_steps": [
            "Verifica si el problema es local abriendo tu web desde otro dispositivo o red (datos móviles).",
            "Comprueba el panel de estado de tu proveedor de hosting para ver si hay incidencias.",
            "Contacta a tu proveedor de hosting con carácter urgente y proporciona capturas del error.",
            "Si usas WordPress, verifica desde el panel FTP que los archivos están correctos.",
        ],
    },
    "breach_found": {
        "human_impact": (
            "Un email de tu empresa aparece en bases de datos de hackers con datos filtrados. "
            "La contraseña asociada puede estar comprometida y en manos de delincuentes."
        ),
        "fix_steps": [
            "Cambia la contraseña de ese email inmediatamente usando una contraseña única y robusta.",
            "Activa la verificación en dos pasos (2FA/MFA) en esa cuenta de email.",
            "Si usabas esa misma contraseña en otros servicios, cámbiala también en todos ellos.",
            "Revisa los accesos recientes a la cuenta (en Gmail: Última actividad de la cuenta) por si hubo accesos no autorizados.",
        ],
    },
    "darkweb_found": {
        "human_impact": (
            "Tu dominio aparece en la dark web, lo que indica una posible brecha de seguridad "
            "o que está siendo mencionado en foros de ciberdelincuentes."
        ),
        "fix_steps": [
            "Revisa los accesos recientes a tu web desde el panel de hosting (logs de acceso).",
            "Cambia todas las contraseñas de administración: panel de hosting, FTP, base de datos y CMS.",
            "Si usas WordPress u otro CMS, actualiza el núcleo, plugins y temas a sus últimas versiones.",
            "Considera contratar un escaneo antimalware de tu servidor con tu proveedor de hosting.",
        ],
    },
    "typosquatting": {
        "human_impact": (
            "Alguien ha registrado un dominio similar al tuyo para engañar a tus clientes, "
            "robar información o dinero haciéndose pasar por tu empresa."
        ),
        "fix_steps": [
            "Documenta el dominio fraudulento con capturas de pantalla para futuras reclamaciones.",
            "Reporta el dominio a la ICANN: icann.org/complaints",
            "Si el dominio está siendo usado para actividad delictiva, presenta denuncia ante la Policía Nacional (grupo de delitos telemáticos).",
            "Avisa a tus clientes por email de la existencia del dominio falso para prevenir que sean estafados.",
        ],
    },
    "uptime_slow": {
        "human_impact": (
            "Tu web carga lentamente. "
            "Cada segundo de carga extra reduce las conversiones y la satisfacción de tus clientes, además de perjudicar tu posicionamiento en Google."
        ),
        "fix_steps": [
            "Analiza tu web con la herramienta gratuita PageSpeed Insights (pagespeed.web.dev).",
            "Comprime las imágenes de tu web usando herramientas como TinyPNG.",
            "Activa el caché del navegador si usas un CMS como WordPress (plugin WP Super Cache).",
            "Contacta a tu proveedor de hosting para revisar el rendimiento y considera migrar a un plan con más recursos.",
        ],
    },
}

SEVERITY_LABEL = {
    "critical": "CRÍTICA",
    "high": "ALTA",
    "medium": "MEDIA",
    "low": "BAJA",
}

SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}


# ── Schemas ───────────────────────────────────────────────────────────────────
class AlertEnriched(BaseModel):
    id: str
    alert_type: str
    severity: str
    severity_label: str
    title: str
    message: str
    human_impact: str
    fix_steps: List[str]
    sent_at: str
    read_at: Optional[str] = None
    domain_id: Optional[str] = None
    is_unread: bool


class AlertsResponse(BaseModel):
    total: int
    unread_count: int
    alerts: List[AlertEnriched]


# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.get("", response_model=AlertsResponse)
async def list_alerts(
    unread_only: bool = False,
    severity: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    query = (
        db.table("alerts")
        .select("*")
        .eq("user_id", user_id)
        .order("sent_at", desc=True)
        .limit(200)
    )
    if unread_only:
        query = query.is_("read_at", "null")
    if severity:
        query = query.eq("severity", severity)

    rows = query.execute().data or []

    # Count unread
    unread_count = sum(1 for r in rows if not r.get("read_at"))

    enriched: List[AlertEnriched] = []
    for r in rows:
        content = ALERT_CONTENT.get(r.get("alert_type", ""), {})
        enriched.append(
            AlertEnriched(
                id=str(r["id"]),
                alert_type=r.get("alert_type", "unknown"),
                severity=r.get("severity", "low"),
                severity_label=SEVERITY_LABEL.get(r.get("severity", "low"), "BAJA"),
                title=r.get("title", "Alerta"),
                message=r.get("message", ""),
                human_impact=content.get(
                    "human_impact",
                    "Se ha detectado un problema de seguridad que requiere tu atención.",
                ),
                fix_steps=content.get(
                    "fix_steps",
                    ["Revisa la descripción de la alerta y contacta con soporte si necesitas ayuda."],
                ),
                sent_at=r["sent_at"],
                read_at=r.get("read_at"),
                domain_id=str(r["domain_id"]) if r.get("domain_id") else None,
                is_unread=not bool(r.get("read_at")),
            )
        )

    # Sort by severity then date
    enriched.sort(
        key=lambda a: (SEVERITY_ORDER.get(a.severity, 9), a.sent_at),
        reverse=False,
    )

    return AlertsResponse(total=len(enriched), unread_count=unread_count, alerts=enriched)


@router.get("/unread-count")
async def unread_count(
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    result = (
        db.table("alerts")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .is_("read_at", "null")
        .execute()
    )
    return {"unread_count": result.count or 0}


@router.patch("/{alert_id}/read", status_code=204)
async def mark_read(
    alert_id: UUID,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    db.table("alerts").update(
        {"read_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", str(alert_id)).eq("user_id", user_id).execute()


@router.patch("/read-all", status_code=204)
async def mark_all_read(
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    db.table("alerts").update(
        {"read_at": datetime.now(timezone.utc).isoformat()}
    ).eq("user_id", user_id).is_("read_at", "null").execute()
