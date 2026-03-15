import Link from "next/link";

export const metadata = {
  title: "Términos y Condiciones – ChronoShield",
  description: "Condiciones generales de uso del servicio ChronoShield.",
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
            <span className="font-mono text-[10px] tracking-[2px] text-[#00C2FF] uppercase">Legal</span>
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
function WarnBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-5 p-4 rounded-xl text-[14px] text-[#9AACBA] leading-[1.7]"
      style={{ background: "rgba(255,179,64,0.04)", border: "1px solid rgba(255,179,64,0.15)" }}>
      {children}
    </div>
  );
}

export default function TerminosPage() {
  return (
    <LegalPage title="Términos y Condiciones" updated="15 de marzo de 2026">

      <P>
        Los presentes Términos y Condiciones regulan el acceso y uso del servicio ChronoShield, plataforma de
        ciberseguridad y monitorización de seguridad digital para empresas. Al registrarse y utilizar el servicio,
        el usuario acepta expresamente las presentes condiciones.
      </P>

      <H2>1. Descripción del servicio</H2>
      <P>
        ChronoShield es un servicio de monitorización de seguridad digital que permite a las empresas vigilar
        continuamente su exposición a amenazas cibernéticas. El servicio incluye:
      </P>
      <Ul items={[
        "Detección de filtraciones de datos en la dark web",
        "Monitorización del estado SSL y disponibilidad del servidor (uptime)",
        "Análisis de la configuración de seguridad del correo electrónico (SPF, DKIM, DMARC)",
        "Cálculo del Security Score global de la empresa",
        "Sistema de alertas automáticas por correo electrónico",
        "Escaneos manuales bajo demanda mediante créditos",
      ]} />

      <H2>2. Registro y acceso</H2>
      <P>
        Para acceder al servicio es necesario crear una cuenta proporcionando un correo electrónico válido y una
        contraseña. El usuario es responsable de mantener la confidencialidad de sus credenciales y de todas las
        actividades realizadas bajo su cuenta. ChronoShield no se hace responsable de accesos no autorizados
        derivados de un uso negligente de las credenciales por parte del usuario.
      </P>
      <P>
        El usuario declara ser mayor de 18 años y actuar en nombre de una empresa o persona jurídica, aceptando
        estos términos en su nombre.
      </P>

      <H2>3. Planes y precios</H2>
      <P>ChronoShield ofrece los siguientes planes de suscripción:</P>

      <div className="grid sm:grid-cols-2 gap-4 my-5">
        {[
          {
            name: "Starter",
            price: "29€ / mes",
            features: ["1 dominio monitorizado", "10 emails vigilados", "5 créditos de escaneo / mes", "Todas las funcionalidades básicas"],
          },
          {
            name: "Business",
            price: "59€ / mes",
            features: ["3 dominios monitorizados", "30 emails vigilados", "20 créditos de escaneo / mes", "Detección de suplantación de empresa"],
          },
        ].map((plan) => (
          <div key={plan.name} className="p-4 rounded-xl"
            style={{ background: "#0D1218", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="font-syne font-bold text-[16px] text-[#E8EDF2] mb-1">{plan.name}</div>
            <div className="font-mono text-[13px] text-[#00C2FF] mb-3">{plan.price}</div>
            <ul className="space-y-1.5">
              {plan.features.map((f, i) => (
                <li key={i} className="text-[13px] text-[#9AACBA] flex items-start gap-2">
                  <span className="text-[#00C2FF] shrink-0">·</span>{f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <P>
        Los precios indicados incluyen el IVA aplicable. ChronoShield se reserva el derecho a modificar los precios
        con un preaviso mínimo de 30 días, notificándolo al usuario por correo electrónico.
      </P>

      <H2>4. Sistema de créditos</H2>
      <P>
        Los créditos de escaneo permiten lanzar análisis manuales de seguridad (emails, dominios o detección de
        suplantación). Cada plan mensual incluye un número de créditos que se renuevan cada mes.
        Adicionalmente, el usuario puede adquirir packs de créditos adicionales:
      </P>
      <Ul items={[
        "Pack S: 5 créditos por 9,99€",
        "Pack M: 10 créditos por 18,99€",
        "Pack L: 20 créditos por 34,99€ (más popular)",
      ]} />
      <P>
        Los créditos adquiridos mediante packs adicionales no caducan y son acumulables. Los créditos incluidos en
        la suscripción mensual no son acumulables ni reembolsables si no se utilizan.
      </P>

      <H2>5. Facturación y pago</H2>
      <P>
        La suscripción se factura mensualmente con carácter anticipado. El cobro se realiza mediante la pasarela
        de pago segura Stripe. El usuario autoriza a ChronoShield a cargar el importe correspondiente al plan
        contratado en la fecha de renovación mensual.
      </P>
      <P>
        En caso de impago, el acceso al servicio podrá ser suspendido hasta regularizar el pago. No se realizarán
        devoluciones por periodos parciales de suscripción ya facturados.
      </P>

      <H2>6. Cancelación</H2>
      <InfoBox>
        <strong className="text-[#E8EDF2]">Sin permanencia.</strong> El usuario puede cancelar su suscripción en cualquier momento
        desde el panel de control en Ajustes → Suscripción → Gestionar suscripción, sin coste adicional ni penalización.
        Tras la cancelación, el servicio permanece activo hasta el final del periodo mensual ya pagado.
      </InfoBox>
      <P>
        ChronoShield también se reserva el derecho a cancelar o suspender cuentas que incumplan estos términos,
        con notificación previa salvo en casos de uso fraudulento o ilícito.
      </P>

      <H2>7. Uso aceptable</H2>
      <P>El usuario se compromete a:</P>
      <Ul items={[
        "Utilizar el servicio únicamente para monitorizar dominios y correos electrónicos de los que sea titular o tenga autorización expresa",
        "No utilizar el servicio para actividades ilegales o que infrinjan derechos de terceros",
        "No intentar acceder a datos de otros usuarios o a sistemas internos de ChronoShield",
        "No realizar un uso abusivo del servicio que pueda afectar a su disponibilidad para otros usuarios",
      ]} />

      <H2>8. Limitación de responsabilidad</H2>
      <WarnBox>
        ChronoShield es un servicio de <strong className="text-[#E8EDF2]">monitorización y detección</strong>. La prestación del servicio
        no garantiza la seguridad absoluta ni la prevención de todos los ataques o filtraciones. ChronoShield
        actúa como herramienta de vigilancia, facilitando la detección temprana de amenazas, pero la
        responsabilidad de implementar las medidas correctoras recae en el usuario.
      </WarnBox>
      <P>
        ChronoShield no será responsable de daños indirectos, lucro cesante o pérdidas de datos derivados del
        uso o imposibilidad de uso del servicio, salvo en casos de dolo o negligencia grave imputable a ChronoShield.
        La responsabilidad total máxima de ChronoShield frente al usuario se limitará al importe pagado en los
        últimos 3 meses de suscripción.
      </P>
      <P>
        ChronoShield no garantiza la disponibilidad ininterrumpida del servicio, aunque se compromete a mantener
        un nivel de disponibilidad razonable y a informar de mantenimientos programados con antelación.
      </P>

      <H2>9. Propiedad intelectual</H2>
      <P>
        Todos los derechos de propiedad intelectual sobre el servicio ChronoShield, incluyendo su código fuente,
        diseño, marca y contenidos, son propiedad exclusiva de ChronoShield. El usuario recibe una licencia de
        uso personal, no exclusiva e intransferible, limitada al objeto del servicio contratado.
      </P>

      <H2>10. Modificaciones del servicio y de los términos</H2>
      <P>
        ChronoShield se reserva el derecho a modificar el servicio o los presentes términos. Los cambios
        sustanciales serán notificados al usuario con al menos 15 días de antelación. El uso continuado del
        servicio tras la notificación implica la aceptación de los nuevos términos.
      </P>

      <H2>11. Ley aplicable y jurisdicción</H2>
      <P>
        Los presentes Términos y Condiciones se rigen por la <strong className="text-[#E8EDF2]">legislación española</strong>.
        Para la resolución de cualquier controversia derivada de su interpretación o aplicación, las partes
        se someten expresamente a la jurisdicción de los{" "}
        <strong className="text-[#E8EDF2]">Juzgados y Tribunales de Alicante</strong>,
        con renuncia a cualquier otro fuero que pudiera corresponderles.
      </P>

      <H2>12. Contacto</H2>
      <P>
        Para cualquier consulta relacionada con estos términos, puede contactar con nosotros en{" "}
        <a href="mailto:hola@chronoshield.eu" className="text-[#00C2FF] hover:underline">hola@chronoshield.eu</a>.
      </P>

    </LegalPage>
  );
}
