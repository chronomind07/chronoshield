"use client";

import { useEffect, useState } from "react";
import { dashboardApi, emailsApi } from "@/lib/api";
import { useTechMode } from "@/lib/mode-context";
import Link from "next/link";
import toast from "react-hot-toast";

// ── Types ─────────────────────────────────────────────────────────────────────
interface DashboardSummary {
  domains_monitored:      number;
  emails_monitored:       number;
  active_alerts:          number;
  average_score:          number;
  domains_with_ssl_issues: number;
  domains_down:           number;
  breached_emails:        number;
  recent_alerts:          Alert[];
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
  return s >= 80 ? "#00E5A0" : s >= 60 ? "#FFB340" : "#FF4D6A";
}

/** Derive individual component scores from summary data */
function componentScores(s: DashboardSummary) {
  const td = Math.max(1, s.domains_monitored);
  const te = Math.max(1, s.emails_monitored);
  const ssl    = Math.round(Math.max(0, (1 - s.domains_with_ssl_issues / td) * 100));
  const uptime = Math.round(Math.max(0, (1 - s.domains_down / td) * 100));
  const breach = Math.round(Math.max(0, (1 - s.breached_emails / te) * 100));
  // reverse from: overall = breach*0.30 + ssl*0.25 + uptime*0.25 + email_sec*0.20
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

/** Alert type → tag label + color */
function alertTag(type: string, sev: string) {
  if (type?.includes("breach"))  return { label: "Breach",    bg: "rgba(255,77,106,0.1)",  color: "#FF4D6A" };
  if (type?.includes("ssl"))     return { label: "SSL",       bg: "rgba(0,119,255,0.1)",   color: "#0077FF" };
  if (type?.includes("uptime"))  return { label: "Uptime",    bg: "rgba(0,229,160,0.1)",   color: "#00E5A0" };
  if (type?.includes("email"))   return { label: "Email Sec.",bg: "rgba(255,179,64,0.1)",  color: "#FFB340" };
  if (sev === "critical")        return { label: "Crítico",   bg: "rgba(255,77,106,0.1)",  color: "#FF4D6A" };
  if (sev === "warning")         return { label: "Aviso",     bg: "rgba(255,179,64,0.1)",  color: "#FFB340" };
  return { label: "Info", bg: "rgba(0,194,255,0.1)", color: "#00C2FF" };
}

function alertDotColor(type: string, sev: string) {
  if (type?.includes("breach") || sev === "critical") return "#FF4D6A";
  if (type?.includes("email") || sev === "warning")   return "#FFB340";
  if (type?.includes("ssl"))                          return "#0077FF";
  if (type?.includes("uptime"))                       return "#00E5A0";
  return "#00C2FF";
}

// ── Score Ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const [animated, setAnimated] = useState(false);
  const circumference = 283; // 2*π*45 ≈ 282.74
  const offset = animated ? circumference * (1 - score / 100) : circumference;
  const col = scoreColor(score);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative w-[100px] h-[100px] shrink-0">
      <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0077FF" />
            <stop offset="100%" stopColor="#00C2FF" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle
          cx="50" cy="50" r="45"
          fill="none"
          stroke="url(#scoreGrad)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            filter: "drop-shadow(0 0 6px rgba(0,194,255,0.5))",
            transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-syne text-[26px] font-extrabold text-[#E8EDF2] leading-none">{score}</span>
        <span className="font-mono text-[10px] tracking-[1px] mt-0.5" style={{ color: col }}>
          {scoreGrade(score)}
        </span>
      </div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
type CardStatus = "ok" | "warn" | "danger";

function StatCard({
  status, iconBg, icon, badge, value, name, meta, techMode,
}: {
  status:   CardStatus;
  iconBg:   string;
  icon:     string;
  badge:    { text: string; class: "ok" | "warn" | "danger" };
  value:    React.ReactNode;
  name:     React.ReactNode;
  meta:     React.ReactNode;
  techMode: boolean;
}) {
  const borderColor = {
    ok:     "rgba(255,255,255,0.06)",
    warn:   "rgba(255,179,64,0.2)",
    danger: "rgba(255,77,106,0.2)",
  }[status];

  const barColor   = { ok: "#00E5A0", warn: "#FFB340", danger: "#FF4D6A" }[status];
  const barShadow  = { ok: "rgba(0,229,160,0.4)", warn: "rgba(255,179,64,0.4)", danger: "rgba(255,77,106,0.4)" }[status];
  const badgeStyle = {
    ok:     { bg: "rgba(0,229,160,0.1)",  color: "#00E5A0", border: "rgba(0,229,160,0.2)"  },
    warn:   { bg: "rgba(255,179,64,0.1)", color: "#FFB340", border: "rgba(255,179,64,0.2)" },
    danger: { bg: "rgba(255,77,106,0.1)", color: "#FF4D6A", border: "rgba(255,77,106,0.2)" },
  }[badge.class];

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 transition-all duration-200 hover:border-opacity-50"
      style={{ background: "#0D1218", border: `1px solid ${borderColor}` }}
    >
      <div className="flex items-center justify-between mb-3.5">
        <div
          className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center text-[15px]"
          style={{ background: iconBg }}
        >
          {icon}
        </div>
        <span
          className="font-mono text-[9px] uppercase tracking-[1px] px-2 py-px rounded-full border"
          style={{
            background: badgeStyle.bg,
            color: badgeStyle.color,
            borderColor: badgeStyle.border,
          }}
        >
          {badge.text}
        </span>
      </div>
      <div className="font-syne text-[24px] font-bold text-[#E8EDF2] leading-none mb-1">{value}</div>
      <div className="text-[12px] text-[#5A6B7A]">{name}</div>
      <div className="font-mono text-[11px] text-[#5A6B7A] mt-2">{meta}</div>
      {/* Bottom glow bar */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[2px]"
        style={{ background: barColor, boxShadow: `0 0 10px ${barShadow}` }}
      />
    </div>
  );
}

// ── Alert timeline ────────────────────────────────────────────────────────────
function AlertTimeline({ alerts, onRead, techMode }: {
  alerts:   Alert[];
  onRead:   (id: string) => void;
  techMode: boolean;
}) {
  if (alerts.length === 0) {
    return (
      <div className="py-8 flex flex-col items-center gap-2 text-center">
        <span className="text-2xl">✅</span>
        <p className="text-sm font-medium text-[#E8EDF2]">
          {techMode ? "Sin alertas activas" : "¡Todo en orden!"}
        </p>
        <p className="text-xs text-[#5A6B7A]">
          {techMode ? "No se han detectado incidencias" : "No hay problemas de seguridad ahora mismo"}
        </p>
      </div>
    );
  }

  return (
    <div>
      {alerts.map((alert, i) => {
        const tag      = alertTag(alert.alert_type, alert.severity);
        const dotColor = alertDotColor(alert.alert_type, alert.severity);
        const isUnread = !alert.read_at;
        const isLast   = i === alerts.length - 1;

        return (
          <div key={alert.id} className="flex gap-3.5 py-3.5" style={{ borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.06)" }}>
            {/* Dot + line */}
            <div className="flex flex-col items-center pt-1 gap-1 shrink-0">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor }} />
              {!isLast && <div className="w-px flex-1 min-h-[20px] bg-[rgba(255,255,255,0.06)]" />}
            </div>
            {/* Body */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="text-[13px] font-medium text-[#E8EDF2] leading-snug">
                  {techMode ? alert.title : (
                    <span>
                      {alert.severity === "critical" ? "🚨 " : alert.severity === "warning" ? "⚠ " : "✅ "}
                      {alert.title}
                    </span>
                  )}
                </div>
                <span className="font-mono text-[10px] text-[#5A6B7A] shrink-0">{relTime(alert.sent_at)}</span>
              </div>
              <p className="text-[12px] text-[#5A6B7A] leading-relaxed">{alert.message}</p>
              <div className="flex items-center gap-2 mt-1.5">
                {techMode && (
                  <span
                    className="font-mono text-[9px] uppercase tracking-[1px] px-1.5 py-0.5 rounded"
                    style={{ background: tag.bg, color: tag.color }}
                  >
                    {tag.label}
                  </span>
                )}
                {isUnread && (
                  <button
                    onClick={() => onRead(alert.id)}
                    className="text-[10px] text-[#5A6B7A] hover:text-[#00C2FF] transition-colors ml-auto"
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
  );
}

// ── Emails panel ──────────────────────────────────────────────────────────────
function EmailsPanel({ emails, techMode }: { emails: MonitoredEmail[]; techMode: boolean }) {
  if (emails.length === 0) {
    return (
      <div className="py-4 text-center">
        <p className="text-xs text-[#5A6B7A]">
          {techMode ? "No hay emails monitorizados" : "Añade emails para vigilarlos"}
        </p>
        <Link href="/dashboard/emails" className="text-[11px] text-[#00C2FF] mt-1 inline-block hover:underline">
          Añadir email →
        </Link>
      </div>
    );
  }

  return (
    <div>
      {emails.map((e) => {
        const isBreached = (e.breach_count ?? 0) > 0;
        const initial    = e.email.slice(0, 2).toUpperCase();
        return (
          <div key={e.id} className="flex items-center gap-3 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div
              className="w-[30px] h-[30px] rounded-lg flex items-center justify-center font-syne font-bold text-[11px] text-[#5A6B7A] shrink-0"
              style={{ background: "#121A22" }}
            >
              {initial}
            </div>
            <div className="flex-1 min-w-0 text-[12px] text-[#E8EDF2] truncate">{e.email}</div>
            <span
              className="font-mono text-[9px] uppercase tracking-[1px] px-2 py-px rounded-full border shrink-0"
              style={
                isBreached
                  ? { background: "rgba(255,77,106,0.1)", color: "#FF4D6A", borderColor: "rgba(255,77,106,0.2)" }
                  : { background: "rgba(0,229,160,0.1)",  color: "#00E5A0", borderColor: "rgba(0,229,160,0.2)" }
              }
            >
              {isBreached ? (techMode ? "Filtrado" : "⚠ Filtrado") : (techMode ? "Seguro" : "✓ Seguro")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Score breakdown ───────────────────────────────────────────────────────────
function ProgressRow({ labelTech, labelSimple, value, techMode }: {
  labelTech:   string;
  labelSimple: string;
  value:       number;
  techMode:    boolean;
}) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 300); return () => clearTimeout(t); }, []);
  const col = scoreColor(value);

  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[11px] text-[#5A6B7A]">{techMode ? labelTech : labelSimple}</span>
        <span className="font-mono text-[11px]" style={{ color: col }}>{value}</span>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: animated ? `${value}%` : "0%",
            background: col,
            transition: "width 1s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </div>
    </div>
  );
}

// ── Recommendation card ───────────────────────────────────────────────────────
function RecCard({ level, icon, title, desc, btnLabel, btnHref }: {
  level:    "urgent" | "warn" | "info";
  icon:     string;
  title:    string;
  desc:     string;
  btnLabel: string;
  btnHref:  string;
}) {
  const cfg = {
    urgent: { iconBg: "rgba(255,77,106,0.12)",  priBg: "rgba(255,77,106,0.12)",  priColor: "#FF4D6A", priBorder: "rgba(255,77,106,0.2)",  priText: "Urgente",    btnBg: "rgba(255,77,106,0.12)",  btnColor: "#FF4D6A" },
    warn:   { iconBg: "rgba(255,179,64,0.12)",  priBg: "rgba(255,179,64,0.12)",  priColor: "#FFB340", priBorder: "rgba(255,179,64,0.2)",  priText: "Importante", btnBg: "rgba(255,179,64,0.12)",  btnColor: "#FFB340" },
    info:   { iconBg: "rgba(0,194,255,0.10)",   priBg: "rgba(0,194,255,0.10)",   priColor: "#00C2FF", priBorder: "rgba(0,194,255,0.2)",   priText: "Todo bien",  btnBg: "rgba(0,194,255,0.10)",   btnColor: "#00C2FF" },
  }[level];

  return (
    <div
      className="flex gap-4 items-start rounded-2xl p-5 mb-3"
      style={{ background: "#0D1218", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
        style={{ background: cfg.iconBg }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-syne font-bold text-[14px] text-[#E8EDF2] mb-1">{title}</div>
        <div className="text-[13px] text-[#5A6B7A] leading-relaxed">{desc}</div>
        <Link
          href={btnHref}
          className="inline-block mt-2.5 text-[12px] font-semibold px-3.5 py-1.5 rounded-lg"
          style={{ background: cfg.btnBg, color: cfg.btnColor }}
        >
          {btnLabel}
        </Link>
      </div>
      <span
        className="font-mono text-[9px] uppercase tracking-[1px] px-2 py-1 rounded-full border shrink-0 mt-0.5"
        style={{ background: cfg.priBg, color: cfg.priColor, borderColor: cfg.priBorder }}
      >
        {cfg.priText}
      </span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { techMode, setTechMode } = useTechMode();
  const [summary, setSummary]     = useState<DashboardSummary | null>(null);
  const [emails, setEmails]       = useState<MonitoredEmail[]>([]);
  const [loading, setLoading]     = useState(true);

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

  useEffect(() => { load(); }, []);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-10 flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#00C2FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!summary) {
    return (
      <div className="p-10 flex flex-col items-center justify-center h-[60vh] gap-5 text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: "rgba(0,194,255,0.08)", border: "1px solid rgba(0,194,255,0.15)" }}
        >
          🛡
        </div>
        <div>
          <h2 className="font-syne text-xl font-bold text-[#E8EDF2]">
            Empieza añadiendo tu primer dominio
          </h2>
          <p className="text-sm text-[#5A6B7A] mt-1 max-w-xs">
            Monitoriza la seguridad de tus dominios y emails desde un solo lugar.
          </p>
        </div>
        <Link
          href="/dashboard/domains"
          className="inline-flex items-center gap-2 font-semibold text-sm px-5 py-2.5 rounded-xl text-[#080C10]"
          style={{ background: "linear-gradient(135deg, #0077FF, #00C2FF)" }}
        >
          Añadir dominio
        </Link>
      </div>
    );
  }

  const comp = componentScores(summary);
  const lastDomain = ""; // Could get from first domain

  return (
    <div className="p-9">

      {/* ── Topbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-7 fade-up">
        <div>
          <h1 className="font-syne font-bold text-[22px] text-[#E8EDF2]">
            {techMode ? "Overview" : "Tu seguridad"}
          </h1>
          <p className="text-[12px] text-[#5A6B7A] mt-0.5">
            {techMode ? "Security monitoring dashboard" : "Un resumen claro del estado de tu agencia"}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {/* Mode toggle */}
          <div
            className="flex items-center rounded-[10px] p-[3px]"
            style={{ background: "#121A22", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <button
              onClick={() => setTechMode(false)}
              className={`flex items-center gap-1.5 px-3.5 py-[7px] rounded-[7px] text-[12px] font-semibold transition-all duration-200 ${
                !techMode ? "bg-[#0D1218] text-[#E8EDF2] shadow-[0_1px_6px_rgba(0,0,0,0.4)]" : "text-[#5A6B7A]"
              }`}
            >
              <span>☀</span> Vista simple
            </button>
            <button
              onClick={() => setTechMode(true)}
              className={`flex items-center gap-1.5 px-3.5 py-[7px] rounded-[7px] text-[12px] font-semibold transition-all duration-200 ${
                techMode ? "bg-[#0D1218] text-[#E8EDF2] shadow-[0_1px_6px_rgba(0,0,0,0.4)]" : "text-[#5A6B7A]"
              }`}
            >
              <span>⚙</span> Técnico
            </button>
          </div>
          {/* Notification */}
          <div
            className="relative w-9 h-9 flex items-center justify-center rounded-lg text-[15px] cursor-pointer"
            style={{ background: "#0D1218", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            🔔
            {summary.active_alerts > 0 && (
              <span
                className="absolute top-[7px] right-[7px] w-[7px] h-[7px] rounded-full border-[1.5px] border-[#0D1218]"
                style={{ background: "#FF4D6A" }}
              />
            )}
          </div>
          {/* Scan button */}
          <button
            onClick={load}
            className="flex items-center gap-1.5 font-semibold text-[12px] text-white px-[18px] py-[9px] rounded-lg border-none cursor-pointer"
            style={{
              background: "linear-gradient(135deg, #0077FF, #00C2FF)",
              boxShadow: "0 0 20px rgba(0,194,255,0.2)",
            }}
          >
            ⟳ Escanear
          </button>
        </div>
      </div>

      {/* ── Scan bar ───────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-3.5 py-2.5 rounded-[10px] mb-6 fade-up"
        style={{ background: "rgba(0,194,255,0.04)", border: "1px solid rgba(0,194,255,0.12)" }}
      >
        <div className="w-2 h-2 rounded-full shrink-0 pulse-dot" style={{ background: "#00C2FF" }} />
        <span className={`${techMode ? "font-mono text-[10px] tracking-[0.5px]" : "text-[13px] font-medium"} text-[#00C2FF]`}>
          {techMode ? "MONITOREO ACTIVO" : "Vigilando tu empresa · todo bajo control"}
        </span>
        <span className={`${techMode ? "font-mono text-[10px]" : "text-[12px]"} text-[#5A6B7A] ml-auto`}>
          {summary.domains_monitored > 0
            ? (techMode ? `${summary.domains_monitored} dominio${summary.domains_monitored > 1 ? "s" : ""} activo${summary.domains_monitored > 1 ? "s" : ""}` : `próximo chequeo en breve`)
            : (techMode ? "sin dominios" : "añade tu web")}
        </span>
      </div>

      {/* ── Recommendation cards (simple mode) ─────────────────────────── */}
      {!techMode && (
        <div className="mb-6">
          {summary.breached_emails > 0 && (
            <RecCard
              level="urgent" icon="🚨"
              title={`${summary.breached_emails} contraseña${summary.breached_emails > 1 ? "s" : ""} de tu empresa ha${summary.breached_emails > 1 ? "n" : ""} sido filtrada${summary.breached_emails > 1 ? "s" : ""} en internet`}
              desc="Detectamos emails de tu empresa en bases de datos de hackers. Cambia esas contraseñas hoy mismo para proteger tu negocio."
              btnLabel="Ver emails afectados →" btnHref="/dashboard/emails"
            />
          )}
          {summary.domains_with_ssl_issues > 0 && (
            <RecCard
              level="warn" icon="⚠️"
              title="Tu email puede ser suplantado por estafadores"
              desc="No tienes activada una protección que impide que alguien envíe emails haciéndose pasar por ti. Un estafador podría escribir a tus clientes con tu nombre."
              btnLabel="Cómo solucionar esto →" btnHref="/dashboard/domains"
            />
          )}
          {summary.breached_emails === 0 && summary.domains_with_ssl_issues === 0 && summary.domains_down === 0 && (
            <RecCard
              level="info" icon="✅"
              title="Tu empresa está protegida"
              desc="No hemos detectado ningún problema de seguridad. ChronoShield sigue monitorizando 24/7. Volveremos a avisarte si algo cambia."
              btnLabel="Ver detalles →" btnHref="/dashboard/domains"
            />
          )}
        </div>
      )}

      {/* ── Score row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-[280px_1fr] gap-5 mb-5 fade-up">

        {/* Score card */}
        <div
          className="relative overflow-hidden rounded-2xl p-7"
          style={{ background: "#0D1218", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          {/* Glow orb */}
          <div
            className="absolute -top-[60px] -right-[60px] w-[180px] h-[180px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(0,119,255,0.12), transparent 70%)" }}
          />
          <div className="font-mono text-[10px] uppercase tracking-[2px] text-[#5A6B7A] mb-5">
            {techMode ? "Security Score" : <span className="font-syne text-[14px] font-bold normal-case tracking-normal text-[#E8EDF2]">Resumen de seguridad</span>}
          </div>
          <div className="flex items-center gap-6">
            <ScoreRing score={Math.round(summary.average_score)} />
            {/* Breakdown items */}
            <div className="flex-1 space-y-2.5">
              {[
                { dot: "#00E5A0", labelT: "SSL",         labelS: "Seguridad web",    val: comp.ssl,      col: scoreColor(comp.ssl)    },
                { dot: "#FFB340", labelT: "Email Sec.",  labelS: "Protección email", val: comp.email_sec,col: scoreColor(comp.email_sec)},
                { dot: "#FF4D6A", labelT: "Breaches",    labelS: "Datos filtrados",  val: comp.breach,   col: scoreColor(comp.breach)  },
                { dot: "#00E5A0", labelT: "Uptime",      labelS: "Uptime",           val: comp.uptime,   col: scoreColor(comp.uptime)  },
              ].map((item) => (
                <div key={item.labelT} className="flex items-center gap-2 text-[12px]">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: item.dot }} />
                  <span className="text-[#5A6B7A] flex-1">
                    {techMode ? item.labelT : item.labelS}
                  </span>
                  <span className="font-mono text-[11px]" style={{ color: item.col }}>{item.val}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Desc */}
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            {techMode ? (
              <>
                <div className="font-mono text-[10px] text-[#00C2FF] tracking-[1px] mb-1.5">
                  NIVEL: {summary.average_score >= 80 ? "BUENO" : summary.average_score >= 60 ? "MODERADO · MEJORABLE" : "CRÍTICO"}
                </div>
                <div className="text-[11px] text-[#5A6B7A] leading-relaxed">
                  {summary.active_alerts} alerta{summary.active_alerts !== 1 ? "s" : ""} activa{summary.active_alerts !== 1 ? "s" : ""}. {summary.breached_emails > 0 ? `${summary.breached_emails} emails comprometidos detectados.` : "Sin brechas detectadas."}
                </div>
              </>
            ) : (
              <>
                <div
                  className="font-syne font-bold text-[15px] mb-1.5"
                  style={{ color: summary.average_score >= 80 ? "#00E5A0" : summary.average_score >= 60 ? "#FFB340" : "#FF4D6A" }}
                >
                  {summary.average_score >= 80 ? "✓ Seguridad en buen estado" : summary.average_score >= 60 ? "⚠ Seguridad mejorable" : "🚨 Atención urgente necesaria"}
                </div>
                <div className="text-[13px] text-[#5A6B7A] leading-relaxed">
                  {summary.active_alerts > 0
                    ? `Tienes ${summary.active_alerts} cosa${summary.active_alerts > 1 ? "s" : ""} que solucionar. Mira las recomendaciones de arriba.`
                    : "Tu empresa está bien protegida en este momento."}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Status cards 3×2 */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            status={summary.domains_with_ssl_issues === 0 ? "ok" : "warn"}
            iconBg="rgba(0,229,160,0.10)" icon="🔒"
            badge={{ text: summary.domains_with_ssl_issues === 0 ? "Seguro" : "Atención", class: summary.domains_with_ssl_issues === 0 ? "ok" : "warn" }}
            value={<><span className="tech-only">SSL</span>{!techMode && <span style={{fontSize:18}}>Candado web</span>}</>}
            name={techMode ? "Certificado activo" : "Tu web es segura para clientes"}
            meta={techMode ? `${summary.domains_with_ssl_issues} issues · ${summary.domains_monitored} dominios` : summary.domains_with_ssl_issues === 0 ? "El certificado está en perfecto estado" : `${summary.domains_with_ssl_issues} dominio con problema`}
            techMode={techMode}
          />
          <StatCard
            status={comp.email_sec >= 80 ? "ok" : comp.email_sec >= 60 ? "warn" : "danger"}
            iconBg="rgba(255,179,64,0.10)" icon="✉"
            badge={{ text: comp.email_sec >= 80 ? "Protegido" : "Atención", class: comp.email_sec >= 80 ? "ok" : "warn" }}
            value={techMode ? "SPF" : <span style={{fontSize:18}}>Tu email</span>}
            name={techMode ? "Email Security" : comp.email_sec >= 80 ? "Emails protegidos" : "Puede ser suplantado"}
            meta={techMode ? `Score: ${comp.email_sec}` : comp.email_sec >= 80 ? "SPF, DKIM y DMARC activos" : "Revisa la configuración DMARC"}
            techMode={techMode}
          />
          <StatCard
            status={summary.domains_down === 0 ? "ok" : "danger"}
            iconBg="rgba(0,119,255,0.12)" icon="↑"
            badge={{ text: summary.domains_down === 0 ? "Online" : "Caído", class: summary.domains_down === 0 ? "ok" : "danger" }}
            value={`${comp.uptime}%`}
            name={techMode ? "Uptime 30 días" : "Disponibilidad web"}
            meta={techMode ? `${summary.domains_down} dominio${summary.domains_down !== 1 ? "s" : ""} caído${summary.domains_down !== 1 ? "s" : ""}` : summary.domains_down === 0 ? "Tu web está funcionando" : `${summary.domains_down} web caída ahora`}
            techMode={techMode}
          />
          <StatCard
            status={summary.breached_emails === 0 ? "ok" : "danger"}
            iconBg="rgba(255,77,106,0.10)" icon="⚠"
            badge={{ text: summary.breached_emails === 0 ? "Limpio" : "Alerta", class: summary.breached_emails === 0 ? "ok" : "danger" }}
            value={summary.breached_emails}
            name={techMode ? "Emails filtrados" : "Contraseñas expuestas"}
            meta={techMode ? `de ${summary.emails_monitored} emails monitorizados` : summary.breached_emails === 0 ? "Ningún email comprometido" : `${summary.breached_emails} cuenta${summary.breached_emails > 1 ? "s" : ""} en hackeos conocidos`}
            techMode={techMode}
          />
          <StatCard
            status="ok"
            iconBg="rgba(0,229,160,0.10)" icon="◎"
            badge={{ text: "Activo", class: "ok" }}
            value={summary.domains_monitored}
            name={techMode ? "Dominios monitorizados" : "Webs vigiladas"}
            meta={techMode ? "Monitoreo continuo activo" : "Vigiladas 24/7 automáticamente"}
            techMode={techMode}
          />
          <StatCard
            status={summary.active_alerts === 0 ? "ok" : "warn"}
            iconBg="rgba(0,119,255,0.12)" icon="⚡"
            badge={{ text: summary.active_alerts === 0 ? "Normal" : `${summary.active_alerts} nuevas`, class: summary.active_alerts === 0 ? "ok" : "warn" }}
            value={summary.active_alerts}
            name={techMode ? "Alertas activas" : "Avisos pendientes"}
            meta={techMode ? `${summary.emails_monitored} emails vigilados` : summary.active_alerts === 0 ? "Sin incidencias pendientes" : "Revisa las alertas abajo"}
            techMode={techMode}
          />
        </div>
      </div>

      {/* ── Bottom row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-[1fr_340px] gap-5">

        {/* Alerts panel */}
        <div
          className="rounded-2xl p-6 fade-up"
          style={{ background: "#0D1218", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-syne font-bold text-[15px] text-[#E8EDF2]">
              {techMode ? "Alertas recientes" : "¿Qué ha pasado últimamente?"}
            </h2>
            {summary.active_alerts > 0 && (
              <span className="font-mono text-[9px] uppercase tracking-[1px] px-2.5 py-1 rounded-full"
                style={{ background: "rgba(255,77,106,0.1)", color: "#FF4D6A", border: "1px solid rgba(255,77,106,0.2)" }}>
                {summary.active_alerts} sin leer
              </span>
            )}
          </div>
          <AlertTimeline alerts={summary.recent_alerts} onRead={markRead} techMode={techMode} />
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-5">

          {/* Emails panel */}
          <div
            className="rounded-2xl p-6 fade-up"
            style={{ background: "#0D1218", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-syne font-bold text-[15px] text-[#E8EDF2]">Emails monitorizados</h2>
              <Link href="/dashboard/emails" className="font-mono text-[11px] text-[#00C2FF] hover:underline">
                Gestionar →
              </Link>
            </div>
            <EmailsPanel emails={emails} techMode={techMode} />
          </div>

          {/* Score breakdown */}
          <div
            className="rounded-2xl p-6 fade-up"
            style={{ background: "#0D1218", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="mb-4">
              <h2 className="font-syne font-bold text-[15px] text-[#E8EDF2]">
                {techMode ? "Desglose del Score" : "Tu puntuación explicada"}
              </h2>
            </div>
            <ProgressRow labelTech="SSL & Certificados" labelSimple="🔒 Seguridad web"      value={comp.ssl}       techMode={techMode} />
            <ProgressRow labelTech="Uptime"             labelSimple="↑ Disponibilidad web"  value={comp.uptime}    techMode={techMode} />
            <ProgressRow labelTech="Seguridad Email"    labelSimple="✉ Protección email"    value={comp.email_sec} techMode={techMode} />
            <ProgressRow labelTech="Breach Detection"   labelSimple="🔑 Datos filtrados"    value={comp.breach}    techMode={techMode} />
          </div>

        </div>
      </div>
    </div>
  );
}
