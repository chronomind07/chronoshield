import Link from "next/link";
import { LegalPage, H2, P, Ul, InfoBox, AL, B } from "@/components/legal";

export const metadata = {
  title: "Política de Privacidad – ChronoShield",
  description: "Información sobre el tratamiento de tus datos personales por ChronoShield.",
};

export default function PrivacidadPage() {
  return (
    <LegalPage title="Política de Privacidad" updated="15 de marzo de 2026" badge="Legal · RGPD">

      <P>
        En ChronoShield nos comprometemos a proteger la privacidad de nuestros usuarios y a tratar sus datos personales
        de forma transparente, segura y conforme al Reglamento General de Protección de Datos (RGPD) y a la Ley
        Orgánica 3/2018 de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD).
      </P>

      <H2>1. Responsable del tratamiento</H2>
      <InfoBox>
        <B>ChronoShield</B><br />
        Servicio de ciberseguridad para empresas<br />
        Email de contacto: <AL href="mailto:hola@chronoshield.eu">hola@chronoshield.eu</AL><br />
        Delegado de Protección de Datos (DPD): <AL href="mailto:hola@chronoshield.eu">hola@chronoshield.eu</AL>
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
        la suscripción, los datos se conservarán bloqueados durante un plazo de <B>3 años adicionales</B> para
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
        <AL href="mailto:hola@chronoshield.eu">hola@chronoshield.eu</AL>.
        También tiene derecho a presentar una reclamación ante la{" "}
        <B>Agencia Española de Protección de Datos (AEPD)</B> en{" "}
        <AL href="https://www.aepd.es" external>www.aepd.es</AL>.
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
        <Link href="/cookies" style={{ color: "#00e5bf", textDecoration: "none" }}>Política de Cookies</Link> para más información.
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
