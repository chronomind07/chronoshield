"use client";

import { useEffect, useState, useCallback } from "react";
import { alertsApi } from "@/lib/api";
import toast from "react-hot-toast";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Alert {
  id: string;
  alert_type: string;
  severity: string;
  severity_label: string;
  title: string;
  message: string;
  human_impact: string;
  fix_steps: string[];
  sent_at: string;
  read_at: string | null;
  domain_id: string | null;
  is_unread: boolean;
}

interface AlertsData {
  total: number;
  unread_count: number;
  alerts: Alert[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

// ── Severity config ────────────────────────────────────────────────────────────
const SEV_CONFIG: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  critical: {
    color: "#FF4D6A",
    bg: "rgba(255,77,106,0.06)",
    border: "rgba(255,77,106,0.2)",
    dot: "#FF4D6A",
  },
  high: {
    color: "#FF8C42",
    bg: "rgba(255,140,66,0.06)",
    border: "rgba(255,140,66,0.2)",
    dot: "#FF8C42",
  },
  medium: {
    color: "#FFB340",
    bg: "rgba(255,179,64,0.06)",
    border: "rgba(255,179,64,0.2)",
    dot: "#FFB340",
  },
  low: {
    color: "#00C2FF",
    bg: "rgba(0,194,255,0.04)",
    border: "rgba(0,194,255,0.12)",
    dot: "#00C2FF",
  },
};

// ── Alert card ─────────────────────────────────────────────────────────────────
function AlertCard({ alert, onMarkRead }: { alert: Alert; onMarkRead: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [marking, setMarking] = useState(false);
  const sev = SEV_CONFIG[alert.severity] ?? SEV_CONFIG.low;

  const handleMarkRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!alert.is_unread || marking) return;
    setMarking(true);
    try {
      await alertsApi.markRead(alert.id);
      onMarkRead(alert.id);
    } catch {
      toast.error("No se pudo marcar como leída");
    } finally {
      setMarking(false);
    }
  };

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        background: alert.is_unread ? sev.bg : "#0A0F14",
        border: `1px solid ${alert.is_unread ? sev.border : "rgba(255,255,255,0.05)"}`,
      }}
    >
      {/* ── Header row ── */}
      <button
        className="w-full flex items-start gap-4 px-5 py-4 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Severity dot */}
        <div className="mt-1 flex flex-col items-center gap-1.5 shrink-0">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{
              background: sev.dot,
              boxShadow: alert.is_unread ? `0 0 8px ${sev.dot}88` : "none",
            }}
          />
          {alert.is_unread && (
            <div className="w-[1px] flex-1 min-h-[16px]" style={{ background: `${sev.dot}33` }} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="font-mono text-[9px] uppercase tracking-[1.5px] px-2 py-px rounded-full shrink-0 font-bold"
                style={{ color: sev.color, background: `${sev.color}18` }}
              >
                {alert.severity_label}
              </span>
              <h3
                className="font-syne font-bold text-[14px] leading-tight"
                style={{ color: alert.is_unread ? "#E8EDF2" : "#9AACBA" }}
              >
                {alert.title}
              </h3>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-[#5A6B7A] whitespace-nowrap">
                {relTime(alert.sent_at)}
              </span>
              <span className="text-[#5A6B7A] text-xs">{expanded ? "▲" : "▼"}</span>
            </div>
          </div>

          <p className="text-[12px] text-[#5A6B7A] mt-1 leading-relaxed line-clamp-2">
            {alert.message}
          </p>
        </div>
      </button>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div
          className="px-5 pb-5"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
        >
          {/* Human impact */}
          <div
            className="mt-4 rounded-xl p-4"
            style={{ background: `${sev.color}0D`, border: `1px solid ${sev.color}22` }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">⚠️</span>
              <span
                className="font-mono text-[9px] uppercase tracking-[1.5px] font-bold"
                style={{ color: sev.color }}
              >
                Impacto en tu negocio
              </span>
            </div>
            <p className="text-[12px] leading-relaxed" style={{ color: "#D0DCE8" }}>
              {alert.human_impact}
            </p>
          </div>

          {/* Fix steps */}
          <div
            className="mt-3 rounded-xl p-4"
            style={{ background: "rgba(0,229,160,0.04)", border: "1px solid rgba(0,229,160,0.12)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">🔧</span>
              <span className="font-mono text-[9px] uppercase tracking-[1.5px] font-bold text-[#00E5A0]">
                Cómo solucionarlo
              </span>
            </div>
            <ol className="space-y-2">
              {alert.fix_steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center font-mono text-[9px] font-bold shrink-0 mt-px"
                    style={{ background: "rgba(0,229,160,0.15)", color: "#00E5A0" }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-[12px] text-[#9AACBA] leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-4">
            <span className="text-[10px] text-[#5A6B7A]">
              {fmtDate(alert.sent_at)}
            </span>
            {alert.is_unread ? (
              <button
                onClick={handleMarkRead}
                disabled={marking}
                className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                style={{ background: "rgba(255,255,255,0.04)", color: "#5A6B7A", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <span>{marking ? "…" : "✓"}</span>
                Marcar como leída
              </button>
            ) : (
              <span className="text-[10px] text-[#5A6B7A] flex items-center gap-1">
                <span className="text-[#00E5A0]">✓</span> Leída{" "}
                {alert.read_at ? relTime(alert.read_at) : ""}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section group ──────────────────────────────────────────────────────────────
function AlertGroup({
  label, color, alerts, onMarkRead,
}: {
  label: string;
  color: string;
  alerts: Alert[];
  onMarkRead: (id: string) => void;
}) {
  if (alerts.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
        <h2 className="font-mono text-[10px] uppercase tracking-[2px]" style={{ color }}>
          {label}
        </h2>
        <span
          className="font-mono text-[9px] px-1.5 py-px rounded-full"
          style={{ color, background: `${color}18` }}
        >
          {alerts.length}
        </span>
        <div className="flex-1 h-px" style={{ background: `${color}20` }} />
      </div>
      <div className="space-y-2">
        {alerts.map((a) => (
          <AlertCard key={a.id} alert={a} onMarkRead={onMarkRead} />
        ))}
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-5">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl"
        style={{ background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.15)" }}
      >
        🛡
      </div>
      <div className="text-center">
        <h3 className="font-syne font-bold text-[18px] text-[#E8EDF2] mb-2">
          Todo está en orden
        </h3>
        <p className="text-[13px] text-[#5A6B7A] max-w-xs leading-relaxed">
          No tienes alertas activas. Tus sistemas de seguridad están monitorizados
          y te avisaremos si se detecta cualquier problema.
        </p>
      </div>
      <div
        className="flex items-center gap-2 px-4 py-2 rounded-full"
        style={{ background: "rgba(0,229,160,0.06)", border: "1px solid rgba(0,229,160,0.12)" }}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-[#00E5A0] pulse-dot" />
        <span className="font-mono text-[10px] text-[#00E5A0] tracking-[1px]">
          MONITOREO ACTIVO
        </span>
      </div>
    </div>
  );
}

// ── Filter bar ─────────────────────────────────────────────────────────────────
function FilterBar({
  activeFilter,
  onChange,
  counts,
}: {
  activeFilter: string;
  onChange: (f: string) => void;
  counts: { all: number; critical: number; medium: number; low: number; unread: number };
}) {
  const filters = [
    { key: "all",      label: "Todas",    count: counts.all },
    { key: "unread",   label: "No leídas", count: counts.unread },
    { key: "critical", label: "Críticas",  count: counts.critical },
    { key: "medium",   label: "Medias",    count: counts.medium },
    { key: "low",      label: "Bajas",     count: counts.low },
  ];

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {filters.map((f) => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
          style={
            activeFilter === f.key
              ? { background: "rgba(0,194,255,0.1)", color: "#00C2FF", border: "1px solid rgba(0,194,255,0.2)" }
              : { background: "rgba(255,255,255,0.03)", color: "#5A6B7A", border: "1px solid rgba(255,255,255,0.06)" }
          }
        >
          {f.label}
          {f.count > 0 && (
            <span
              className="font-mono text-[9px] px-1 rounded"
              style={{ background: activeFilter === f.key ? "rgba(0,194,255,0.15)" : "rgba(255,255,255,0.06)" }}
            >
              {f.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AlertsPage() {
  const [data, setData]         = useState<AlertsData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("all");
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await alertsApi.list();
      setData(res.data);
    } catch {
      toast.error("Error al cargar las alertas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleMarkRead = useCallback((id: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        unread_count: Math.max(0, prev.unread_count - 1),
        alerts: prev.alerts.map((a) =>
          a.id === id ? { ...a, is_unread: false, read_at: new Date().toISOString() } : a
        ),
      };
    });
  }, []);

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await alertsApi.markAllRead();
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          unread_count: 0,
          alerts: prev.alerts.map((a) => ({
            ...a,
            is_unread: false,
            read_at: a.read_at ?? new Date().toISOString(),
          })),
        };
      });
      toast.success("Todas las alertas marcadas como leídas");
    } catch {
      toast.error("Error al marcar alertas");
    } finally {
      setMarkingAll(false);
    }
  };

  if (loading) {
    return (
      <div className="p-10 flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#00C2FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  // Filter alerts
  const filteredAlerts = data.alerts.filter((a) => {
    if (filter === "unread") return a.is_unread;
    if (filter === "critical") return a.severity === "critical" || a.severity === "high";
    if (filter === "medium") return a.severity === "medium";
    if (filter === "low") return a.severity === "low";
    return true; // all
  });

  const criticals = filteredAlerts.filter((a) => a.severity === "critical" || a.severity === "high");
  const mediums   = filteredAlerts.filter((a) => a.severity === "medium");
  const lows      = filteredAlerts.filter((a) => a.severity === "low");

  const counts = {
    all:      data.total,
    unread:   data.unread_count,
    critical: data.alerts.filter((a) => a.severity === "critical" || a.severity === "high").length,
    medium:   data.alerts.filter((a) => a.severity === "medium").length,
    low:      data.alerts.filter((a) => a.severity === "low").length,
  };

  return (
    <div className="p-9">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-7 fade-up">
        <div>
          <h1 className="font-syne font-bold text-[22px] text-[#E8EDF2]">Alertas de seguridad</h1>
          <p className="text-[12px] text-[#5A6B7A] mt-0.5">
            {data.unread_count > 0
              ? `${data.unread_count} alerta${data.unread_count !== 1 ? "s" : ""} sin leer · ${data.total} total`
              : `${data.total} alerta${data.total !== 1 ? "s" : ""} · todo al día`}
          </p>
        </div>
        {data.unread_count > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="flex items-center gap-1.5 text-[12px] font-semibold px-4 py-2 rounded-lg transition-all disabled:opacity-50"
            style={{
              background: "rgba(255,255,255,0.04)",
              color: "#5A6B7A",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {markingAll ? "⟳" : "✓"} Marcar todas como leídas
          </button>
        )}
      </div>

      {/* ── Filters ── */}
      {data.total > 0 && (
        <div className="mb-6 fade-up">
          <FilterBar activeFilter={filter} onChange={setFilter} counts={counts} />
        </div>
      )}

      {/* ── Alert groups or empty ── */}
      {filteredAlerts.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8 fade-up">
          <AlertGroup
            label="Críticas"
            color="#FF4D6A"
            alerts={criticals}
            onMarkRead={handleMarkRead}
          />
          <AlertGroup
            label="Medias"
            color="#FFB340"
            alerts={mediums}
            onMarkRead={handleMarkRead}
          />
          <AlertGroup
            label="Bajas"
            color="#00C2FF"
            alerts={lows}
            onMarkRead={handleMarkRead}
          />
        </div>
      )}
    </div>
  );
}
