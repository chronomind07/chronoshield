"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

/* ─────────────────────────────────────────────────────────────────────────────
   SHARED HELPERS
───────────────────────────────────────────────────────────────────────────── */
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function ShieldLogo({ size = 36 }: { size?: number }) {
  return (
    <div
      className="rounded-xl flex items-center justify-center shrink-0"
      style={{ width: size, height: size, background: "linear-gradient(135deg,#0077FF,#00C2FF)" }}
    >
      <svg width={Math.round(size * 0.5)} height={Math.round(size * 0.5)} viewBox="0 0 24 24" fill="none">
        <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7L12 2z"
          fill="white" fillOpacity="0.92" />
        <path d="M9 12l2 2 4-4" stroke="rgba(0,220,255,0.9)" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4"
      style={{ background: "rgba(0,194,255,0.05)", border: "1px solid rgba(0,194,255,0.15)" }}>
      <span className="font-mono text-[10px] tracking-[2px] text-[#00C2FF] uppercase">{children}</span>
    </div>
  );
}

function Divider() {
  return (
    <div className="w-full h-px"
      style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)" }} />
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   NAVBAR
───────────────────────────────────────────────────────────────────────────── */
function Navbar() {
  const [open, setOpen]         = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", fn, { passive: true });
    fn();
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const links = [
    { label: "Inicio",          href: "#inicio" },
    { label: "Funcionalidades", href: "#funcionalidades" },
    { label: "Precios",         href: "#precios" },
    { label: "Contacto",        href: "#contacto" },
  ];

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
      style={{
        background:     scrolled ? "rgba(8,12,16,0.97)" : "rgba(8,12,16,0.55)",
        backdropFilter: "blur(20px)",
        borderBottom:   `1px solid ${scrolled ? "rgba(255,255,255,0.07)" : "transparent"}`,
      }}
    >
      <div className="max-w-[1200px] mx-auto px-6 h-[72px] flex items-center gap-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 mr-auto">
          <ShieldLogo size={36} />
          <span className="font-syne font-bold text-[15px] text-[#E8EDF2] tracking-wide hidden sm:block">
            ChronoShield
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-7">
          {links.map((l) => (
            <a key={l.href} href={l.href}
              className="text-[13.5px] font-medium text-[#9AACBA] hover:text-[#E8EDF2] transition-colors">
              {l.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-2.5 ml-auto">
          <Link href="/login"
            className="px-4 py-2 rounded-xl text-[13px] font-semibold text-[#9AACBA] hover:text-[#E8EDF2] transition-all"
            style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)" }}>
            Iniciar sesión
          </Link>
          <Link href="/register"
            className="px-4 py-2 rounded-xl text-[13px] font-bold text-white transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#0077FF,#0099DD)", boxShadow: "0 0 24px rgba(0,119,255,0.28)" }}>
            Empezar gratis
          </Link>
        </div>

        {/* Hamburger */}
        <button className="md:hidden p-2 ml-auto" onClick={() => setOpen(!open)} aria-label="Menú">
          <div className="w-5 flex flex-col gap-[5px]">
            <span className="h-px w-full bg-[#9AACBA] block transition-all origin-center"
              style={{ transform: open ? "rotate(45deg) translateY(6px)" : "" }} />
            <span className="h-px w-full bg-[#9AACBA] block transition-all"
              style={{ opacity: open ? 0 : 1 }} />
            <span className="h-px w-full bg-[#9AACBA] block transition-all origin-center"
              style={{ transform: open ? "rotate(-45deg) translateY(-6px)" : "" }} />
          </div>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden px-6 pb-6 flex flex-col gap-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(8,12,16,0.97)" }}>
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}
              className="py-2 text-[15px] text-[#9AACBA] hover:text-[#E8EDF2] transition-colors">
              {l.label}
            </a>
          ))}
          <div className="flex flex-col gap-2 mt-2 pt-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <Link href="/login"
              className="text-center py-3 rounded-xl text-[14px] font-semibold text-[#9AACBA] border"
              style={{ borderColor: "rgba(255,255,255,0.12)" }}>
              Iniciar sesión
            </Link>
            <Link href="/register"
              className="text-center py-3 rounded-xl text-[14px] font-bold text-white"
              style={{ background: "linear-gradient(135deg,#0077FF,#0099DD)" }}>
              Empezar gratis
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   PRODUCT MOCKUP
───────────────────────────────────────────────────────────────────────────── */
function ProductMockup() {
  const bars = [
    { label: "SSL",      v: 100 },
    { label: "Uptime",   v: 98  },
    { label: "Email",    v: 86  },
    { label: "Dark Web", v: 92  },
  ];

  return (
    <div className="relative">
      <div className="absolute inset-[-25%] pointer-events-none"
        style={{ background: "radial-gradient(ellipse,rgba(0,119,255,0.15) 0%,transparent 70%)", filter: "blur(32px)" }} />

      <div className="relative rounded-2xl"
        style={{ background: "#0D1218", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 40px 80px rgba(0,0,0,0.55)" }}>

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <div className="font-mono text-[9px] tracking-[2px] text-[#5A6B7A] uppercase mb-1">Security Score</div>
            <div className="flex items-baseline gap-2">
              <span className="font-syne font-bold text-[40px] leading-none"
                style={{ background: "linear-gradient(90deg,#0077FF,#00C2FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                A+
              </span>
              <span className="font-mono text-[16px] text-[#9AACBA]">94/100</span>
            </div>
          </div>
          <div className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ border: "2px solid rgba(0,194,255,0.2)", background: "rgba(0,194,255,0.05)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7L12 2z"
                fill="rgba(0,194,255,0.12)" stroke="#00C2FF" strokeWidth="1.2" />
              <path d="M9 12l2 2 4-4" stroke="#00C2FF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Bars */}
        <div className="p-5 space-y-3">
          {bars.map((b) => (
            <div key={b.label} className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-[#5A6B7A] w-[60px] shrink-0">{b.label}</span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#121A22" }}>
                <div className="h-full rounded-full"
                  style={{ width: `${b.v}%`, background: "linear-gradient(90deg,#0055CC,#00C2FF)" }} />
              </div>
              <span className="font-mono text-[11px] text-[#9AACBA] w-6 text-right shrink-0">{b.v}</span>
            </div>
          ))}
        </div>

        {/* Status */}
        <div className="mx-5 mb-4 px-3.5 py-2.5 rounded-xl"
          style={{ background: "rgba(0,194,255,0.03)", border: "1px solid rgba(0,194,255,0.1)" }}>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot shrink-0" />
            <span className="text-[11px] text-[#5A6B7A]">Sin amenazas · Última revisión hace 2 min</span>
          </div>
        </div>

        {/* Domains */}
        <div className="px-5 pb-5">
          <div className="font-mono text-[9px] tracking-[2px] text-[#5A6B7A] uppercase mb-2">Dominios protegidos</div>
          {["miempresa.com", "clientes.miempresa.com"].map((d) => (
            <div key={d} className="flex items-center justify-between py-2"
              style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              <span className="font-mono text-[12px] text-[#9AACBA]">{d}</span>
              <span className="font-mono text-[9px] px-2 py-0.5 rounded-full"
                style={{ background: "rgba(16,185,129,0.08)", color: "#10B981", border: "1px solid rgba(16,185,129,0.2)" }}>
                SEGURO
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Floating — top right */}
      <div className="absolute -top-4 -right-3 px-3 py-2 rounded-xl hidden sm:block"
        style={{ background: "#0D1218", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "rgba(0,194,255,0.1)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="#00C2FF" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M13.73 21a2 2 0 01-3.46 0" stroke="#00C2FF" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-[#E8EDF2]">SSL renovado</div>
            <div className="text-[9px] text-[#5A6B7A]">hace 3 horas</div>
          </div>
        </div>
      </div>

      {/* Floating — bottom left */}
      <div className="absolute -bottom-3 -left-5 px-3 py-2 rounded-xl hidden sm:block"
        style={{ background: "#0D1218", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "rgba(16,185,129,0.1)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-[#E8EDF2]">SPF · DKIM · DMARC</div>
            <div className="text-[9px] text-[#5A6B7A]">Todo configurado ✓</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   HERO
───────────────────────────────────────────────────────────────────────────── */
function HeroSection() {
  return (
    <section id="inicio" className="relative min-h-screen flex items-center pt-[72px] overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-18%] left-1/2 -translate-x-1/2 w-[1000px] h-[650px]"
          style={{ background: "radial-gradient(ellipse,rgba(0,119,255,0.12) 0%,transparent 70%)" }} />
        <div className="absolute bottom-[5%] right-[-5%] w-[500px] h-[500px]"
          style={{ background: "radial-gradient(ellipse,rgba(0,194,255,0.04) 0%,transparent 70%)" }} />
        <div className="absolute inset-0 opacity-[0.016]"
          style={{ backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "44px 44px" }} />
      </div>

      <div className="relative max-w-[1200px] mx-auto px-6 py-24 w-full">
        <div className="grid lg:grid-cols-[1fr_460px] gap-16 xl:gap-20 items-center">
          {/* Left */}
          <div>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-8"
              style={{ background: "rgba(0,194,255,0.05)", border: "1px solid rgba(0,194,255,0.18)" }}>
              <span className="w-2 h-2 rounded-full bg-[#00C2FF] pulse-dot shrink-0" />
              <span className="font-mono text-[10px] tracking-[2.5px] text-[#00C2FF] uppercase">
                Monitoreo Activo · 24/7
              </span>
            </div>

            {/* H1 */}
            <h1 className="font-syne font-bold text-[44px] lg:text-[60px] xl:text-[68px] leading-[1.06] text-[#E8EDF2] mb-6">
              Tu empresa es más{" "}
              <span style={{ background: "linear-gradient(90deg,#0077FF,#00C2FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                vulnerable
              </span>
              {" "}de lo que crees
            </h1>

            {/* Subtitle */}
            <p className="text-[17px] lg:text-[18px] text-[#9AACBA] leading-[1.72] mb-9 max-w-[530px]">
              ChronoShield monitoriza la seguridad digital de tu negocio 24/7.
              Detectamos filtraciones, vulnerabilidades y amenazas{" "}
              <span className="text-[#E8EDF2] font-medium">antes de que sea demasiado tarde</span>.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 mb-10">
              <Link href="/register"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-[15px] font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg,#0077FF,#00A8E8)", boxShadow: "0 8px 36px rgba(0,119,255,0.32)" }}>
                Analiza tu empresa ahora
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M2 7.5h11M8 3l4.5 4.5L8 12" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <a href="#funcionalidades"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-[15px] font-semibold text-[#9AACBA] hover:text-[#E8EDF2] transition-all"
                style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)" }}>
                Ver cómo funciona
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M7.5 2v11M3 8.5l4.5 4.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>

            {/* Trust pills */}
            <div className="flex flex-wrap gap-5">
              {["Sin permanencia", "Setup en 5 minutos", "Cumple el RGPD"].map((t) => (
                <div key={t} className="flex items-center gap-1.5 text-[12.5px] text-[#5A6B7A]">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <circle cx="6.5" cy="6.5" r="5.5" stroke="rgba(0,194,255,0.3)" strokeWidth="1" />
                    <path d="M4.5 6.5l1.5 1.5 2.5-2.5" stroke="#00C2FF" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {t}
                </div>
              ))}
            </div>
          </div>

          {/* Right: mockup */}
          <div className="hidden lg:block">
            <ProductMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   STATS
───────────────────────────────────────────────────────────────────────────── */
function StatsSection() {
  const stats = [
    { n: "1.400 M",  label: "ciberataques anuales a empresas en todo el mundo" },
    { n: "60%",      label: "de PYMEs han sufrido una filtración sin saberlo" },
    { n: "80%",      label: "de los ataques van dirigidos a empresas sin equipo de IT" },
  ];

  return (
    <section>
      <Divider />
      <div className="max-w-[1200px] mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-px rounded-2xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.04)" }}>
          {stats.map((s, i) => (
            <div key={i} className="flex flex-col items-center text-center px-8 py-10"
              style={{ background: "#080C10" }}>
              <div className="font-syne font-bold text-[48px] lg:text-[54px] leading-none mb-3"
                style={{ background: "linear-gradient(135deg,#0077FF,#00C2FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {s.n}
              </div>
              <p className="text-[14px] text-[#5A6B7A] leading-[1.6] max-w-[220px]">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
      <Divider />
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   PARA QUIÉN ES
───────────────────────────────────────────────────────────────────────────── */
function ForWhoSection() {
  const sectors = [
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#00C2FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 22V12h6v10" stroke="#00C2FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      sector: "Inmobiliarias",
      desc: "Manejas datos de clientes, contratos y transferencias bancarias. Un solo email comprometido puede costarte una operación entera.",
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7L12 2z" stroke="#00C2FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="8" x2="12" y2="13" stroke="#00C2FF" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="12" cy="16" r="0.5" fill="#00C2FF" stroke="#00C2FF" strokeWidth="1" />
        </svg>
      ),
      sector: "Clínicas y dentistas",
      desc: "Los datos médicos de tus pacientes son los más valiosos para los hackers. Protégelos antes de que se conviertan en un problema legal.",
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="7" width="20" height="14" rx="2" stroke="#00C2FF" strokeWidth="1.5" />
          <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" stroke="#00C2FF" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M12 12v3M10.5 13.5h3" stroke="#00C2FF" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
      sector: "Asesorías y gestorías",
      desc: "Manejas datos fiscales y bancarios de tus clientes. Una filtración puede destruir años de confianza en un solo día.",
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#00C2FF" strokeWidth="1.5" />
          <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"
            stroke="#00C2FF" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
      sector: "Cualquier PYME",
      desc: "Si tienes un dominio y emails corporativos, eres un objetivo. Los atacantes no discriminan por tamaño, discriminan por vulnerabilidad.",
    },
  ];

  return (
    <section className="py-24">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="text-center mb-14">
          <SectionLabel>Para quién es</SectionLabel>
          <h2 className="font-syne font-bold text-[36px] lg:text-[44px] text-[#E8EDF2] leading-[1.15]">
            Diseñado para empresas que manejan{" "}
            <span style={{ background: "linear-gradient(90deg,#0077FF,#00C2FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              datos sensibles
            </span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {sectors.map((s) => (
            <div key={s.sector}
              className="p-6 rounded-2xl transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: "#0D1218", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: "rgba(0,194,255,0.07)", border: "1px solid rgba(0,194,255,0.12)" }}>
                {s.icon}
              </div>
              <h3 className="font-syne font-bold text-[17px] text-[#E8EDF2] mb-2">{s.sector}</h3>
              <p className="text-[14px] text-[#5A6B7A] leading-[1.65]">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   CÓMO FUNCIONA
───────────────────────────────────────────────────────────────────────────── */
function HowItWorksSection() {
  const steps = [
    {
      n: "01",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" stroke="#00C2FF" strokeWidth="1.5" />
          <path d="M20 21a8 8 0 10-16 0" stroke="#00C2FF" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M17 16l2 2 3-3" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      title: "Registra tu empresa",
      desc: "Crea tu cuenta, añade tu dominio y los emails corporativos que quieres proteger. Tarda menos de 5 minutos.",
    },
    {
      n: "02",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" stroke="#00C2FF" strokeWidth="1.5" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="#00C2FF" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M5.64 5.64l2.12 2.12M16.24 16.24l2.12 2.12M5.64 18.36l2.12-2.12M16.24 7.76l2.12-2.12"
            stroke="#00C2FF" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      ),
      title: "Escaneamos cada día",
      desc: "ChronoShield monitoriza automáticamente tu empresa: dark web, SSL, disponibilidad del servidor y seguridad del email.",
    },
    {
      n: "03",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="#00C2FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.73 21a2 2 0 01-3.46 0" stroke="#00C2FF" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="18" cy="5" r="3" fill="#10B981" />
        </svg>
      ),
      title: "Alertas con soluciones",
      desc: "Cuando detectamos un problema, te avisamos inmediatamente con instrucciones concretas para solucionarlo. Sin tecnicismos.",
    },
  ];

  return (
    <section style={{ background: "rgba(13,18,24,0.5)" }}>
      <Divider />
      <div className="max-w-[1200px] mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <SectionLabel>Cómo funciona</SectionLabel>
          <h2 className="font-syne font-bold text-[36px] lg:text-[44px] text-[#E8EDF2] leading-[1.15]">
            Configurado en minutos,{" "}
            <span style={{ background: "linear-gradient(90deg,#0077FF,#00C2FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              protección para siempre
            </span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {steps.map((s, i) => (
            <div key={s.n} className="relative">
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-7 left-[calc(50%+48px)] right-[-calc(50%-48px)] h-px"
                  style={{ background: "linear-gradient(90deg,rgba(0,194,255,0.25),transparent)" }} />
              )}
              <div className="p-6 rounded-2xl h-full"
                style={{ background: "#0D1218", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(0,194,255,0.07)", border: "1px solid rgba(0,194,255,0.12)" }}>
                    {s.icon}
                  </div>
                  <span className="font-mono text-[11px] tracking-[2px] text-[#5A6B7A]">Paso {s.n}</span>
                </div>
                <h3 className="font-syne font-bold text-[18px] text-[#E8EDF2] mb-2">{s.title}</h3>
                <p className="text-[14px] text-[#5A6B7A] leading-[1.65]">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Divider />
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   FUNCIONALIDADES
───────────────────────────────────────────────────────────────────────────── */
function FeaturesSection() {
  const features = [
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" stroke="#00C2FF" strokeWidth="1.5" />
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" stroke="#00C2FF" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="3" y1="3" x2="21" y2="21" stroke="#E87070" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
      title: "Detección en Dark Web",
      desc: "Buscamos tus emails y dominio en bases de datos de filtraciones y foros de hackers. Te avisamos si encontramos algo.",
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="11" width="18" height="11" rx="2" stroke="#00C2FF" strokeWidth="1.5" />
          <path d="M7 11V7a5 5 0 0110 0v4" stroke="#00C2FF" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="12" cy="16" r="1" fill="#00C2FF" />
        </svg>
      ),
      title: "SSL y Uptime",
      desc: "Monitorizamos el certificado SSL de tu web (expiración, validez) y comprobamos que esté online cada 5 minutos.",
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="4" width="20" height="16" rx="2" stroke="#00C2FF" strokeWidth="1.5" />
          <path d="M2 8l10 6 10-6" stroke="#00C2FF" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
      title: "Seguridad del email",
      desc: "Verificamos que tu dominio tenga SPF, DKIM y DMARC correctamente configurados para evitar suplantaciones de identidad.",
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7L12 2z" stroke="#00C2FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 12l2.5 2.5L16 9" stroke="#00C2FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      title: "Security Score",
      desc: "Un número del 0 al 100 y una nota de A+ a F que resume el estado de seguridad de tu empresa. Comprensible para cualquiera.",
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="#00C2FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.73 21a2 2 0 01-3.46 0" stroke="#00C2FF" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
      title: "Alertas automáticas",
      desc: "Te enviamos un email inmediatamente cuando detectamos una amenaza, con pasos concretos para solucionarlo sin tecnicismos.",
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="8" stroke="#00C2FF" strokeWidth="1.5" />
          <path d="M21 21l-4.35-4.35" stroke="#00C2FF" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M11 8v3l2 2" stroke="#00C2FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      title: "Escaneos bajo demanda",
      desc: "Lanza escaneos manuales cuando quieras usando créditos. Ideal antes de cerrar una operación importante o reunión clave.",
    },
  ];

  return (
    <section id="funcionalidades" className="py-24">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="text-center mb-14">
          <SectionLabel>Funcionalidades</SectionLabel>
          <h2 className="font-syne font-bold text-[36px] lg:text-[44px] text-[#E8EDF2] leading-[1.15] mb-4">
            Todo lo que necesitas para{" "}
            <span style={{ background: "linear-gradient(90deg,#0077FF,#00C2FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              dormir tranquilo
            </span>
          </h2>
          <p className="text-[16px] text-[#5A6B7A] max-w-[500px] mx-auto">
            Monitorización continua de los vectores de ataque más comunes en pequeñas y medianas empresas.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.title}
              className="p-5 rounded-2xl transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: "#0D1218", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
                style={{ background: "rgba(0,194,255,0.07)", border: "1px solid rgba(0,194,255,0.1)" }}>
                {f.icon}
              </div>
              <h3 className="font-syne font-semibold text-[15px] text-[#E8EDF2] mb-1.5">{f.title}</h3>
              <p className="text-[13.5px] text-[#5A6B7A] leading-[1.6]">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   PRICING
───────────────────────────────────────────────────────────────────────────── */
function PricingSection() {
  const plans = [
    {
      name: "Starter",
      price: "29",
      desc: "Para empresas que empiezan a tomarse en serio su seguridad digital.",
      features: [
        "1 dominio monitorizado",
        "10 emails vigilados",
        "5 créditos de escaneo / mes",
        "Detección en dark web",
        "Monitorización SSL y uptime",
        "Seguridad del email (SPF/DKIM/DMARC)",
        "Security Score diario",
        "Alertas automáticas por email",
      ],
      popular: false,
    },
    {
      name: "Business",
      price: "59",
      desc: "Para empresas con más exposición y necesidad de protección ampliada.",
      features: [
        "3 dominios monitorizados",
        "30 emails vigilados",
        "20 créditos de escaneo / mes",
        "Todo lo del plan Starter",
        "Detección de suplantación de empresa",
        "Historial completo de eventos",
        "Soporte prioritario",
        "Informes mensuales de seguridad",
      ],
      popular: true,
    },
  ];

  return (
    <section id="precios" style={{ background: "rgba(13,18,24,0.5)" }}>
      <Divider />
      <div className="max-w-[1200px] mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <SectionLabel>Precios</SectionLabel>
          <h2 className="font-syne font-bold text-[36px] lg:text-[44px] text-[#E8EDF2] leading-[1.15] mb-3">
            Simple y transparente
          </h2>
          <p className="text-[16px] text-[#5A6B7A]">Sin permanencia. Cancela cuando quieras.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-5 max-w-[760px] mx-auto">
          {plans.map((p) => (
            <div key={p.name}
              className="relative flex flex-col rounded-2xl p-7"
              style={{
                background:   p.popular ? "rgba(0,119,255,0.04)" : "#0D1218",
                border:       p.popular ? "1px solid rgba(0,194,255,0.25)" : "1px solid rgba(255,255,255,0.07)",
                boxShadow:    p.popular ? "0 0 60px rgba(0,119,255,0.1)" : "none",
              }}>
              {p.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full font-mono text-[10px] tracking-[2px] font-bold"
                  style={{ background: "linear-gradient(135deg,#0077FF,#00C2FF)", color: "white" }}>
                  POPULAR
                </div>
              )}

              <div className="mb-5">
                <div className="font-syne font-bold text-[15px] text-[#E8EDF2] mb-1">{p.name}</div>
                <div className="flex items-baseline gap-1.5 mb-2">
                  <span className="font-syne font-bold text-[42px] leading-none text-[#E8EDF2]">{p.price}€</span>
                  <span className="text-[14px] text-[#5A6B7A]">/ mes</span>
                </div>
                <p className="text-[13px] text-[#5A6B7A] leading-[1.6]">{p.desc}</p>
              </div>

              <Link href="/register"
                className="block text-center py-3 rounded-xl text-[14px] font-bold mb-6 transition-all hover:opacity-90"
                style={p.popular
                  ? { background: "linear-gradient(135deg,#0077FF,#00A8E8)", color: "white", boxShadow: "0 4px 24px rgba(0,119,255,0.3)" }
                  : { background: "rgba(255,255,255,0.06)", color: "#E8EDF2", border: "1px solid rgba(255,255,255,0.1)" }}>
                Empezar ahora
              </Link>

              <div className="space-y-3 flex-1">
                {p.features.map((f) => (
                  <div key={f} className="flex items-start gap-2.5">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5">
                      <circle cx="7" cy="7" r="6"
                        fill={p.popular ? "rgba(0,194,255,0.12)" : "rgba(255,255,255,0.04)"} />
                      <path d="M4.5 7l2 2 3-3"
                        stroke={p.popular ? "#00C2FF" : "#9AACBA"} strokeWidth="1.2"
                        strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-[13.5px] text-[#9AACBA] leading-[1.5]">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Divider />
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   FAQ
───────────────────────────────────────────────────────────────────────────── */
function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const faqs = [
    {
      q: "¿Necesito conocimientos técnicos para usar ChronoShield?",
      a: "No. Todo está explicado en lenguaje claro y sin tecnicismos. Recibirás alertas con pasos concretos que cualquier persona puede seguir, aunque no tenga formación en informática.",
    },
    {
      q: "¿Qué pasa si detectáis una filtración o problema?",
      a: "Te enviamos una alerta por email inmediatamente con una explicación clara de qué ha pasado, qué riesgo implica y qué pasos debes dar para solucionarlo. Nunca te dejamos solo ante un problema.",
    },
    {
      q: "¿Puedo cancelar la suscripción cuando quiera?",
      a: "Sí, sin permanencia ni penalizaciones. Cancelas desde tu panel de control en cualquier momento y tu suscripción se mantiene activa hasta el final del periodo ya pagado.",
    },
    {
      q: "¿Mis datos y los de mis clientes están seguros con ChronoShield?",
      a: "Absolutamente. Usamos cifrado en tránsito y en reposo, cumplimos con el RGPD y el marco legal europeo de protección de datos. Nunca compartimos ni vendemos tus datos a terceros.",
    },
    {
      q: "¿Cuánto tarda en configurarse?",
      a: "Menos de 5 minutos. Creas tu cuenta, introduces tu dominio y tus emails corporativos, y ChronoShield empieza a trabajar de inmediato. No requiere instalar nada ni acceso a tus servidores.",
    },
  ];

  return (
    <section className="py-24">
      <div className="max-w-[760px] mx-auto px-6">
        <div className="text-center mb-12">
          <SectionLabel>Preguntas frecuentes</SectionLabel>
          <h2 className="font-syne font-bold text-[36px] lg:text-[44px] text-[#E8EDF2] leading-[1.15]">
            ¿Tienes dudas?
          </h2>
        </div>

        <div className="space-y-2">
          {faqs.map((f, i) => (
            <div key={i} className="rounded-xl overflow-hidden transition-all"
              style={{ background: "#0D1218", border: `1px solid ${openIdx === i ? "rgba(0,194,255,0.18)" : "rgba(255,255,255,0.07)"}` }}>
              <button
                className="w-full flex items-center justify-between px-5 py-4 text-left gap-4"
                onClick={() => setOpenIdx(openIdx === i ? null : i)}>
                <span className="font-syne font-semibold text-[15px] text-[#E8EDF2] leading-[1.4]">{f.q}</span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                  className="shrink-0 transition-transform duration-200"
                  style={{ transform: openIdx === i ? "rotate(180deg)" : "" }}>
                  <path d="M4 6l4 4 4-4"
                    stroke={openIdx === i ? "#00C2FF" : "#5A6B7A"}
                    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {openIdx === i && (
                <div className="px-5 pb-4">
                  <p className="text-[14px] text-[#5A6B7A] leading-[1.7]">{f.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   CONTACTO
───────────────────────────────────────────────────────────────────────────── */
function ContactSection() {
  const [name, setName]             = useState("");
  const [email, setEmail]           = useState("");
  const [message, setMessage]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch(`${API_URL}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      setSubmitted(true);
    } catch {
      toast.error("Error al enviar el mensaje. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = [
    "w-full rounded-xl px-4 py-3 text-[14px] text-[#E8EDF2]",
    "placeholder-[#3D4F5E] focus:outline-none transition-all",
  ].join(" ");

  return (
    <section id="contacto" style={{ background: "rgba(13,18,24,0.5)" }}>
      <Divider />
      <div className="max-w-[1200px] mx-auto px-6 py-24">
        <div className="grid lg:grid-cols-[1fr_480px] gap-16 items-start">
          {/* Left */}
          <div>
            <SectionLabel>Contacto</SectionLabel>
            <h2 className="font-syne font-bold text-[36px] lg:text-[44px] text-[#E8EDF2] leading-[1.15] mb-5">
              ¿Tienes preguntas?{" "}
              <span style={{ background: "linear-gradient(90deg,#0077FF,#00C2FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Escríbenos
              </span>
            </h2>
            <p className="text-[16px] text-[#5A6B7A] leading-[1.7] mb-8 max-w-[420px]">
              Estaremos encantados de responder tus dudas y ayudarte a evaluar si ChronoShield encaja con las necesidades de tu empresa.
            </p>

            <div className="flex items-center gap-3 p-4 rounded-xl"
              style={{ background: "#0D1218", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "rgba(0,194,255,0.08)", border: "1px solid rgba(0,194,255,0.12)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="4" width="20" height="16" rx="2" stroke="#00C2FF" strokeWidth="1.5" />
                  <path d="M2 8l10 6 10-6" stroke="#00C2FF" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <div className="text-[11px] text-[#5A6B7A] mb-0.5">Email</div>
                <a href="mailto:hola@chronoshield.eu"
                  className="text-[14px] font-semibold text-[#E8EDF2] hover:text-[#00C2FF] transition-colors">
                  hola@chronoshield.eu
                </a>
              </div>
            </div>
          </div>

          {/* Right: form */}
          <div className="rounded-2xl p-6 lg:p-8"
            style={{ background: "#0D1218", border: "1px solid rgba(255,255,255,0.08)" }}>
            {submitted ? (
              <div className="flex flex-col items-center text-center py-8">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                  style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3 className="font-syne font-bold text-[20px] text-[#E8EDF2] mb-2">¡Mensaje enviado!</h3>
                <p className="text-[14px] text-[#5A6B7A]">Te responderemos en menos de 24 horas.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] text-[#5A6B7A] mb-1.5 font-mono uppercase tracking-[1.5px]">Nombre</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                    required placeholder="Tu nombre"
                    className={inputCls}
                    style={{ background: "#121A22", border: "1px solid rgba(255,255,255,0.08)" }} />
                </div>
                <div>
                  <label className="block text-[11px] text-[#5A6B7A] mb-1.5 font-mono uppercase tracking-[1.5px]">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    required placeholder="tu@empresa.com"
                    className={inputCls}
                    style={{ background: "#121A22", border: "1px solid rgba(255,255,255,0.08)" }} />
                </div>
                <div>
                  <label className="block text-[11px] text-[#5A6B7A] mb-1.5 font-mono uppercase tracking-[1.5px]">Mensaje</label>
                  <textarea value={message} onChange={(e) => setMessage(e.target.value)}
                    required rows={4} placeholder="Cuéntanos sobre tu empresa y tus dudas..."
                    className={`${inputCls} resize-none`}
                    style={{ background: "#121A22", border: "1px solid rgba(255,255,255,0.08)" }} />
                </div>
                <button type="submit" disabled={submitting}
                  className="w-full py-3.5 rounded-xl text-[14px] font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#0077FF,#00A8E8)", boxShadow: "0 4px 24px rgba(0,119,255,0.25)" }}>
                  {submitting ? "Enviando..." : "Enviar mensaje"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
      <Divider />
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   FOOTER
───────────────────────────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="py-12">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <ShieldLogo size={32} />
            <div>
              <div className="font-syne font-bold text-[14px] text-[#E8EDF2]">ChronoShield</div>
              <div className="text-[12px] text-[#5A6B7A]">Ciberseguridad para empresas</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-[#5A6B7A]">
            <a href="#" className="hover:text-[#9AACBA] transition-colors">Política de privacidad</a>
            <a href="#" className="hover:text-[#9AACBA] transition-colors">Términos de uso</a>
            <a href="#contacto" className="hover:text-[#9AACBA] transition-colors">Contacto</a>
          </div>
        </div>
        <div className="mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-[12px] text-[#3D4F5E]">© 2026 ChronoShield. Todos los derechos reservados.</p>
          <p className="text-[12px] text-[#3D4F5E]">Hecho con ♥ para proteger las PYMEs españolas</p>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN PAGE — redirect to dashboard if already authenticated
───────────────────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <StatsSection />
        <ForWhoSection />
        <HowItWorksSection />
        <FeaturesSection />
        <PricingSection />
        <FAQSection />
        <ContactSection />
      </main>
      <Footer />
    </>
  );
}
