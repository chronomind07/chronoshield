"use client";

import { useEffect, useState } from "react";
import { dashboardApi } from "@/lib/api";
import { useTechMode } from "@/lib/mode-context";
import toast from "react-hot-toast";
import Link from "next/link";

interface DashboardSummary {
  domains_monitored: number;
  emails_monitored: number;
  active_alerts: number;
  average_score: number;
  domains_with_ssl_issues: number;
  domains_down: number;
  breached_emails: number;
  recent_alerts: Alert[];
}

interface Alert {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  sent_at: string;
  read_at: string | null;
}

// ─── Score Ring ──────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const [animated, setAnimated] = useState(false);
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const grade =
    score >= 95 ? "A+" : score >= 90 ? "A" : score >= 80 ? "B" :
    score >= 70 ? "C" : score >= 60 ? "D" : "F";
  const color =
    score >= 80 ? "#00E5A0" : score >= 60 ? "#F59E0B" : "#FF4757";
  const offset = animated ? circumference * (1 - score / 100) : circumference;

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 120);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        viewBox="0 0 120 120"
        className="w-36 h-36"
        style={{ transform: "rotate(-90deg)" }}
      >
        {/* Track */}
        <circle
          cx="60" cy="60" r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="8"
        />
        {/* Progress */}
        <circle
          cx="60" cy="60" r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-3xl font-bold text-white leading-none">
          {score}
        </span>
        <span className="font-mono text-sm font-semibold mt-0.5" style={{ color }}>
          {grade}
        </span>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
type BarColor = "green" | "yellow" | "red" | "brand";

const BAR_COLORS: Record<BarColor, string> = {
  green:  "#00E5A0",
  yellow: "#F59E0B",
  red:    "#FF4757",
  brand:  "#00C2FF",
};

