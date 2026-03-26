import { LegalPage, H2, P, Ul, InfoBox, WarnBox, AL, B } from "@/components/legal";

export const metadata = {
  title: "Términos y Condiciones – ChronoShield",
  description: "Condiciones generales de uso del servicio ChronoShield.",
};

export default function TerminosPage() {
  return (
    <LegalPage title="Términos y Condiciones" updated="15 de marzo de 2026" badge="Legal">

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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
          margin: "20px 0",
        }}
      >
        {[
          {
            name: "Starter",
            price: "29€ / mes",
            features: [
              "1 dominio monitorizado",
              "10 emails vigilados",
              "5 créditos de escaneo / mes",
              "Todas las funcionalidades básicas",
            ],
          },
          {
            name: "Business",
            price: "59€ / mes",
            features: [
              "3 dominios monitorizados",
              "30 emails vigilados",
              "20 créditos de escaneo / mes",
              "Detección de suplantación de empresa",
            ],
          },
        ].map((plan) => (
          <div
            key={plan.name}
            style={{
              padding: "20px",
              borderRadius: 12,
              background: "#0a0a0f",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-jakarta-family, 'Plus Jakarta Sans', system-ui, sans-serif)",
                fontSize: "0.95rem",
                fontWeight: 700,
                color: "#f0f0f5",
                marginBottom: 4,
              }}
            >
              {plan.name}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono, 'Geist Mono', monospace)",
                fontSize: "0.82rem",
                color: "#00e5bf",
                marginBottom: 14,
              }}
            >
              {plan.price}
            </div>
            <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {plan.features.map((f, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    fontSize: "0.82rem",
                    color: "#9999ad",
                  }}
                >
                  <span style={{ color: "#00e5bf", flexShrink: 0 }}>·</span>
                  {f}
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
        <B>Sin permanencia.</B> El usuario puede cancelar su suscripción en cualquier momento
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
        ChronoShield es un servicio de <B>monitorización y detección</B>. La prestación del servicio
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
        Los presentes Términos y Condiciones se rigen por la <B>legislación española</B>.
        Para la resolución de cualquier controversia derivada de su interpretación o aplicación, las partes
        se someten expresamente a la jurisdicción de los{" "}
        <B>Juzgados y Tribunales de Alicante</B>,
        con renuncia a cualquier otro fuero que pudiera corresponderles.
      </P>

      <H2>12. Contacto</H2>
      <P>
        Para cualquier consulta relacionada con estos términos, puede contactar con nosotros en{" "}
        <AL href="mailto:hola@chronoshield.eu">hola@chronoshield.eu</AL>.
      </P>

    </LegalPage>
  );
}
