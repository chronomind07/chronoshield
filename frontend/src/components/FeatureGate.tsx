"use client";
import { useState, useEffect, ReactNode } from "react";
import Link from "next/link";

// ── Icon SVGs (inline, no emoji) ──────────────────────────────────────────────
function ShieldIcon() { return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>; }
function RadarIcon() { return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><line x1="12" y1="2" x2="12" y2="6"/></svg>; }
function AlertIcon() { return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>; }
function BotIcon() { return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M12 11V7"/><circle cx="12" cy="4" r="2"/><path d="M8 11v-1a4 4 0 018 0v1"/><circle cx="8" cy="16" r="1" fill="#3ecf8e"/><circle cx="16" cy="16" r="1" fill="#3ecf8e"/></svg>; }
function ChatIcon() { return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>; }
function ListIcon() { return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="#3ecf8e"/><circle cx="3" cy="12" r="1" fill="#3ecf8e"/><circle cx="3" cy="18" r="1" fill="#3ecf8e"/></svg>; }
function FileIcon() { return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>; }
function CertIcon() { return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>; }
function MailIcon() { return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>; }
function ShieldCheckIcon() { return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>; }
function DnsIcon() { return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>; }
function BellAlertIcon() { return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>; }
function SeverityIcon() { return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>; }
function AiAlertIcon() { return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M12 11V7"/><circle cx="12" cy="4" r="2"/><path d="M8 11v-1a4 4 0 018 0v1"/><circle cx="8" cy="16" r="1" fill="#3ecf8e"/><circle cx="16" cy="16" r="1" fill="#3ecf8e"/></svg>; }
function ShareIcon() { return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>; }
function ClockIcon() { return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }
function ChartIcon() { return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>; }
function TrendIcon() { return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>; }
function LockIcon({ size = 20 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>; }
function XIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }

// ── Slide definitions ─────────────────────────────────────────────────────────
interface Slide { icon: ReactNode; title: string; desc: string; }

const DEMO_SLIDES: Record<string, Slide[]> = {
  emails: [
    { icon: <MailIcon />, title: "Protege tus dominios contra suplantación", desc: "Los atacantes falsifican tu dominio para enviar emails fraudulentos. ChronoShield detecta si tu configuración lo permite." },
    { icon: <DnsIcon />, title: "Verificamos SPF, DKIM y DMARC automáticamente", desc: "Analizamos los registros DNS de tus dominios dos veces al día y te alertamos si alguna protección falla o desaparece." },
    { icon: <ShieldCheckIcon />, title: "Recibe alertas si tu configuración cambia", desc: "Si alguien modifica tus registros de email security, recibirás una alerta inmediata antes de que los atacantes puedan explotarlo." },
  ],
  alerts: [
    { icon: <BellAlertIcon />, title: "Alertas inteligentes en tiempo real", desc: "Recibe notificaciones instantáneas cuando detectamos un problema: SSL caducado, dominio caído, brecha de datos o configuración comprometida." },
    { icon: <SeverityIcon />, title: "Clasificadas por severidad", desc: "Cada alerta incluye nivel de riesgo (crítico, medio, bajo), descripción del impacto y pasos concretos para solucionarlo." },
    { icon: <AiAlertIcon />, title: "Análisis con IA integrado", desc: "ChronoAI analiza el contexto de cada alerta y genera recomendaciones personalizadas basadas en el estado real de tu infraestructura." },
  ],
  darkweb: [
    { icon: <RadarIcon />, title: "Monitorizamos la dark web 24/7", desc: "Rastreamos más de 10 millones de registros expuestos en tiempo real para detectar si tus datos aparecen." },
    { icon: <AlertIcon />, title: "Detectamos filtraciones al instante", desc: "Cuando encontramos tu email o contraseña en una base de datos filtrada, te alertamos de inmediato." },
    { icon: <ShieldIcon />, title: "Te guiamos para protegerte", desc: "Recibirás instrucciones paso a paso para cambiar contraseñas y proteger tus cuentas afectadas." },
  ],
  assistant: [
    { icon: <BotIcon />, title: "ChronoAI analiza tu seguridad", desc: "Nuestro asistente de IA revisa todos tus datos de seguridad y detecta los problemas más urgentes." },
    { icon: <ChatIcon />, title: "Responde con datos reales", desc: "ChronoAI tiene acceso directo a tu cuenta: SSL, uptime, emails, scores. Sus respuestas son siempre relevantes." },
    { icon: <ListIcon />, title: "Recomendaciones personalizadas", desc: "Obtén un plan de acción concreto para mejorar tu puntuación de seguridad, con pasos numerados y valores exactos." },
  ],
  reports: [
    { icon: <FileIcon />, title: "Informes PDF profesionales", desc: "Genera informes de seguridad completos con tu logo, métricas clave y recomendaciones en un solo clic." },
    { icon: <CertIcon />, title: "Cumplimiento NIS2 automático", desc: "ChronoShield evalúa tu nivel de cumplimiento con la directiva NIS2 y genera el certificado de conformidad." },
    { icon: <ShareIcon />, title: "Comparte con clientes o equipo", desc: "Envía los informes por email, descárgalos en PDF o genera un enlace de acceso temporal para terceros." },
  ],
  history: [
    { icon: <ClockIcon />, title: "Historial completo de escaneos", desc: "Consulta todos los resultados de SSL, uptime, email security y dark web organizados cronológicamente." },
    { icon: <ChartIcon />, title: "Compara a lo largo del tiempo", desc: "Visualiza cómo evoluciona tu seguridad mes a mes con gráficos de tendencia y comparativas." },
    { icon: <TrendIcon />, title: "Detecta tendencias y mejoras", desc: "Identifica patrones, periodos de riesgo y el impacto de los cambios que has implementado." },
  ],
};

// ── Demo modal (carousel) ─────────────────────────────────────────────────────
function DemoModal({ feature, onClose }: { feature: string; onClose: () => void }) {
  const slides = DEMO_SLIDES[feature] ?? DEMO_SLIDES.darkweb;
  const [current, setCurrent] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [animating, setAnimating] = useState(false);

  const goTo = (idx: number) => {
    if (animating || idx === current) return;
    setDir(idx > current ? 1 : -1);
    setAnimating(true);
    setTimeout(() => { setCurrent(idx); setAnimating(false); }, 220);
  };
  const next = () => goTo(Math.min(current + 1, slides.length - 1));
  const prev = () => goTo(Math.max(current - 1, 0));

  const slide = slides[current];

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(5,5,8,0.88)", backdropFilter: "blur(8px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 20, padding: "40px 36px 32px", maxWidth: 440, width: "100%", position: "relative", boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
        {/* Close */}
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#71717a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32 }}>
          <XIcon />
        </button>

        {/* Slide content */}
        <div style={{ minHeight: 220, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", justifyContent: "center", gap: 20, transition: "opacity 0.22s ease, transform 0.22s ease", opacity: animating ? 0 : 1, transform: animating ? `translateX(${dir * 24}px)` : "translateX(0)" }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: "rgba(62,207,142,0.08)", border: "1px solid rgba(62,207,142,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {slide.icon}
          </div>
          <div>
            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#f5f5f5", marginBottom: 10, lineHeight: 1.3 }}>{slide.title}</div>
            <div style={{ fontSize: "0.84rem", color: "#71717a", lineHeight: 1.65, maxWidth: 320, marginInline: "auto" }}>{slide.desc}</div>
          </div>
        </div>

        {/* Dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 7, margin: "24px 0 20px" }}>
          {slides.map((_, i) => (
            <button key={i} onClick={() => goTo(i)} style={{ width: i === current ? 20 : 7, height: 7, borderRadius: 4, background: i === current ? "#3ecf8e" : "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", padding: 0, transition: "all 0.25s ease" }} aria-label={`Slide ${i + 1}`} />
          ))}
        </div>

        {/* Nav buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          {current > 0 && (
            <button onClick={prev} style={{ flex: 1, padding: "11px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "#a3a3a3", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "background 0.2s" }}>
              ← Anterior
            </button>
          )}
          {current < slides.length - 1 ? (
            <button onClick={next} style={{ flex: 1, padding: "11px", borderRadius: 10, background: "rgba(62,207,142,0.1)", border: "1px solid rgba(62,207,142,0.2)", color: "#3ecf8e", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "background 0.2s" }}>
              Siguiente →
            </button>
          ) : (
            <Link href="/select-plan" style={{ flex: 1, padding: "11px", borderRadius: 10, background: "linear-gradient(135deg, #3ecf8e, #2db87a)", color: "#0a0a0a", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textDecoration: "none", display: "block", textAlign: "center" }}>
              Mejorar plan →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ── FeatureGate main export ───────────────────────────────────────────────────
interface FeatureGateProps {
  feature: "emails" | "alerts" | "darkweb" | "assistant" | "reports" | "history";
  title: string;
  subtitle: string;
  requiredPlan?: "starter" | "business";
  isFree: boolean;
  children: ReactNode;
}

export default function FeatureGate({ feature, title, subtitle, requiredPlan = "starter", isFree, children }: FeatureGateProps) {
  const [showDemo, setShowDemo] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  if (!isFree) return <>{children}</>;

  const planLabel = requiredPlan === "business" ? "Business" : "Starter";

  return (
    <div style={{ padding: "28px 32px 60px", background: "#0b0b0b", minHeight: "100vh", fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", position: "relative" }}>
      <style>{`
        @keyframes fgFadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fgPulse { 0%,100% { opacity:0.4; } 50% { opacity:0.7; } }
        .fg-btn-demo { transition: background 0.2s, border-color 0.2s, color 0.2s; }
        .fg-btn-demo:hover { background: rgba(255,255,255,0.08) !important; border-color: rgba(255,255,255,0.16) !important; color: #f5f5f5 !important; }
        .fg-btn-upgrade { transition: opacity 0.2s, transform 0.15s; }
        .fg-btn-upgrade:hover { opacity: 0.88; transform: scale(1.02); }
      `}</style>

      {/* Blurred ghost background — simulates content behind gate */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        <div style={{ opacity: 0.18, filter: "blur(6px)", padding: "28px 32px" }}>
          {/* Ghost skeleton lines */}
          {[80, 60, 90, 50, 70, 55, 85].map((w, i) => (
            <div key={i} style={{ height: 12, width: `${w}%`, background: "#2a2a2a", borderRadius: 6, marginBottom: 16, animation: "fgPulse 2s ease-in-out infinite", animationDelay: `${i * 0.15}s` }} />
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 24 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ height: 80, background: "#1a1a1a", borderRadius: 12, animation: "fgPulse 2s ease-in-out infinite", animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </div>
      </div>

      {/* Overlay gradient */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(11,11,11,0.2) 0%, rgba(11,11,11,0.92) 35%, rgba(11,11,11,0.98) 100%)", pointerEvents: "none" }} />

      {/* Gate content */}
      <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", textAlign: "center", opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)", transition: "opacity 0.5s ease, transform 0.5s ease" }}>

        {/* Lock icon */}
        <div style={{ width: 64, height: 64, borderRadius: 18, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, color: "#71717a" }}>
          <LockIcon size={26} />
        </div>

        {/* Plan badge */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(62,207,142,0.08)", border: "1px solid rgba(62,207,142,0.2)", borderRadius: 20, padding: "4px 14px", marginBottom: 20 }}>
          <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#3ecf8e" opacity="0.8"/></svg>
          <span style={{ fontFamily: "var(--font-dm-mono, monospace)", fontSize: "0.65rem", fontWeight: 700, color: "#3ecf8e", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Disponible desde el plan {planLabel}
          </span>
        </div>

        {/* Title & subtitle */}
        <h1 style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.2rem)", fontWeight: 700, color: "#f5f5f5", margin: "0 0 12px", letterSpacing: "-0.03em", lineHeight: 1.2 }}>{title}</h1>
        <p style={{ color: "#71717a", fontSize: "0.9rem", maxWidth: 440, margin: "0 0 36px", lineHeight: 1.7 }}>{subtitle}</p>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            className="fg-btn-demo"
            onClick={() => setShowDemo(true)}
            style={{ padding: "12px 22px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#a3a3a3", fontSize: "0.88rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Ver demo
          </button>
          <Link
            href="/select-plan"
            className="fg-btn-upgrade"
            style={{ padding: "12px 22px", borderRadius: 10, background: "linear-gradient(135deg, #3ecf8e, #2db87a)", border: "none", color: "#0a0a0a", fontSize: "0.88rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            Mejorar plan →
          </Link>
        </div>
      </div>

      {showDemo && <DemoModal feature={feature} onClose={() => setShowDemo(false)} />}
    </div>
  );
}
