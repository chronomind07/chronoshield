import Link from "next/link";

export const metadata = {
  title: "Política de Privacidad – ChronoShield",
  description: "Información sobre el tratamiento de tus datos personales por ChronoShield.",
};

/* ── Shared nav ─────────────────────────────────────────────────────────────── */
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

/* ── Legal page shell ───────────────────────────────────────────────────────── */
function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "#080C10" }}>
      <LegalNav />
      <main className="max-w-[900px] mx-auto px-6 pt-[96px] pb-24">
        {/* Header */}
        <div className="mb-10 pb-8" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4"
            style={{ background: "rgba(0,194,255,0.05)", border: "1px solid rgba(0,194,255,0.15)" }}>
            <span className="font-mono text-[10px] tracking-[2px] text-[#00C2FF] uppercase">Legal · RGPD</span>
          </div>
          <h1 className="font-syne font-bold text-[36px] lg:text-[42px] text-[#E8EDF2] leading-[1.1] mb-3">{title}</h1>
          <p className="text-[13px] text-[#5A6B7A] font-mono">Última actualización: {updated}</p>
        </div>
        {/* Content */}
        <div className="prose-legal">
          {children}
        </div>
        {/* Footer links */}
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

/* ── Typography helpers ─────────────────────────────────────────────────────── */
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
function Ul({ items }: { items: string[] }) {
  return (
    <ul className="mb-4 space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-[15px] text-[#9AACBA] leading-[1.7]">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-1">
            <circle cx="7" cy="7" r="6" fill="rgba(0,194,255,0.08)" />
            <path d="M4.5 7l2 2 3-3" stroke="#00C2FF" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {item}
        </li>
      ))}
    </ul>
  );
}
function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-5 p-4 rounded-xl text-[14px] text-[#9AACBA] leading-[1.7]"
      style={{ background: "rgba(0,194,255,0.04)", border: "1px solid rgba(0,194,255,0.12)" }}>
      {children}
    </div>
  );
}

