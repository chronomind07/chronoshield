"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { billingApi } from "@/lib/api";

// ── Feature lists ─────────────────────────────────────────────────────────────
const STARTER_FEATURES = [
  "1 dominio monitorizado",
  "5 emails protegidos",
  "5 créditos/mes",
  "Scans SSL, Uptime, Dark Web",
  "Alertas por email",
  "ChronoAI: 5 consultas/mes",
];

const BUSINESS_FEATURES = [
  "2 dominios monitorizados",
  "15 emails protegidos",
  "15 créditos/mes",
  "Scans prioritarios",
  "Alertas instantáneas",
  "ChronoAI: 20 consultas/mes",
  "Informes semanales y mensuales",
  "Historial 90 días",
];

// ── Noise texture overlay ─────────────────────────────────────────────────────
const noiseStyle = {
  position: "fixed" as const,
  inset: 0,
  pointerEvents: "none" as const,
  zIndex: 0,
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
  backgroundSize: "200px 200px",
};

// ── Check icon ────────────────────────────────────────────────────────────────
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
      <path d="M2.5 7L5.5 10L11.5 4" stroke="#3ecf8e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SelectPlanPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState<"starter" | "business" | null>(null);

  // Auth + subscription guard
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.replace("/login");
        return;
      }
      // If user already has an active paid plan → go to dashboard
      // (but allow trial/free users to stay on select-plan to upgrade)
      try {
        const res = await billingApi.subscription();
        const plan = res.data?.plan;
        const status = res.data?.status;
        if (plan && plan !== "trial" && plan !== "free" && status === "active") {
          router.replace("/dashboard");
          return;
        }
      } catch {
        // Can't fetch subscription — continue showing plan selection
      }
      setChecking(false);
    });
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const handleSelect = useCallback(async (plan: "starter" | "business") => {
    setLoading(plan);
    try {
      const res = await billingApi.checkout(plan);
      const url = res.data?.url;
      if (url) {
        window.location.href = url;
      }
    } catch {
      setLoading(null);
    }
  }, []);

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", background: "#0b0b0b", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 28, height: 28, border: "2px solid #3ecf8e", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0b0b0b", position: "relative", fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}>
      {/* Cerrar sesión */}
      <button
        onClick={handleLogout}
        style={{
          position: "absolute", top: 24, right: 24, zIndex: 10,
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          color: "#71717a", fontSize: "0.78rem", fontWeight: 500,
          padding: "6px 14px", borderRadius: 8, cursor: "pointer",
          fontFamily: "inherit", transition: "color 0.2s",
        }}
        onMouseEnter={e => (e.currentTarget.style.color = "#f5f5f5")}
        onMouseLeave={e => (e.currentTarget.style.color = "#71717a")}
      >
        Cerrar sesión
      </button>
      <div style={noiseStyle} />
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .sp-card {
          animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both;
          transition: border-color 0.3s, transform 0.3s, box-shadow 0.3s;
        }
        .sp-card:hover { transform: translateY(-5px); box-shadow: 0 0 0 1px rgba(62,207,142,0.12); }
        .sp-card-business:hover { box-shadow: 0 0 24px rgba(62,207,142,0.08), 0 0 0 1px rgba(62,207,142,0.2) !important; }
        .sp-btn { transition: opacity 0.2s, transform 0.1s; }
        .sp-btn:hover:not(:disabled) { opacity: 0.88; }
        .sp-btn:active:not(:disabled) { transform: scale(0.98); }
      `}</style>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto", padding: "60px 24px 80px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 56, animation: "fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both" }}>
          {/* Logo */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 40 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(62,207,142,0.12)", border: "1px solid rgba(62,207,142,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>
              🛡️
            </div>
            <span style={{ fontFamily: "var(--font-dm-mono, monospace)", fontSize: "0.8rem", fontWeight: 700, color: "#3ecf8e", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              ChronoShield
            </span>
          </div>

          <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", fontWeight: 700, color: "#f5f5f5", margin: "0 0 14px", letterSpacing: "-0.03em", lineHeight: 1.15 }}>
            Elige tu plan
          </h1>
          <p style={{ color: "#71717a", fontSize: "0.95rem", margin: 0, maxWidth: 460, marginInline: "auto", lineHeight: 1.6 }}>
            Protege tu negocio desde el primer día. Sin permanencia, cancela cuando quieras.
          </p>
        </div>

        {/* Plan cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24, maxWidth: 720, margin: "0 auto" }}>

          {/* ── Starter ── */}
          <div
            className="sp-card"
            style={{
              background: "#0f0f0f",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 20,
              padding: "36px 32px",
              display: "flex",
              flexDirection: "column",
              animationDelay: "0.05s",
            }}
          >
            <div style={{ fontFamily: "var(--font-dm-mono, monospace)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#71717a", marginBottom: 20 }}>
              Starter
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: "2.4rem", fontWeight: 700, color: "#f5f5f5", letterSpacing: "-0.04em", lineHeight: 1 }}>
                24€
              </span>
              <span style={{ fontSize: "0.82rem", color: "#71717a" }}>/mes</span>
            </div>
            <div style={{ fontSize: "0.72rem", color: "#3a3a3a", marginBottom: 28 }}>IVA incluido</div>

            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 36px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              {STARTER_FEATURES.map((f) => (
                <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: "0.83rem", color: "#a3a3a3" }}>
                  <CheckIcon />
                  {f}
                </li>
              ))}
            </ul>

            <button
              className="sp-btn"
              onClick={() => handleSelect("starter")}
              disabled={!!loading}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#f5f5f5",
                fontSize: "0.9rem",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading && loading !== "starter" ? 0.4 : 1,
                fontFamily: "inherit",
              }}
            >
              {loading === "starter" ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                  Redirigiendo…
                </span>
              ) : "Empezar con Starter"}
            </button>
          </div>

          {/* ── Business (Popular) ── */}
          <div
            className="sp-card sp-card-business"
            style={{
              background: "linear-gradient(160deg, rgba(62,207,142,0.06) 0%, #0f0f12 60%)",
              border: "1px solid rgba(62,207,142,0.25)",
              borderRadius: 20,
              padding: "36px 32px",
              display: "flex",
              flexDirection: "column",
              position: "relative",
              animationDelay: "0.12s",
            }}
          >
            {/* Popular badge */}
            <div style={{
              position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)",
              background: "rgba(62,207,142,0.15)", color: "#3ecf8e",
              border: "1px solid rgba(62,207,142,0.3)",
              fontFamily: "var(--font-dm-mono, monospace)", fontSize: "0.62rem", fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.15em",
              padding: "3px 14px", borderRadius: 20, whiteSpace: "nowrap",
            }}>
              Popular
            </div>

            <div style={{ fontFamily: "var(--font-dm-mono, monospace)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#3ecf8e", marginBottom: 20 }}>
              Business
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: "2.4rem", fontWeight: 700, color: "#f5f5f5", letterSpacing: "-0.04em", lineHeight: 1 }}>
                59€
              </span>
              <span style={{ fontSize: "0.82rem", color: "#71717a" }}>/mes</span>
            </div>
            <div style={{ fontSize: "0.72rem", color: "#3a3a3a", marginBottom: 28 }}>IVA incluido</div>

            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 36px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              {BUSINESS_FEATURES.map((f) => (
                <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: "0.83rem", color: "#a3a3a3" }}>
                  <CheckIcon />
                  {f}
                </li>
              ))}
            </ul>

            <button
              className="sp-btn"
              onClick={() => handleSelect("business")}
              disabled={!!loading}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #3ecf8e, #2db87a)",
                border: "none",
                color: "#0a0a0a",
                fontSize: "0.9rem",
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading && loading !== "business" ? 0.4 : 1,
                fontFamily: "inherit",
              }}
            >
              {loading === "business" ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span style={{ width: 14, height: 14, border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "#0a0a0a", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                  Redirigiendo…
                </span>
              ) : "Empezar con Business"}
            </button>
          </div>
        </div>

        {/* Footer note */}
        <p style={{ textAlign: "center", color: "#3a3a3a", fontSize: "0.75rem", marginTop: 36, fontFamily: "var(--font-dm-mono, monospace)" }}>
          Pago seguro con Stripe · Sin permanencia · Cancela cuando quieras
        </p>
      </div>
    </div>
  );
}
