"use client";

import { useEffect, useState, useCallback } from "react";
import { historyApi } from "@/lib/api";
import toast from "react-hot-toast";

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
const RESULT_STYLE: Record<string, { color: string; bg: string }> = {
  clean:    { color: "#22c55e", bg: "rgba(34,197,94,0.10)" },
  findings: { color: "#ff4d6a", bg: "rgba(255,77,106,0.10)" },
  ok:       { color: "#22d3ee", bg: "rgba(34,211,238,0.10)" },
  info:     { color: "#55556a", bg: "rgba(85,85,106,0.10)" },
};

function ResultBadge({ result, label }: { result: string; label: string }) {
  const s = RESULT_STYLE[result] ?? RESULT_STYLE.info;
  return (
    <span
      style={{
        fontFamily: "var(--font-mono-family)",
        fontSize: "0.58rem",
        textTransform: "uppercase" as const,
        letterSpacing: "1px",
        padding: "3px 8px",
        borderRadius: 6,
        fontWeight: 600,
        flexShrink: 0,
        color: s.color,
        background: s.bg,
      }}
    >
      {label}
    </span>
  );
}

// ── Origin badge ───────────────────────────────────────────────────────────────
const ORIGIN_STYLE: Record<string, { color: string; bg: string }> = {
  automatic: { color: "#55556a", bg: "rgba(85,85,106,0.08)" },
  manual:    { color: "#22d3ee", bg: "rgba(34,211,238,0.08)" },
  system:    { color: "#6366f1", bg: "rgba(99,102,241,0.08)" },
};

function OriginBadge({ origin, label }: { origin: string; label: string }) {
  const s = ORIGIN_STYLE[origin] ?? ORIGIN_STYLE.system;
  return (
    <span
      style={{
        fontFamily: "var(--font-mono-family)",
        fontSize: "0.58rem",
        textTransform: "uppercase" as const,
        letterSpacing: "1px",
        padding: "3px 8px",
        borderRadius: 6,
        fontWeight: 600,
        flexShrink: 0,
        color: s.color,
        background: s.bg,
        border: `1px solid ${s.color}30`,
      }}
    >
      {label}
    </span>
  );
}

// ── Entry card ─────────────────────────────────────────────────────────────────
function EntryRow({ entry }: { entry: HistoryEntry }) {
  const isFindings = entry.result === "findings";

  // Type icon background color based on result
  const iconBg = isFindings
    ? "rgba(255,77,106,0.10)"
    : "rgba(255,255,255,0.04)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "13px 20px",
        background: "#0f0f16",
        border: `1px solid ${isFindings ? "rgba(255,77,106,0.10)" : "rgba(255,255,255,0.03)"}`,
        borderRadius: 10,
        marginBottom: 6,
        transition: "border-color 0.15s",
      }}
    >
      {/* Type icon in colored circle */}
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          background: iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1rem",
          flexShrink: 0,
        }}
      >
        {entry.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
          <span
            style={{
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#f0f0f5",
              fontFamily: "var(--font-jakarta-family)",
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
            color: "#55556a",
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
          fontFamily: "var(--font-mono-family)",
          fontSize: "0.7rem",
          color: "#33334a",
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
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <span
          style={{
            fontFamily: "var(--font-mono-family)",
            fontSize: "0.65rem",
            textTransform: "uppercase",
            letterSpacing: "2px",
            color: "#55556a",
            whiteSpace: "nowrap",
          }}
        >
          {dayLabel}
        </span>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.04)" }} />
      </div>
      <div>
        {items.map((e) => (
          <EntryRow key={e.id} entry={e} />
        ))}
      </div>
    </div>
  );
}

// ── Filter bar ─────────────────────────────────────────────────────────────────
const DATE_FILTERS = [
  { key: "week",  label: "Última semana" },
  { key: "month", label: "Último mes" },
  { key: "all",   label: "Todo" },
];

