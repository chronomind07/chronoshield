"use client";

import { useEffect, useState } from "react";
import { dashboardApi, emailsApi, domainsApi } from "@/lib/api";
import Link from "next/link";
import toast from "react-hot-toast";

// ── Types ─────────────────────────────────────────────────────────────────────
interface DashboardSummary {
  domains_monitored:       number;
  emails_monitored:        number;
  active_alerts:           number;
  average_score:           number;
  domains_with_ssl_issues: number;
  domains_down:            number;
  breached_emails:         number;
  recent_alerts:           Alert[];
}

interface Alert {
  id:         string;
  alert_type: string;
  severity:   string;
  title:      string;
  message:    string;
  sent_at:    string;
  read_at:    string | null;
}

interface MonitoredEmail {
  id:              string;
  email:           string;
  last_checked_at: string | null;
  breach_count:    number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function scoreGrade(s: number) {
  return s >= 95 ? "A+" : s >= 90 ? "A" : s >= 80 ? "B" : s >= 70 ? "C" : s >= 60 ? "D" : "F";
}

function scoreColor(s: number) {
  return s >= 80 ? "#00e5bf" : s >= 60 ? "#ffb020" : "#ff4d6a";
}

/** Derive individual component scores from summary data */
function componentScores(s: DashboardSummary) {
  const td = Math.max(1, s.domains_monitored);
  const te = Math.max(1, s.emails_monitored);
  const ssl    = Math.round(Math.max(0, (1 - s.domains_with_ssl_issues / td) * 100));
  const uptime = Math.round(Math.max(0, (1 - s.domains_down / td) * 100));
  const breach = Math.round(Math.max(0, (1 - s.breached_emails / te) * 100));
  const email_sec = Math.round(
    Math.max(0, Math.min(100,
      (s.average_score - breach * 0.30 - ssl * 0.25 - uptime * 0.25) / 0.20
    ))
  );
  return { ssl, uptime, breach, email_sec };
}

/** Relative time string */
function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)} días`;
}

/** Alert type → dot color */
function alertDotColor(type: string, sev: string): { color: string; glow: string } {
  if (type?.includes("breach") || sev === "critical") return { color: "#ff4d6a", glow: "rgba(255,77,106,0.4)" };
  if (type?.includes("email")  || sev === "warning")  return { color: "#ffb020", glow: "rgba(255,176,32,0.4)" };
  if (type?.includes("ssl"))                          return { color: "#6366f1", glow: "rgba(99,102,241,0.4)" };
  if (type?.includes("uptime"))                       return { color: "#22c55e", glow: "rgba(34,197,94,0.4)" };
  return { color: "#22d3ee", glow: "rgba(34,211,238,0.4)" };
}

/** Alert type → tag label */
function alertTagLabel(type: string, sev: string) {
  if (type?.includes("breach"))  return "Breach";
  if (type?.includes("ssl"))     return "SSL";
  if (type?.includes("uptime"))  return "Uptime";
  if (type?.includes("email"))   return "Email Sec.";
  if (sev === "critical")        return "Crítico";
  if (sev === "warning")         return "Aviso";
  return "Info";
}

// ── Score Ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const [animated, setAnimated] = useState(false);
  const circumference = 283;
  const offset = animated ? circumference * (1 - score / 100) : circumference;

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ position: "relative", width: 110, height: 110, flexShrink: 0 }}>
      <svg width="110" height="110" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id="scoreGradNew" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00e5bf" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
        {/* Progress */}
        <circle
          cx="50" cy="50" r="45"
          fill="none"
          stroke="url(#scoreGradNew)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            filter: "drop-shadow(0 0 3px rgba(0,229,191,0.15))",
            transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{
          fontFamily: "var(--font-serif-family)",
          fontSize: "1.65rem",
          fontWeight: 400,
          letterSpacing: "-0.02em",
          color: "#00e5bf",
          lineHeight: 1,
        }}>{score}</span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [emails, setEmails]   = useState<MonitoredEmail[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [sumRes, emlRes] = await Promise.all([
        dashboardApi.summary(),
        emailsApi.list(),
      ]);
      setSummary(sumRes.data);
      setEmails(emlRes.data ?? []);
    } catch {
      toast.error("Error al cargar el dashboard");
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (alertId: string) => {
    try {
      await dashboardApi.markAlertRead(alertId);
      setSummary((prev) =>
        prev ? {
          ...prev,
          recent_alerts: prev.recent_alerts.map((a) =>
            a.id === alertId ? { ...a, read_at: new Date().toISOString() } : a
          ),
          active_alerts: Math.max(0, prev.active_alerts - 1),
        } : prev
      );
    } catch { /* silent */ }
  };

  const [scanning, setScanning] = useState(false);

  const handleScanAll = async () => {
    if (scanning) return;
    setScanning(true);
    try {
      const domsRes = await domainsApi.list();
      const doms: { id: string }[] = domsRes.data ?? [];
      if (doms.length === 0) {
        toast("Sin dominios que escanear");
        setScanning(false);
        return;
      }
      // Fire all domain scans (ignore individual 402 errors)
      await Promise.allSettled(doms.map((d) => domainsApi.scan(d.id)));
      // Wait for background scans to complete (~12 s)
      await new Promise((resolve) => setTimeout(resolve, 12000));
      // Reload fresh data
      const [sumRes, emlRes] = await Promise.all([
        dashboardApi.summary(),
        emailsApi.list(),
      ]);
      const fresh: DashboardSummary = sumRes.data;
      setSummary(fresh);
      setEmails(emlRes.data ?? []);
      // Toast based on results
      const score = Math.round(fresh?.average_score ?? 0);
      const issues = fresh?.active_alerts ?? 0;
      if (score >= 90 && issues === 0) {
        toast.success("✅ Tu dominio está correctamente configurado y protegido");
      } else if (score >= 70) {
        toast.success(
          `Scan completado · Score: ${score}${issues > 0 ? ` · ${issues} alerta${issues !== 1 ? "s" : ""} activa${issues !== 1 ? "s" : ""}` : ""}`,
        );
      } else {
        toast.error(`Score: ${score} · Revisa las alertas activas`);
      }
    } catch {
      toast.error("Error al escanear");
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: "32px 36px 60px", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 260, background: "#050507" }}>
        <div style={{ width: 32, height: 32, border: "2px solid #00e5bf", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!summary) {
    return (
      <div style={{ padding: "32px 36px 60px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 20, textAlign: "center", background: "#050507" }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", background: "rgba(0,229,191,0.08)", border: "1px solid rgba(0,229,191,0.15)" }}>
          🛡
        </div>
        <div>
          <h2 style={{ fontFamily: "var(--font-serif-family)", fontSize: "1.3rem", fontWeight: 400, color: "#f0f0f5" }}>
            Empieza añadiendo tu primer dominio
          </h2>
          <p style={{ fontSize: "0.85rem", color: "#55556a", marginTop: 6, maxWidth: 300 }}>
            Monitoriza la seguridad de tus dominios y emails desde un solo lugar.
          </p>
        </div>
        <Link
          href="/dashboard/domains"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: "0.875rem", padding: "10px 20px", borderRadius: 12, color: "#050507", background: "linear-gradient(135deg, #00e5bf, #00ffd5)", textDecoration: "none" }}
        >
          Añadir dominio
        </Link>
      </div>
    );
  }

  const comp = componentScores(summary);

  // Metric card data
  const metricCards = [
    {
      variant:  "v-green",
      delay:    "0.15s",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
      badge:    summary.domains_with_ssl_issues === 0 ? "Seguro" : "Atención",
      title:    "SSL",
      desc:     `Certificado activo · ${summary.domains_with_ssl_issues} issues · ${summary.domains_monitored} dominios`,
      pct:      comp.ssl,
    },
    {
      variant:  "v-accent",
      delay:    "0.2s",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00e5bf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
        </svg>
      ),
      badge:    comp.email_sec >= 80 ? "Protegido" : "Atención",
      title:    "SPF / Email Sec.",
      desc:     `Score: ${comp.email_sec} · Seguridad de correo`,
      pct:      comp.email_sec,
    },
    {
      variant:  summary.domains_down === 0 ? "v-green" : "v-red",
      delay:    "0.25s",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={summary.domains_down === 0 ? "#22c55e" : "#ff4d6a"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
      badge:    summary.domains_down === 0 ? "Online" : "Caído",
      title:    `Uptime ${comp.uptime}%`,
      desc:     `${summary.domains_down} dominio${summary.domains_down !== 1 ? "s" : ""} caído${summary.domains_down !== 1 ? "s" : ""} · 30 días`,
      pct:      comp.uptime,
    },
    {
      variant:  summary.breached_emails === 0 ? "v-amber" : "v-red",
      delay:    "0.3s",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={summary.breached_emails === 0 ? "#ffb020" : "#ff4d6a"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
      badge:    summary.breached_emails === 0 ? "Limpio" : "Alerta",
      title:    `${summary.breached_emails} filtrados`,
      desc:     `de ${summary.emails_monitored} emails monitorizados`,
      pct:      comp.breach,
    },
    {
      variant:  "v-blue",
      delay:    "0.35s",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ),
      badge:    "Activo",
      title:    `${summary.domains_monitored} dominios`,
      desc:     "Monitoreo continuo activo",
      pct:      100,
    },
    {
      variant:  summary.active_alerts === 0 ? "v-cyan" : "v-amber",
      delay:    "0.4s",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={summary.active_alerts === 0 ? "#22d3ee" : "#ffb020"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
      badge:    summary.active_alerts === 0 ? "Normal" : `${summary.active_alerts} nuevas`,
      title:    `${summary.active_alerts} alertas`,
      desc:     `${summary.emails_monitored} emails vigilados`,
      pct:      summary.active_alerts === 0 ? 100 : Math.max(5, 100 - summary.active_alerts * 10),
    },
  ];

  return (
    <div style={{ padding: "32px 36px 60px", position: "relative", zIndex: 1, background: "#050507" }}>
      <style>{`
        @keyframes dashFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .status-dot-pulse {
          animation: dotPulse 2s ease-in-out infinite;
        }
        @keyframes dotPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
        .m-card {
          background: #0f0f16;
          border: 1px solid rgba(255,255,255,0.03);
          border-radius: 14px;
          padding: 18px;
          position: relative;
          overflow: hidden;
          animation: dashFadeIn 0.5s ease both;
          transition: border-color 0.3s, background 0.3s;
        }
        .m-card:hover { background: #14141d; border-color: rgba(255,255,255,0.08); }
        .m-card-progress {
          margin-top: 14px;
          height: 3px;
          border-radius: 99px;
          background: rgba(255,255,255,0.05);
          overflow: hidden;
        }
        .m-card-progress-fill {
          height: 100%;
          border-radius: 99px;
          transition: width 1s cubic-bezier(0.4,0,0.2,1);
        }
        .v-green .m-card-icon  { background: rgba(34,197,94,0.10); }
        .v-green .m-card-badge { background: rgba(34,197,94,0.10); color: #22c55e; }
        .v-green .m-card-progress-fill { background: #22c55e; box-shadow: 0 0 6px rgba(34,197,94,0.4); }
        .v-accent .m-card-icon  { background: rgba(0,229,191,0.10); }
        .v-accent .m-card-badge { background: rgba(0,229,191,0.10); color: #00e5bf; }
        .v-accent .m-card-progress-fill { background: #00e5bf; box-shadow: 0 0 6px rgba(0,229,191,0.4); }
        .v-red .m-card-icon  { background: rgba(255,77,106,0.10); }
        .v-red .m-card-badge { background: rgba(255,77,106,0.10); color: #ff4d6a; }
        .v-red .m-card-progress-fill { background: #ff4d6a; box-shadow: 0 0 6px rgba(255,77,106,0.4); }
        .v-amber .m-card-icon  { background: rgba(255,176,32,0.10); }
        .v-amber .m-card-badge { background: rgba(255,176,32,0.10); color: #ffb020; }
        .v-amber .m-card-progress-fill { background: #ffb020; box-shadow: 0 0 6px rgba(255,176,32,0.4); }
        .v-blue .m-card-icon  { background: rgba(99,102,241,0.10); }
        .v-blue .m-card-badge { background: rgba(99,102,241,0.10); color: #6366f1; }
        .v-blue .m-card-progress-fill { background: #6366f1; box-shadow: 0 0 6px rgba(99,102,241,0.4); }
        .v-cyan .m-card-icon  { background: rgba(34,211,238,0.10); }
        .v-cyan .m-card-badge { background: rgba(34,211,238,0.10); color: #22d3ee; }
        .v-cyan .m-card-progress-fill { background: #22d3ee; box-shadow: 0 0 6px rgba(34,211,238,0.4); }
        .dash-panel {
          background: #0f0f16;
          border: 1px solid rgba(255,255,255,0.03);
          border-radius: 16px;
          padding: 22px 24px;
          animation: dashFadeIn 0.5s ease both;
          transition: border-color 0.3s;
        }
        .dash-panel:hover { border-color: rgba(255,255,255,0.07); }
        @media (max-width: 1200px) {
          .dash-score-section  { grid-template-columns: 1fr !important; }
          .dash-bottom-section { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 900px) {
          .dash-metrics-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media (max-width: 600px) {
          .dash-metrics-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif-family)", fontSize: "1.75rem", fontWeight: 400, letterSpacing: "-0.02em", color: "#f0f0f5", margin: 0 }}>Dashboard</h1>
          <p style={{ color: "#55556a", fontSize: "0.82rem", marginTop: 4, margin: "4px 0 0" }}>Panel de monitorización de seguridad</p>
        </div>
        <button
          onClick={handleScanAll}
          disabled={scanning}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontFamily: "var(--font-jakarta-family)",
            fontWeight: 600,
            fontSize: "0.8rem",
            color: "#050507",
            padding: "9px 18px",
            borderRadius: 10,
            border: "none",
            cursor: scanning ? "not-allowed" : "pointer",
            background: "linear-gradient(135deg, #00e5bf, #00d4b0)",
            boxShadow: "0 0 20px rgba(0,229,191,0.25)",
            letterSpacing: "0.01em",
            opacity: scanning ? 0.7 : 1,
            transition: "opacity 0.2s",
          }}
        >
          <svg
            width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ animation: scanning ? "spin 0.8s linear infinite" : "none" }}
          >
            <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.84" />
          </svg>
          {scanning ? "Escaneando..." : "Escanear"}
        </button>
      </div>

      {/* ── Status bar ───────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", background: "#0f0f16", border: "1px solid rgba(255,255,255,0.03)", borderRadius: 12, marginBottom: 24, animation: "dashFadeIn 0.5s ease" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#22c55e" }}>
          <span className="status-dot-pulse" style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px rgba(34,197,94,0.4)", display: "inline-block" }} />
          Monitoreo activo
        </div>
        <span style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.72rem", color: "#55556a" }}>
          {summary.domains_monitored > 0
            ? `${summary.domains_monitored} dominio${summary.domains_monitored > 1 ? "s" : ""} activo${summary.domains_monitored > 1 ? "s" : ""}`
            : "sin dominios"}
        </span>
      </div>

      {/* ── Score section (score card + metrics grid) ─────────────────────── */}
      <div className="dash-score-section" style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, marginBottom: 20 }}>

        {/* Score card */}
        <div style={{ background: "#0f0f16", border: "1px solid rgba(255,255,255,0.03)", borderRadius: 16, padding: 28, position: "relative", overflow: "hidden", transition: "border-color 0.4s", animation: "dashFadeIn 0.6s ease 0.1s both" }}>
          {/* Ambient glow */}
          <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,229,191,0.08), transparent 70%)", pointerEvents: "none" }} />

          <div style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.18em", color: "#33334a", marginBottom: 20 }}>
            Security Score
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 20 }}>
            <ScoreRing score={Math.round(summary.average_score)} />
            <div style={{ flex: 1 }}>
              {[
                { dot: "#22c55e", label: "SSL",        val: comp.ssl       },
                { dot: "#00e5bf", label: "Email Sec.", val: comp.email_sec },
                { dot: "#ff4d6a", label: "Breaches",   val: comp.breach    },
                { dot: "#22d3ee", label: "Uptime",     val: comp.uptime    },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: item.dot, boxShadow: `0 0 5px ${item.dot}80` }} />
                  <span style={{ fontSize: "0.75rem", color: "#55556a", flex: 1 }}>{item.label}</span>
                  <span style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.7rem", color: scoreColor(item.val) }}>{item.val}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.03)", paddingTop: 16 }}>
            <div style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#00e5bf", marginBottom: 6 }}>
              NIVEL: {summary.average_score >= 80 ? "BUENO" : summary.average_score >= 60 ? "MODERADO · MEJORABLE" : "CRÍTICO"}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#55556a", lineHeight: 1.6 }}>
              {summary.active_alerts} alerta{summary.active_alerts !== 1 ? "s" : ""} activa{summary.active_alerts !== 1 ? "s" : ""}.{" "}
              {summary.breached_emails > 0
                ? `${summary.breached_emails} emails comprometidos detectados.`
                : "Sin brechas detectadas."}
            </div>
          </div>
        </div>

        {/* Metrics grid */}
        <div className="dash-metrics-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          {metricCards.map((card, i) => (
            <div key={i} className={`m-card ${card.variant}`} style={{ animationDelay: card.delay }}>
              <div className="m-card-top" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div className="m-card-icon" style={{ width: 34, height: 34, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {card.icon}
                </div>
                <div className="m-card-badge" style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.58rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", padding: "3px 8px", borderRadius: 6 }}>
                  {card.badge}
                </div>
              </div>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4, color: "#f0f0f5" }}>{card.title}</div>
              <div style={{ fontSize: "0.75rem", color: "#55556a", lineHeight: 1.5 }}>{card.desc}</div>
              <div className="m-card-progress">
                <div className="m-card-progress-fill" style={{ width: `${card.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom panels ────────────────────────────────────────────────── */}
      <div className="dash-bottom-section" style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20, marginTop: 20 }}>

        {/* Alerts panel */}
        <div className="dash-panel" style={{ animationDelay: "0.3s" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, letterSpacing: "-0.01em", color: "#f0f0f5" }}>Alertas recientes</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {summary.active_alerts > 0 && (
                <span style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.58rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", padding: "3px 8px", borderRadius: 6, background: "rgba(255,77,106,0.10)", color: "#ff4d6a" }}>
                  {summary.active_alerts} sin leer
                </span>
              )}
              <Link href="/dashboard/alerts" style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.7rem", color: "#00e5bf", textDecoration: "none", fontWeight: 500, letterSpacing: "0.02em" }}>ver todas →</Link>
            </div>
          </div>

          {summary.recent_alerts.length === 0 ? (
            <div style={{ padding: "32px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "#f0f0f5", margin: 0 }}>Sin alertas activas</p>
              <p style={{ fontSize: "0.75rem", color: "#55556a", margin: 0 }}>No se han detectado incidencias</p>
            </div>
          ) : (
            <div>
              {summary.recent_alerts.map((alert, i) => {
                const dc = alertDotColor(alert.alert_type, alert.severity);
                const isUnread = !alert.read_at;
                const isLast   = i === summary.recent_alerts.length - 1;
                return (
                  <div key={alert.id} style={{ display: "flex", gap: 12, padding: "13px 0", borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.03)" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", marginTop: 6, flexShrink: 0, background: dc.color, boxShadow: `0 0 6px ${dc.glow}` }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                        <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#f0f0f5", lineHeight: 1.4 }}>{alert.title}</div>
                        <span style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.65rem", color: "#33334a", whiteSpace: "nowrap", marginTop: 2 }}>{relTime(alert.sent_at)}</span>
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "#55556a", lineHeight: 1.55 }}>{alert.message}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                        <span style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.58rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", padding: "2px 7px", borderRadius: 5, background: dc.color + "18", color: dc.color }}>
                          {alertTagLabel(alert.alert_type, alert.severity)}
                        </span>
                        {isUnread && (
                          <button
                            onClick={() => markRead(alert.id)}
                            style={{ marginLeft: "auto", fontFamily: "var(--font-mono-family)", fontSize: "0.62rem", color: "#55556a", background: "none", border: "none", cursor: "pointer", padding: 0, transition: "color 0.2s" }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#00e5bf")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "#55556a")}
                          >
                            Marcar leído
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Emails panel */}
          <div className="dash-panel" style={{ animationDelay: "0.35s" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ fontSize: "0.95rem", fontWeight: 700, letterSpacing: "-0.01em", color: "#f0f0f5" }}>Emails monitorizados</div>
              <Link href="/dashboard/emails" style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.7rem", color: "#00e5bf", textDecoration: "none", fontWeight: 500, letterSpacing: "0.02em" }}>gestionar →</Link>
            </div>

            {emails.length === 0 ? (
              <div style={{ padding: "16px 0", textAlign: "center" }}>
                <p style={{ fontSize: "0.75rem", color: "#55556a", margin: "0 0 6px" }}>No hay emails monitorizados</p>
                <Link href="/dashboard/emails" style={{ fontSize: "0.72rem", color: "#00e5bf", textDecoration: "none" }}>Añadir email →</Link>
              </div>
            ) : (
              <div>
                {emails.map((e) => {
                  const isBreached = (e.breach_count ?? 0) > 0;
                  const initials   = e.email.slice(0, 2).toUpperCase();
                  return (
                    <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: "#1a1a26", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono-family)", fontSize: "0.6rem", fontWeight: 600, color: "#55556a" }}>
                        {initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.8rem", fontWeight: 500, color: "#f0f0f5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.email}</div>
                        <div style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.65rem", color: "#33334a", marginTop: 2 }}>
                          {e.last_checked_at ? relTime(e.last_checked_at) : "no verificado"}
                        </div>
                      </div>
                      <div style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.58rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", padding: "3px 8px", borderRadius: 6, background: isBreached ? "rgba(255,77,106,0.10)" : "rgba(34,197,94,0.10)", color: isBreached ? "#ff4d6a" : "#22c55e" }}>
                        {isBreached ? "Filtrado" : "Seguro"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Score breakdown */}
          <div className="dash-panel" style={{ animationDelay: "0.4s" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ fontSize: "0.95rem", fontWeight: 700, letterSpacing: "-0.01em", color: "#f0f0f5" }}>Desglose del Score</div>
            </div>
            {[
              { label: "SSL & Certificados", value: comp.ssl       },
              { label: "Uptime",             value: comp.uptime    },
              { label: "Seguridad Email",    value: comp.email_sec },
              { label: "Breach Detection",   value: comp.breach    },
            ].map((row) => (
              <div key={row.label} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: "0.75rem", color: "#55556a" }}>{row.label}</span>
                  <span style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.7rem", color: scoreColor(row.value) }}>{row.value}</span>
                </div>
                <div style={{ height: 3, borderRadius: 99, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 99, width: `${row.value}%`, background: scoreColor(row.value), transition: "width 1s cubic-bezier(0.4,0,0.2,1)", boxShadow: `0 0 6px ${scoreColor(row.value)}60` }} />
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
