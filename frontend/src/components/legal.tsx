"use client";

/**
 * ChronoShield — Shared Legal Page Components
 * Used by: /privacidad, /terminos, /cookies, /contacto
 * Design system: Instrument Serif + Plus Jakarta Sans + Geist Mono, #050507 bg, #00e5bf accent
 * "use client" required — LegalNav + FooterLink + AL use onMouseOver/onMouseOut handlers
 */

import Link from "next/link";

// ── Nav ──────────────────────────────────────────────────────────────────────

export function LegalNav() {
  return (
    <header
      className="fixed top-0 inset-x-0 z-50"
      style={{
        background: "rgba(5,5,7,0.96)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <div
        className="mx-auto px-6 h-[60px] flex items-center justify-between"
        style={{ maxWidth: 720 }}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group" style={{ textDecoration: "none" }}>
          <div
            style={{
              width: 34, height: 34,
              background: "linear-gradient(135deg, #00e5bf, #6366f1)",
              borderRadius: 9,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 16px rgba(0,229,191,0.15)",
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono, 'Geist Mono', monospace)",
              fontSize: "0.8rem",
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#f0f0f5",
            }}
          >
            ChronoShield
          </span>
        </Link>

        {/* Back */}
        <Link
          href="/"
          className="transition-colors"
          style={{ fontSize: "0.82rem", color: "#55556a", textDecoration: "none" }}
          onMouseOver={(e) => (e.currentTarget.style.color = "#00e5bf")}
          onMouseOut={(e) => (e.currentTarget.style.color = "#55556a")}
        >
          ← Volver
        </Link>
      </div>
    </header>
  );
}

// ── Page shell ────────────────────────────────────────────────────────────────

interface LegalPageProps {
  title: string;
  updated: string;
  badge?: string;
  children: React.ReactNode;
}

export function LegalPage({ title, updated, badge = "Legal", children }: LegalPageProps) {
  return (
    <div style={{ minHeight: "100vh", background: "#050507", position: "relative", overflowX: "hidden" }}>

      {/* Noise overlay */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          pointerEvents: "none", opacity: 0.018,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "256px",
        }}
      />

      {/* Ambient orbs */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed", top: -200, right: -120, zIndex: 0,
          width: 600, height: 600, pointerEvents: "none",
          background: "radial-gradient(circle, rgba(0,229,191,0.035) 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "fixed", bottom: -150, left: -150, zIndex: 0,
          width: 500, height: 500, pointerEvents: "none",
          background: "radial-gradient(circle, rgba(99,102,241,0.025) 0%, transparent 70%)",
        }}
      />

      <LegalNav />

      <main
        className="mx-auto px-6"
        style={{
          maxWidth: 720,
          paddingTop: 96,
          paddingBottom: 96,
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Page header */}
        <div
          style={{
            marginBottom: 48,
            paddingBottom: 32,
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          {/* Badge */}
          <div
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 12px",
              borderRadius: 20,
              background: "rgba(0,229,191,0.05)",
              border: "1px solid rgba(0,229,191,0.12)",
              marginBottom: 16,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono, 'Geist Mono', monospace)",
                fontSize: "0.68rem",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#00e5bf",
                fontWeight: 500,
              }}
            >
              {badge}
            </span>
          </div>

          {/* Title — Instrument Serif */}
          <h1
            style={{
              fontFamily: "var(--font-serif-family, 'Instrument Serif', Georgia, serif)",
              fontSize: "clamp(2rem, 5vw, 3rem)",
              fontWeight: 400,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              color: "#f0f0f5",
              marginBottom: 12,
            }}
          >
            {title}
          </h1>

          {/* Date */}
          <p
            style={{
              fontFamily: "var(--font-mono, 'Geist Mono', monospace)",
              fontSize: "0.75rem",
              color: "#55556a",
              letterSpacing: "0.02em",
            }}
          >
            Última actualización: {updated}
          </p>
        </div>

        {/* Page content */}
        {children}

        {/* Footer links */}
        <div
          style={{
            marginTop: 72,
            paddingTop: 28,
            borderTop: "1px solid rgba(255,255,255,0.04)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "8px 20px",
            fontSize: "0.78rem",
            color: "#55556a",
          }}
        >
          <FooterLink href="/privacidad">Privacidad</FooterLink>
          <FooterLink href="/terminos">Términos</FooterLink>
          <FooterLink href="/cookies">Cookies</FooterLink>
          <FooterLink href="/contacto">Contacto</FooterLink>
          <span style={{ marginLeft: "auto", color: "#33334a" }}>© 2026 ChronoShield</span>
        </div>
      </main>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{ color: "inherit", textDecoration: "none", transition: "color 0.2s" }}
      onMouseOver={(e) => (e.currentTarget.style.color = "#9999ad")}
      onMouseOut={(e) => (e.currentTarget.style.color = "#55556a")}
    >
      {children}
    </Link>
  );
}

