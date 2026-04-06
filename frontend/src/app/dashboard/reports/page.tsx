"use client";

import { useEffect, useState, useCallback } from "react";
import { reportsApi } from "@/lib/api";
import { useTranslation } from "@/contexts/LanguageContext";
import { useCredits } from "@/contexts/CreditsContext";
import FeatureGate from "@/components/FeatureGate";
import { usePlan } from "@/contexts/PlanContext";

// ── Types ───────────────────────────────────────────────────────────────────

interface ReportMeta {
  id: string;
  type: "weekly" | "monthly" | "manual";
  period_start: string;
  period_end: string;
  created_at: string;
}

interface ReportData {
  summary: {
    period_start: string;
    period_end: string;
    average_score: number;
    grade: string;
    domains_count: number;
    emails_count: number;
    alerts_count: number;
    scan_count: number;
    breach_count: number;
  };
  scores: Array<{ domain: string; overall_score: number; grade: string }>;
  ssl: Array<{ domain: string; status: string; valid_until?: string }>;
  uptime: Array<{ domain: string; uptime_pct?: number; avg_response_ms?: number; total_checks: number }>;
  email_security: Array<{ domain: string; spf_status: string; dkim_status: string; dmarc_status: string }>;
  alerts: Array<{ severity: string; title: string; alert_type: string; sent_at: string }>;
  recommendations: Array<{ priority: string; category: string; title: string; action: string }>;
}

interface Nis2Item {
  id: string;
  article: string;
  category: string;
  title: string;
  description: string;
  status: "compliant" | "partial" | "non_compliant" | "not_applicable" | "manual_review";
  detail: string;
}

interface DomainBreakdown {
  domain: string;
  ssl_status?: string;
  days_remaining?: number;
  spf_status?: string;
  dkim_status?: string;
  dmarc_status?: string;
  uptime_pct?: number;
  breach_count?: number;
  emails?: string[];
}

interface Nis2Data {
  compliance_score: number;
  items: Nis2Item[];
  domains_breakdown?: DomainBreakdown[];
  evaluated_at: string;
  disclaimer: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const TYPE_COLORS: Record<string, string> = {
  weekly:  "#3b82f6",
  monthly: "#8b5cf6",
  manual:  "#3ecf8e",
};

const PRIO_COLORS: Record<string, string> = {
  critical: "#ef4444",
  warning:  "#f59e0b",
  medium:   "#3b82f6",
  info:     "#3ecf8e",
};

const NIS2_STATUS_COLORS: Record<string, string> = {
  compliant:      "#3ecf8e",
  partial:        "#f59e0b",
  non_compliant:  "#ef4444",
  not_applicable: "#71717a",
  manual_review:  "#3b82f6",
};

const NIS2_STATUS_BG: Record<string, string> = {
  compliant:      "rgba(62,207,142,0.08)",
  partial:        "rgba(245,158,11,0.08)",
  non_compliant:  "rgba(239,68,68,0.08)",
  not_applicable: "rgba(113,113,122,0.08)",
  manual_review:  "rgba(59,130,246,0.08)",
};

const NIS2_STATUS_ICON: Record<string, string> = {
  compliant:      "✓",
  partial:        "◑",
  non_compliant:  "✗",
  not_applicable: "—",
  manual_review:  "⊙",
};

function scoreColor(score: number): string {
  if (score >= 80) return "#3ecf8e";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
}

function sslLabel(status: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    valid:          { label: "Válido",           color: "#3ecf8e" },
    expired:        { label: "Caducado",          color: "#ef4444" },
    expiring_soon:  { label: "Por caducar",       color: "#f59e0b" },
    error:          { label: "Error",             color: "#ef4444" },
    invalid:        { label: "Inválido",          color: "#ef4444" },
  };
  return map[status] ?? { label: status, color: "#71717a" };
}

function emailStatusLabel(status: string): { label: string; color: string } {
  if (["valid","ok"].includes(status)) return { label: "✓", color: "#3ecf8e" };
  if (!status || status === "missing") return { label: "✗", color: "#71717a" };
  return { label: "✗", color: "#ef4444" };
}

// ── Generate Modal ───────────────────────────────────────────────────────────

