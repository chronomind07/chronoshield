"use client";

import { useEffect, useState, useCallback } from "react";
import { historyApi } from "@/lib/api";
import { toast } from "@/components/Toast";

// ── Types ──────────────────────────────────────────────────────────────────────
interface HistoryEntry {
  id: string;
  event_type: string;
  icon: string;
  title: string;
  description: string;
  result: string;
  result_label: string;
  origin: string;
  origin_label: string;
  occurred_at: string;
}

interface HistoryData {
  total: number;
  page: number;
  per_page: number;
  entries: HistoryEntry[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isYesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString();

  const time = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return `Hoy, ${time}`;
  if (isYesterday) return `Ayer, ${time}`;
  return (
    d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) + `, ${time}`
  );
}

function groupByDay(entries: HistoryEntry[]): { dayLabel: string; items: HistoryEntry[] }[] {
  const map = new Map<string, HistoryEntry[]>();
  const now = new Date();

  for (const e of entries) {
    const d = new Date(e.occurred_at);
    const isToday = d.toDateString() === now.toDateString();
    const isYesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString();
    const key = isToday
      ? "Hoy"
      : isYesterday
      ? "Ayer"
      : d.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }

  return Array.from(map.entries()).map(([dayLabel, items]) => ({ dayLabel, items }));
}

// ── Result badge ───────────────────────────────────────────────────────────────
const RESULT_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  clean:    { color: "#3ecf8e", bg: "rgba(62,207,142,0.10)",  border: "rgba(62,207,142,0.2)" },
  findings: { color: "#ef4444", bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.2)" },
  warn:     { color: "#f59e0b", bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.2)" },
  ok:       { color: "#3b82f6", bg: "rgba(59,130,246,0.10)",  border: "rgba(59,130,246,0.2)" },
  info:     { color: "#b3b4b5", bg: "rgba(179,180,181,0.08)", border: "rgba(179,180,181,0.15)" },
};

function ResultBadge({ result, label }: { result: string; label: string }) {
  const s = RESULT_STYLE[result] ?? RESULT_STYLE.info;
  return (
    <span
      style={{
        fontFamily: "var(--font-dm-mono)",
        fontSize: "11px",
        textTransform: "uppercase" as const,
        letterSpacing: "0.06em",
        padding: "2px 8px",
        borderRadius: 6,
        fontWeight: 600,
        flexShrink: 0,
        color: s.color,
        background: s.bg,
        border: `0.8px solid ${s.border}`,
      }}
    >
      {label}
    </span>
  );
}

// ── Origin badge ───────────────────────────────────────────────────────────────
const ORIGIN_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  automatic: { color: "#b3b4b5", bg: "rgba(179,180,181,0.08)", border: "rgba(179,180,181,0.12)" },
  manual:    { color: "#3b82f6", bg: "rgba(59,130,246,0.08)",  border: "rgba(59,130,246,0.15)" },
  system:    { color: "#a855f7", bg: "rgba(168,85,247,0.08)",  border: "rgba(168,85,247,0.15)" },
};

function OriginBadge({ origin, label }: { origin: string; label: string }) {
  const s = ORIGIN_STYLE[origin] ?? ORIGIN_STYLE.system;
  return (
    <span
      style={{
        fontFamily: "var(--font-dm-mono)",
        fontSize: "11px",
        textTransform: "uppercase" as const,
        letterSpacing: "0.06em",
        padding: "2px 8px",
        borderRadius: 6,
        fontWeight: 600,
        flexShrink: 0,
        color: s.color,
        background: s.bg,
        border: `0.8px solid ${s.border}`,
      }}
    >
      {label}
    </span>
  );
}