// ── Typography helpers ────────────────────────────────────────────────────────

export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: "var(--font-jakarta-family, 'Plus Jakarta Sans', system-ui, sans-serif)",
        fontSize: "1.05rem",
        fontWeight: 700,
        color: "#f0f0f5",
        marginTop: 40,
        marginBottom: 14,
        paddingTop: 32,
        borderTop: "1px solid rgba(255,255,255,0.03)",
        letterSpacing: "-0.01em",
      }}
    >
      {children}
    </h2>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: "var(--font-jakarta-family, 'Plus Jakarta Sans', system-ui, sans-serif)",
        fontSize: "0.94rem",
        color: "#9999ad",
        lineHeight: 1.8,
        marginBottom: 16,
      }}
    >
      {children}
    </p>
  );
}

export function Ul({ items }: { items: string[] }) {
  return (
    <ul style={{ marginBottom: 16, listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          {/* Bullet */}
          <span
            style={{
              marginTop: 5,
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "rgba(0,229,191,0.08)",
              border: "1px solid rgba(0,229,191,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#00e5bf" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </span>
          <span
            style={{
              fontFamily: "var(--font-jakarta-family, 'Plus Jakarta Sans', system-ui, sans-serif)",
              fontSize: "0.92rem",
              color: "#9999ad",
              lineHeight: 1.7,
            }}
          >
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        margin: "20px 0",
        padding: "16px 20px",
        borderRadius: 12,
        background: "rgba(0,229,191,0.04)",
        border: "1px solid rgba(0,229,191,0.10)",
        fontFamily: "var(--font-jakarta-family, 'Plus Jakarta Sans', system-ui, sans-serif)",
        fontSize: "0.88rem",
        color: "#9999ad",
        lineHeight: 1.75,
      }}
    >
      {children}
    </div>
  );
}

export function WarnBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        margin: "20px 0",
        padding: "16px 20px",
        borderRadius: 12,
        background: "rgba(255,179,64,0.04)",
        border: "1px solid rgba(255,179,64,0.12)",
        fontFamily: "var(--font-jakarta-family, 'Plus Jakarta Sans', system-ui, sans-serif)",
        fontSize: "0.88rem",
        color: "#9999ad",
        lineHeight: 1.75,
      }}
    >
      {children}
    </div>
  );
}

// ── Cookie table ──────────────────────────────────────────────────────────────

interface CookieRow {
  name: string;
  type: string;
  purpose: string;
  duration: string;
}

export function CookieTable({ cookies }: { cookies: CookieRow[] }) {
  return (
    <div
      style={{
        margin: "20px 0",
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 90px 2fr 110px",
          background: "#0a0a0f",
        }}
      >
        {["Cookie", "Tipo", "Finalidad", "Duración"].map((h) => (
          <div
            key={h}
            style={{
              padding: "10px 16px",
              fontFamily: "var(--font-mono, 'Geist Mono', monospace)",
              fontSize: "0.68rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#55556a",
              fontWeight: 500,
            }}
          >
            {h}
          </div>
        ))}
      </div>

      {/* Data rows */}
      {cookies.map((c, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 90px 2fr 110px",
            borderTop: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              fontFamily: "var(--font-mono, 'Geist Mono', monospace)",
              fontSize: "0.78rem",
              color: "#f0f0f5",
            }}
          >
            {c.name}
          </div>
          <div style={{ padding: "12px 16px" }}>
            <span
              style={{
                fontFamily: "var(--font-mono, 'Geist Mono', monospace)",
                fontSize: "0.65rem",
                padding: "3px 8px",
                borderRadius: 4,
                background: "rgba(0,229,191,0.06)",
                color: "#00e5bf",
                border: "1px solid rgba(0,229,191,0.12)",
              }}
            >
              {c.type}
            </span>
          </div>
          <div style={{ padding: "12px 16px", fontSize: "0.82rem", color: "#9999ad", lineHeight: 1.6 }}>{c.purpose}</div>
          <div style={{ padding: "12px 16px", fontSize: "0.82rem", color: "#55556a" }}>{c.duration}</div>
        </div>
      ))}
    </div>
  );
}

// ── Accent link helper ────────────────────────────────────────────────────────

export function AL({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  const props = external ? { target: "_blank", rel: "noopener noreferrer" } : {};
  return (
    <a
      href={href}
      {...props}
      style={{ color: "#00e5bf", textDecoration: "none" }}
      onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
      onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
    >
      {children}
    </a>
  );
}

// ── Strong helper ─────────────────────────────────────────────────────────────

export function B({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: "#f0f0f5", fontWeight: 600 }}>{children}</strong>;
}