function StatCard({
  label,
  labelSimple,
  value,
  barColor,
  techMode,
}: {
  label: string;
  labelSimple: string;
  value: number | string;
  barColor: BarColor;
  techMode: boolean;
}) {
  return (
    <div className="relative bg-[#0D1117] border border-white/[0.06] rounded-xl p-5 overflow-hidden flex flex-col gap-2">
      <p className="text-xs text-slate-500 leading-snug">
        {techMode ? label : labelSimple}
      </p>
      <p className="font-mono text-2xl font-bold text-white">{value}</p>
      {/* Bottom color bar */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[3px]"
        style={{ backgroundColor: BAR_COLORS[barColor] }}
      />
    </div>
  );
}

// ─── Alert Timeline ───────────────────────────────────────────────────────────
const SEVERITY_DOT: Record<string, string> = {
  critical: "#FF4757",
  warning:  "#F59E0B",
  info:     "#00C2FF",
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: "Crítico",
  warning:  "Aviso",
  info:     "Info",
};

function AlertTimeline({
  alerts,
  onRead,
  techMode,
}: {
  alerts: Alert[];
  onRead: (id: string) => void;
  techMode: boolean;
}) {
  if (alerts.length === 0) {
    return (
      <div className="bg-[#0D1117] border border-white/[0.06] rounded-xl p-8 flex flex-col items-center gap-3 text-center">
        <div className="w-10 h-10 rounded-full bg-[#00E5A0]/10 flex items-center justify-center">
          <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
            <path d="M5 10 L8.5 13.5 L15 7" stroke="#00E5A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-300">
          {techMode ? "Sin alertas activas" : "¡Todo en orden!"}
        </p>
        <p className="text-xs text-slate-600">
          {techMode
            ? "No se han detectado incidencias."
            : "No hay problemas de seguridad en este momento."}
        </p>
      </div>
    );
  }

  return (
    <div className="relative pl-5">
      {/* Vertical line */}
      <div className="absolute left-[7px] top-3 bottom-3 w-px bg-white/[0.06]" />

      <div className="space-y-3">
        {alerts.map((alert) => {
          const dotColor = SEVERITY_DOT[alert.severity] || "#00C2FF";
          const isUnread = !alert.read_at;

          return (
            <div key={alert.id} className="relative flex gap-4">
              {/* Dot */}
              <div
                className="relative z-10 mt-3.5 w-3 h-3 rounded-full shrink-0 ring-2 ring-[#080C10]"
                style={{ backgroundColor: dotColor, marginLeft: "-1.5px" }}
              />

              {/* Card */}
              <div
                className={`flex-1 bg-[#0D1117] border rounded-xl p-4 transition-opacity ${
                  isUnread
                    ? "border-white/[0.08] opacity-100"
                    : "border-white/[0.04] opacity-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded"
                        style={{
                          color: dotColor,
                          backgroundColor: `${dotColor}18`,
                        }}
                      >
                        {SEVERITY_LABEL[alert.severity] || alert.severity}
                      </span>
                      {isUnread && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00C2FF]" />
                      )}
                    </div>
                    <p className="text-sm font-medium text-slate-200 leading-snug">
                      {alert.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {alert.message}
                    </p>
                  </div>
                  {isUnread && (
                    <button
                      onClick={() => onRead(alert.id)}
                      className="text-[11px] text-slate-600 hover:text-[#00C2FF] transition-colors shrink-0 mt-0.5"
                    >
                      Leído
                    </button>
                  )}
                </div>
                <p className="font-mono text-[10px] text-slate-700 mt-2">
                  {new Date(alert.sent_at).toLocaleString("es-ES")}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Recommendations (simple mode) ────────────────────────────────────────────
function Recommendation({
  icon, title, body, level,
}: {
  icon: string; title: string; body: string; level: "ok" | "warn" | "danger";
}) {
  const border = { ok: "border-[#00E5A0]/20", warn: "border-[#F59E0B]/20", danger: "border-[#FF4757]/20" }[level];
  const bg    = { ok: "bg-[#00E5A0]/05", warn: "bg-[#F59E0B]/05", danger: "bg-[#FF4757]/05" }[level];

  return (
    <div className={`flex items-start gap-3 bg-[#0D1117] ${bg} border ${border} rounded-xl p-4`}>
      <span className="text-xl shrink-0 mt-0.5">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-slate-200">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { techMode } = useTechMode();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSummary = async () => {
    try {
      const res = await dashboardApi.summary();
      setSummary(res.data);
    } catch {
      toast.error("Error al cargar el dashboard");
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (alertId: string) => {
    await dashboardApi.markAlertRead(alertId);
    setSummary((prev) =>
      prev
        ? {
            ...prev,
            recent_alerts: prev.recent_alerts.map((a) =>
              a.id === alertId ? { ...a, read_at: new Date().toISOString() } : a
            ),
            active_alerts: Math.max(0, prev.active_alerts - 1),
          }
        : prev
    );
  };

  useEffect(() => {
    loadSummary();
  }, []);

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#00C2FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ─── Empty state ───────────────────────────────────────────────────────────
  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-5 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#00C2FF]/10 flex items-center justify-center">
          <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8">
            <path d="M16 3 L28 8 L28 17 C28 23.5 22.5 28.5 16 30 C9.5 28.5 4 23.5 4 17 L4 8 Z"
              fill="rgba(0,194,255,0.12)" stroke="#00C2FF" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M11.5 16.5 L14.5 19.5 L20.5 13" stroke="#00C2FF" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <h2 className="font-syne text-lg font-bold text-white">
            Empieza añadiendo tu primer dominio
          </h2>
          <p className="text-sm text-slate-500 mt-1 max-w-xs">
            Monitoriza la seguridad de tus dominios y emails desde un solo lugar.
          </p>
        </div>
        <Link
          href="/dashboard/domains"
          className="inline-flex items-center gap-2 bg-[#00C2FF] text-[#080C10] text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#00C2FF]/90 transition-colors"
        >
          Añadir dominio
        </Link>
      </div>
    );
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const scoreColor = (n: number): BarColor =>
    n > 0 ? "red" : "green";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-syne text-2xl font-bold text-white">
          {techMode ? "Security Overview" : "Tu seguridad hoy"}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {techMode
            ? "Real-time monitoring dashboard"
            : "Un resumen claro del estado de tu agencia"}
        </p>
      </div>

      {/* Score + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-5">
        {/* Score ring card */}
        <div className="bg-[#0D1117] border border-white/[0.06] rounded-xl p-6 flex flex-col items-center justify-center gap-3 min-w-[180px]">
          <ScoreRing score={summary.average_score} />
          <p className="text-xs text-slate-500">
            {techMode ? "Security Score" : "Nivel de seguridad"}
          </p>
        </div>

        {/* Stat cards grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard
            label="Domains monitored"
            labelSimple="Webs vigiladas"
            value={summary.domains_monitored}
            barColor="brand"
            techMode={techMode}
          />
          <StatCard
            label="Emails monitored"
            labelSimple="Emails vigilados"
            value={summary.emails_monitored}
            barColor="brand"
            techMode={techMode}
          />
          <StatCard
            label="Active alerts"
            labelSimple="Alertas activas"
            value={summary.active_alerts}
            barColor={scoreColor(summary.active_alerts)}
            techMode={techMode}
          />
          <StatCard
            label="SSL issues"
            labelSimple="Problemas de seguridad web"
            value={summary.domains_with_ssl_issues}
            barColor={summary.domains_with_ssl_issues > 0 ? "yellow" : "green"}
            techMode={techMode}
          />
          <StatCard
            label="Domains down"
            labelSimple="Webs caídas"
            value={summary.domains_down}
            barColor={scoreColor(summary.domains_down)}
            techMode={techMode}
          />
          <StatCard
            label="Breached emails"
            labelSimple="Emails comprometidos"
            value={summary.breached_emails}
            barColor={scoreColor(summary.breached_emails)}
            techMode={techMode}
          />
        </div>
      </div>

      {/* Recommendations — simple mode only */}
      {!techMode && (
        <div className="space-y-3">
          <h2 className="font-syne text-base font-bold text-white">
            ¿Qué debes hacer?
          </h2>
          {summary.domains_down > 0 && (
            <Recommendation
              icon="🔴"
              title="Tu web está caída"
              body="Los visitantes no pueden acceder. Contacta a tu proveedor de hosting o revisa el servidor."
              level="danger"
            />
          )}
          {summary.domains_with_ssl_issues > 0 && (
            <Recommendation
              icon="🔒"
              title="Certificado de seguridad con problemas"
              body="Tus clientes ven un aviso de 'sitio no seguro'. Renueva el certificado SSL cuanto antes."
              level="warn"
            />
          )}
          {summary.breached_emails > 0 && (
            <Recommendation
              icon="📧"
              title="Email filtrado en brecha de datos"
              body="Una de tus direcciones apareció en una filtración. Cambia esa contraseña inmediatamente."
              level="danger"
            />
          )}
          {summary.active_alerts === 0 &&
            summary.domains_down === 0 &&
            summary.breached_emails === 0 && (
              <Recommendation
                icon="✅"
                title="Todo en orden"
                body="No hay problemas detectados. Tus sistemas están funcionando correctamente."
                level="ok"
              />
            )}
        </div>
      )}

      {/* Alerts timeline */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-syne text-base font-bold text-white">
            {techMode ? "Recent Alerts" : "Últimos avisos"}
          </h2>
          {summary.active_alerts > 0 && (
            <span className="font-mono text-xs text-[#FF4757] bg-[#FF4757]/10 px-2.5 py-1 rounded-full">
              {summary.active_alerts} sin leer
            </span>
          )}
        </div>
        <AlertTimeline
          alerts={summary.recent_alerts}
          onRead={markRead}
          techMode={techMode}
        />
      </div>
    </div>
  );
}
