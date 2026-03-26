import Link from "next/link";
import { LegalPage, H2, P, InfoBox, CookieTable, AL, B } from "@/components/legal";

export const metadata = {
  title: "Política de Cookies – ChronoShield",
  description: "Información sobre el uso de cookies en ChronoShield.",
};

export default function CookiesPage() {
  return (
    <LegalPage title="Política de Cookies" updated="15 de marzo de 2026" badge="Legal · Cookies">

      <InfoBox>
        <B>Resumen:</B> ChronoShield solo utiliza cookies técnicas estrictamente
        necesarias para que el servicio funcione correctamente. No utilizamos cookies de rastreo, publicidad,
        análisis de comportamiento ni de redes sociales.
      </InfoBox>

      <H2>1. ¿Qué son las cookies?</H2>
      <P>
        Las cookies son pequeños archivos de texto que los sitios web almacenan en el navegador del usuario al
        visitarlos. Permiten que el sitio recuerde información entre visitas, como si el usuario ha iniciado
        sesión o sus preferencias de idioma.
      </P>

      <H2>2. Tipos de cookies que utilizamos</H2>
      <P>
        ChronoShield utiliza <B>exclusivamente cookies técnicas necesarias</B>.
        Estas cookies no requieren consentimiento del usuario según el artículo 22.2 de la LSSI-CE, ya que
        son imprescindibles para el funcionamiento del servicio.
      </P>

      <CookieTable cookies={[
        {
          name: "sb-access-token",
          type: "Técnica",
          purpose: "Token de autenticación de Supabase. Mantiene la sesión del usuario activa de forma segura.",
          duration: "Sesión",
        },
        {
          name: "sb-refresh-token",
          type: "Técnica",
          purpose: "Token de renovación de sesión de Supabase. Permite renovar el acceso sin requerir inicio de sesión repetido.",
          duration: "30 días",
        },
        {
          name: "sb-auth-token",
          type: "Técnica",
          purpose: "Cookie de autenticación secundaria de Supabase para el correcto funcionamiento del sistema de autenticación.",
          duration: "Sesión",
        },
      ]} />

      <H2>3. Cookies de terceros</H2>
      <P>
        ChronoShield <B>no instala cookies de terceros</B> con fines publicitarios,
        de rastreo o de análisis de comportamiento. Las únicas cookies presentes son las mencionadas anteriormente,
        generadas por nuestro proveedor de autenticación (Supabase) para el funcionamiento técnico del servicio.
      </P>

      <H2>4. Lo que NO hacemos</H2>
      <P>Confirmamos expresamente que ChronoShield <B>no utiliza</B>:</P>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        {[
          "Cookies de publicidad o retargeting",
          "Cookies de Google Analytics ni ninguna otra herramienta de analítica",
          "Cookies de redes sociales (Facebook Pixel, LinkedIn Insight, etc.)",
          "Cookies de rastreo de comportamiento",
          "Fingerprinting del navegador ni técnicas de rastreo similares",
        ].map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 16, height: 16,
                borderRadius: "50%",
                background: "rgba(239,68,68,0.06)",
                border: "1px solid rgba(239,68,68,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="7" height="7" viewBox="0 0 14 14" fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round">
                <path d="M5 5l4 4M9 5l-4 4"/>
              </svg>
            </span>
            <span style={{
              fontFamily: "var(--font-jakarta-family, 'Plus Jakarta Sans', system-ui, sans-serif)",
              fontSize: "0.9rem", color: "#9999ad",
            }}>
              {item}
            </span>
          </div>
        ))}
      </div>

      <H2>5. Cómo gestionar las cookies</H2>
      <P>
        Dado que las cookies que utilizamos son estrictamente técnicas y necesarias para el funcionamiento del
        servicio, no disponemos de un panel de gestión de consentimiento de cookies.
      </P>
      <P>
        No obstante, puede gestionar o eliminar las cookies desde la configuración de su navegador. Tenga en cuenta
        que deshabilitar las cookies de sesión podría impedir el correcto funcionamiento del servicio, ya que son
        necesarias para mantener la sesión activa.
      </P>
      <P>Instrucciones para gestionar cookies en los principales navegadores:</P>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        {[
          { name: "Google Chrome", url: "https://support.google.com/chrome/answer/95647" },
          { name: "Mozilla Firefox", url: "https://support.mozilla.org/es/kb/habilitar-y-deshabilitar-cookies-sitios-web" },
          { name: "Safari", url: "https://support.apple.com/es-es/guide/safari/sfri11471/mac" },
          { name: "Microsoft Edge", url: "https://support.microsoft.com/es-es/microsoft-edge/eliminar-las-cookies-en-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" },
        ].map((b) => (
          <div key={b.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 16, height: 16,
                borderRadius: "50%",
                background: "rgba(0,229,191,0.06)",
                border: "1px solid rgba(0,229,191,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#00e5bf" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </span>
            <AL href={b.url} external>{b.name}</AL>
          </div>
        ))}
      </div>

      <H2>6. Más información</H2>
      <P>
        Para cualquier consulta sobre nuestra política de cookies o el tratamiento de sus datos personales,
        puede contactar con nosotros en{" "}
        <AL href="mailto:hola@chronoshield.eu">hola@chronoshield.eu</AL>.
        Consulte también nuestra{" "}
        <Link href="/privacidad" style={{ color: "#00e5bf", textDecoration: "none" }}>Política de Privacidad</Link>{" "}
        para información completa sobre el tratamiento de sus datos.
      </P>

    </LegalPage>
  );
}
