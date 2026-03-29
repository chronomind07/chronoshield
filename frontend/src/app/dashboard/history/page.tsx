"use client";

import { useEffect, useState, useCallback } from "react";
import { historyApi } from "@/lib/api";
import { toast } from "@/components/Toast";

// ── Types ──────────────────────────────────────────────────────────────────────

interface HistoryEntry {
  id: string;
  event_type: string;    // domain_scan | email_dns | darkweb_scan | alert_generated | domain_added | email_added
  category: string;      // domain | email | darkweb | system
  icon: string;
  title: string;
  subject: string;
  occurred_at: string;
  scan_mode: string;     // auto | manual | system
  status: string;        // ok | warning | critical
  status_label: string;
  details: Record<string, unknown>;
}

interface HistoryData {
  total: number;
  page: number;
  per_page: number;
  entries: HistoryEntry[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function fmtFull(iso: string) {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Hoy";
  if (new Date(now.getTime() - 86400000).toDateString() === d.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
}

function groupByDay(entries: HistoryEntry[]): { label: string; items: HistoryEntry[] }[] {
  const map = new Map<string, HistoryEntry[]>();
  for (const e of entries) {
    const key = dayLabel(e.occurred_at);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

// ── Style maps ────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string; leftBorder: string }> = {
  ok:       { color: "#3ecf8e", bg: "rgba(62,207,142,0.10)",  border: "rgba(62,207,142,0.2)",  leftBorder: "rgba(62,207,142,0.5)"  },
  warning:  { color: "#f59e0b", bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.2)",  leftBorder: "rgba(245,158,11,0.5)"  },
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.2)",   leftBorder: "rgba(239,68,68,0.5)"   },
};
const STATUS_SYSTEM: typeof STATUS_STYLE["ok"] = { color: "#71717a", bg: "rgba(113,113,122,0.08)", border: "rgba(113,113,122,0.15)", leftBorder: "#2a2a2a" };

const MODE_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  auto:   { color: "#b3b4b5", bg: "rgba(179,180,181,0.08)", border: "rgba(179,180,181,0.12)" },
  manual: { color: "#3b82f6", bg: "rgba(59,130,246,0.08)",  border: "rgba(59,130,246,0.15)"  },
  system: { color: "#a855f7", bg: "rgba(168,85,247,0.08)",  border: "rgba(168,85,247,0.15)"  },
};

const DNS_CHIP: Record<string, { color: string; bg: string; border: string; label: string }> = {
  valid:   { color: "#3ecf8e", bg: "rgba(62,207,142,0.10)",  border: "rgba(62,207,142,0.2)",  label: "OK"      },
  invalid: { color: "#ef4444", bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.2)",   label: "Inválido" },
  missing: { color: "#f59e0b", bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.2)",  label: "Falta"   },
  error:   { color: "#f59e0b", bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.2)",  label: "Error"   },
};

// ── Small components ──────────────────────────────────────────────────────────

function StatusBadge({ status, label }: { status: string; label: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_SYSTEM;
  return (
    <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "11px", fontWeight: 600,
      padding: "2px 8px", borderRadius: 6, color: s.color, background: s.bg,
      border: `0.8px solid ${s.border}`, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function ModeBadge({ mode }: { mode: string }) {
  const s = MODE_STYLE[mode] ?? MODE_STYLE.system;
  const label = mode === "auto" ? "Auto" : mode === "manual" ? "Manual" : "Sistema";
  return (
    <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "11px", fontWeight: 600,
      padding: "2px 8px", borderRadius: 6, color: s.color, background: s.bg,
      border: `0.8px solid ${s.border}`, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function DnsChip({ label, status }: { label: string; status: string | null | undefined }) {
  const s = status ? (DNS_CHIP[status] ?? DNS_CHIP.error) : { color: "#71717a", bg: "rgba(113,113,122,0.08)", border: "rgba(113,113,122,0.15)", label: "—" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "var(--font-dm-mono)",
      fontSize: "11px", fontWeight: 500, padding: "2px 7px", borderRadius: 5,
      color: s.color, background: s.bg, border: `0.8px solid ${s.border}`, whiteSpace: "nowrap" }}>
      <span style={{ color: "#71717a", fontWeight: 400 }}>{label}</span>
      <span>{s.label}</span>
    </span>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 80 ? "#3ecf8e" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.7rem", color: "#71717a", width: 80, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 4, background: "#1a1a1a", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.4s" }} />
      </div>
      <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.7rem", color, width: 28, textAlign: "right", flexShrink: 0 }}>{score}</span>
    </div>
  );
}

// ── Expanded detail panels ────────────────────────────────────────────────────

function DomainScanDetails({ details }: { details: Record<string, unknown> }) {
  const score = (details.overall_score as number) ?? 0;
  const grade = details.grade as string | undefined;
  const color = score >= 80 ? "#3ecf8e" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ padding: "14px 16px", background: "#1a1a1a", borderRadius: 10, marginTop: 12 }}>
      {/* Score headline */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#71717a" }}>Puntuación de seguridad</span>
        <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "1.1rem", fontWeight: 700, color }}>
          {score}/100{grade ? ` · ${grade}` : ""}
        </span>
      </div>
      {/* Component bars */}
      <ScoreBar label="SSL"          score={(details.ssl_score as number) ?? 0} />
      <ScoreBar label="Uptime"       score={(details.uptime_score as number) ?? 0} />
      <ScoreBar label="Email DNS"    score={(details.email_sec_score as number) ?? 0} />
      <ScoreBar label="Dark Web"     score={(details.breach_score as number) ?? 0} />
      {/* Text summary */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
        {([
          ["SSL",      details.ssl_label],
          ["Uptime",   details.uptime_label],
          ["DNS",      details.email_label],
          ["Brechas",  details.breach_label],
        ] as [string, unknown][]).map(([k, v]) => (
          <span key={k} style={{ fontFamily: "var(--font-dm-mono)", fontSize: "11px", color: "#b3b4b5",
            padding: "2px 7px", borderRadius: 5, background: "rgba(255,255,255,0.04)", border: "0.8px solid #222" }}>
            <span style={{ color: "#71717a" }}>{k}: </span>{String(v ?? "—")}
          </span>
        ))}
      </div>
    </div>
  );
}

function EmailDnsDetails({ details }: { details: Record<string, unknown> }) {
  return (
    <div style={{ padding: "14px 16px", background: "#1a1a1a", borderRadius: 10, marginTop: 12 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        <DnsChip label="SPF"   status={details.spf_status as string} />
        <DnsChip label="DKIM"  status={details.dkim_status as string} />
        <DnsChip label="DMARC" status={details.dmarc_status as string} />
      </div>
      {(["spf_record", "dkim_record", "dmarc_record"] as const).map((key) => {
        const val = details[key] as string | null | undefined;
        if (!val) return null;
        const prefix = key.replace("_record", "").toUpperCase();
        return (
          <div key={key} style={{ marginBottom: 6 }}>
            <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "10px", color: "#71717a",
              textTransform: "uppercase", letterSpacing: "0.08em" }}>{prefix} record: </span>
            <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "10px", color: "#b3b4b5",
              wordBreak: "break-all" }}>{val.length > 120 ? val.slice(0, 120) + "…" : val}</span>
          </div>
        );
      })}
    </div>
  );
}

