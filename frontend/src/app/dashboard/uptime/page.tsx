"use client";

import { useEffect, useState, useCallback } from "react";
import { uptimeApi, billingApi } from "@/lib/api";
import { toast } from "@/components/Toast";
import { useTranslation } from "@/contexts/LanguageContext";
import FeatureGate from "@/components/FeatureGate";
import { usePlan } from "@/contexts/PlanContext";

// ── Types ──────────────────────────────────────────────────────────────────────

interface UptimeDomain {
  id: string;
  domain: string;
}

interface UptimePoint {
  checked_at: string;
  status: string;
  response_time_ms: number | null;
}

interface UptimeTimeline {
  domain_id: string;
  domain: string;
  uptime_pct: number;
  avg_response_ms: number | null;
  total_checks: number;
  down_checks: number;
  degraded_checks: number;
  range: string;
  points: UptimePoint[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtFull(iso: string, lang = "es") {
  return new Date(iso).toLocaleString(lang === "en" ? "en-US" : "es-ES", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Uptime status colours ─────────────────────────────────────────────────────

const UPTIME_COLORS: Record<string, string> = {
  up:       "#3ecf8e",
  degraded: "#f59e0b",
  down:     "#ef4444",
  error:    "#71717a",
};

// ── Uptime timeline bar ───────────────────────────────────────────────────────

function UptimeBar({ points }: { points: UptimePoint[] }) {
  if (!points.length) return null;
  const total = points.length;
  return (
    <div style={{ display: "flex", gap: 1, height: 28, alignItems: "stretch", overflow: "hidden", borderRadius: 6 }}>
      {points.map((p, i) => (
        <div
          key={i}
          title={`${new Date(p.checked_at).toLocaleTimeString()} — ${p.status}${p.response_time_ms ? ` (${p.response_time_ms}ms)` : ""}`}
          style={{
            flex: `${1 / total}`,
            minWidth: 2,
            background: UPTIME_COLORS[p.status] ?? "#71717a",
            opacity: p.status === "up" ? 0.75 : 1,
            transition: "opacity 0.1s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = "1"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = p.status === "up" ? "0.75" : "1"; }}
        />
      ))}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, unit, color }: { label: string; value: string | number; unit?: string; color?: string }) {
  return (
    <div style={{ background: "#151515", border: "0.8px solid #1a1a1a", borderRadius: 12,
      padding: "16px 20px", flex: 1, minWidth: 120 }}>
      <div style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.62rem", color: "#71717a",
        textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "1.6rem", fontWeight: 700,
          color: color ?? "#f5f5f5", lineHeight: 1 }}>
          {value}
        </span>
        {unit && <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.75rem", color: "#71717a" }}>{unit}</span>}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function UptimePage() {
  const { isFree, loading: planLoading } = usePlan();
  const { t, lang } = useTranslation();
  const [domains, setDomains]               = useState<UptimeDomain[]>([]);
  const [selectedId, setSelectedId]         = useState<string>("");
  const [range, setRange]                   = useState<"24h" | "7d" | "30d">("24h");
  const [timeline, setTimeline]             = useState<UptimeTimeline | null>(null);
  const [loading, setLoading]               = useState(false);
  const [domainsLoading, setDomainsLoading] = useState(true);
  const [plan, setPlan]                     = useState<string>("trial");

  // Early return for free users — no API calls
  useEffect(() => {
    if (planLoading || isFree) { setDomainsLoading(false); return; }

    uptimeApi.domains()
      .then(r => {
        const list: UptimeDomain[] = r.data?.domains ?? [];
        setDomains(list);
        if (list.length > 0) setSelectedId(list[0].id);
      })
      .catch(() => toast.error(t("uptime.errorLoad")))
      .finally(() => setDomainsLoading(false));

    billingApi.subscription()
      .then(r => { if (r.data?.plan) setPlan(r.data.plan); })
      .catch(() => { /* non-critical */ });
  }, [planLoading, isFree, t]); // eslint-disable-line

  // Load timeline when domain or range changes
  const loadTimeline = useCallback(async () => {
    if (!selectedId || isFree) return;
    setLoading(true);
    try {
      const r = await uptimeApi.timeline(selectedId, range);
      setTimeline(r.data);
    } catch {
      toast.error(t("uptime.errorLoad"));
    } finally {
      setLoading(false);
    }
  }, [selectedId, range, isFree, t]);

  useEffect(() => { loadTimeline(); }, [loadTimeline]);

  const RANGES: { key: "24h" | "7d" | "30d"; label: string }[] = [
    { key: "24h", label: t("uptime.range.24h") },
    { key: "7d",  label: t("uptime.range.7d")  },
    { key: "30d", label: t("uptime.range.30d") },
  ];

  const pctColor = !timeline ? "#f5f5f5"
    : timeline.uptime_pct >= 99 ? "#3ecf8e"
    : timeline.uptime_pct >= 95 ? "#f59e0b"
    : "#ef4444";

  // ── Free users gate ──────────────────────────────────────────────────────────
  if (!planLoading && isFree) {
    return (
      <FeatureGate
        feature="uptime"
        title="Disponibilidad"
        subtitle="Monitorea el uptime de tus dominios en tiempo real, visualiza el historial de disponibilidad y detecta caídas al instante."
        requiredPlan="starter"
        isFree={isFree}
      >
        <></>
      </FeatureGate>
    );
  }

  // ── Loading domains ──────────────────────────────────────────────────────────
  if (domainsLoading) {
    return (
      <div style={{ padding: "28px 32px 60px", background: "#0b0b0b", minHeight: "100vh",
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 28, height: 28, border: "2px solid #3ecf8e",
          borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  // ── No domains ───────────────────────────────────────────────────────────────
  if (domains.length === 0) {
    return (
      <div style={{ padding: "28px 32px 60px", background: "#0b0b0b", minHeight: "100vh",
        fontFamily: "var(--font-dm-sans)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
          gap: 12, padding: "80px 0", textAlign: "center" }}>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: "#f5f5f5" }}>{t("uptime.noDomains")}</div>
        </div>
      </div>
    );
  }

  // ── Main content ─────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "28px 32px 60px", background: "#0b0b0b", minHeight: "100vh",
      fontFamily: "var(--font-dm-sans)" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div className="cs-fadeup-1" style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#f5f5f5", margin: 0, letterSpacing: "-0.01em" }}>
          {t("nav.uptime")}
        </h1>
        <p style={{ color: "#71717a", fontSize: "0.8rem", margin: "5px 0 0" }}>
          {t(["starter","business","enterprise","trial"].includes(plan) ? `uptime.subtitle.${plan}` : "uptime.subtitle")}
        </p>
      </div>

      {/* Controls: domain selector + range pills */}
      <div className="cs-fadeup-2" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
        {/* Domain selector */}
        {domains.length > 1 && (
          <div style={{ display: "flex", gap: 4, padding: 4, background: "#1c1c1c",
            border: "0.8px solid #1a1a1a", borderRadius: 8 }}>
            {domains.map(d => {
              const active = selectedId === d.id;
              return (
                <button key={d.id} onClick={() => setSelectedId(d.id)} style={{
                  padding: "5px 12px", borderRadius: 6, fontSize: "13px", fontWeight: 600,
                  cursor: "pointer", transition: "all 0.15s", fontFamily: "var(--font-dm-sans)",
                  border: active ? "0.8px solid rgba(62,207,142,0.2)" : "0.8px solid transparent",
                  background: active ? "rgba(62,207,142,0.08)" : "transparent",
                  color: active ? "#3ecf8e" : "#71717a",
                }}>{d.domain}</button>
              );
            })}
          </div>
        )}

        {/* Range pills */}
        <div style={{ display: "flex", gap: 4, padding: 4, background: "#1c1c1c",
          border: "0.8px solid #1a1a1a", borderRadius: 8 }}>
          {RANGES.map(r => {
            const active = range === r.key;
            return (
              <button key={r.key} onClick={() => setRange(r.key)} style={{
                padding: "5px 12px", borderRadius: 6, fontSize: "13px", fontWeight: 600,
                cursor: "pointer", transition: "all 0.15s", fontFamily: "var(--font-dm-sans)",
                border: active ? "0.8px solid #1a1a1a" : "0.8px solid transparent",
                background: active ? "#151515" : "transparent",
                color: active ? "#f5f5f5" : "#71717a",
              }}>{r.label}</button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 180 }}>
          <div style={{ width: 28, height: 28, border: "2px solid #3ecf8e",
            borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
      ) : !timeline || timeline.total_checks === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
          gap: 12, padding: "60px 0", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(62,207,142,0.06)",
            border: "0.8px solid rgba(62,207,142,0.15)", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: "1.2rem" }}>📡</div>
          <div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "#f5f5f5", marginBottom: 6 }}>
              {t("uptime.noData")}
            </div>
            <div style={{ fontSize: "0.82rem", color: "#71717a", maxWidth: 300, lineHeight: 1.6 }}>
              {t("uptime.noDataSub")}
            </div>
          </div>
        </div>
      ) : (
        <div className="cs-fadeup-3">
          {/* Stats row */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
            <StatCard
              label={t("uptime.pct")}
              value={`${timeline.uptime_pct.toFixed(2)}%`}
              color={pctColor}
            />
            <StatCard
              label={t("uptime.avgResponse")}
              value={timeline.avg_response_ms != null ? Math.round(timeline.avg_response_ms) : "—"}
              unit={timeline.avg_response_ms != null ? t("uptime.ms") : undefined}
              color="#b3b4b5"
            />
            <StatCard
              label={t("uptime.totalChecks")}
              value={timeline.total_checks}
              color="#b3b4b5"
            />
            <StatCard
              label={t("uptime.incidents")}
              value={timeline.down_checks}
              color={timeline.down_checks > 0 ? "#ef4444" : "#3ecf8e"}
            />
            {timeline.degraded_checks > 0 && (
              <StatCard
                label={t("uptime.degraded")}
                value={timeline.degraded_checks}
                color="#f59e0b"
              />
            )}
          </div>

          {/* Timeline bar */}
          <div style={{ background: "#151515", border: "0.8px solid #1a1a1a",
            borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 12 }}>
              <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.65rem",
                textTransform: "uppercase", letterSpacing: "0.1em", color: "#71717a" }}>
                {domains.find(d => d.id === selectedId)?.domain ?? ""}
              </span>
              <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.65rem", color: "#71717a" }}>
                {timeline.points.length} pts · {RANGES.find(r => r.key === range)?.label}
              </span>
            </div>
            <UptimeBar points={timeline.points} />
            {/* Legend */}
            <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
              {(["up", "degraded", "down", "error"] as const).map(s => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: UPTIME_COLORS[s] }} />
                  <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.65rem", color: "#71717a" }}>
                    {t(`uptime.legend.${s}`)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Time axis labels */}
          <div style={{ display: "flex", justifyContent: "space-between",
            fontFamily: "var(--font-dm-mono)", fontSize: "0.6rem", color: "#3a3a3a",
            padding: "0 2px" }}>
            {timeline.points.length > 0 && (
              <>
                <span>{fmtFull(timeline.points[0].checked_at, lang)}</span>
                <span>{fmtFull(timeline.points[timeline.points.length - 1].checked_at, lang)}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ background: "#151515", border: "0.8px solid #1a1a1a", borderRadius: 16,
        padding: "12px 24px", display: "flex", justifyContent: "space-between",
        alignItems: "center", marginTop: 40 }}>
        <span style={{ fontSize: "12px", color: "#71717a" }}>© 2026 • v1.0.0</span>
        <span style={{ fontSize: "12px", color: "#71717a" }}>
          by <span style={{ color: "#b3b4b5", fontWeight: 500 }}>ChronoShield</span>
        </span>
      </div>
    </div>
  );
}