/* ── PAGE ───────────────────────────────────────────────────────────────────── */
export default function PrivacidadPage() {
  return (
    <LegalPage title="Política de Privacidad" updated="15 de marzo de 2026">

      <P>
        En ChronoShield nos comprometemos a proteger la privacidad de nuestros usuarios y a tratar sus datos personales
        de forma transparente, segura y conforme al Reglamento General de Protección de Datos (RGPD) y a la Ley
        Orgánica 3/2018 de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD).
      </P>

      <H2>1. Responsable del tratamiento</H2>
      <InfoBox>
        <strong className="text-[#E8EDF2]">ChronoShield</strong><br />
        Servicio de ciberseguridad para empresas<br />
        Email de contacto: <a href="mailto:hola@chronoshield.eu" className="text-[#00C2FF] hover:underline">hola@chronoshield.eu</a><br />
        Delegado de Protección de Datos (DPD): <a href="mailto:hola@chronoshield.eu" className="text-[#00C2FF] hover:underline">hola@chronoshield.eu</a>
      </InfoBox>

      <H2>2. Datos personales que tratamos</H2>
      <P>Recogemos y tratamos las siguientes categorías de datos:</P>
      <Ul items={[
        "Datos de identificación: nombre completo o denominación social",
        "Datos de contacto: dirección de correo electrónico",
        "Datos del servicio: dominio o dominios corporativos que desea monitorizar",
        "Correos electrónicos corporativos facilitados para la vigilancia de filtraciones",
        "Datos de la suscripción: plan contratado, historial de pagos (gestionado por Stripe)",
        "Datos técnicos: dirección IP de acceso, registros de uso del servicio",
      ]} />

      <H2>3. Finalidad del tratamiento</H2>
      <P>Tratamos sus datos para las siguientes finalidades:</P>
      <Ul items={[
        "Prestación del servicio de monitorización de seguridad digital contratado",
        "Gestión de la cuenta de usuario y autenticación",
        "Envío de alertas de seguridad y notificaciones del servicio",
        "Gestión de la facturación y el cobro de la suscripción",
        "Atención al cliente y resolución de incidencias",
        "Cumplimiento de las obligaciones legales aplicables",
      ]} />

      <H2>4. Base legal del tratamiento</H2>
      <Ul items={[
        "Ejecución de un contrato: el tratamiento es necesario para prestar el servicio de monitorización de seguridad que ha contratado",
        "Consentimiento: para el envío de comunicaciones comerciales cuando así lo solicite",
        "Interés legítimo: para la detección de fraude y la mejora del servicio",
        "Obligación legal: para el cumplimiento de obligaciones fiscales y contables",
      ]} />

      <H2>5. Conservación de datos</H2>
      <P>
        Sus datos se conservarán durante el tiempo que mantenga activa su cuenta en ChronoShield. Una vez cancelada
        la suscripción, los datos se conservarán bloqueados durante un plazo de <strong className="text-[#E8EDF2]">3 años adicionales</strong> para
        atender posibles reclamaciones legales o fiscales, transcurridos los cuales serán eliminados de forma segura.
      </P>

      <H2>6. Destinatarios y transferencias internacionales</H2>
      <P>Sus datos pueden ser comunicados a los siguientes terceros encargados del tratamiento:</P>
      <Ul items={[
        "Supabase Inc. — Infraestructura de base de datos y autenticación. Datos almacenados en la región EU (Frankfurt). Cumple con el RGPD mediante cláusulas contractuales tipo.",
        "Stripe Inc. — Procesamiento de pagos y gestión de suscripciones. Opera bajo el marco EU-US Data Privacy Framework y cláusulas contractuales tipo.",
        "Railway — Infraestructura de servidor backend. Los datos procesados en tránsito están cifrados mediante TLS.",
        "Resend Inc. — Envío de emails transaccionales (alertas, notificaciones). Datos en tránsito cifrados.",
      ]} />
      <P>
        Todos los proveedores han sido evaluados y ofrecen garantías suficientes de conformidad con el RGPD.
        No realizamos transferencias de datos a terceros países sin las salvaguardias adecuadas.
      </P>

      <H2>7. Derechos del interesado</H2>
      <P>
        Tiene derecho a ejercer, en cualquier momento y de forma gratuita, los siguientes derechos sobre sus datos personales:
      </P>
      <Ul items={[
        "Acceso: conocer qué datos suyos tratamos y cómo",
        "Rectificación: corregir datos inexactos o incompletos",
        "Supresión ('derecho al olvido'): solicitar la eliminación de sus datos cuando ya no sean necesarios",
        "Portabilidad: recibir sus datos en un formato estructurado y de uso común",
        "Limitación del tratamiento: solicitar la suspensión temporal del tratamiento",
        "Oposición: oponerse al tratamiento basado en interés legítimo",
        "Retirada del consentimiento: en cualquier momento, sin que ello afecte a la licitud del tratamiento previo",
      ]} />
      <P>
        Para ejercer sus derechos, puede dirigirse a{" "}
        <a href="mailto:hola@chronoshield.eu" className="text-[#00C2FF] hover:underline">hola@chronoshield.eu</a>.
        También tiene derecho a presentar una reclamación ante la{" "}
        <strong className="text-[#E8EDF2]">Agencia Española de Protección de Datos (AEPD)</strong> en{" "}
        <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer" className="text-[#00C2FF] hover:underline">
          www.aepd.es
        </a>.
      </P>

      <H2>8. Seguridad de los datos</H2>
      <P>
        Aplicamos medidas técnicas y organizativas apropiadas para proteger sus datos contra el acceso no autorizado,
        pérdida, alteración o destrucción. Esto incluye el cifrado de datos en tránsito (TLS) y en reposo,
        control de acceso basado en roles, y revisiones periódicas de seguridad.
      </P>

      <H2>9. Cookies</H2>
      <P>
        ChronoShield utiliza únicamente cookies técnicas estrictamente necesarias para el funcionamiento del servicio.
        No utilizamos cookies de rastreo, publicidad ni analítica de terceros. Puede consultar nuestra{" "}
        <Link href="/cookies" className="text-[#00C2FF] hover:underline">Política de Cookies</Link> para más información.
      </P>

      <H2>10. Modificaciones de esta política</H2>
      <P>
        Nos reservamos el derecho a actualizar esta política de privacidad cuando sea necesario, por ejemplo ante
        cambios normativos o en nuestros servicios. Le notificaremos cualquier cambio relevante por email o mediante
        un aviso destacado en el panel de control.
      </P>

    </LegalPage>
  );
}