function DarkWebDetails({ details }: { details: Record<string, unknown> }) {
  const total = (details.total_results as number) ?? 0;
  const findings = (details.findings as unknown[]) ?? [];
  return (
    <div style={{ padding: "14px 16px", background: "#1a1a1a", borderRadius: 10, marginTop: 12 }}>
      <div style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.75rem", marginBottom: 8 }}>
        <span style={{ color: "#71717a" }}>Tipo: </span>
        <span style={{ color: "#b3b4b5" }}>{String(details.scan_type ?? "—")}</span>
        <span style={{ color: "#71717a", marginLeft: 16 }}>Resultados: </span>
        <span style={{ color: total > 0 ? "#ef4444" : "#3ecf8e", fontWeight: 600 }}>{total}</span>
      </div>
      {findings.length > 0 && (
        <div style={{ fontSize: "11px", color: "#71717a", fontFamily: "var(--font-dm-mono)" }}>
          {findings.slice(0, 3).map((f, i) => (
            <div key={i} style={{ padding: "4px 0", borderTop: "0.8px solid #222" }}>
              {JSON.stringify(f).slice(0, 100)}…
            </div>
          ))}
          {total > 3 && <div style={{ color: "#3b82f6", marginTop: 4 }}>+{total - 3} más…</div>}
        </div>
      )}
      {total === 0 && (
        <div style={{ fontFamily: "var(--font-dm-mono)", fontSize: "11px", color: "#3ecf8e" }}>
          ✓ Sin hallazgos en la dark web
        </div>
      )}
    </div>
  );
}