const EVENT_FILTERS = [
  { key: "",                label: "Todos los eventos" },
  { key: "alert_generated", label: "⚡ Alertas" },
  { key: "darkweb_scan",    label: "🕸 Escaneos Dark Web" },
  { key: "auto_scan",       label: "⟳ Escaneos automáticos" },
  { key: "domain_added",    label: "◎ Dominios añadidos" },
  { key: "email_added",     label: "✉ Emails añadidos" },
];

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState({ dateFilter }: { dateFilter: string }) {
  const msg =
    dateFilter === "week"
      ? "en los últimos 7 días"
      : dateFilter === "month"
      ? "en el último mes"
      : "aún";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "80px 0", textAlign: "center" }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: "rgba(34,211,238,0.06)",
          border: "1px solid rgba(34,211,238,0.10)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
        }}
      >
        ≡
      </div>
      <div>
        <div
          style={{
            fontFamily: "var(--font-serif-family)",
            fontSize: "1.1rem",
            fontWeight: 400,
            color: "#f0f0f5",
            marginBottom: 6,
          }}
        >
          Sin actividad
        </div>
        <div style={{ fontSize: "0.85rem", color: "#55556a", maxWidth: 280, lineHeight: 1.6 }}>
          Tu historial de actividad {msg} aparecerá aquí. Los escaneos automáticos y eventos de
          seguridad quedarán registrados.
        </div>
      </div>
    </div>
  );
}

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
        marginTop: 20,
        paddingTop: 16,
        borderTop: "1px solid rgba(255,255,255,0.03)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono-family)",
          fontSize: "0.72rem",
          color: "#33334a",
        }}
      >
        {showing} de {total} eventos
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          style={{
            padding: "6px 14px",
            borderRadius: 7,
            background: "#0f0f16",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "#9999ad",
            fontSize: "0.8rem",
            cursor: page <= 1 ? "not-allowed" : "pointer",
            opacity: page <= 1 ? 0.3 : 1,
            fontFamily: "var(--font-jakarta-family)",
          }}
        >
          ← Anterior
        </button>

        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          const p = page <= 3 ? i + 1 : page + i - 2;
          if (p < 1 || p > totalPages) return null;
          return (
            <button
              key={p}
              onClick={() => onPage(p)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 7,
                fontFamily: "var(--font-mono-family)",
                fontSize: "0.75rem",
                fontWeight: 600,
                transition: "all 0.2s",
                cursor: "pointer",
                ...(p === page
                  ? {
                      background: "rgba(0,229,191,0.10)",
                      color: "#00e5bf",
                      border: "1px solid rgba(0,229,191,0.20)",
                    }
                  : {
                      background: "rgba(255,255,255,0.03)",
                      color: "#55556a",
                      border: "1px solid rgba(255,255,255,0.05)",
                    }),
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
            borderRadius: 7,
            background: "#0f0f16",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "#9999ad",
            fontSize: "0.8rem",
            cursor: page >= totalPages ? "not-allowed" : "pointer",
            opacity: page >= totalPages ? 0.3 : 1,
            fontFamily: "var(--font-jakarta-family)",
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

  const groups = data ? groupByDay(data.entries) : [];

  return (
    <div
      style={{
        padding: "32px 36px 60px",
        background: "#050507",
        minHeight: "100vh",
        position: "relative",
        zIndex: 1,
        fontFamily: "var(--font-jakarta-family)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1
            style={{
              fontFamily: "var(--font-serif-family)",
              fontSize: "1.75rem",
              fontWeight: 400,
              letterSpacing: "-0.02em",
              color: "#f0f0f5",
              margin: 0,
            }}
          >
            Historial de actividad
          </h1>
          <p style={{ color: "#55556a", fontSize: "0.82rem", marginTop: 4, margin: "4px 0 0" }}>
            Registro cronológico de todos los eventos de seguridad de tu cuenta
          </p>
        </div>
        {data && (
          <span
            style={{
              fontFamily: "var(--font-mono-family)",
              fontSize: "0.72rem",
              color: "#33334a",
            }}
          >
            {data.total} evento{data.total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
        {/* Date filter tabs */}
        <div
          style={{
            display: "flex",
            gap: 4,
            padding: 4,
            background: "#0f0f16",
            border: "1px solid rgba(255,255,255,0.03)",
            borderRadius: 10,
          }}
        >
          {DATE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setDateFilter(f.key)}
              style={{
                padding: "7px 14px",
                borderRadius: 7,
                fontSize: "0.8rem",
                fontWeight: 600,
                transition: "all 0.2s",
                cursor: "pointer",
                border: "none",
                fontFamily: "var(--font-jakarta-family)",
                background: dateFilter === f.key ? "#1a1a26" : "transparent",
                color: dateFilter === f.key ? "#f0f0f5" : "#55556a",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Event type select */}
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 9,
            fontSize: "0.8rem",
            outline: "none",
            cursor: "pointer",
            fontFamily: "var(--font-jakarta-family)",
            background: "#0f0f16",
            border: "1px solid rgba(255,255,255,0.06)",
            color: eventFilter ? "#00e5bf" : "#55556a",
          }}
        >
          {EVENT_FILTERS.map((f) => (
            <option key={f.key} value={f.key} style={{ background: "#0f0f16" }}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 192 }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: "2px solid #00e5bf",
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
    </div>
  );
}
