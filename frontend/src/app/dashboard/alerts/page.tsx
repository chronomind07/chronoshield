"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { alertsApi } from "@/lib/api";
import { toast } from "@/components/Toast";
import { useTranslation } from "@/contexts/LanguageContext";

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
function fmtDate(iso: string, lang = "es") {
  return new Date(iso).toLocaleDateString(lang === "en" ? "en-US" : "es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relTime(iso: string, lang = "es") {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return lang === "en" ? "now" : "ahora";
  if (m < 60) return lang === "en" ? `${m}m ago` : `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return lang === "en" ? `${h}h ago` : `hace ${h}h`;
  return lang === "en" ? `${Math.floor(h / 24)}d ago` : `hace ${Math.floor(h / 24)}d`;
}

// ── Severity config ────────────────────────────────────────────────────────────
const SEV_CONFIG: Record<string, { color: string; bg: string; border: string; dot: string; leftBorder: string }> = {
  critical: {
    color: "#ef4444",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.15)",
    dot: "#ef4444",
    leftBorder: "#ef4444",
  },
  high: {
    color: "#ef4444",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.15)",
    dot: "#ef4444",
    leftBorder: "#ef4444",
  },
  medium: {
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.15)",
    dot: "#f59e0b",
    leftBorder: "#f59e0b",
  },
  low: {
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.08)",
    border: "rgba(59,130,246,0.15)",
    dot: "#3b82f6",
    leftBorder: "#3b82f6",
  },
};


// ── Alert card ─────────────────────────────────────────────────────────────────
function AlertCard({
  alert,
  onMarkRead,
  onArchive,
  archivingId,
}: {
  alert: Alert;
  onMarkRead: (id: string) => void;
  onArchive: (id: string) => void;
  archivingId: string | null;
}) {
  const { t, lang } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [marking, setMarking]   = useState(false);
  const sev = SEV_CONFIG[alert.severity] ?? SEV_CONFIG.low;

  const handleMarkRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!alert.is_unread || marking) return;
    setMarking(true);
    try {
      await alertsApi.markRead(alert.id);
      onMarkRead(alert.id);
    } catch {
      toast.error(t("alerts.errorMarkOne"));
    } finally {
      setMarking(false);
    }
  };

  return (
    <div
      className="cs-domain-item"
      style={{
        background: "#151515",
        border: "0.8px solid #1a1a1a",
        borderRadius: 16,
        marginBottom: 8,
        overflow: "hidden",
        borderLeft: `3px solid ${alert.is_unread ? sev.leftBorder : "#1a1a1a"}`,
        transition: "border-color 0.2s",
      }}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
          padding: "16px 20px",
          textAlign: "left",
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
      >
        {/* Severity dot */}
        <div style={{ flexShrink: 0, marginTop: 5 }}>
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: alert.is_unread ? sev.dot : "#3f3f46",
            }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {/* Severity badge */}
              <span
                style={{
                  fontFamily: "var(--font-dm-mono)",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  padding: "2px 8px",
                  borderRadius: 6,
                  fontWeight: 600,
                  flexShrink: 0,
                  color: sev.color,
                  background: sev.bg,
                  border: `0.8px solid ${sev.border}`,
                }}
              >
                {alert.severity_label}
              </span>
              {/* Type badge */}
              <span
                style={{
                  fontFamily: "var(--font-dm-mono)",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  padding: "2px 8px",
                  borderRadius: 6,
                  fontWeight: 600,
                  flexShrink: 0,
                  color: "#71717a",
                  background: "rgba(255,255,255,0.04)",
                  border: "0.8px solid #1a1a1a",
                }}
              >
                {alert.alert_type.replace(/_/g, " ")}
              </span>
              {/* Title */}
              <span
                style={{
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  color: alert.is_unread ? "#f5f5f5" : "#71717a",
                  lineHeight: 1.3,
                }}
              >
                {alert.title}
              </span>
            </div>
            {/* Right side: timestamp + chevron + trash */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <span
                style={{
                  fontFamily: "var(--font-dm-mono)",
                  fontSize: "0.65rem",
                  color: "#71717a",
                  whiteSpace: "nowrap",
                }}
              >
                {relTime(alert.sent_at, lang)}
              </span>
              {alert.is_unread && (
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#3ecf8e",
                    flexShrink: 0,
                  }}
                />
              )}
              <span style={{ color: "#71717a", fontSize: "0.65rem" }}>{expanded ? "▲" : "▼"}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onArchive(alert.id); }}
                disabled={archivingId === alert.id}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px",
                  color: "#71717a",
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  opacity: archivingId === alert.id ? 0.5 : 1,
                }}
                title={t("alerts.deleteAlert")}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Message preview */}
          <p
            style={{
              fontSize: "0.78rem",
              color: "#b3b4b5",
              marginTop: 6,
              lineHeight: 1.55,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {alert.message}
          </p>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: "0 20px 20px", borderTop: "0.8px solid #1a1a1a" }}>
          {/* Human impact */}
          <div
            style={{
              marginTop: 16,
              borderRadius: 10,
              padding: "14px 16px",
              background: `rgba(${sev.color === "#ef4444" ? "239,68,68" : sev.color === "#f59e0b" ? "245,158,11" : "59,130,246"},0.06)`,
              border: `0.8px solid rgba(${sev.color === "#ef4444" ? "239,68,68" : sev.color === "#f59e0b" ? "245,158,11" : "59,130,246"},0.15)`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span
                style={{
                  fontFamily: "var(--font-dm-mono)",
                  fontSize: "0.62rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  fontWeight: 600,
                  color: sev.color,
                }}
              >
                {t("alerts.businessImpact")}
              </span>
            </div>
            <p style={{ fontSize: "0.78rem", lineHeight: 1.6, color: "#b3b4b5", margin: 0 }}>{alert.human_impact}</p>
          </div>

          {/* Fix steps */}
          <div
            style={{
              marginTop: 10,
              borderRadius: 10,
              padding: "14px 16px",
              background: "rgba(62,207,142,0.04)",
              border: "0.8px solid rgba(62,207,142,0.15)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span
                style={{
                  fontFamily: "var(--font-dm-mono)",
                  fontSize: "0.62rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  fontWeight: 600,
                  color: "#3ecf8e",
                }}
              >
                {t("alerts.howToFix")}
              </span>
            </div>
            <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {alert.fix_steps.map((step, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--font-dm-mono)",
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      flexShrink: 0,
                      marginTop: 1,
                      background: "rgba(62,207,142,0.12)",
                      color: "#3ecf8e",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ fontSize: "0.78rem", color: "#b3b4b5", lineHeight: 1.6 }}>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 16,
              paddingTop: 14,
              borderTop: "0.8px solid #1a1a1a",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-dm-mono)",
                fontSize: "0.65rem",
                color: "#71717a",
              }}
            >
              {fmtDate(alert.sent_at, lang)}
            </span>
            {alert.is_unread ? (
              <button
                onClick={handleMarkRead}
                disabled={marking}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "13px",
                  fontWeight: 600,
                  padding: "8px 16px",
                  borderRadius: 8,
                  transition: "all 0.2s",
                  opacity: marking ? 0.5 : 1,
                  cursor: marking ? "not-allowed" : "pointer",
                  background: "#151515",
                  color: "#f5f5f5",
                  border: "0.8px solid #1a1a1a",
                  fontFamily: "var(--font-dm-sans)",
                }}
              >
                <span>{marking ? "…" : "✓"}</span>
                {t("alerts.markAsRead")}
              </button>
            ) : (
              <span
                style={{
                  fontSize: "0.65rem",
                  color: "#71717a",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontFamily: "var(--font-dm-mono)",
                }}
              >
                <span style={{ color: "#3ecf8e" }}>✓</span> {t("alerts.filter.read")}{" "}
                {alert.read_at ? relTime(alert.read_at, lang) : ""}
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
  label, color, alerts, onMarkRead, onArchive, archivingId,
}: {
  label: string;
  color: string;
  alerts: Alert[];
  onMarkRead: (id: string) => void;
  onArchive: (id: string) => void;
  archivingId: string | null;
}) {
  if (alerts.length === 0) return null;
  return (
    <div>
      {/* Group header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            flexShrink: 0,
            background: color,
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-dm-mono)",
            fontSize: "0.62rem",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            fontWeight: 600,
            color: "#71717a",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: "var(--font-dm-mono)",
            fontSize: "0.6rem",
            padding: "1px 7px",
            borderRadius: 6,
            color,
            background: `${color}18`,
            border: `0.8px solid ${color}30`,
          }}
        >
          {alerts.length}
        </span>
        <div style={{ flex: 1, height: 1, background: "#1a1a1a" }} />
      </div>
      <div>
        {alerts.map((a) => (
          <AlertCard key={a.id} alert={a} onMarkRead={onMarkRead} onArchive={onArchive} archivingId={archivingId} />
        ))}
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState() {
  const { t } = useTranslation();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        padding: "80px 0",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: "rgba(62,207,142,0.06)",
          border: "0.8px solid rgba(62,207,142,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.4rem",
        }}
      >
        ✦
      </div>
      <div>
        <div
          style={{
            fontSize: "1rem",
            fontWeight: 700,
            color: "#f5f5f5",
            marginBottom: 6,
          }}
        >
          {t("alerts.allClear.title")}
        </div>
        <div style={{ fontSize: "0.82rem", color: "#71717a", maxWidth: 280, lineHeight: 1.6 }}>
          {t("alerts.allClear.desc")}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 14px",
          borderRadius: 20,
          background: "rgba(62,207,142,0.06)",
          border: "0.8px solid rgba(62,207,142,0.15)",
        }}
      >
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3ecf8e" }} />
        <span
          style={{
            fontFamily: "var(--font-dm-mono)",
            fontSize: "0.62rem",
            color: "#3ecf8e",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {t("alerts.activeMonitoring")}
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
  const { t } = useTranslation();
  const filters = [
    { key: "all",      label: t("alerts.filter.all"),      count: counts.all },
    { key: "unread",   label: t("alerts.filter.unread"),   count: counts.unread },
    { key: "critical", label: t("alerts.critical"),        count: counts.critical },
    { key: "medium",   label: t("alerts.medium2"),         count: counts.medium },
    { key: "low",      label: t("alerts.low2"),            count: counts.low },
  ];

  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        padding: 4,
        background: "#1c1c1c",
        border: "0.8px solid #1a1a1a",
        borderRadius: 8,
        marginBottom: 24,
        width: "fit-content",
        flexWrap: "wrap",
      }}
    >
      {filters.map((f) => {
        const active = activeFilter === f.key;
        return (
          <button
            key={f.key}
            onClick={() => onChange(f.key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              borderRadius: 6,
              fontSize: "13px",
              fontWeight: 600,
              transition: "all 0.15s",
              cursor: "pointer",
              border: active ? "0.8px solid #1a1a1a" : "0.8px solid transparent",
              fontFamily: "var(--font-dm-sans)",
              background: active ? "#151515" : "transparent",
              color: active ? "#f5f5f5" : "#71717a",
            }}
          >
            {f.label}
            {f.count > 0 && (
              <span
                style={{
                  fontFamily: "var(--font-dm-mono)",
                  fontSize: "0.6rem",
                  padding: "1px 5px",
                  borderRadius: 4,
                  background: active ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
                  color: active ? "#f5f5f5" : "#71717a",
                }}
              >
                {f.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AlertsPage() {
  const { t, lang } = useTranslation();
  const [data, setData]             = useState<AlertsData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState("all");
  const [markingAll, setMarkingAll] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [archivingAll, setArchivingAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await alertsApi.list();
      setData(res.data);
    } catch {
      toast.error(t("alerts.errorLoad"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const handleMarkRead = useCallback((id: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        unread_count: Math.max(0, prev.unread_count - 1),
        alerts: (prev.alerts ?? []).map((a) =>
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
          alerts: (prev.alerts ?? []).map((a) => ({
            ...a,
            is_unread: false,
            read_at: a.read_at ?? new Date().toISOString(),
          })),
        };
      });
      toast.success(t("alerts.markedRead"));
    } catch {
      toast.error(t("alerts.errorMark"));
    } finally {
      setMarkingAll(false);
    }
  };

  const handleArchive = useCallback(async (id: string) => {
    setArchivingId(id);
    try {
      await alertsApi.archiveAlert(id);
      setData(prev => {
        if (!prev) return prev;
        const updated = (prev.alerts ?? []).filter(a => a.id !== id);
        return { ...prev, alerts: updated, total: updated.length, unread_count: updated.filter(a => a.is_unread).length };
      });
      toast.success(t("alerts.deleted"));
    } catch {
      toast.error(t("alerts.errorDelete"));
    } finally {
      setArchivingId(null);
    }
  }, [t]);

  const handleArchiveResolved = async () => {
    setArchivingAll(true);
    try {
      await alertsApi.archiveResolved();
      setData(prev => {
        if (!prev) return prev;
        const active = (prev.alerts ?? []).filter(a => a.is_unread);
        return { ...prev, alerts: active, total: active.length, unread_count: active.length };
      });
      toast.success(t("alerts.resolvedDeleted"));
    } catch {
      toast.error(t("alerts.errorDeleteResolved"));
    } finally {
      setArchivingAll(false);
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          padding: "28px 32px 60px",
          background: "#0b0b0b",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            border: "2px solid #3ecf8e",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
      </div>
    );
  }

  if (!data) return null;

  const allAlerts = Array.isArray(data.alerts) ? data.alerts : [];
  const filteredAlerts = allAlerts.filter((a) => {
    if (filter === "unread")   return a.is_unread;
    if (filter === "critical") return a.severity === "critical" || a.severity === "high";
    if (filter === "medium")   return a.severity === "medium";
    if (filter === "low")      return a.severity === "low";
    return true;
  });

  const criticals = filteredAlerts.filter((a) => a.severity === "critical" || a.severity === "high");
  const mediums   = filteredAlerts.filter((a) => a.severity === "medium");
  const lows      = filteredAlerts.filter((a) => a.severity === "low");

  const counts = {
    all:      data.total ?? allAlerts.length,
    unread:   data.unread_count ?? 0,
    critical: allAlerts.filter((a) => a.severity === "critical" || a.severity === "high").length,
    medium:   allAlerts.filter((a) => a.severity === "medium").length,
    low:      allAlerts.filter((a) => a.severity === "low").length,
  };

  const unreadText = data.unread_count > 0
    ? t("alerts.unread2").replace("{n}", String(data.unread_count)).replace("{total}", String(data.total))
    : t("alerts.upToDate")
        .replace("{n}", String(data.total))
        .replace("{s}", data.total !== 1 ? "s" : "");

  return (
    <div
      style={{
        padding: "28px 32px 60px",
        background: "#0b0b0b",
        minHeight: "100vh",
        fontFamily: "var(--font-dm-sans)",
      }}
    >
      {/* Page header */}
      <div
        className="cs-fadeup-1"
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 28,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.4rem",
              fontWeight: 700,
              color: "#f5f5f5",
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            {t("alerts.title")}
          </h1>
          <p
            style={{
              color: "#71717a",
              fontSize: "0.8rem",
              marginTop: 5,
              margin: "5px 0 0",
              fontFamily: "var(--font-dm-mono)",
            }}
          >
            {unreadText}
          </p>
        </div>

        <div className="cs-fadeup-2" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={handleArchiveResolved}
            disabled={archivingAll || (data?.alerts ?? []).every(a => a.is_unread)}
            style={{
              background: "rgba(239,68,68,0.08)",
              color: "#ef4444",
              border: "0.8px solid rgba(239,68,68,0.2)",
              borderRadius: 8,
              padding: "7px 14px",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
            {archivingAll ? t("alerts.archivingAll") : t("alerts.deleteResolved2")}
          </button>

          {data.unread_count > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markingAll}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: "13px",
                fontWeight: 600,
                padding: "8px 16px",
                borderRadius: 8,
                transition: "opacity 0.2s",
                opacity: markingAll ? 0.5 : 1,
                cursor: markingAll ? "not-allowed" : "pointer",
                background: "#151515",
                color: "#f5f5f5",
                border: "0.8px solid #1a1a1a",
                fontFamily: "var(--font-dm-sans)",
              }}
            >
              <span>{markingAll ? "⟳" : "✓"}</span> {t("alerts.markAllRead2")}
            </button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      {data.total > 0 && (
        <FilterBar activeFilter={filter} onChange={setFilter} counts={counts} />
      )}

      {/* Alert groups or empty */}
      {filteredAlerts.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <AlertGroup label={t("alerts.critical")}  color="#ef4444" alerts={criticals} onMarkRead={handleMarkRead} onArchive={handleArchive} archivingId={archivingId} />
          <AlertGroup label={t("alerts.medium2")}   color="#f59e0b" alerts={mediums}   onMarkRead={handleMarkRead} onArchive={handleArchive} archivingId={archivingId} />
          <AlertGroup label={t("alerts.low2")}      color="#3b82f6" alerts={lows}      onMarkRead={handleMarkRead} onArchive={handleArchive} archivingId={archivingId} />
        </div>
      )}

      {/* Footer */}
      <div style={{ background: "#151515", border: "0.8px solid #1a1a1a", borderRadius: 16, padding: "12px 24px", display: "flex", justifyContent: "space-between", marginTop: 40 }}>
        <span style={{ fontSize: "12px", color: "#71717a" }}>© 2026 • v1.0.0</span>
        <span style={{ fontSize: "12px", color: "#71717a" }}>by <span style={{ color: "#b3b4b5", fontWeight: 500 }}>ChronoShield</span></span>
      </div>
    </div>
  );
}
