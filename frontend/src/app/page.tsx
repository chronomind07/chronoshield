"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// ── Scroll reveal setup ───────────────────────────────────────────────────────
function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("revealed");
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

// ── Shield icon SVG ───────────────────────────────────────────────────────────
function ShieldIcon({ size = 18, color = "#000" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size }}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

// ── Navbar ────────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", fn, { passive: true });
    fn();
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <header
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "0 48px", height: 72,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: scrolled ? "rgba(5,5,7,0.88)" : "rgba(5,5,7,0.6)",
        backdropFilter: "blur(24px) saturate(1.4)",
        borderBottom: `1px solid ${scrolled ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)"}`,
        transition: "background 0.3s, border-color 0.3s",
      }}
    >
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", flexShrink: 0 }}>
        <div style={{ width: 34, height: 34, background: "linear-gradient(135deg,#00e5bf,#6366f1)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 20px rgba(0,229,191,0.12)", flexShrink: 0 }}>
          <ShieldIcon size={18} color="#000" />
        </div>
        <span style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.82rem", fontWeight: 600, letterSpacing: "0.08em", color: "#f0f0f5", textTransform: "uppercase" }}>
          ChronoShield
        </span>
      </Link>

      {/* Desktop links */}
      <nav style={{ display: "flex", alignItems: "center", gap: 36 }} className="hidden md:flex">
        {[["#features", "Features"], ["#how", "Cómo funciona"], ["#pricing", "Precios"], ["#extension", "Extensión"]].map(([href, label]) => (
          <a key={href} href={href} style={{ fontSize: "0.82rem", fontWeight: 500, color: "#9999ad", textDecoration: "none", letterSpacing: "0.01em", transition: "color 0.25s" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#f0f0f5")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#9999ad")}>{label}</a>
        ))}
      </nav>

      <div className="hidden md:flex" style={{ alignItems: "center", gap: 10 }}>
        <Link href="/login" style={{ padding: "8px 18px", borderRadius: 8, fontSize: "0.8rem", fontWeight: 600, color: "#f0f0f5", textDecoration: "none", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", transition: "all 0.25s" }}>
          Iniciar sesión
        </Link>
        <Link href="/register"
          className="btn-shimmer"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 22px", background: "#f0f0f5", color: "#050507", fontFamily: "var(--font-jakarta-family)", fontSize: "0.8rem", fontWeight: 700, borderRadius: 8, textDecoration: "none", letterSpacing: "-0.01em", transition: "all 0.3s cubic-bezier(0.16,1,0.3,1)" }}>
          Empezar gratis →
        </Link>
      </div>

      {/* Hamburger */}
      <button className="md:hidden" style={{ background: "none", border: "none", cursor: "pointer", padding: 8 }} onClick={() => setOpen(!open)}>
        <div style={{ width: 20, display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={{ height: 1, width: "100%", background: "#9999ad", display: "block", transition: "transform 0.2s", transform: open ? "rotate(45deg) translateY(6px)" : "" }} />
          <span style={{ height: 1, width: "100%", background: "#9999ad", display: "block", transition: "opacity 0.2s", opacity: open ? 0 : 1 }} />
          <span style={{ height: 1, width: "100%", background: "#9999ad", display: "block", transition: "transform 0.2s", transform: open ? "rotate(-45deg) translateY(-6px)" : "" }} />
        </div>
      </button>

      {open && (
        <div className="md:hidden" style={{ position: "absolute", top: 72, left: 0, right: 0, background: "rgba(5,5,7,0.97)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
          {[["#features", "Features"], ["#how", "Cómo funciona"], ["#pricing", "Precios"], ["#extension", "Extensión"]].map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} style={{ padding: "8px 0", fontSize: "0.95rem", color: "#9999ad", textDecoration: "none" }}>{label}</a>
          ))}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            <Link href="/login" onClick={() => setOpen(false)} style={{ textAlign: "center", padding: "11px", borderRadius: 8, fontSize: "0.88rem", fontWeight: 600, color: "#f0f0f5", textDecoration: "none", border: "1px solid rgba(255,255,255,0.1)" }}>Iniciar sesión</Link>
            <Link href="/register" onClick={() => setOpen(false)} style={{ textAlign: "center", padding: "11px", borderRadius: 8, fontSize: "0.88rem", fontWeight: 700, color: "#050507", textDecoration: "none", background: "#00e5bf" }}>Empezar gratis</Link>
          </div>
        </div>
      )}
    </header>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "140px 48px 100px", textAlign: "center", overflow: "hidden", background: "var(--bg-void)" }}>
      {/* Orb 1 */}
      <div style={{ position: "absolute", width: 900, height: 900, top: -300, left: "50%", background: "radial-gradient(circle, rgba(0,229,191,0.12) 0%, transparent 70%)", animation: "orbBreathe 8s ease-in-out infinite", pointerEvents: "none", zIndex: 0 }} />
      {/* Orb 2 */}
      <div style={{ position: "absolute", width: 600, height: 600, bottom: -200, right: -100, background: "radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%)", animation: "orbBreathe2 12s ease-in-out infinite", pointerEvents: "none", zIndex: 0 }} />
      {/* Grid */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, backgroundImage: "linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px)", backgroundSize: "80px 80px", WebkitMaskImage: "radial-gradient(ellipse 60% 50% at 50% 40%, black, transparent)" }} />
      {/* Scan line */}
      <div style={{ position: "absolute", left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,#00e5bf,transparent)", opacity: 0.15, animation: "scanMove 6s ease-in-out infinite", pointerEvents: "none", zIndex: 1 }} />

      <div style={{ position: "relative", zIndex: 2, maxWidth: 860 }}>
        <div className="hero-tag-anim" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px 6px 8px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", fontSize: "0.75rem", fontWeight: 500, color: "#9999ad", marginBottom: 36 }}>
          <span className="pulse-dot-cs" style={{ width: 7, height: 7, borderRadius: "50%", background: "#00e5bf", boxShadow: "0 0 8px rgba(0,229,191,0.4)", display: "inline-block", flexShrink: 0 }} />
          Monitoreo 24/7 activo
        </div>

        <h1 className="hero-title-anim" style={{ fontFamily: "var(--font-serif-family)", fontSize: "clamp(3rem,6.5vw,5.5rem)", fontWeight: 400, lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: 28, color: "#f0f0f5" }}>
          Ciberseguridad<br />
          <em style={{ fontStyle: "italic", background: "linear-gradient(135deg,#00e5bf,#00ffd5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>sin complicaciones</em>
        </h1>

        <p className="hero-sub-anim" style={{ fontSize: "1.15rem", lineHeight: 1.7, color: "#9999ad", maxWidth: 560, margin: "0 auto 44px", fontFamily: "var(--font-jakarta-family)" }}>
          Monitoreo automatizado de seguridad para tu empresa. Sin equipo técnico, sin auditorías manuales. Solo protección real, en tiempo real.
        </p>

        <div className="hero-actions-anim" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
          <Link href="/register"
            className="btn-shimmer"
            style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "14px 32px", background: "#00e5bf", color: "#000", fontFamily: "var(--font-jakarta-family)", fontSize: "0.9rem", fontWeight: 700, borderRadius: 10, textDecoration: "none", boxShadow: "0 0 32px rgba(0,229,191,0.2), inset 0 1px 0 rgba(255,255,255,0.2)", transition: "all 0.3s cubic-bezier(0.16,1,0.3,1)" }}>
            Protege tu empresa
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </Link>
          <a href="#how" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px", background: "transparent", color: "#f0f0f5", fontFamily: "var(--font-jakarta-family)", fontSize: "0.9rem", fontWeight: 600, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, textDecoration: "none", transition: "all 0.3s" }}>
            Ver cómo funciona
          </a>
        </div>
      </div>
    </section>
  );
}

// ── Stats Bar ─────────────────────────────────────────────────────────────────
function StatsBar() {
  const stats = [
    { num: "24/7",   label: "Monitoreo continuo" },
    { num: "<5min",  label: "Tiempo de alerta" },
    { num: "100%",   label: "Automatizado" },
    { num: "0",      label: "Conocimiento técnico necesario" },
  ];
  return (
    <div style={{ padding: "48px", borderTop: "1px solid rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.03)", background: "#0a0a0f", display: "flex", justifyContent: "center", gap: 80, flexWrap: "wrap" }}>
      {stats.map((s, i) => (
        <div key={s.label} className={`reveal${i ? ` reveal-d${i}` : ""}`} style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-mono-family)", fontSize: "2rem", fontWeight: 600, color: "#00e5bf", letterSpacing: "-0.03em" }}>{s.num}</div>
          <div style={{ fontSize: "0.78rem", color: "#55556a", marginTop: 6, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500 }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Features ──────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 20, height: 20, color: "#00e5bf" }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    name: "Certificados SSL",
    desc: "Monitoreo de estado, expiración y configuración de tus certificados SSL. Alertas antes de que caduquen.",
    delay: "",
  },
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 20, height: 20, color: "#00e5bf" }}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    name: "Uptime 24/7",
    desc: "Verificación de disponibilidad cada 5 minutos. Si tu web cae, lo sabrás antes que tus clientes.",
    delay: "reveal-d1",
  },
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 20, height: 20, color: "#00e5bf" }}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
    name: "Seguridad de Email",
    desc: "Verificación de SPF, DKIM y DMARC. Evita que suplanten tu identidad por email.",
    delay: "reveal-d2",
  },
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 20, height: 20, color: "#00e5bf" }}><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>,
    name: "Dark Web Monitoring",
    desc: "Escaneo continuo de la dark web buscando filtraciones de tus emails y dominios corporativos.",
    delay: "reveal-d1",
  },
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 20, height: 20, color: "#00e5bf" }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    name: "Security Score",
    desc: "Puntuación unificada de tu seguridad digital. De la A a la F, siempre sabrás dónde estás.",
    delay: "reveal-d2",
  },
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 20, height: 20, color: "#00e5bf" }}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
    name: "Extensión Gmail",
    desc: "Detección de phishing en tiempo real directamente en tu bandeja de Gmail. Sin salir del email.",
    delay: "reveal-d3",
  },
];

