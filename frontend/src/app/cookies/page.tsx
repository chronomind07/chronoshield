import Link from "next/link";

export const metadata = {
  title: "Política de Cookies – ChronoShield",
  description: "Información sobre el uso de cookies en ChronoShield.",
};

function LegalNav() {
  return (
    <header
      className="fixed top-0 inset-x-0 z-50"
      style={{ background: "rgba(8,12,16,0.97)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="max-w-[900px] mx-auto px-6 h-[64px] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg overflow-hidden" style={{ background: "#080C10" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpeg" alt="ChronoShield" width={32} height={32} className="w-full h-full object-contain" />
          </div>
          <span className="font-syne font-bold text-[14px] text-[#E8EDF2]">ChronoShield</span>
        </Link>
        <Link href="/" className="text-[13px] text-[#5A6B7A] hover:text-[#9AACBA] transition-colors">
          ← Volver al inicio
        </Link>
      </div>
    </header>
  );
}

function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "#080C10" }}>
      <LegalNav />
      <main className="max-w-[900px] mx-auto px-6 pt-[96px] pb-24">
        <div className="mb-10 pb-8" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4"
            style={{ background: "rgba(0,194,255,0.05)", border: "1px solid rgba(0,194,255,0.15)" }}>
            <span className="font-mono text-[10px] tracking-[2px] text-[#00C2FF] uppercase">Legal · Cookies</span>
          </div>
          <h1 className="font-syne font-bold text-[36px] lg:text-[42px] text-[#E8EDF2] leading-[1.1] mb-3">{title}</h1>
          <p className="text-[13px] text-[#5A6B7A] font-mono">Última actualización: {updated}</p>
        </div>
        {children}
        <div className="mt-16 pt-8 flex flex-wrap gap-4 text-[13px] text-[#5A6B7A]"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <Link href="/privacidad" className="hover:text-[#9AACBA] transition-colors">Política de privacidad</Link>
          <Link href="/terminos" className="hover:text-[#9AACBA] transition-colors">Términos y condiciones</Link>
          <Link href="/cookies" className="hover:text-[#9AACBA] transition-colors">Política de cookies</Link>
          <Link href="/" className="hover:text-[#9AACBA] transition-colors ml-auto">← Inicio</Link>
        </div>
      </main>
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-syne font-bold text-[20px] text-[#E8EDF2] mt-10 mb-3 pb-2"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      {children}
    </h2>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] text-[#9AACBA] leading-[1.75] mb-4">{children}</p>;
}
function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-5 p-4 rounded-xl text-[14px] text-[#9AACBA] leading-[1.7]"
      style={{ background: "rgba(0,194,255,0.04)", border: "1px solid rgba(0,194,255,0.12)" }}>
      {children}
    </div>
  );
}

/* ── Cookie table ───────────────────────────────────────────────────────────── */
function CookieTable({ cookies }: { cookies: { name: string; type: string; purpose: string; duration: string }[] }) {
  return (
    <div className="my-5 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
      {/* Header */}
      <div className="grid grid-cols-[1fr_100px_2fr_120px] gap-0">
        {["Cookie", "Tipo", "Finalidad", "Duración"].map((h) => (
          <div key={h} className="px-4 py-2.5 font-mono text-[11px] tracking-[1px] text-[#5A6B7A] uppercase"
            style={{ background: "#121A22" }}>
            {h}
          </div>
        ))}
      </div>
      {/* Rows */}
      {cookies.map((c, i) => (
        <div key={i} className="grid grid-cols-[1fr_100px_2fr_120px] gap-0"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="px-4 py-3 font-mono text-[12px] text-[#E8EDF2]">{c.name}</div>
          <div className="px-4 py-3">
            <span className="font-mono text-[10px] px-2 py-0.5 rounded"
              style={{ background: "rgba(0,194,255,0.08)", color: "#00C2FF", border: "1px solid rgba(0,194,255,0.15)" }}>
              {c.type}
            </span>
          </div>
          <div className="px-4 py-3 text-[13px] text-[#9AACBA] leading-[1.6]">{c.purpose}</div>
          <div className="px-4 py-3 text-[13px] text-[#5A6B7A]">{c.duration}</div>
        </div>
      ))}
    </div>
  );
}

export default function CookiesPage() {
  return (
    <LegalPage title="Política de Cookies" updated="15 de marzo de 2026">

      <InfoBox>
        <strong className="text-[#E8EDF2]">Resumen:</strong> ChronoShield solo utiliza cookies técnicas estrictamente
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
        ChronoShield utiliza <strong className="text-[#E8EDF2]">exclusivamente cookies técnicas necesarias</strong>.
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
        ChronoShield <strong className="text-[#E8EDF2]">no instala cookies de terceros</strong> con fines publicitarios,
        de rastreo o de análisis de comportamiento. Las únicas cookies presentes son las mencionadas anteriormente,
        generadas por nuestro proveedor de autenticación (Supabase) para el funcionamiento técnico del servicio.
      </P>

      <H2>4. Lo que NO hacemos</H2>
      <P>Confirmamos expresamente que ChronoShield <strong className="text-[#E8EDF2]">no utiliza</strong>:</P>
      <div className="space-y-2 mb-4">
        {[
          "Cookies de publicidad o retargeting",
          "Cookies de Google Analytics ni ninguna otra herramienta de analítica",
          "Cookies de redes sociales (Facebook Pixel, LinkedIn Insight, etc.)",
          "Cookies de rastreo de comportamiento",
          "Fingerprinting del navegador ni técnicas de rastreo similares",
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-2.5 text-[14px] text-[#9AACBA]">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
              <circle cx="7" cy="7" r="6" fill="rgba(239,68,68,0.08)" />
              <path d="M5 5l4 4M9 5l-4 4" stroke="#EF4444" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            {item}
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
      <div className="space-y-2 mb-4">
        {[
          { name: "Google Chrome", url: "https://support.google.com/chrome/answer/95647" },
          { name: "Mozilla Firefox", url: "https://support.mozilla.org/es/kb/habilitar-y-deshabilitar-cookies-sitios-web" },
          { name: "Safari", url: "https://support.apple.com/es-es/guide/safari/sfri11471/mac" },
          { name: "Microsoft Edge", url: "https://support.microsoft.com/es-es/microsoft-edge/eliminar-las-cookies-en-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" },
        ].map((b) => (
          <div key={b.name} className="flex items-center gap-2.5 text-[14px] text-[#9AACBA]">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
              <circle cx="7" cy="7" r="6" fill="rgba(0,194,255,0.08)" />
              <path d="M4.5 7l2 2 3-3" stroke="#00C2FF" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <a href={b.url} target="_blank" rel="noopener noreferrer"
              className="text-[#00C2FF] hover:underline">
              {b.name}
            </a>
          </div>
        ))}
      </div>

      <H2>6. Más información</H2>
      <P>
        Para cualquier consulta sobre nuestra política de cookies o el tratamiento de sus datos personales,
        puede contactar con nosotros en{" "}
        <a href="mailto:hola@chronoshield.eu" className="text-[#00C2FF] hover:underline">hola@chronoshield.eu</a>.
        Consulte también nuestra{" "}
        <Link href="/privacidad" className="text-[#00C2FF] hover:underline">Política de Privacidad</Link>{" "}
        para información completa sobre el tratamiento de sus datos.
      </P>

    </LegalPage>
  );
}