function AlertDetails({ details }: { details: Record<string, unknown> }) {
  return (
    <div style={{ padding: "14px 16px", background: "#1a1a1a", borderRadius: 10, marginTop: 12 }}>
      <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.78rem", color: "#b3b4b5", margin: 0, lineHeight: 1.6 }}>
        {String(details.message ?? "—")}
      </p>
    </div>
  );
}

// ── Entry card (expandable) ────────────────────────────────────────────────────

function EntryCard({ entry, isExpanded, onToggle }: {
  entry: HistoryEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const ss = STATUS_STYLE[entry.status] ?? STATUS_SYSTEM;
  const isSystem = entry.category === "system" && entry.event_type !== "alert_generated";
  const leftBorder = isSystem ? "#2a2a2a" : ss.leftBorder;

  const hasDetails = entry.event_type === "domain_scan" || entry.event_type === "email_dns"
    || entry.event_type === "darkweb_scan" || entry.event_type === "alert_generated";

  return (
    <div
      style={{
        background: "#151515",
        border: "0.8px solid #1a1a1a",
        borderRadius: 14,
        marginBottom: 6,
        overflow: "hidden",
        transition: "border-color 0.15s",
      }}
      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = "#222"}
      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = "#1a1a1a"}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "13px 18px",
          borderLeft: `3px solid ${leftBorder}`,
          cursor: hasDetails ? "pointer" : "default",
        }}
        onClick={hasDetails ? onToggle : undefined}
      >
        {/* Icon */}
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: isSystem ? "rgba(255,255,255,0.03)" : ss.bg,
          border: `0.8px solid ${isSystem ? "#222" : ss.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.95rem",
        }}>
          {entry.icon}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#f5f5f5",
              fontFamily: "var(--font-dm-sans)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {entry.title}
            </span>
            {!isSystem && <StatusBadge status={entry.status} label={entry.status_label} />}
            <ModeBadge mode={entry.scan_mode} />
          </div>
          <div style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.68rem", color: "#71717a" }}>
            {entry.subject !== entry.title && entry.subject !== "—" && (
              <span style={{ marginRight: 8 }}>{entry.subject}</span>
            )}
          </div>
        </div>

        {/* Time + chevron */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.68rem", color: "#71717a", whiteSpace: "nowrap" }}>
            {fmtTime(entry.occurred_at)}
          </span>
          {hasDetails && (
            <svg viewBox="0 0 16 16" fill="none" style={{
              width: 13, height: 13, color: "#71717a",
              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
            }}>
              <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && hasDetails && (
        <div style={{ padding: "0 18px 14px", borderTop: "0.8px solid #1a1a1a" }}>
          <div style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.62rem", color: "#71717a",
            paddingTop: 10, marginBottom: 2 }}>
            {fmtFull(entry.occurred_at)}
          </div>
          {entry.event_type === "domain_scan"      && <DomainScanDetails details={entry.details} />}
          {entry.event_type === "email_dns"         && <EmailDnsDetails   details={entry.details} />}
          {entry.event_type === "darkweb_scan"      && <DarkWebDetails    details={entry.details} />}
          {entry.event_type === "alert_generated"   && <AlertDetails      details={entry.details} />}
        </div>
      )}
    </div>
  );
}

// ── Day group ─────────────────────────────────────────────────────────────────

function DayGroup({ label, items, expandedId, onToggle }: {
  label: string;
  items: HistoryEntry[];
  expandedId: string | null;
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.62rem",
          textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600,
          color: "#71717a", whiteSpace: "nowrap" }}>
          {label}
        </span>
        <div style={{ flex: 1, height: 1, background: "#1a1a1a" }} />
        <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.6rem", color: "#2a2a2a" }}>
          {items.length}
        </span>
      </div>
      {items.map(e => (
        <EntryCard
          key={e.id}
          entry={e}
          isExpanded={expandedId === e.id}
          onToggle={() => onToggle(e.id)}
        />
      ))}
    </div>
  );
}

// ── Filter constants ───────────────────────────────────────────────────────────

const DATE_FILTERS = [
  { key: "week",  label: "7 días" },
  { key: "month", label: "30 días" },
  { key: "all",   label: "Todo" },
];

const CATEGORY_FILTERS = [
  { key: "",        label: "Todos" },
  { key: "domain",  label: "🌐 Dominios" },
  { key: "email",   label: "📧 Emails" },
  { key: "darkweb", label: "🕵️ Dark Web" },
  { key: "system",  label: "⚡ Alertas" },
];

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({ page, total, perPage, onPage }: {
  page: number; total: number; perPage: number; onPage: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) return null;
  const showing = Math.min(page * perPage, total);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
      marginTop: 24, paddingTop: 18, borderTop: "0.8px solid #1a1a1a" }}>
      <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.68rem", color: "#71717a" }}>
        {showing} de {total} registros
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {[
          { label: "←", disabled: page <= 1, onClick: () => onPage(page - 1) },
          ...Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            const p = page <= 3 ? i + 1 : page + i - 2;
            if (p < 1 || p > totalPages) return null;
            return { label: String(p), disabled: false, onClick: () => onPage(p), active: p === page };
          }).filter(Boolean),
          { label: "→", disabled: page >= totalPages, onClick: () => onPage(page + 1) },
        ].map((btn, i) => {
          if (!btn) return null;
          const isActive = (btn as { active?: boolean }).active;
          return (
            <button key={i} onClick={btn.onClick} disabled={btn.disabled} style={{
              padding: "6px 10px", borderRadius: 6, fontFamily: "var(--font-dm-mono)", fontSize: "0.75rem",
              fontWeight: 600, cursor: btn.disabled ? "not-allowed" : "pointer",
              opacity: btn.disabled ? 0.3 : 1, transition: "all 0.15s",
              background: isActive ? "#3ecf8e" : "#151515",
              color: isActive ? "#000" : "#71717a",
              border: isActive ? "none" : "0.8px solid #1a1a1a",
            }}>{btn.label}</button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const [data, setData]                 = useState<HistoryData | null>(null);
  const [loading, setLoading]           = useState(true);
  const [dateFilter, setDateFilter]     = useState("month");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [page, setPage]                 = useState(1);
  const [expandedId, setExpandedId]     = useState<string | null>(null);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await historyApi.list({
        dateFilter,
        category: categoryFilter || undefined,
        problemsOnly,
        page: p,
        perPage: 30,
      });
      setData(res.data);
    } catch {
      toast.error("Error al cargar el historial");
    } finally {
      setLoading(false);
    }
  }, [dateFilter, categoryFilter, problemsOnly]);

  useEffect(() => {
    setPage(1);
    setExpandedId(null);
    load(1);
  }, [dateFilter, categoryFilter, problemsOnly]); // eslint-disable-line

  useEffect(() => {
    load(page);
  }, [page]); // eslint-disable-line

  const handlePage = (p: number) => {
    setPage(p);
    setExpandedId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleToggle = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const groups = data ? groupByDay(Array.isArray(data.entries) ? data.entries : []) : [];

  return (
    <div style={{ padding: "28px 32px 60px", background: "#0b0b0b", minHeight: "100vh",
      fontFamily: "var(--font-dm-sans)" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#f5f5f5", margin: 0, letterSpacing: "-0.01em" }}>
            Historial de actividad
          </h1>
          <p style={{ color: "#71717a", fontSize: "0.8rem", marginTop: 5, margin: "5px 0 0" }}>
            Registro cronológico de todos los eventos y escaneos de seguridad
          </p>
        </div>
        {data && (
          <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.68rem", color: "#71717a", marginTop: 6 }}>
            {data.total} registro{data.total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 28 }}>
        {/* Date filter pills */}
        <div style={{ display: "flex", gap: 4, padding: 4, background: "#1c1c1c",
          border: "0.8px solid #1a1a1a", borderRadius: 8 }}>
          {DATE_FILTERS.map(f => {
            const active = dateFilter === f.key;
            return (
              <button key={f.key} onClick={() => setDateFilter(f.key)} style={{
                padding: "5px 12px", borderRadius: 6, fontSize: "13px", fontWeight: 600,
                cursor: "pointer", transition: "all 0.15s", fontFamily: "var(--font-dm-sans)",
                border: active ? "0.8px solid #1a1a1a" : "0.8px solid transparent",
                background: active ? "#151515" : "transparent",
                color: active ? "#f5f5f5" : "#71717a",
              }}>{f.label}</button>
            );
          })}
        </div>

        {/* Category filter pills */}
        <div style={{ display: "flex", gap: 4, padding: 4, background: "#1c1c1c",
          border: "0.8px solid #1a1a1a", borderRadius: 8 }}>
          {CATEGORY_FILTERS.map(f => {
            const active = categoryFilter === f.key;
            return (
              <button key={f.key} onClick={() => setCategoryFilter(f.key)} style={{
                padding: "5px 12px", borderRadius: 6, fontSize: "13px", fontWeight: 600,
                cursor: "pointer", transition: "all 0.15s", fontFamily: "var(--font-dm-sans)",
                border: active ? "0.8px solid rgba(62,207,142,0.2)" : "0.8px solid transparent",
                background: active ? "rgba(62,207,142,0.08)" : "transparent",
                color: active ? "#3ecf8e" : "#71717a",
              }}>{f.label}</button>
            );
          })}
        </div>

        {/* Problems only toggle */}
        <button
          onClick={() => setProblemsOnly(p => !p)}
          style={{
            padding: "7px 14px", borderRadius: 8, fontSize: "13px", fontWeight: 600,
            cursor: "pointer", transition: "all 0.15s", fontFamily: "var(--font-dm-sans)",
            background: problemsOnly ? "rgba(239,68,68,0.10)" : "#1c1c1c",
            color: problemsOnly ? "#ef4444" : "#71717a",
            border: problemsOnly ? "0.8px solid rgba(239,68,68,0.2)" : "0.8px solid #1a1a1a",
          }}
        >
          ⚠ Solo problemas
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 192 }}>
          <div style={{ width: 28, height: 28, border: "2px solid #3ecf8e",
            borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
      ) : !data || data.entries.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
          gap: 16, padding: "80px 0", textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(59,130,246,0.06)",
            border: "0.8px solid rgba(59,130,246,0.15)", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: "1.3rem" }}>≡</div>
          <div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "#f5f5f5", marginBottom: 6 }}>Sin actividad</div>
            <div style={{ fontSize: "0.82rem", color: "#71717a", maxWidth: 280, lineHeight: 1.6 }}>
              {problemsOnly
                ? "No se encontraron problemas en el período seleccionado."
                : "Tu historial aparecerá aquí cuando se realicen escaneos."}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {groups.map(g => (
            <DayGroup
              key={g.label}
              label={g.label}
              items={g.items}
              expandedId={expandedId}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && (
        <Pagination page={page} total={data.total} perPage={data.per_page} onPage={handlePage} />
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