function Features() {
  return (
    <section id="features" style={{ padding: "120px 48px", background: "var(--bg-void)" }}>
      <div className="reveal" style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 72px" }}>
        <div style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.2em", color: "#00e5bf", marginBottom: 16, fontWeight: 500 }}>Protección completa</div>
        <h2 style={{ fontFamily: "var(--font-serif-family)", fontSize: "clamp(2rem,4vw,3.2rem)", fontWeight: 400, lineHeight: 1.15, letterSpacing: "-0.025em", marginBottom: 20 }}>Todo lo que necesitas, nada que no</h2>
        <p style={{ fontSize: "1.05rem", color: "#9999ad", lineHeight: 1.7 }}>Cada capa de tu presencia digital monitorizada automáticamente</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, maxWidth: 1200, margin: "0 auto", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.03)", borderRadius: 20, overflow: "hidden" }} className="cs-features-grid">
        {FEATURES.map((f) => (
          <div key={f.name} className={`reveal feature-card-cs${f.delay ? ` ${f.delay}` : ""}`} style={{ background: "#0f0f16", padding: "44px 36px", cursor: "default" }}>
            <div style={{ width: 44, height: 44, borderRadius: 11, background: "rgba(0,229,191,0.08)", border: "1px solid rgba(0,229,191,0.08)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, transition: "box-shadow 0.4s" }}>
              {f.icon}
            </div>
            <div style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: 10, letterSpacing: "-0.01em", color: "#f0f0f5" }}>{f.name}</div>
            <div style={{ fontSize: "0.85rem", color: "#9999ad", lineHeight: 1.65 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      <style>{`
        @media (max-width: 1024px) { .cs-features-grid { grid-template-columns: repeat(2,1fr) !important; } }
        @media (max-width: 640px)  { .cs-features-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </section>
  );
}

// ── Terminal ──────────────────────────────────────────────────────────────────
function Terminal() {
  const ref = useRef<HTMLDivElement>(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setAnimated(true); obs.disconnect(); }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ background: "#0f0f16", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.4)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 18px", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57", display: "inline-block" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e", display: "inline-block" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840", display: "inline-block" }} />
        <span style={{ flex: 1, textAlign: "center", fontFamily: "var(--font-mono-family)", fontSize: "0.7rem", color: "#55556a" }}>chronoshield — scan</span>
      </div>
      <div className={animated ? "terminal-animate" : ""} style={{ padding: 24, fontFamily: "var(--font-mono-family)", fontSize: "0.8rem", lineHeight: 2, color: "#9999ad" }}>
        <div className="terminal-line"><span style={{ color: "#55556a" }}>$</span> <span style={{ color: "#f0f0f5" }}>chronoshield scan</span> <span style={{ color: "#55556a" }}>inmobiliaria-costa.es</span></div>
        <div className="terminal-line"><span style={{ color: "#00e5bf" }}>✓</span> SSL válido — expira en 247 días</div>
        <div className="terminal-line"><span style={{ color: "#00e5bf" }}>✓</span> SPF configurado correctamente</div>
        <div className="terminal-line"><span style={{ color: "#ffb020" }}>⚠</span> <span style={{ color: "#ffb020" }}>DKIM no detectado</span></div>
        <div className="terminal-line"><span style={{ color: "#ff4d6a" }}>✗</span> <span style={{ color: "#ff4d6a" }}>2 emails encontrados en dark web</span></div>
        <div className="terminal-line"><span style={{ color: "#55556a" }}>→</span> <span style={{ color: "#f0f0f5" }}>Security Score:</span> <span style={{ color: "#ffb020" }}>72/100 — Grado C</span></div>
      </div>
    </div>
  );
}

// ── How It Works ──────────────────────────────────────────────────────────────
function HowItWorks() {
  return (
    <section id="how" style={{ padding: "120px 48px", background: "#0a0a0f" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, maxWidth: 1100, margin: "0 auto", alignItems: "center" }} className="cs-how-grid">
        <div>
          <div className="reveal" style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.2em", color: "#00e5bf", marginBottom: 16, fontWeight: 500 }}>Proceso</div>
          <h2 className="reveal reveal-d1" style={{ fontFamily: "var(--font-serif-family)", fontSize: "clamp(2rem,4vw,3.2rem)", fontWeight: 400, lineHeight: 1.15, letterSpacing: "-0.025em", marginBottom: 48 }}>Tres pasos.<br />Sin complicaciones.</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { n: "01", title: "Registra tu dominio", desc: "Añade tu dominio y emails corporativos. Sin instalaciones, sin configuración técnica.", d: "reveal-d2" },
              { n: "02", title: "Monitoreo automático", desc: "ChronoShield escanea tu seguridad 24/7. SSL, emails, dark web, uptime — todo cubierto.", d: "reveal-d3" },
              { n: "03", title: "Alertas inteligentes", desc: "Recibe alertas claras con guías de solución. Sin jerga técnica, solo acciones concretas.", d: "reveal-d4" },
            ].map((s) => (
              <div key={s.n} className={`reveal ${s.d}`} style={{ display: "flex", gap: 20, padding: 24, borderRadius: 14, border: "1px solid transparent", transition: "all 0.4s", cursor: "default" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = ""; e.currentTarget.style.borderColor = "transparent"; }}>
                <div style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.7rem", color: "#00e5bf", fontWeight: 600, flexShrink: 0, width: 28, height: 28, border: "1px solid rgba(0,229,191,0.15)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>{s.n}</div>
                <div>
                  <div style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 6, letterSpacing: "-0.01em", color: "#f0f0f5" }}>{s.title}</div>
                  <div style={{ fontSize: "0.85rem", color: "#9999ad", lineHeight: 1.6 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="reveal reveal-d2"><Terminal /></div>
      </div>

      <style>{`
        @media (max-width: 900px) { .cs-how-grid { grid-template-columns: 1fr !important; gap: 48px !important; } }
      `}</style>
    </section>
  );
}

// ── Pricing ───────────────────────────────────────────────────────────────────
function Pricing() {
  return (
    <section id="pricing" style={{ padding: "120px 48px", background: "var(--bg-void)" }}>
      <div className="reveal" style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 64px" }}>
        <div style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.2em", color: "#00e5bf", marginBottom: 16, fontWeight: 500 }}>Planes</div>
        <h2 style={{ fontFamily: "var(--font-serif-family)", fontSize: "clamp(2rem,4vw,3.2rem)", fontWeight: 400, lineHeight: 1.15, letterSpacing: "-0.025em", marginBottom: 16 }}>Protección que cabe en tu presupuesto</h2>
        <p style={{ fontSize: "1.05rem", color: "#9999ad", lineHeight: 1.7 }}>Sin compromisos. Cancela cuando quieras.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 24, maxWidth: 840, margin: "0 auto" }} className="cs-pricing-grid">
        {/* Starter */}
        <div className="reveal" style={{ background: "#0f0f16", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "44px 36px", position: "relative", transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 20px 60px rgba(0,0,0,0.3)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
          <div style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#55556a", marginBottom: 16 }}>Starter</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
            <span style={{ fontSize: "1.2rem", fontWeight: 600, color: "#9999ad" }}>€</span>
            <span style={{ fontFamily: "var(--font-serif-family)", fontSize: "3.5rem", fontWeight: 400, letterSpacing: "-0.04em", lineHeight: 1, color: "#f0f0f5" }}>29</span>
            <span style={{ fontSize: "0.85rem", color: "#55556a" }}>/mes</span>
          </div>
          <p style={{ fontSize: "0.85rem", color: "#9999ad", marginBottom: 32, lineHeight: 1.5 }}>Para pequeñas empresas con un dominio principal.</p>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 14, marginBottom: 36, padding: 0 }}>
            {["1 dominio monitorizado", "10 emails protegidos", "5 créditos/mes", "Extensión Gmail incluida", "Alertas por email"].map((f) => (
              <li key={f} style={{ fontSize: "0.85rem", color: "#9999ad", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: "#00e5bf", fontWeight: 700, fontSize: "0.8rem" }}>✓</span>{f}
              </li>
            ))}
          </ul>
          <Link href="/register" style={{ display: "block", width: "100%", padding: 14, borderRadius: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#f0f0f5", fontFamily: "var(--font-jakarta-family)", fontSize: "0.88rem", fontWeight: 700, textAlign: "center", textDecoration: "none", transition: "all 0.3s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "#9999ad"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}>
            Empezar con Starter
          </Link>
        </div>

        {/* Business (featured) */}
        <div className="reveal reveal-d1 price-featured-badge" style={{ background: "linear-gradient(180deg,rgba(0,229,191,0.03) 0%,#0f0f16 40%)", border: "1px solid #00e5bf", borderRadius: 20, padding: "44px 36px", position: "relative", transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)" }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 20px 60px rgba(0,0,0,0.3)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
          <div style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#55556a", marginBottom: 16 }}>Business</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
            <span style={{ fontSize: "1.2rem", fontWeight: 600, color: "#9999ad" }}>€</span>
            <span style={{ fontFamily: "var(--font-serif-family)", fontSize: "3.5rem", fontWeight: 400, letterSpacing: "-0.04em", lineHeight: 1, color: "#f0f0f5" }}>59</span>
            <span style={{ fontSize: "0.85rem", color: "#55556a" }}>/mes</span>
          </div>
          <p style={{ fontSize: "0.85rem", color: "#9999ad", marginBottom: 32, lineHeight: 1.5 }}>Para empresas que necesitan cobertura completa.</p>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 14, marginBottom: 36, padding: 0 }}>
            {["3 dominios monitorizados", "30 emails protegidos", "20 créditos/mes", "Company Impersonation Detection", "Extensión Gmail incluida", "Soporte prioritario"].map((f) => (
              <li key={f} style={{ fontSize: "0.85rem", color: "#9999ad", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: "#00e5bf", fontWeight: 700, fontSize: "0.8rem" }}>✓</span>{f}
              </li>
            ))}
          </ul>
          <Link href="/register"
            className="btn-shimmer"
            style={{ display: "block", width: "100%", padding: 14, borderRadius: 10, background: "#00e5bf", border: "none", color: "#000", fontFamily: "var(--font-jakarta-family)", fontSize: "0.88rem", fontWeight: 700, textAlign: "center", textDecoration: "none", boxShadow: "0 0 24px rgba(0,229,191,0.15)", transition: "all 0.3s" }}>
            Empezar con Business
          </Link>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) { .cs-pricing-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </section>
  );
}

// ── Extension Promo ───────────────────────────────────────────────────────────
function ExtensionPromo() {
  return (
    <section id="extension" style={{ padding: "120px 48px", background: "#0a0a0f", borderTop: "1px solid rgba(255,255,255,0.03)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, maxWidth: 1100, margin: "0 auto", alignItems: "center" }} className="cs-promo-grid">
        <div>
          <div className="reveal" style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.2em", color: "#00e5bf", marginBottom: 16, fontWeight: 500 }}>Extensión Chrome</div>
          <h2 className="reveal reveal-d1" style={{ fontFamily: "var(--font-serif-family)", fontSize: "clamp(2rem,4vw,3.2rem)", fontWeight: 400, lineHeight: 1.15, letterSpacing: "-0.025em", marginBottom: 20 }}>Phishing detection<br />directo en Gmail</h2>
          <p className="reveal reveal-d2" style={{ fontSize: "1.05rem", color: "#9999ad", lineHeight: 1.7, marginBottom: 32 }}>
            Analiza cada email que recibes en tiempo real. Detecta dominios sospechosos, enlaces maliciosos y suplantación de identidad sin salir de tu bandeja.
          </p>
          <div className="reveal reveal-d3">
            <a href="#" className="btn-shimmer" style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "14px 32px", background: "#00e5bf", color: "#000", fontFamily: "var(--font-jakarta-family)", fontSize: "0.9rem", fontWeight: 700, borderRadius: 10, textDecoration: "none", boxShadow: "0 0 32px rgba(0,229,191,0.15)", transition: "all 0.3s" }}>
              Instalar extensión
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          </div>
        </div>

        {/* Email mockup */}
        <div className="reveal reveal-d2" style={{ display: "flex", flexDirection: "column", gap: 20, alignItems: "center" }}>
          <div style={{ background: "#0f0f16", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "28px 32px", width: "100%", maxWidth: 420 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#1a1a2e,#16213e)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, color: "#9999ad", flexShrink: 0 }}>SB</div>
              <div>
                <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#f0f0f5" }}>Soporte Bancario</div>
                <div style={{ fontSize: "0.75rem", color: "#55556a" }}>soporte@baanco-seguridad.tk</div>
              </div>
            </div>
            <div style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", color: "#f0f0f5" }}>
              Verifica tu cuenta urgente
              <span className="mock-badge-pulse" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: "0.72rem", fontWeight: 700, background: "rgba(255,77,106,0.12)", border: "1px solid rgba(255,77,106,0.2)", color: "#ff4d6a" }}>
                🔴 Peligroso
              </span>
            </div>
            <div style={{ fontSize: "0.82rem", color: "#9999ad", lineHeight: 1.6 }}>
              Estimado cliente, hemos detectado actividad sospechosa en su cuenta. Por favor verifique su identidad haciendo click en{" "}
              <span style={{ color: "#5b8def", textDecoration: "underline" }}>http://baanco-seguridad.tk/verify</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) { .cs-promo-grid { grid-template-columns: 1fr !important; gap: 48px !important; text-align: center; } }
      `}</style>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ padding: "64px 48px", borderTop: "1px solid rgba(255,255,255,0.03)", background: "var(--bg-void)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 28, height: 28, background: "linear-gradient(135deg,#00e5bf,#6366f1)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ShieldIcon size={14} color="#000" />
          </div>
          <span style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.78rem", color: "#55556a", letterSpacing: "0.06em", textTransform: "uppercase" }}>ChronoShield</span>
        </div>

        <div style={{ fontSize: "0.78rem", color: "#55556a" }}>
          © 2026 ChronoShield. Todos los derechos reservados.
        </div>

        <div style={{ display: "flex", gap: 28 }}>
          {[["Privacidad", "/privacidad"], ["Términos", "/terminos"], ["Contacto", "#contacto"]].map(([label, href]) => (
            <Link key={label} href={href} style={{ fontSize: "0.8rem", color: "#55556a", textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#9999ad")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#55556a")}>
              {label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function LandingPage() {
  useScrollReveal();

  return (
    <div className="noise-overlay" style={{ minHeight: "100vh", background: "var(--bg-void)", color: "var(--text-bright)" }}>
      <Navbar />
      <main>
        <Hero />
        <StatsBar />
        <Features />
        <HowItWorks />
        <Pricing />
        <ExtensionPromo />
      </main>
      <Footer />
    </div>
  );
}
