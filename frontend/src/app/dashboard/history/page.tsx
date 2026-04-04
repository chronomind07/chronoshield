"use client";

import { useEffect, useState, useCallback } from "react";
import { historyApi, uptimeApi, billingApi } from "@/lib/api";
import { toast } from "@/components/Toast";
import { useTranslation } from "@/contexts/LanguageContext";
import FeatureGate from "@/components/FeatureGate";
import { usePlan } from "@/contexts/PlanContext";

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

function fmtTime(iso: string, lang = "es") {
  return new Date(iso).toLocaleTimeString(lang === "en" ? "en-US" : "es-ES", { hour: "2-digit", minute: "2-digit" });
}

function fmtFull(iso: string, lang = "es") {
  return new Date(iso).toLocaleString(lang === "en" ? "en-US" : "es-ES", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function dayLabel(iso: string, lang = "es", tToday = "Hoy", tYesterday = "Ayer"): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return tToday;
  if (new Date(now.getTime() - 86400000).toDateString() === d.toDateString()) return tYesterday;
  return d.toLocaleDateString(lang === "en" ? "en-US" : "es-ES", { day: "2-digit", month: "long", year: "numeric" });
}

function groupByDay(entries: HistoryEntry[], lang: string, tToday: string, tYesterday: string): { label: string; items: HistoryEntry[] }[] {
  const map = new Map<string, HistoryEntry[]>();
  for (const e of entries) {
    const key = dayLabel(e.occurred_at, lang, tToday, tYesterday);
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

const DNS_CHIP_BASE: Record<string, { color: string; bg: string; border: string }> = {
  valid:   { color: "#3ecf8e", bg: "rgba(62,207,142,0.10)",  border: "rgba(62,207,142,0.2)"  },
  invalid: { color: "#ef4444", bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.2)"   },
  missing: { color: "#f59e0b", bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.2)"  },
  error:   { color: "#f59e0b", bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.2)"  },
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

function ModeBadge({ mode, tAuto, tManual, tSystem }: { mode: string; tAuto: string; tManual: string; tSystem: string }) {
  const s = MODE_STYLE[mode] ?? MODE_STYLE.system;
  const label = mode === "auto" ? tAuto : mode === "manual" ? tManual : tSystem;
  return (
    <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "11px", fontWeight: 600,
      padding: "2px 8px", borderRadius: 6, color: s.color, background: s.bg,
      border: `0.8px solid ${s.border}`, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function DnsChip({ label, status, tInvalid, tMissing }: {
  label: string; status: string | null | undefined;
  tInvalid: string; tMissing: string;
}) {
  const base = status ? (DNS_CHIP_BASE[status] ?? DNS_CHIP_BASE.error) : null;
  const color = base?.color ?? "#71717a";
  const bg = base?.bg ?? "rgba(113,113,122,0.08)";
  const border = base?.border ?? "rgba(113,113,122,0.15)";
  const chipLabel = !status ? "—" : status === "valid" ? "OK" : status === "invalid" ? tInvalid : status === "missing" ? tMissing : "Error";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "var(--font-dm-mono)",
      fontSize: "11px", fontWeight: 500, padding: "2px 7px", borderRadius: 5,
      color, background: bg, border: `0.8px solid ${border}`, whiteSpace: "nowrap" }}>
      <span style={{ color: "#71717a", fontWeight: 400 }}>{label}</span>
      <span>{chipLabel}</span>
    </span>
  );
}

function ScoreBar({ label, score }: { label: string; score: number | null | undefined }) {
  if (score == null) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.7rem", color: "#71717a", width: 80, flexShrink: 0 }}>{label}</span>
        <div style={{ flex: 1, height: 4, background: "#1a1a1a", borderRadius: 2 }} />
        <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.7rem", color: "#3a3a3a", width: 28, textAlign: "right", flexShrink: 0 }}>—</span>
      </div>
    );
  }
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

function DomainScanDetails({ details, tScore, tBreaches }: { details: Record<string, unknown>; tScore: string; tBreaches: string }) {
  const score = (details.overall_score as number) ?? 0;
  const grade = details.grade as string | undefined;
  const color = score >= 80 ? "#3ecf8e" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ padding: "14px 16px", background: "#1a1a1a", borderRadius: 10, marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#71717a" }}>{tScore}</span>
        <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "1.1rem", fontWeight: 700, color }}>
          {score}/100{grade ? ` · ${grade}` : ""}
        </span>
      </div>
      <ScoreBar label="SSL"       score={details.ssl_score != null ? (details.ssl_score as number) : null} />
      <ScoreBar label="Uptime"    score={details.uptime_score != null ? (details.uptime_score as number) : null} />
      <ScoreBar label="Email DNS" score={details.email_sec_score != null ? (details.email_sec_score as number) : null} />
      <ScoreBar label="Dark Web"  score={(details.breach_score as number) ?? 0} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
        {([
          ["SSL",       details.ssl_label],
          ["Uptime",    details.uptime_label],
          ["DNS",       details.email_label],
          [tBreaches,   details.breach_label],
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

function EmailDnsDetails({ details, tInvalid, tMissing }: { details: Record<string, unknown>; tInvalid: string; tMissing: string }) {
  return (
    <div style={{ padding: "14px 16px", background: "#1a1a1a", borderRadius: 10, marginTop: 12 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        <DnsChip label="SPF"   status={details.spf_status as string}   tInvalid={tInvalid} tMissing={tMissing} />
        <DnsChip label="DKIM"  status={details.dkim_status as string}  tInvalid={tInvalid} tMissing={tMissing} />
        <DnsChip label="DMARC" status={details.dmarc_status as string} tInvalid={tInvalid} tMissing={tMissing} />
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

function DarkWebDetails({ details, tType, tResults, tNoFindings }: { details: Record<string, unknown>; tType: string; tResults: string; tNoFindings: string }) {
  const total = (details.total_results as number) ?? 0;
  const findings = (details.findings as unknown[]) ?? [];
  return (
    <div style={{ padding: "14px 16px", background: "#1a1a1a", borderRadius: 10, marginTop: 12 }}>
      <div style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.75rem", marginBottom: 8 }}>
        <span style={{ color: "#71717a" }}>{tType} </span>
        <span style={{ color: "#b3b4b5" }}>{String(details.scan_type ?? "—")}</span>
        <span style={{ color: "#71717a", marginLeft: 16 }}>{tResults} </span>
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
          {tNoFindings}
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

function EntryCard({ entry, isExpanded, onToggle, lang, tInvalid, tMissing, tScore, tBreaches, tType, tResults, tNoFindings, tAuto, tManual, tSystem }: {
  entry: HistoryEntry;
  isExpanded: boolean;
  onToggle: () => void;
  lang: string;
  tInvalid: string; tMissing: string; tScore: string; tBreaches: string;
  tType: string; tResults: string; tNoFindings: string;
  tAuto: string; tManual: string; tSystem: string;
}) {
  const ss = STATUS_STYLE[entry.status] ?? STATUS_SYSTEM;
  const isSystem = entry.category === "system" && entry.event_type !== "alert_generated";
  const leftBorder = isSystem ? "#2a2a2a" : ss.leftBorder;

  const hasDetails = entry.event_type === "domain_scan" || entry.event_type === "email_dns"
    || entry.event_type === "darkweb_scan" || entry.event_type === "alert_generated";

  return (
    <div
      className="cs-domain-item"
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
            <ModeBadge mode={entry.scan_mode} tAuto={tAuto} tManual={tManual} tSystem={tSystem} />
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
            {fmtTime(entry.occurred_at, lang)}
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
            {fmtFull(entry.occurred_at, lang)}
          </div>
          {entry.event_type === "domain_scan"    && <DomainScanDetails details={entry.details} tScore={tScore} tBreaches={tBreaches} />}
          {entry.event_type === "email_dns"      && <EmailDnsDetails   details={entry.details} tInvalid={tInvalid} tMissing={tMissing} />}
          {entry.event_type === "darkweb_scan"   && <DarkWebDetails    details={entry.details} tType={tType} tResults={tResults} tNoFindings={tNoFindings} />}
          {entry.event_type === "alert_generated"&& <AlertDetails      details={entry.details} />}
        </div>
      )}
    </div>
  );
}

// ── Day group ─────────────────────────────────────────────────────────────────

function DayGroup({ label, items, expandedId, onToggle, lang, tInvalid, tMissing, tScore, tBreaches, tType, tResults, tNoFindings, tAuto, tManual, tSystem }: {
  label: string;
  items: HistoryEntry[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  lang: string;
  tInvalid: string; tMissing: string; tScore: string; tBreaches: string;
  tType: string; tResults: string; tNoFindings: string;
  tAuto: string; tManual: string; tSystem: string;
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
          lang={lang}
          tInvalid={tInvalid} tMissing={tMissing} tScore={tScore} tBreaches={tBreaches}
          tType={tType} tResults={tResults} tNoFindings={tNoFindings}
          tAuto={tAuto} tManual={tManual} tSystem={tSystem}
        />
      ))}
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({ page, total, perPage, onPage, tShowing }: {
  page: number; total: number; perPage: number; onPage: (p: number) => void; tShowing: string;
}) {
  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) return null;
  const showing = Math.min(page * perPage, total);
  const showingText = tShowing.replace("{n}", String(showing)).replace("{total}", String(total));
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
      marginTop: 24, paddingTop: 18, borderTop: "0.8px solid #1a1a1a" }}>
      <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.68rem", color: "#71717a" }}>
        {showingText}
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

// ── Uptime status colours ────────────────────────────────────────────────────

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
  // Cap display at 500 blocks; each block is a thin rectangle
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

// ── Uptime tab ────────────────────────────────────────────────────────────────

function UptimeTab({ lang }: { lang: string }) {
  const { t } = useTranslation();
  const [domains, setDomains]           = useState<UptimeDomain[]>([]);
  const [selectedId, setSelectedId]     = useState<string>("");
  const [range, setRange]               = useState<"24h" | "7d" | "30d">("24h");
  const [timeline, setTimeline]         = useState<UptimeTimeline | null>(null);
  const [loading, setLoading]           = useState(false);
  const [domainsLoading, setDomainsLoading] = useState(true);
  const [plan, setPlan]                 = useState<string>("trial");

  // Load domain list and plan on mount
  useEffect(() => {
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
  }, [t]);

  // Load timeline when domain or range changes
  const loadTimeline = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const r = await uptimeApi.timeline(selectedId, range);
      setTimeline(r.data);
    } catch {
      toast.error(t("uptime.errorLoad"));
    } finally {
      setLoading(false);
    }
  }, [selectedId, range, t]);

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

  if (domainsLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
        <div style={{ width: 28, height: 28, border: "2px solid #3ecf8e",
          borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  if (domains.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
        gap: 12, padding: "80px 0", textAlign: "center" }}>
        <div style={{ fontSize: "1rem", fontWeight: 700, color: "#f5f5f5" }}>{t("uptime.noDomains")}</div>
      </div>
    );
  }

  return (
    <div className="cs-fadeup-2">
      {/* Subtitle showing plan-specific check interval */}
      <p style={{ color: "#71717a", fontSize: "0.78rem", margin: "0 0 16px" }}>
        {t(["starter","business","enterprise","trial"].includes(plan) ? `uptime.subtitle.${plan}` : "uptime.subtitle")}
      </p>
      {/* Controls: domain selector + range pills */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
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
        <>
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
        </>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const { isFree } = usePlan();
  const { t, lang } = useTranslation();
  const [activeTab, setActiveTab]       = useState<"activity" | "uptime">("activity");
  const [data, setData]                 = useState<HistoryData | null>(null);
  const [loading, setLoading]           = useState(true);
  const [dateFilter, setDateFilter]     = useState("month");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [page, setPage]                 = useState(1);
  const [expandedId, setExpandedId]     = useState<string | null>(null);

  const DATE_FILTERS = [
    { key: "week",  label: t("history.dateFilter.week") },
    { key: "month", label: t("history.dateFilter.month") },
    { key: "all",   label: t("history.dateFilter.all") },
  ];

  const CATEGORY_FILTERS = [
    { key: "",        label: t("history.category.all") },
    { key: "domain",  label: t("history.category.domain") },
    { key: "email",   label: t("history.category.email") },
    { key: "darkweb", label: t("history.category.darkweb") },
    { key: "system",  label: t("history.category.system") },
  ];

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
      toast.error(t("history.errorLoad"));
    } finally {
      setLoading(false);
    }
  }, [dateFilter, categoryFilter, problemsOnly, t]);

  useEffect(() => {
    if (activeTab !== "activity") return;
    setPage(1);
    setExpandedId(null);
    load(1);
  }, [dateFilter, categoryFilter, problemsOnly, activeTab]); // eslint-disable-line

  useEffect(() => {
    if (activeTab !== "activity") return;
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

  const tToday     = t("history.today");
  const tYesterday = t("history.yesterday");
  const tInvalid   = t("emails.status.invalid") ?? "Inválido";
  const tMissing   = t("emails.status.missing") ?? "Falta";
  const tScore     = t("history.scanScore");
  const tBreaches  = t("history.breaches");
  const tType      = t("history.darkwebType");
  const tResults   = t("history.darkwebResults");
  const tNoFindings= t("history.darkwebNoFindings");
  const tAuto      = t("history.modeAuto");
  const tManual    = t("history.modeManual");
  const tSystem    = t("history.modeSystem");

  const groups = data ? groupByDay(
    Array.isArray(data.entries) ? data.entries : [],
    lang, tToday, tYesterday
  ) : [];

  return (
    <FeatureGate
      feature="history"
      title="Historial de Escaneos"
      subtitle="Accede al historial completo de todos tus escaneos, compara resultados a lo largo del tiempo y detecta tendencias."
      requiredPlan="starter"
      isFree={isFree}
    >
    <div style={{ padding: "28px 32px 60px", background: "#0b0b0b", minHeight: "100vh",
      fontFamily: "var(--font-dm-sans)" }}>

      {/* Header */}
      <div className="cs-fadeup-1" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#f5f5f5", margin: 0, letterSpacing: "-0.01em" }}>
            {t("history.title")}
          </h1>
          <p style={{ color: "#71717a", fontSize: "0.8rem", marginTop: 5, margin: "5px 0 0" }}>
            {t("history.subtitle")}
          </p>
        </div>
        {activeTab === "activity" && data && (
          <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.68rem", color: "#71717a", marginTop: 6 }}>
            {data.total} {t("history.records").replace("{s}", data.total !== 1 ? "s" : "")}
          </span>
        )}
      </div>

      {/* Tab switcher */}
      <div className="cs-fadeup-1" style={{ display: "flex", gap: 4, padding: 4, background: "#1c1c1c",
        border: "0.8px solid #1a1a1a", borderRadius: 10, width: "fit-content", marginBottom: 24 }}>
        {(["activity", "uptime"] as const).map(tab => {
          const active = activeTab === tab;
          const label  = tab === "activity" ? t("history.tab.activity") : t("history.tab.uptime");
          return (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "7px 18px", borderRadius: 7, fontSize: "13px", fontWeight: 600,
              cursor: "pointer", transition: "all 0.15s", fontFamily: "var(--font-dm-sans)",
              border: active ? "0.8px solid rgba(62,207,142,0.2)" : "0.8px solid transparent",
              background: active ? "rgba(62,207,142,0.08)" : "transparent",
              color: active ? "#3ecf8e" : "#71717a",
            }}>
              {tab === "uptime" ? "📡 " : "📋 "}{label}
            </button>
          );
        })}
      </div>

      {/* ── Activity tab content ─────────────────────────────────────────────── */}
      {activeTab === "activity" && (
        <>
          {/* Filters */}
          <div className="cs-fadeup-2" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 28 }}>
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
              {t("history.problemsOnly")}
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
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#f5f5f5", marginBottom: 6 }}>{t("history.noActivity")}</div>
                <div style={{ fontSize: "0.82rem", color: "#71717a", maxWidth: 280, lineHeight: 1.6 }}>
                  {problemsOnly ? t("history.noProblems") : t("history.appearsHere")}
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
                  lang={lang}
                  tInvalid={tInvalid} tMissing={tMissing} tScore={tScore} tBreaches={tBreaches}
                  tType={tType} tResults={tResults} tNoFindings={tNoFindings}
                  tAuto={tAuto} tManual={tManual} tSystem={tSystem}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {data && (
            <Pagination page={page} total={data.total} perPage={data.per_page} onPage={handlePage} tShowing={t("history.showing")} />
          )}
        </>
      )}

      {/* ── Uptime tab content ───────────────────────────────────────────────── */}
      {activeTab === "uptime" && <UptimeTab lang={lang} />}

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
    </FeatureGate>
  );
}
