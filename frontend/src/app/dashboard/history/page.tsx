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
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }) + `, ${time}`;
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
  clean:    { color: "#00E5A0", bg: "rgba(0,229,160,0.1)" },
  findings: { color: "#FF4D6A", bg: "rgba(255,77,106,0.1)" },
  ok:       { color: "#00C2FF", bg: "rgba(0,194,255,0.1)" },
  info:     { color: "#5A6B7A", bg: "rgba(90,107,122,0.1)" },
};

function ResultBadge({ result, label }: { result: string; label: string }) {
  const s = RESULT_STYLE[result] ?? RESULT_STYLE.info;
  return (
    <span
      className="font-mono text-[9px] uppercase tracking-[1px] px-2 py-px rounded-full shrink-0"
      style={{ color: s.color, background: s.bg }}
    >
      {label}
    </span>
  );
}

// ── Origin badge ───────────────────────────────────────────────────────────────
const ORIGIN_STYLE: Record<string, { color: string; bg: string }> = {
  automatic: { color: "#5A6B7A", bg: "rgba(90,107,122,0.08)" },
  manual:    { color: "#00C2FF", bg: "rgba(0,194,255,0.08)" },
  system:    { color: "#9B6DFF", bg: "rgba(155,109,255,0.08)" },
};

function OriginBadge({ origin, label }: { origin: string; label: string }) {
  const s = ORIGIN_STYLE[origin] ?? ORIGIN_STYLE.system;
  return (
    <span
      className="font-mono text-[9px] uppercase tracking-[1px] px-2 py-px rounded-full shrink-0 border"
      style={{ color: s.color, background: s.bg, borderColor: `${s.color}30` }}
    >
      {label}
    </span>
  );
}

// ── Entry card ─────────────────────────────────────────────────────────────────
function EntryRow({ entry }: { entry: HistoryEntry }) {
  const isFindings = entry.result === "findings";

  return (
    <div
      className="flex items-start gap-4 px-4 py-3.5 rounded-xl transition-colors"
      style={{
        background: "#0A0F14",
        border: `1px solid ${isFindings ? "rgba(255,77,106,0.1)" : "rgba(255,255,255,0.04)"}`,
      }}
    >
      {/* Icon */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-[16px] shrink-0 mt-0.5"
        style={{
          background: isFindings ? "rgba(255,77,106,0.08)" : "rgba(255,255,255,0.04)",
        }}
      >
        {entry.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-syne font-semibold text-[13px] text-[#E8EDF2]">{entry.title}</span>
          <ResultBadge result={entry.result} label={entry.result_label} />
          <OriginBadge origin={entry.origin} label={entry.origin_label} />
        </div>
        <p className="text-[11px] text-[#5A6B7A] leading-relaxed line-clamp-2">
          {entry.description}
        </p>
      </div>

      {/* Time */}
      <div className="text-right shrink-0">
        <div className="text-[10px] text-[#5A6B7A] whitespace-nowrap">{fmtDate(entry.occurred_at)}</div>
      </div>
    </div>
  );
}

// ── Day group ──────────────────────────────────────────────────────────────────
function DayGroup({ dayLabel, items }: { dayLabel: string; items: HistoryEntry[] }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2.5">
        <span className="font-mono text-[10px] uppercase tracking-[2px] text-[#5A6B7A]">
          {dayLabel}
        </span>
        <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />
      </div>
      <div className="space-y-2">
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
  { key: "",              label: "Todos los eventos" },
  { key: "alert_generated", label: "⚡ Alertas" },
  { key: "darkweb_scan",  label: "🕸 Escaneos Dark Web" },
  { key: "auto_scan",     label: "⟳ Escaneos automáticos" },
  { key: "domain_added",  label: "◎ Dominios añadidos" },
  { key: "email_added",   label: "✉ Emails añadidos" },
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
    <div className="flex flex-col items-center justify-center py-24 gap-5">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl"
        style={{ background: "rgba(0,194,255,0.06)", border: "1px solid rgba(0,194,255,0.12)" }}
      >
        ≡
      </div>
      <div className="text-center">
        <h3 className="font-syne font-bold text-[18px] text-[#E8EDF2] mb-2">Sin actividad</h3>
        <p className="text-[13px] text-[#5A6B7A] max-w-xs leading-relaxed">
          Tu historial de actividad {msg} aparecerá aquí. Los escaneos automáticos y eventos de
          seguridad quedarán registrados.
        </p>
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

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-30"
        style={{ background: "rgba(255,255,255,0.04)", color: "#5A6B7A", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        ← Anterior
      </button>

      <div className="flex items-center gap-1">
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          const p = page <= 3 ? i + 1 : page + i - 2;
          if (p < 1 || p > totalPages) return null;
          return (
            <button
              key={p}
              onClick={() => onPage(p)}
              className="w-8 h-8 rounded-lg text-[11px] font-mono font-semibold transition-all"
              style={
                p === page
                  ? { background: "rgba(0,194,255,0.1)", color: "#00C2FF", border: "1px solid rgba(0,194,255,0.2)" }
                  : { background: "rgba(255,255,255,0.03)", color: "#5A6B7A", border: "1px solid rgba(255,255,255,0.05)" }
              }
            >
              {p}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-30"
        style={{ background: "rgba(255,255,255,0.04)", color: "#5A6B7A", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        Siguiente →
      </button>

      <span className="text-[10px] text-[#5A6B7A] ml-2">
        Pág. {page} de {totalPages} · {total} eventos
      </span>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function HistoryPage() {
  const [data, setData]           = useState<HistoryData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [dateFilter, setDateFilter] = useState("month");
  const [eventFilter, setEventFilter] = useState("");
  const [page, setPage]           = useState(1);

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
    <div className="p-9">
      {/* ── Header ── */}
      <div className="mb-7 fade-up">
        <h1 className="font-syne font-bold text-[22px] text-[#E8EDF2]">Historial de actividad</h1>
        <p className="text-[12px] text-[#5A6B7A] mt-0.5">
          Registro cronológico de todos los eventos de seguridad de tu cuenta
        </p>
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-3 flex-wrap mb-6 fade-up">
        {/* Date filter */}
        <div
          className="flex items-center rounded-xl overflow-hidden"
          style={{ background: "#0D1218", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          {DATE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setDateFilter(f.key)}
              className="px-3.5 py-2 text-[11px] font-semibold transition-all"
              style={
                dateFilter === f.key
                  ? { color: "#00C2FF", background: "rgba(0,194,255,0.08)" }
                  : { color: "#5A6B7A" }
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Event type filter */}
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="px-3 py-2 text-[11px] rounded-xl outline-none cursor-pointer"
          style={{
            background: "#0D1218",
            border: "1px solid rgba(255,255,255,0.06)",
            color: eventFilter ? "#00C2FF" : "#5A6B7A",
          }}
        >
          {EVENT_FILTERS.map((f) => (
            <option key={f.key} value={f.key} style={{ background: "#0D1218" }}>
              {f.label}
            </option>
          ))}
        </select>

        {data && (
          <span className="text-[11px] text-[#5A6B7A] ml-auto">
            {data.total} evento{data.total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-[#00C2FF] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data || data.entries.length === 0 ? (
        <EmptyState dateFilter={dateFilter} />
      ) : (
        <div className="space-y-7 fade-up">
          {groups.map((g) => (
            <DayGroup key={g.dayLabel} dayLabel={g.dayLabel} items={g.items} />
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
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