function GenerateModal({ onClose, onGenerated }: { onClose: () => void; onGenerated: (data: ReportData, meta: ReportMeta) => void }) {
  const { t } = useTranslation();
  const { credits } = useCredits();
  const [period, setPeriod] = useState("7d");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd,   setPeriodEnd]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const handleGenerate = async () => {
    if (loading) return;
    if ((credits ?? 0) < 1) { setError(t("reports.modal.noCredits")); return; }
    setLoading(true);
    setError("");
    try {
      const res = await reportsApi.generate({
        period,
        ...(period === "custom" ? { period_start: periodStart, period_end: periodEnd } : {}),
      });
      onGenerated(res.data.data as ReportData, res.data.report as ReportMeta);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || t("reports.error.generate");
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: 420, background: "#151515", border: "1px solid #1f1f1f", borderRadius: 16, padding: 28 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <div>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#f5f5f5", margin: 0 }}>{t("reports.modal.title")}</h2>
            <p style={{ fontSize: "0.78rem", color: "#71717a", margin: "4px 0 0" }}>{t("reports.modal.cost")}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#71717a", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 4 }}>×</button>
        </div>

        {/* Period selector */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#b3b4b5", marginBottom: 8 }}>
            {t("reports.modal.period")}
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {(["24h","7d","30d","custom"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                style={{
                  padding: "9px 12px", borderRadius: 8, fontSize: "0.82rem", fontWeight: period === p ? 600 : 400,
                  background: period === p ? "rgba(62,207,142,0.08)" : "#1a1a1a",
                  border: period === p ? "1px solid rgba(62,207,142,0.3)" : "1px solid #1f1f1f",
                  color: period === p ? "#3ecf8e" : "#b3b4b5",
                  cursor: "pointer", transition: "all 0.15s", textAlign: "center",
                }}>
                {t(`reports.modal.${p}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date range */}
        {period === "custom" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: "0.72rem", color: "#71717a", marginBottom: 4 }}>{t("reports.modal.from")}</label>
              <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#f5f5f5", fontSize: "0.82rem", outline: "none" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.72rem", color: "#71717a", marginBottom: 4 }}>{t("reports.modal.to")}</label>
              <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#f5f5f5", fontSize: "0.82rem", outline: "none" }} />
            </div>
          </div>
        )}

        {/* Credits info */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "#0f0f0f", borderRadius: 8, marginBottom: 16 }}>
          <span style={{ fontSize: "0.78rem", color: "#71717a" }}>{t("reports.modal.creditsLeft")}</span>
          <span style={{ fontSize: "0.88rem", fontWeight: 700, color: credits !== null && credits > 0 ? "#3ecf8e" : "#ef4444", fontFamily: "var(--font-dm-mono, monospace)" }}>
            {credits ?? "—"}
          </span>
        </div>

        {error && (
          <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: "0.8rem", marginBottom: 14 }}>
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading || (credits ?? 0) < 1}
          style={{
            width: "100%", padding: "11px 0", borderRadius: 10, fontSize: "0.88rem", fontWeight: 700,
            background: loading || (credits ?? 0) < 1 ? "rgba(62,207,142,0.15)" : "#3ecf8e",
            color: loading || (credits ?? 0) < 1 ? "#3ecf8e" : "#050507",
            border: "none", cursor: loading || (credits ?? 0) < 1 ? "not-allowed" : "pointer", transition: "all 0.2s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {loading ? (
            <>
              <span style={{ width: 14, height: 14, border: "2px solid #3ecf8e", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
              {t("reports.modal.generating")}
            </>
          ) : t("reports.modal.generate")}
        </button>
      </div>
    </div>
  );
}

// ── Report Preview Modal ──────────────────────────────────────────────────────

function ReportPreviewModal({ data, meta, onClose, onDownload }: {
  data: ReportData;
  meta: Partial<ReportMeta>;
  onClose: () => void;
  onDownload?: () => void;
}) {
  const summary = data.summary;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "48px 16px 24px", background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", overflowY: "auto" }}
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: 680, background: "#111", border: "1px solid #1f1f1f", borderRadius: 16, overflow: "hidden" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,rgba(62,207,142,0.12),rgba(0,229,191,0.06))", borderBottom: "1px solid #1f1f1f", padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f5f5f5", margin: 0 }}>
                {meta.type ? { weekly: "Informe Semanal", monthly: "Informe Mensual", manual: "Informe Manual" }[meta.type] : "Informe de Seguridad"}
              </h2>
              <p style={{ fontSize: "0.78rem", color: "#71717a", margin: "4px 0 0" }}>
                {fmtDate(summary.period_start)} — {fmtDate(summary.period_end)}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {onDownload && meta.id && (
                <button onClick={onDownload}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, background: "rgba(62,207,142,0.1)", border: "1px solid rgba(62,207,142,0.25)", color: "#3ecf8e", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  PDF
                </button>
              )}
              <button onClick={onClose} style={{ background: "none", border: "none", color: "#71717a", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 4 }}>×</button>
            </div>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 24 }}>
            {[
              { label: "Security Score", value: `${summary.average_score}/100`, sub: summary.grade, accent: scoreColor(summary.average_score) },
              { label: "Dominios",  value: String(summary.domains_count ?? 0) },
              { label: "Emails",    value: String(summary.emails_count  ?? 0) },
              { label: "Alertas",   value: String(summary.alerts_count  ?? 0) },
              { label: "Brechas",   value: String(summary.breach_count  ?? 0), accent: summary.breach_count > 0 ? "#ef4444" : undefined },
            ].map(kpi => (
              <div key={kpi.label} style={{ background: "#1a1a1a", borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
                <div style={{ fontSize: "0.62rem", color: "#71717a", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{kpi.label}</div>
                <div style={{ fontSize: "1.05rem", fontWeight: 700, color: kpi.accent ?? "#f5f5f5", fontFamily: "var(--font-dm-mono, monospace)" }}>{kpi.value}</div>
                {kpi.sub && <div style={{ fontSize: "0.62rem", color: kpi.accent ?? "#71717a", marginTop: 2 }}>{kpi.sub}</div>}
              </div>
            ))}
          </div>

          {/* SSL */}
          {data.ssl?.length > 0 && (
            <Section title="Certificados SSL">
              {data.ssl.map(s => {
                const { label, color } = sslLabel(s.status);
                return (
                  <Row key={s.domain}>
                    <span style={{ flex: 1, color: "#b3b4b5", fontSize: "0.82rem" }}>{s.domain}</span>
                    <Badge color={color}>{label}</Badge>
                    {s.valid_until && <span style={{ fontSize: "0.72rem", color: "#71717a" }}>{s.valid_until.slice(0,10)}</span>}
                  </Row>
                );
              })}
            </Section>
          )}

          {/* Email security */}
          {data.email_security?.length > 0 && (
            <Section title="Seguridad de Email">
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: "6px 12px", alignItems: "center" }}>
                <span style={{ fontSize: "0.7rem", color: "#71717a", fontWeight: 600 }}>Dominio</span>
                {["SPF","DKIM","DMARC"].map(h => <span key={h} style={{ fontSize: "0.7rem", color: "#71717a", fontWeight: 600, textAlign: "center" }}>{h}</span>)}
                {data.email_security.map(e => {
                  const spf  = emailStatusLabel(e.spf_status);
                  const dkim = emailStatusLabel(e.dkim_status);
                  const dmrc = emailStatusLabel(e.dmarc_status);
                  return (
                    <>
                      <span key={`d-${e.domain}`} style={{ fontSize: "0.82rem", color: "#b3b4b5" }}>{e.domain}</span>
                      {[spf,dkim,dmrc].map((st, i) => (
                        <span key={i} style={{ textAlign: "center", color: st.color, fontWeight: 700, fontSize: "0.9rem" }}>{st.label}</span>
                      ))}
                    </>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Uptime */}
          {data.uptime?.length > 0 && (
            <Section title="Disponibilidad">
              {data.uptime.map(u => (
                <Row key={u.domain}>
                  <span style={{ flex: 1, color: "#b3b4b5", fontSize: "0.82rem" }}>{u.domain}</span>
                  {u.uptime_pct !== null && u.uptime_pct !== undefined
                    ? <Badge color={u.uptime_pct >= 99 ? "#3ecf8e" : u.uptime_pct >= 95 ? "#f59e0b" : "#ef4444"}>{u.uptime_pct.toFixed(1)}%</Badge>
                    : <span style={{ fontSize: "0.72rem", color: "#71717a" }}>Sin datos</span>}
                  {u.avg_response_ms !== null && u.avg_response_ms !== undefined && (
                    <span style={{ fontSize: "0.72rem", color: "#71717a" }}>{Math.round(u.avg_response_ms)} ms</span>
                  )}
                </Row>
              ))}
            </Section>
          )}

          {/* Recommendations */}
          {data.recommendations?.length > 0 && (
            <Section title="Recomendaciones">
              {data.recommendations.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: PRIO_COLORS[r.priority] ?? "#71717a", flexShrink: 0, marginTop: 6 }} />
                  <div>
                    <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 600, color: "#f5f5f5" }}>{r.title}</p>
                    <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#71717a" }}>{r.action}</p>
                  </div>
                </div>
              ))}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: "0.78rem", fontWeight: 700, color: "#3ecf8e", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>{title}</h3>
      <div style={{ background: "#1a1a1a", borderRadius: 10, overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderBottom: "1px solid #111" }}>
      {children}
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{ fontSize: "0.72rem", fontWeight: 700, color, background: `${color}15`, border: `1px solid ${color}30`, borderRadius: 5, padding: "2px 7px" }}>
      {children}
    </span>
  );
}

// ── NIS2 Domain Breakdown Card ────────────────────────────────────────────────

function DomainCard({ dom, index }: { dom: DomainBreakdown; index: number }) {
  const checks = [
    { label: "SSL",   status: dom.ssl_status },
    { label: "SPF",   status: dom.spf_status },
    { label: "DKIM",  status: dom.dkim_status },
    { label: "DMARC", status: dom.dmarc_status },
  ];

  function statusColor(s: string | undefined): string {
    if (!s || s === "missing" || s === "error") return "#71717a";
    if (["valid", "ok"].includes(s)) return "#3ecf8e";
    if (s === "expiring_soon") return "#f59e0b";
    return "#ef4444";
  }
  function statusIcon(s: string | undefined): string {
    if (!s || s === "missing" || s === "error") return "–";
    if (["valid", "ok"].includes(s)) return "✓";
    if (s === "expiring_soon") return "⚠";
    return "✗";
  }

  return (
    <div
      style={{
        background: "#111", border: "1px solid #1f1f1f", borderRadius: 12, padding: "16px 20px",
        animation: "fadeUp 0.4s ease both", animationDelay: `${index * 80}ms`,
        transition: "border-color 0.2s, background 0.15s",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.background = "#141414"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#1f1f1f"; e.currentTarget.style.background = "#111"; }}
    >
      {/* Domain header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#f5f5f5", fontFamily: "var(--font-dm-mono, monospace)" }}>
          {dom.domain}
        </span>
        {dom.days_remaining !== undefined && dom.days_remaining !== null && (
          <span style={{ fontSize: "0.68rem", color: dom.days_remaining > 30 ? "#3ecf8e" : dom.days_remaining > 7 ? "#f59e0b" : "#ef4444", background: dom.days_remaining > 30 ? "rgba(62,207,142,0.08)" : dom.days_remaining > 7 ? "rgba(245,158,11,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${dom.days_remaining > 30 ? "rgba(62,207,142,0.2)" : dom.days_remaining > 7 ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)"}`, borderRadius: 4, padding: "2px 7px", fontFamily: "var(--font-dm-mono, monospace)" }}>
            SSL: {dom.days_remaining}d restantes
          </span>
        )}
      </div>

      {/* Status pill row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: dom.emails?.length ? 12 : 0 }}>
        {checks.map(c => {
          const col = statusColor(c.status);
          const ico = statusIcon(c.status);
          return (
            <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 6, background: "#1a1a1a", border: `1px solid ${col}25` }}>
              <span style={{ fontSize: "0.68rem", color: "#71717a", fontWeight: 600 }}>{c.label}</span>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: col }}>{ico}</span>
            </div>
          );
        })}
        {dom.uptime_pct !== undefined && dom.uptime_pct !== null && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 6, background: "#1a1a1a", border: `1px solid ${dom.uptime_pct >= 99 ? "rgba(62,207,142,0.25)" : dom.uptime_pct >= 95 ? "rgba(245,158,11,0.25)" : "rgba(239,68,68,0.25)"}` }}>
            <span style={{ fontSize: "0.68rem", color: "#71717a", fontWeight: 600 }}>Uptime</span>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: dom.uptime_pct >= 99 ? "#3ecf8e" : dom.uptime_pct >= 95 ? "#f59e0b" : "#ef4444" }}>{dom.uptime_pct}%</span>
          </div>
        )}
        {(dom.breach_count ?? 0) > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 6, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)" }}>
            <span style={{ fontSize: "0.68rem", color: "#ef4444", fontWeight: 600 }}>Brechas</span>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#ef4444" }}>{dom.breach_count}</span>
          </div>
        )}
      </div>

      {/* Emails under domain */}
      {dom.emails && dom.emails.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {dom.emails.map(email => (
            <span key={email} style={{ fontSize: "0.68rem", color: "#71717a", background: "#1a1a1a", border: "1px solid #252525", borderRadius: 4, padding: "2px 7px", fontFamily: "var(--font-dm-mono, monospace)" }}>
              {email}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── NIS2 Tab ──────────────────────────────────────────────────────────────────

function Nis2Tab() {
  const { t } = useTranslation();
  const [data, setData]           = useState<Nis2Data | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [catFilter, setCatFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await reportsApi.nis2();
      setData(res.data as Nis2Data);
    } catch {
      setError(t("nis2.error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 80, gap: 10, color: "#71717a", fontSize: "0.88rem" }}>
      <span style={{ width: 18, height: 18, border: "2px solid #3ecf8e", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
      {t("nis2.loading")}
    </div>
  );

  if (error) return (
    <div style={{ padding: 40, textAlign: "center", color: "#ef4444", fontSize: "0.88rem" }}>{error}</div>
  );

  if (!data) return null;

  const score    = data.compliance_score;
  const scoreCol = score >= 80 ? "#3ecf8e" : score >= 60 ? "#f59e0b" : "#ef4444";
  const ringR    = 56;
  const ringCirc = 2 * Math.PI * ringR;

  const cats     = ["all", ...Array.from(new Set(data.items.map(i => i.category)))];
  const filtered = catFilter === "all" ? data.items : data.items.filter(i => i.category === catFilter);

  const compliantCount    = data.items.filter(i => i.status === "compliant").length;
  const partialCount      = data.items.filter(i => i.status === "partial").length;
  const nonCompliantCount = data.items.filter(i => i.status === "non_compliant").length;
  const manualCount       = data.items.filter(i => i.status === "manual_review").length;

  return (
    <div>
      {/* ── Score header ── */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 24, padding: "24px 28px", background: "#111", borderRadius: 16, border: "1px solid #1f1f1f", marginBottom: 20, alignItems: "center" }}>
        {/* Score ring – 140 px, centered overlay */}
        <div style={{ position: "relative", width: 140, height: 140, flexShrink: 0 }}>
          <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="70" cy="70" r={ringR} fill="none" stroke="#1e1e1e" strokeWidth="11" />
            <circle cx="70" cy="70" r={ringR} fill="none" stroke={scoreCol} strokeWidth="11"
              strokeDasharray={`${ringCirc}`}
              strokeDashoffset={`${ringCirc * (1 - score / 100)}`}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1), stroke 0.4s ease" }} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, color: scoreCol, fontFamily: "var(--font-dm-mono, monospace)", lineHeight: 1 }}>{score.toFixed(0)}%</div>
            <div style={{ fontSize: "0.58rem", color: "#71717a", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.1em" }}>{t("nis2.score")}</div>
          </div>
        </div>

        {/* Counters */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
          {[
            { label: t("nis2.status.compliant"),     value: compliantCount,    color: "#3ecf8e", icon: "✓" },
            { label: t("nis2.status.partial"),       value: partialCount,      color: "#f59e0b", icon: "◑" },
            { label: t("nis2.status.non_compliant"), value: nonCompliantCount, color: "#ef4444", icon: "✗" },
            { label: t("nis2.status.manual_review"), value: manualCount,       color: "#3b82f6", icon: "⊙" },
          ].map(stat => (
            <div key={stat.label}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#1a1a1a", borderRadius: 10, transition: "background 0.15s", cursor: "default" }}
              onMouseEnter={e => e.currentTarget.style.background = "#212121"}
              onMouseLeave={e => e.currentTarget.style.background = "#1a1a1a"}
            >
              <div style={{ width: 32, height: 32, borderRadius: 9, background: `${stat.color}12`, border: `1px solid ${stat.color}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.95rem", color: stat.color, fontWeight: 800, flexShrink: 0 }}>
                {stat.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.68rem", color: "#71717a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{stat.label}</div>
              </div>
              <span style={{ fontSize: "1.15rem", fontWeight: 800, color: stat.color, fontFamily: "var(--font-dm-mono, monospace)" }}>{stat.value}</span>
            </div>
          ))}
        </div>

        {/* Refresh */}
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          <button onClick={load}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid #1f1f1f", color: "#71717a", fontSize: "0.78rem", cursor: "pointer", whiteSpace: "nowrap", transition: "border-color 0.15s, color 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#2a2a2a"; (e.currentTarget as HTMLButtonElement).style.color = "#b3b4b5"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1f1f1f"; (e.currentTarget as HTMLButtonElement).style.color = "#71717a"; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            {t("nis2.refresh")}
          </button>
        </div>
      </div>

      {/* ── Category filter ── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {cats.map(cat => (
          <button key={cat} onClick={() => setCatFilter(cat)}
            style={{ padding: "5px 12px", borderRadius: 6, fontSize: "0.78rem", fontWeight: catFilter === cat ? 700 : 400, cursor: "pointer",
              background: catFilter === cat ? "rgba(62,207,142,0.1)" : "transparent",
              border: catFilter === cat ? "1px solid rgba(62,207,142,0.3)" : "1px solid #1f1f1f",
              color: catFilter === cat ? "#3ecf8e" : "#71717a", transition: "all 0.15s",
            }}>
            {cat === "all" ? t("nis2.category.all") : t(`nis2.category.${cat}`) || cat}
          </button>
        ))}
      </div>

      {/* ── Compliance items ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map((item, i) => {
          const col = NIS2_STATUS_COLORS[item.status] ?? "#71717a";
          const bg  = NIS2_STATUS_BG[item.status]    ?? "transparent";
          const ico = NIS2_STATUS_ICON[item.status]  ?? "?";
          return (
            <div key={item.id}
              style={{
                background: "#111", border: "1px solid #1f1f1f", borderRadius: 12, padding: "14px 16px",
                display: "flex", gap: 14, transition: "border-color 0.2s, background 0.15s",
                animation: "fadeUp 0.4s ease both", animationDelay: `${i * 50}ms`,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.background = "#141414"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#1f1f1f"; e.currentTarget.style.background = "#111"; }}
            >
              {/* Status icon */}
              <div style={{ width: 40, height: 40, borderRadius: 11, background: bg, border: `1px solid ${col}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "1.05rem", color: col, fontWeight: 800 }}>
                {ico}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#f5f5f5", marginBottom: 2 }}>{item.title}</div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.68rem", color: "#555", fontFamily: "var(--font-dm-mono, monospace)" }}>{item.article}</span>
                      <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#333" }} />
                      <span style={{ fontSize: "0.68rem", color: "#555" }}>{item.category}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: col, background: bg, border: `1px solid ${col}25`, borderRadius: 5, padding: "2px 8px", flexShrink: 0 }}>
                    {t(`nis2.status.${item.status}`) || item.status}
                  </span>
                </div>
                <p style={{ fontSize: "0.78rem", color: "#71717a", margin: "6px 0 4px", lineHeight: 1.5 }}>{item.description}</p>
                <p style={{ fontSize: "0.78rem", color: col === "#71717a" ? "#555" : `${col}bb`, margin: 0, lineHeight: 1.5 }}>{item.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Per-domain breakdown ── */}
      {data.domains_breakdown && data.domains_breakdown.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h3 style={{ fontSize: "0.78rem", fontWeight: 700, color: "#b3b4b5", textTransform: "uppercase", letterSpacing: "0.09em", margin: "0 0 12px" }}>
            Desglose por Dominio
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.domains_breakdown.map((dom, i) => (
              <DomainCard key={dom.domain} dom={dom} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* ── Disclaimer (discrete) ── */}
      <p style={{ fontSize: "0.67rem", color: "#333", marginTop: 28, textAlign: "center", lineHeight: 1.5, maxWidth: 620, margin: "28px auto 0" }}>
        ⓘ {data.disclaimer}
      </p>

      {/* Evaluated at */}
      <p style={{ fontSize: "0.68rem", color: "#2a2a2a", marginTop: 8, textAlign: "right" }}>
        {t("nis2.evaluatedAt")}: {fmtDateTime(data.evaluated_at)}
      </p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { isFree, loading: planLoading } = usePlan();
  const { t } = useTranslation();
  const { credits, refreshCredits } = useCredits();
  const [activeTab,  setActiveTab]  = useState<"reports" | "nis2">("reports");
  const [reports,    setReports]    = useState<ReportMeta[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showModal,  setShowModal]  = useState(false);
  const [preview,    setPreview]    = useState<{ data: ReportData; meta: Partial<ReportMeta> } | null>(null);

  const loadReports = useCallback(async () => {
    if (planLoading || isFree) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const res = await reportsApi.list(typeFilter === "all" ? undefined : typeFilter);
      setReports(res.data.reports as ReportMeta[]);
    } catch {
      setError(t("reports.error.load"));
    } finally {
      setLoading(false);
    }
  }, [planLoading, isFree, typeFilter, t]);

  useEffect(() => { if (activeTab === "reports") loadReports(); }, [activeTab, loadReports]);

  const handleGenerated = (data: ReportData, meta: ReportMeta) => {
    setShowModal(false);
    refreshCredits();
    setPreview({ data, meta });
    loadReports();
  };

  const handleViewReport = async (id: string) => {
    try {
      const res = await reportsApi.get(id);
      const report = reports.find(r => r.id === id);
      setPreview({ data: res.data.data as ReportData, meta: report ?? { id } });
    } catch { /* silent */ }
  };

  const handleDownloadPdf = async (id: string) => {
    try {
      const { data: { session } } = await import("@/lib/supabase").then(m => m.supabase.auth.getSession());
      const token = session?.access_token;
      const url = reportsApi.downloadPdfUrl(id);
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error("PDF error");
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `chronoshield-report-${id.slice(0,8)}.pdf`;
      link.click();
    } catch { /* silent */ }
  };

  return (
    <FeatureGate
      feature="reports"
      title="Informes de Seguridad"
      subtitle="Genera informes PDF profesionales, mide el cumplimiento NIS2 y compártelos con tu equipo o clientes."
      requiredPlan="starter"
      isFree={isFree}
    >
    <div style={{ padding: "32px 0", maxWidth: 860, margin: "0 auto" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
      `}</style>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#f5f5f5", margin: 0, letterSpacing: "-0.02em" }}>{t("reports.title")}</h1>
          <p style={{ fontSize: "0.85rem", color: "#71717a", margin: "4px 0 0" }}>{t("reports.subtitle")}</p>
        </div>
        {activeTab === "reports" && (
          <button
            onClick={() => setShowModal(true)}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, background: "#3ecf8e", border: "none", color: "#050507", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", transition: "opacity 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {t("reports.generate")}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 24, background: "#111", borderRadius: 10, padding: 4, width: "fit-content" }}>
        {(["reports","nis2"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: "7px 16px", borderRadius: 7, fontSize: "0.82rem", fontWeight: activeTab === tab ? 700 : 400, cursor: "pointer", border: "none", transition: "all 0.15s",
              background: activeTab === tab ? "#1f1f1f" : "transparent",
              color: activeTab === tab ? "#f5f5f5" : "#71717a",
            }}>
            {t(`reports.tab.${tab}`)}
          </button>
        ))}
      </div>

      {/* ── Reports tab ── */}
      {activeTab === "reports" && (
        <>
          {/* Filter bar */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            {(["all","weekly","monthly","manual"] as const).map(f => (
              <button key={f} onClick={() => setTypeFilter(f)}
                style={{ padding: "5px 12px", borderRadius: 6, fontSize: "0.78rem", fontWeight: typeFilter === f ? 700 : 400, cursor: "pointer", transition: "all 0.15s",
                  background: typeFilter === f ? "rgba(62,207,142,0.08)" : "transparent",
                  border: typeFilter === f ? "1px solid rgba(62,207,142,0.25)" : "1px solid #1f1f1f",
                  color: typeFilter === f ? "#3ecf8e" : "#71717a",
                }}>
                {t(`reports.filter.${f}`)}
              </button>
            ))}
          </div>

          {/* Auto notes */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
            {[
              { icon: "📅", text: t("reports.auto.weeklyNote")  },
              { icon: "📆", text: t("reports.auto.monthlyNote") },
            ].map((note, i) => (
              <div key={i} style={{ display: "flex", gap: 8, padding: "10px 12px", background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 10 }}>
                <span style={{ fontSize: "0.85rem" }}>{note.icon}</span>
                <p style={{ fontSize: "0.72rem", color: "#71717a", margin: 0, lineHeight: 1.4 }}>{note.text}</p>
              </div>
            ))}
          </div>

          {/* Error */}
          {error && <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", color: "#ef4444", fontSize: "0.82rem", marginBottom: 16 }}>{error}</div>}

          {/* Loading */}
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, gap: 10, color: "#71717a", fontSize: "0.88rem" }}>
              <span style={{ width: 18, height: 18, border: "2px solid #3ecf8e", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
              {t("common.loading")}
            </div>
          ) : reports.length === 0 ? (
            /* Empty state */
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 72, gap: 14, background: "#0f0f0f", borderRadius: 16, border: "1px dashed #1f1f1f" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2a2a2a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#b3b4b5", marginBottom: 6 }}>{t("reports.empty.title")}</div>
                <div style={{ fontSize: "0.82rem", color: "#71717a", maxWidth: 280 }}>{t("reports.empty.desc")}</div>
              </div>
              <button onClick={() => setShowModal(true)}
                style={{ padding: "8px 20px", borderRadius: 9, background: "rgba(62,207,142,0.1)", border: "1px solid rgba(62,207,142,0.25)", color: "#3ecf8e", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>
                {t("reports.generate")}
              </button>
            </div>
          ) : (
            /* Reports list */
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {reports.map(report => {
                const typeColor = TYPE_COLORS[report.type] ?? "#71717a";
                return (
                  <div key={report.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", background: "#111", border: "1px solid #1f1f1f", borderRadius: 12, transition: "border-color 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = "#2a2a2a")}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "#1f1f1f")}>

                    {/* Type icon */}
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: `${typeColor}12`, border: `1px solid ${typeColor}25`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={typeColor} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "#f5f5f5" }}>
                          {t(`reports.type.${report.type}`)}
                        </span>
                        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: typeColor, background: `${typeColor}15`, border: `1px solid ${typeColor}30`, borderRadius: 4, padding: "1px 6px" }}>
                          {report.type.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.75rem", color: "#71717a" }}>
                          {t("reports.period")}: {fmtDate(report.period_start)} — {fmtDate(report.period_end)}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "#71717a" }}>
                          {t("reports.generated")}: {fmtDateTime(report.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => handleViewReport(report.id)}
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid #1f1f1f", color: "#b3b4b5", fontSize: "0.75rem", cursor: "pointer" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                        {t("reports.view")}
                      </button>
                      <button onClick={() => handleDownloadPdf(report.id)}
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 7, background: "rgba(62,207,142,0.06)", border: "1px solid rgba(62,207,142,0.2)", color: "#3ecf8e", fontSize: "0.75rem", cursor: "pointer" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        PDF
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── NIS2 tab ── */}
      {activeTab === "nis2" && <Nis2Tab />}

      {/* Modals */}
      {showModal && (
        <GenerateModal
          onClose={() => setShowModal(false)}
          onGenerated={handleGenerated}
        />
      )}
      {preview && (
        <ReportPreviewModal
          data={preview.data}
          meta={preview.meta}
          onClose={() => setPreview(null)}
          onDownload={preview.meta.id ? () => { handleDownloadPdf(preview.meta.id!); } : undefined}
        />
      )}
    </div>
    </FeatureGate>
  );
}