// ── Entry row ─────────────────────────────────────────────────────────────────
function EntryRow({ entry }: { entry: HistoryEntry }) {
  const isFindings    = entry.result === "findings";
  const isScanSuccess = entry.event_type === "scan_success";
  const isScanWarn    = entry.event_type === "scan_warning";

  const iconBg =
    isScanSuccess ? "rgba(62,207,142,0.10)" :
    isScanWarn    ? "rgba(245,158,11,0.10)"  :
    isFindings    ? "rgba(239,68,68,0.08)"   :
    "rgba(255,255,255,0.04)";

  const leftBorderColor =
    isScanSuccess ? "rgba(62,207,142,0.5)" :
    isScanWarn    ? "rgba(245,158,11,0.5)"  :
    isFindings    ? "rgba(239,68,68,0.5)"   :
    "#1a1a1a";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "13px 20px",
        background: "#151515",
        border: `0.8px solid #1a1a1a`,
        borderRadius: 16,
        marginBottom: 6,
        transition: "border-color 0.15s",
        borderLeft: `3px solid ${leftBorderColor}`,
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          background: iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.95rem",
          flexShrink: 0,
          color: isScanSuccess ? "#3ecf8e" : isScanWarn ? "#f59e0b" : "inherit",
          fontWeight: 700,
        }}
      >
        {entry.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#f5f5f5",
              fontFamily: "var(--font-dm-sans)",
            }}
          >
            {entry.title}
          </span>
          <ResultBadge result={entry.result} label={entry.result_label} />
          <OriginBadge origin={entry.origin} label={entry.origin_label} />
        </div>
        <p
          style={{
            fontSize: "0.75rem",
            color: "#71717a",
            marginTop: 2,
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {entry.description}
        </p>
      </div>

      {/* Timestamp */}
      <div
        style={{
          fontFamily: "var(--font-dm-mono)",
          fontSize: "0.68rem",
          color: "#71717a",
          textAlign: "right",
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        {fmtDate(entry.occurred_at)}
      </div>
    </div>
  );
}

// ── Day group ──────────────────────────────────────────────────────────────────
function DayGroup({ dayLabel, items }: { dayLabel: string; items: HistoryEntry[] }) {
  return (
    <div>
      {/* Section label */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <span
          style={{
            fontFamily: "var(--font-dm-mono)",
            fontSize: "0.62rem",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            fontWeight: 600,
            color: "#71717a",
            whiteSpace: "nowrap",
          }}
        >
          {dayLabel}
        </span>
        <div style={{ flex: 1, height: 1, background: "#1a1a1a" }} />
        <span
          style={{
            fontFamily: "var(--font-dm-mono)",
            fontSize: "0.6rem",
            color: "#71717a",
          }}
        >
          {items.length}
        </span>
      </div>
      <div>
        {items.map((e) => (
          <EntryRow key={e.id} entry={e} />
        ))}
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState({ dateFilter }: { dateFilter: string }) {
  const msg =
    dateFilter === "week"
      ? "en los últimos 7 días"
      : dateFilter === "month"
      ? "en el último mes"
      : "aún";

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
          background: "rgba(59,130,246,0.06)",
          border: "0.8px solid rgba(59,130,246,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.3rem",
        }}
      >
        ≡
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
          Sin actividad
        </div>
        <div style={{ fontSize: "0.82rem", color: "#71717a", maxWidth: 280, lineHeight: 1.6 }}>
          Tu historial de actividad {msg} aparecerá aquí. Los escaneos automáticos y eventos de
          seguridad quedarán registrados.
        </div>
      </div>
    </div>
  );
}

// ── Filter constants ───────────────────────────────────────────────────────────
const DATE_FILTERS = [
  { key: "week",  label: "Última semana" },
  { key: "month", label: "Último mes" },
  { key: "all",   label: "Todo" },
];

const EVENT_FILTERS = [
  { key: "",                label: "Todos los eventos" },
  { key: "scan_success",    label: "Escaneos exitosos" },
  { key: "scan_warning",    label: "Escaneos con advertencias" },
  { key: "alert_generated", label: "Alertas" },
  { key: "darkweb_scan",    label: "Escaneos Dark Web" },
  { key: "auto_scan",       label: "Escaneos automáticos" },
  { key: "domain_added",    label: "Dominios añadidos" },
  { key: "email_added",     label: "Emails añadidos" },
];

// ── Pagination ─────────────────────────────────────────────────────────────────
function Pagination({
  page, total, perPage, onPage,
}: {
  page: number;
  total: number;
  perPage: number;
  onPage: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) return null;

  const showing = Math.min(page * perPage, total);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 24,
        paddingTop: 18,
        borderTop: "0.8px solid #1a1a1a",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-dm-mono)",
          fontSize: "0.68rem",
          color: "#71717a",
        }}
      >
        {showing} de {total} eventos
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          style={{
            padding: "6px 14px",
            borderRadius: 8,
            background: "#151515",
            border: "0.8px solid #1a1a1a",
            color: "#b3b4b5",
            fontSize: "0.78rem",
            fontWeight: 600,
            cursor: page <= 1 ? "not-allowed" : "pointer",
            opacity: page <= 1 ? 0.3 : 1,
            fontFamily: "var(--font-dm-sans)",
            transition: "opacity 0.15s",
          }}
        >
          ← Anterior
        </button>

        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          const p = page <= 3 ? i + 1 : page + i - 2;
          if (p < 1 || p > totalPages) return null;
          const isActive = p === page;
          return (
            <button
              key={p}
              onClick={() => onPage(p)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                fontFamily: "var(--font-dm-mono)",
                fontSize: "0.75rem",
                fontWeight: 600,
                transition: "all 0.15s",
                cursor: "pointer",
                background: isActive ? "#3ecf8e" : "#151515",
                color: isActive ? "#000" : "#71717a",
                border: isActive ? "none" : "0.8px solid #1a1a1a",
              }}
            >
              {p}
            </button>
          );
        })}

        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          style={{
            padding: "6px 14px",
            borderRadius: 8,
            background: "#151515",
            border: "0.8px solid #1a1a1a",
            color: "#b3b4b5",
            fontSize: "0.78rem",
            fontWeight: 600,
            cursor: page >= totalPages ? "not-allowed" : "pointer",
            opacity: page >= totalPages ? 0.3 : 1,
            fontFamily: "var(--font-dm-sans)",
            transition: "opacity 0.15s",
          }}
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function HistoryPage() {
  const [data, setData]               = useState<HistoryData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [dateFilter, setDateFilter]   = useState("month");
  const [eventFilter, setEventFilter] = useState("");
  const [page, setPage]               = useState(1);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await historyApi.list({ dateFilter, eventType: eventFilter || undefined, page: p });
      setData(res.data);
    } catch {
      toast.error("Error al cargar el historial");
    } finally {
      setLoading(false);
    }
  }, [dateFilter, eventFilter]);

  useEffect(() => {
    setPage(1);
    load(1);
  }, [dateFilter, eventFilter]); // eslint-disable-line

  useEffect(() => {
    load(page);
  }, [page]); // eslint-disable-line

  const handlePage = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const groups = data ? groupByDay(Array.isArray(data.entries) ? data.entries : []) : [];

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
            Historial de actividad
          </h1>
          <p
            style={{
              color: "#71717a",
              fontSize: "0.8rem",
              marginTop: 5,
              margin: "5px 0 0",
            }}
          >
            Registro cronológico de todos los eventos de seguridad
          </p>
        </div>
        {data && (
          <span
            style={{
              fontFamily: "var(--font-dm-mono)",
              fontSize: "0.68rem",
              color: "#71717a",
              marginTop: 6,
            }}
          >
            {data.total} evento{data.total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 28,
        }}
      >
        {/* Date filter pills */}
        <div
          style={{
            display: "flex",
            gap: 4,
            padding: 4,
            background: "#1c1c1c",
            border: "0.8px solid #1a1a1a",
            borderRadius: 8,
          }}
        >
          {DATE_FILTERS.map((f) => {
            const active = dateFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setDateFilter(f.key)}
                style={{
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
              </button>
            );
          })}
        </div>

        {/* Event type select */}
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            fontSize: "13px",
            outline: "none",
            cursor: "pointer",
            fontFamily: "var(--font-dm-sans)",
            background: "#1c1c1c",
            border: "0.8px solid #1a1a1a",
            color: eventFilter ? "#3ecf8e" : "#71717a",
            appearance: "none",
            WebkitAppearance: "none",
            paddingRight: "28px",
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2371717a' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 10px center",
          }}
        >
          {EVENT_FILTERS.map((f) => (
            <option key={f.key} value={f.key} style={{ background: "#1c1c1c", color: "#f5f5f5" }}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 192,
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
      ) : !data || data.entries.length === 0 ? (
        <EmptyState dateFilter={dateFilter} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {groups.map((g) => (
            <DayGroup key={g.dayLabel} dayLabel={g.dayLabel} items={g.items} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && (
        <Pagination
          page={page}
          total={data.total}
          perPage={data.per_page}
          onPage={handlePage}
        />
      )}

      {/* Footer */}
      <div style={{ background: "#151515", border: "0.8px solid #1a1a1a", borderRadius: 16, padding: "12px 24px", display: "flex", justifyContent: "space-between", marginTop: 40 }}>
        <span style={{ fontSize: "12px", color: "#71717a" }}>© 2026 • v1.0.0</span>
        <span style={{ fontSize: "12px", color: "#71717a" }}>by <span style={{ color: "#b3b4b5", fontWeight: 500 }}>ChronoShield</span></span>
      </div>
    </div>
  );
}
