import anthropic
import json
from app.core.config import settings

client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

SYSTEM_PROMPT = """Eres ChronoShield AI, un asistente experto en ciberseguridad especializado en inmobiliarias.
Tu misión es explicar los resultados de seguridad de forma clara y simple, sin tecnicismos innecesarios.
Habla siempre en español, de forma directa y accionable. Usa emojis para hacer el texto más visual.
Prioriza siempre los problemas más urgentes primero."""


def _build_prompt(context: dict, context_type: str) -> str:
    ctx_json = json.dumps(context, indent=2, default=str)

    prompts = {
        "full_report": f"""Analiza la postura de seguridad completa de esta inmobiliaria y genera un informe ejecutivo:

DATOS DE SEGURIDAD:
{ctx_json}

Incluye:
1. 🎯 Resumen ejecutivo (2-3 líneas)
2. 🚨 Problemas críticos (si los hay)
3. ⚠️ Problemas a vigilar
4. ✅ Lo que está bien
5. 📋 Próximos 3 pasos concretos

Sé conciso y claro.""",

        "ssl_alert": f"""Explica este problema de SSL a un cliente de inmobiliaria:

DATOS SSL:
{ctx_json}

Explica: qué es el SSL, por qué importa para su web, qué puede pasar si no lo arregla, y cómo solucionarlo.""",

        "breach_alert": f"""Explica esta brecha de seguridad detectada:

DATOS DE BRECHA:
{ctx_json}

Explica: qué es una brecha de datos, qué información puede haberse expuesto, qué riesgo tiene para su empresa inmobiliaria, y qué debe hacer ahora.""",

        "email_security": f"""Explica los problemas de configuración de email detectados:

DATOS EMAIL SECURITY:
{ctx_json}

Explica SPF, DKIM y DMARC de forma simple (como si hablaras con alguien no técnico) y por qué son importantes para evitar que les suplanten en emails.""",
    }

    return prompts.get(context_type, prompts["full_report"])


async def generate_security_analysis(
    context: dict,
    context_type: str,
    user_id: str,
    db,
) -> dict:
    prompt = _build_prompt(context, context_type)

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    analysis_text = message.content[0].text
    tokens_used = message.usage.input_tokens + message.usage.output_tokens

    # Persist analysis
    db.table("ai_analyses").insert(
        {
            "user_id": user_id,
            "context_type": context_type,
            "input_data": context,
            "analysis": analysis_text,
            "tokens_used": tokens_used,
            "model": "claude-haiku-4-5-20251001",
        }
    ).execute()

    return {
        "analysis": analysis_text,
        "model": "claude-haiku-4-5-20251001",
        "tokens_used": tokens_used,
    }
