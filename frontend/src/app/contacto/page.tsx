"use client";

import { useState } from "react";
import { LegalPage } from "@/components/legal";

// ── Contact form (client component) ─────────────────────────────────────────

function ContactForm() {
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Slight delay for UX, then open mailto + show success
    await new Promise((r) => setTimeout(r, 600));

    const subjectEncoded = encodeURIComponent(`[ChronoShield Web] ${subject}`);
    const bodyEncoded    = encodeURIComponent(
      `Nombre: ${name}\nEmail: ${email}\n\nMensaje:\n${message}`
    );
    window.location.href = `mailto:hola@chronoshield.eu?subject=${subjectEncoded}&body=${bodyEncoded}`;

    setLoading(false);
    setDone(true);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    background: "#0c0c14",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 10,
    color: "#f0f0f5",
    fontFamily: "var(--font-jakarta-family, 'Plus Jakarta Sans', system-ui, sans-serif)",
    fontSize: "0.9rem",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.78rem",
    fontWeight: 600,
    color: "#9999ad",
    marginBottom: 8,
    fontFamily: "var(--font-jakarta-family, 'Plus Jakarta Sans', system-ui, sans-serif)",
  };

  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = "rgba(0,229,191,0.30)";
    e.target.style.boxShadow   = "0 0 0 3px rgba(0,229,191,0.08)";
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = "rgba(255,255,255,0.06)";
    e.target.style.boxShadow   = "none";
  };

  if (done) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "48px 24px",
          borderRadius: 16,
          background: "#0a0a0f",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div
          style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "rgba(0,229,191,0.08)",
            border: "1px solid rgba(0,229,191,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
            color: "#00e5bf",
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h3
          style={{
            fontFamily: "var(--font-serif-family, 'Instrument Serif', Georgia, serif)",
            fontSize: "1.5rem", fontWeight: 400,
            color: "#f0f0f5", marginBottom: 10,
          }}
        >
          ¡Mensaje enviado!
        </h3>
        <p style={{ fontSize: "0.9rem", color: "#9999ad", lineHeight: 1.7, marginBottom: 24 }}>
          Se ha abierto tu cliente de correo con el mensaje listo para enviar a{" "}
          <strong style={{ color: "#f0f0f5" }}>hola@chronoshield.eu</strong>.
          Si no se ha abierto, escríbenos directamente a esa dirección.
        </p>
        <button
          onClick={() => { setDone(false); setName(""); setEmail(""); setSubject(""); setMessage(""); }}
          style={{
            padding: "10px 24px",
            background: "transparent",
            border: "1px solid rgba(0,229,191,0.2)",
            borderRadius: 8,
            color: "#00e5bf",
            fontFamily: "inherit",
            fontSize: "0.85rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseOver={(e) => { e.currentTarget.style.background = "rgba(0,229,191,0.06)"; }}
          onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          Enviar otro mensaje
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {error && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "12px 16px",
          background: "rgba(255,77,106,0.06)",
          border: "1px solid rgba(255,77,106,0.12)",
          borderRadius: 10,
          fontSize: "0.82rem", color: "#ff4d6a",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          {error}
        </div>
      )}

      {/* Name + Email */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label style={labelStyle}>Nombre</label>
          <input
            type="text" required
            placeholder="Tu nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
            onFocus={onFocus} onBlur={onBlur}
          />
        </div>
        <div>
          <label style={labelStyle}>Email</label>
          <input
            type="email" required
            placeholder="tu@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            onFocus={onFocus} onBlur={onBlur}
          />
        </div>
      </div>

      {/* Subject */}
      <div>
        <label style={labelStyle}>Asunto</label>
        <input
          type="text" required
          placeholder="¿En qué podemos ayudarte?"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          style={inputStyle}
          onFocus={onFocus} onBlur={onBlur}
        />
      </div>

      {/* Message */}
      <div>
        <label style={labelStyle}>Mensaje</label>
        <textarea
          required
          rows={6}
          placeholder="Escribe tu mensaje aquí..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.7 }}
          onFocus={onFocus} onBlur={onBlur}
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        style={{
          padding: "14px",
          background: "#00e5bf",
          color: "#000",
          border: "none",
          borderRadius: 10,
          fontFamily: "var(--font-jakarta-family, 'Plus Jakarta Sans', system-ui, sans-serif)",
          fontSize: "0.9rem",
          fontWeight: 700,
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
          transition: "all 0.25s",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          boxShadow: "0 0 24px rgba(0,229,191,0.12)",
          letterSpacing: "-0.01em",
        }}
        onMouseOver={(e) => {
          if (!loading) {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "0 0 40px rgba(0,229,191,0.2)";
          }
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = "none";
          e.currentTarget.style.boxShadow = "0 0 24px rgba(0,229,191,0.12)";
        }}
      >
        {loading ? (
          <>
            <span style={{
              width: 16, height: 16,
              border: "2px solid rgba(0,0,0,0.3)",
              borderTopColor: "#000",
              borderRadius: "50%",
              animation: "contactSpin 0.7s linear infinite",
              display: "inline-block",
            }} />
            Enviando...
          </>
        ) : "Enviar mensaje"}
      </button>

      <style>{`@keyframes contactSpin { to { transform: rotate(360deg); } }`}</style>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ContactoPage() {
  return (
    <LegalPage title="Contacto" updated="hola@chronoshield.eu" badge="Soporte">

      {/* Intro */}
      <p
        style={{
          fontFamily: "var(--font-jakarta-family, 'Plus Jakarta Sans', system-ui, sans-serif)",
          fontSize: "0.94rem",
          color: "#9999ad",
          lineHeight: 1.8,
          marginBottom: 36,
        }}
      >
        ¿Tienes alguna pregunta sobre ChronoShield, necesitas ayuda con tu cuenta o quieres saber más sobre
        nuestros planes? Escríbenos y te respondemos en menos de 24 horas en días laborables.
      </p>

      {/* Contact cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 40,
        }}
      >
        {[
          {
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            ),
            label: "Email general",
            value: "hola@chronoshield.eu",
            href: "mailto:hola@chronoshield.eu",
          },
          {
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            ),
            label: "Soporte técnico",
            value: "hola@chronoshield.eu",
            href: "mailto:hola@chronoshield.eu",
          },
          {
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            ),
            label: "Tiempo de respuesta",
            value: "< 24 h laborables",
            href: null,
          },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              padding: "20px",
              borderRadius: 12,
              background: "#0a0a0f",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div
              style={{
                width: 40, height: 40,
                borderRadius: 10,
                background: "rgba(0,229,191,0.06)",
                border: "1px solid rgba(0,229,191,0.10)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#00e5bf",
                marginBottom: 14,
              }}
            >
              {card.icon}
            </div>
            <div
              style={{
                fontFamily: "var(--font-jakarta-family, 'Plus Jakarta Sans', system-ui, sans-serif)",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#55556a",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 6,
              }}
            >
              {card.label}
            </div>
            {card.href ? (
              <a
                href={card.href}
                style={{
                  fontFamily: "var(--font-mono, 'Geist Mono', monospace)",
                  fontSize: "0.82rem",
                  color: "#00e5bf",
                  textDecoration: "none",
                }}
              >
                {card.value}
              </a>
            ) : (
              <span
                style={{
                  fontFamily: "var(--font-mono, 'Geist Mono', monospace)",
                  fontSize: "0.82rem",
                  color: "#9999ad",
                }}
              >
                {card.value}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Divider */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.04)",
          paddingTop: 36,
          marginBottom: 32,
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-jakarta-family, 'Plus Jakarta Sans', system-ui, sans-serif)",
            fontSize: "1rem",
            fontWeight: 700,
            color: "#f0f0f5",
            marginBottom: 6,
          }}
        >
          Envíanos un mensaje
        </h2>
        <p
          style={{
            fontSize: "0.85rem",
            color: "#55556a",
            lineHeight: 1.6,
            marginBottom: 28,
            fontFamily: "var(--font-jakarta-family, 'Plus Jakarta Sans', system-ui, sans-serif)",
          }}
        >
          Rellena el formulario y te responderemos lo antes posible.
        </p>
      </div>

      {/* The form */}
      <ContactForm />

    </LegalPage>
  );
}
