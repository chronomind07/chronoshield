"use client";

import { useEffect, useState, useCallback } from "react";
import { darkwebApi, creditsApi } from "@/lib/api";
import toast from "react-hot-toast";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Credits {
  credits_available: number;
  credits_used: number;
  reset_date: string;
  plan: string;
}

interface BreachRecord {
  id?: string;
  email?: string;
  domain?: string;
  username?: string;
  password?: string;
  hashedPassword?: string;
  ipAddress?: string;
  timestamp?: string;
  source?: string;
  breachName?: string;
}

interface EmailItem {
  id: string;
  email: string;
  last_scan_at: string | null;
  breach_count: number;
  status: "breached" | "clean" | "never_scanned";
  latest_breaches: BreachRecord[];
}

interface DomainItem {
  id: string;
  domain: string;
  last_scan_at: string | null;
  breach_count: number;
  status: "found" | "clean" | "never_scanned";
  latest_results: BreachRecord[];
}

interface ImpersonationItem {
  id: string;
  domain: string;
  last_scan_at: string | null;
  threats_count: number;
  status: "threatened" | "clean" | "never_scanned";
  latest_threats: BreachRecord[];
}

interface ScanAllBreakdown {
  emails: number;
  domains: number;
  impersonation: number;
}

interface DarkWebSummary {
  plan: string;
  credits: Credits;
  emails: EmailItem[];
  domains: DomainItem[];
  impersonation: ImpersonationItem[];
  impersonation_available: boolean;
  scan_all_cost: number;
  scan_all_breakdown: ScanAllBreakdown;
  last_scan_at: string | null;
  next_auto_scan: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function handleScanError(err: unknown, setShowPacks: (v: boolean) => void) {
  const e = err as { response?: { data?: { detail?: { code?: string; message?: string } | string } } };
  const detail = e?.response?.data?.detail;
  const msg = typeof detail === "object" ? detail?.message : (detail as string) || "Error al escanear";
  toast.error(msg as string);
  if (typeof detail === "object" && detail?.code === "NO_CREDITS") {
    setShowPacks(true);
  }
}

// ── Credit badge ───────────────────────────────────────────────────────────────
function CreditBadge({ credits }: { credits: Credits }) {
  const total = credits.credits_available + credits.credits_used;
  const pct = total > 0 ? credits.credits_available / total : 1;
  const color =
    credits.credits_available > 2 ? "#00E5A0" :
    credits.credits_available > 0 ? "#FFB340" : "#FF4D6A";

  return (
    <div
      className="flex items-center gap-4 px-5 py-3.5 rounded-xl"
      style={{ background: "#0D1218", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="flex-1">
        <div className="font-mono text-[9px] uppercase tracking-[2px] text-[#5A6B7A] mb-1">Créditos</div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-syne font-bold text-[26px] leading-none" style={{ color }}>
            {credits.credits_available}
          </span>
          <span className="text-[11px] text-[#5A6B7A]">/ {total}</span>
        </div>
        <div className="h-1 rounded-full mt-2 overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct * 100}%`, background: color }}
          />
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-mono text-[9px] uppercase tracking-[2px] text-[#5A6B7A]">Reset</div>
        <div className="text-[12px] text-[#E8EDF2] mt-0.5">{fmtDate(credits.reset_date)}</div>
      </div>
    </div>
  );
}

// ── Status pill ────────────────────────────────────────────────────────────────
type ItemStatus = "breached" | "found" | "threatened" | "clean" | "never_scanned";

function StatusPill({ status }: { status: ItemStatus }) {
  const map: Record<ItemStatus, { label: string; color: string; bg: string }> = {
    breached:      { label: "FILTRADO",      color: "#FF4D6A", bg: "rgba(255,77,106,0.1)" },
    found:         { label: "DETECTADO",     color: "#FF4D6A", bg: "rgba(255,77,106,0.1)" },
    threatened:    { label: "AMENAZA",       color: "#FFB340", bg: "rgba(255,179,64,0.1)" },
    clean:         { label: "LIMPIO",        color: "#00E5A0", bg: "rgba(0,229,160,0.1)" },
    never_scanned: { label: "SIN ESCANEAR", color: "#5A6B7A", bg: "rgba(90,107,122,0.1)" },
  };
  const s = map[status];
  return (
    <span
      className="font-mono text-[9px] uppercase tracking-[1px] px-2 py-px rounded-full shrink-0"
      style={{ color: s.color, background: s.bg }}
    >
      {s.label}
    </span>
  );
}

// ── Scan button ────────────────────────────────────────────────────────────────
function ScanBtn({
  scanning, onClick, small,
}: {
  scanning: boolean;
  onClick: () => void;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={scanning}
      className={`flex items-center gap-1 font-semibold rounded-lg transition-all shrink-0 disabled:opacity-50 ${
        small ? "text-[11px] px-3 py-1.5" : "text-[12px] px-4 py-2"
      }`}
      style={{
        background: scanning ? "rgba(0,194,255,0.06)" : "rgba(0,194,255,0.08)",
        border: "1px solid rgba(0,194,255,0.2)",
        color: "#00C2FF",
      }}
    >
      <span className={scanning ? "animate-spin" : ""}>⟳</span>
      {scanning ? "Escaneando" : "Escanear"}
    </button>
  );
}

// ── Breach detail row ──────────────────────────────────────────────────────────
function BreachDetail({ record }: { record: BreachRecord }) {
  const hasPassword = !!(record.password || record.hashedPassword);
  return (
    <div
      className="rounded-lg px-3 py-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5"
      style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.04)" }}
    >
      {[
        { label: "Fuente",     val: record.breachName || record.source },
        { label: "Email",      val: record.email },
        { label: "Usuario",    val: record.username },
        { label: "Dominio",    val: record.domain },
        { label: "IP",         val: record.ipAddress },
        { label: "Contraseña", val: record.password ? "expuesta" : record.hashedPassword ? "hash expuesto" : null },
        { label: "Fecha",      val: record.timestamp ? fmtDate(record.timestamp) : null },
      ].filter((f) => f.val).map((f) => (
        <div key={f.label}>
          <div className="font-mono text-[9px] uppercase tracking-[1px] text-[#5A6B7A]">{f.label}</div>
          <div
            className="font-mono text-[11px] mt-px break-all"
            style={{ color: f.label === "Contraseña" && hasPassword ? "#FF4D6A" : "#E8EDF2" }}
          >
            {f.val}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Email row ──────────────────────────────────────────────────────────────────
function EmailRow({
  item, onScan, setShowPacks,
}: {
  item: EmailItem;
  onScan: (id: string) => void;
  setShowPacks: (v: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [scanning, setScanning] = useState(false);

  const handleScan = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setScanning(true);
    try {
      const res = await darkwebApi.scanEmail(item.id);
      toast.success(`Escaneo iniciado · ${res.data.credits_remaining} créditos restantes`);
      onScan(item.id);
    } catch (err) {
      handleScanError(err, setShowPacks);
    } finally {
      setScanning(false);
    }
  };

  const danger = item.status === "breached";

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "#0A0F14",
        border: `1px solid ${danger ? "rgba(255,77,106,0.15)" : "rgba(255,255,255,0.05)"}`,
      }}
    >
      <button
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
          style={{
            background: danger ? "rgba(255,77,106,0.1)" : "rgba(0,229,160,0.08)",
          }}
        >
          {danger ? "⚠" : "✉"}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-mono text-[13px] text-[#E8EDF2] truncate">{item.email}</div>
          <div className="text-[10px] text-[#5A6B7A] mt-0.5">
            {item.last_scan_at ? relTime(item.last_scan_at) : "Nunca escaneado"}
            {item.breach_count > 0 && (
              <span className="text-[#FF4D6A] ml-2">{item.breach_count} filtración{item.breach_count !== 1 ? "es" : ""}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <StatusPill status={item.status} />
          <ScanBtn scanning={scanning} onClick={handleScan} small />
          <span className="text-[#5A6B7A] text-[11px] ml-1">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && item.latest_breaches.length > 0 && (
        <div
          className="px-4 pb-4 pt-2 space-y-2"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
        >
          <div className="font-mono text-[9px] uppercase tracking-[1px] text-[#5A6B7A] mb-2">
            Filtraciones encontradas
          </div>
          {item.latest_breaches.map((r, i) => (
            <BreachDetail key={r.id || i} record={r} />
          ))}
        </div>
      )}

      {expanded && item.latest_breaches.length === 0 && item.status !== "never_scanned" && (
        <div
          className="px-4 pb-4 pt-3 text-center"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
        >
          <span className="font-mono text-[12px] text-[#00E5A0]">✓ Sin filtraciones detectadas</span>
        </div>
      )}

      {expanded && item.status === "never_scanned" && (
        <div
          className="px-4 pb-4 pt-3 text-center"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
        >
          <span className="text-[12px] text-[#5A6B7A]">Este email aún no ha sido escaneado</span>
        </div>
      )}
    </div>
  );
}

// ── Domain row ─────────────────────────────────────────────────────────────────
function DomainRow({
  item, onScan, setShowPacks, scanType,
}: {
  item: DomainItem | ImpersonationItem;
  onScan: (id: string) => void;
  setShowPacks: (v: boolean) => void;
  scanType: "domain" | "impersonation";
}) {
  const [expanded, setExpanded] = useState(false);
  const [scanning, setScanning] = useState(false);

  const isImpersonation = scanType === "impersonation";
  const domainItem = item as DomainItem;
  const impoItem = item as ImpersonationItem;

  const count = isImpersonation ? impoItem.threats_count : domainItem.breach_count;
  const status = item.status as ItemStatus;
  const results = isImpersonation ? impoItem.latest_threats : domainItem.latest_results;

  const handleScan = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setScanning(true);
    try {
      const res = isImpersonation
        ? await darkwebApi.scanImpersonation(item.id)
        : await darkwebApi.scanDomain(item.id);
      toast.success(`Escaneo iniciado · ${res.data.credits_remaining} créditos restantes`);
      onScan(item.id);
    } catch (err) {
      handleScanError(err, setShowPacks);
    } finally {
      setScanning(false);
    }
  };

  const danger = status === "found" || status === "threatened";

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "#0A0F14",
        border: `1px solid ${danger ? "rgba(255,77,106,0.15)" : "rgba(255,255,255,0.05)"}`,
      }}
    >
      <button
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
          style={{
            background: danger ? "rgba(255,77,106,0.1)" : "rgba(0,229,160,0.08)",
          }}
        >
          {isImpersonation ? "🕸" : "◎"}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-mono text-[13px] text-[#E8EDF2] truncate">{item.domain}</div>
          <div className="text-[10px] text-[#5A6B7A] mt-0.5">
            {item.last_scan_at ? relTime(item.last_scan_at) : "Nunca escaneado"}
            {count > 0 && (
              <span className="text-[#FF4D6A] ml-2">
                {count} {isImpersonation ? `amenaza${count !== 1 ? "s" : ""}` : `hallazgo${count !== 1 ? "s" : ""}`}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <StatusPill status={status} />
          <ScanBtn scanning={scanning} onClick={handleScan} small />
          <span className="text-[#5A6B7A] text-[11px] ml-1">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && results.length > 0 && (
        <div
          className="px-4 pb-4 pt-2 space-y-2"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
        >
          <div className="font-mono text-[9px] uppercase tracking-[1px] text-[#5A6B7A] mb-2">
            {isImpersonation ? "Dominios suplantadores detectados" : "Resultados en dark web"}
          </div>
          {results.map((r, i) => (
            <BreachDetail key={(r as BreachRecord).id || i} record={r as BreachRecord} />
          ))}
        </div>
      )}

      {expanded && results.length === 0 && status !== "never_scanned" && (
        <div
          className="px-4 pb-4 pt-3 text-center"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
        >
          <span className="font-mono text-[12px] text-[#00E5A0]">
            ✓ {isImpersonation ? "Sin suplantaciones detectadas" : "Sin hallazgos en dark web"}
          </span>
        </div>
      )}

      {expanded && status === "never_scanned" && (
        <div
          className="px-4 pb-4 pt-3 text-center"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
        >
          <span className="text-[12px] text-[#5A6B7A]">Este dominio aún no ha sido escaneado</span>
        </div>
      )}
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({
  title, icon, totalDanger, locked, children,
}: {
  title: string;
  icon: string;
  totalDanger: number;
  locked?: boolean;
  children: React.ReactNode;
}) {
  const borderColor = locked
    ? "rgba(255,255,255,0.06)"
    : totalDanger > 0
    ? "rgba(255,77,106,0.2)"
    : "rgba(255,255,255,0.06)";

  const barColor = locked ? "#5A6B7A" : totalDanger > 0 ? "#FF4D6A" : "#00E5A0";

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-6"
      style={{ background: "#0D1218", border: `1px solid ${borderColor}` }}
    >
      <div
        className="absolute bottom-0 left-0 right-0 h-[2px]"
        style={{ background: barColor, boxShadow: `0 0 10px ${barColor}44` }}
      />

      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <span className="text-[18px]">{icon}</span>
          <h3 className="font-syne font-bold text-[15px] text-[#E8EDF2]">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {locked && (
            <span
              className="font-mono text-[9px] uppercase tracking-[1px] px-2 py-px rounded-full border"
              style={{ color: "#FFB340", background: "rgba(255,179,64,0.08)", borderColor: "rgba(255,179,64,0.2)" }}
            >
              Solo Business
            </span>
          )}
          {!locked && (
            <span
              className="font-mono text-[9px] uppercase tracking-[1px] px-2 py-px rounded-full"
              style={
                totalDanger > 0
                  ? { background: "rgba(255,77,106,0.1)", color: "#FF4D6A" }
                  : { background: "rgba(0,229,160,0.1)", color: "#00E5A0" }
              }
            >
              {totalDanger > 0 ? `${totalDanger} hallazgos` : "Sin amenazas"}
            </span>
          )}
        </div>
      </div>

      {locked ? (
        <div className="py-8 flex flex-col items-center gap-3 text-center">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            🔒
          </div>
          <p className="text-[13px] text-[#5A6B7A]">
            Disponible en el plan{" "}
            <span className="text-[#E8EDF2] font-semibold">Business</span>
          </p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

// ── Scan All confirm modal ──────────────────────────────────────────────────────
function ScanAllModal({
  cost, breakdown, credits, onConfirm, onClose, onBuyCredits,
}: {
  cost: number;
  breakdown: ScanAllBreakdown;
  credits: Credits;
  onConfirm: () => void;
  onClose: () => void;
  onBuyCredits: () => void;
}) {
  const canAfford = credits.credits_available >= cost;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(8,12,16,0.9)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-7"
        style={{ background: "#0D1218", border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-5"
          style={{ background: canAfford ? "rgba(0,194,255,0.08)" : "rgba(255,77,106,0.08)" }}
        >
          {canAfford ? "🔍" : "⚠️"}
        </div>

        <h2 className="font-syne font-bold text-[17px] text-[#E8EDF2] mb-1">
          {canAfford ? "Escaneo general" : "Créditos insuficientes"}
        </h2>

        {canAfford ? (
          <>
            <p className="text-[12px] text-[#5A6B7A] mb-5 leading-relaxed">
              Este escaneo analizará todos tus activos y consumirá{" "}
              <span className="text-[#E8EDF2] font-semibold">{cost} créditos</span>.
            </p>

            {/* Desglose */}
            <div
              className="rounded-xl p-4 mb-5 space-y-2"
              style={{ background: "#121A22", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              {[
                { label: "Emails", count: breakdown.emails, icon: "✉" },
                { label: "Dominios", count: breakdown.domains, icon: "◎" },
                { label: "Suplantación", count: breakdown.impersonation, icon: "🕸" },
              ].filter((r) => r.count > 0).map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[12px] text-[#5A6B7A]">
                    <span>{row.icon}</span>
                    <span>{row.label}</span>
                    <span className="text-[#E8EDF2]">× {row.count}</span>
                  </div>
                  <span className="font-mono text-[11px] text-[#5A6B7A]">{row.count} créd.</span>
                </div>
              ))}
              <div
                className="flex items-center justify-between pt-2"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
              >
                <span className="text-[12px] font-semibold text-[#E8EDF2]">Total</span>
                <span className="font-syne font-bold text-[14px] text-[#00C2FF]">{cost} créditos</span>
              </div>
            </div>

            <p className="text-[11px] text-[#5A6B7A] mb-5">
              Te quedarán{" "}
              <span className="text-[#E8EDF2] font-semibold">
                {credits.credits_available - cost}
              </span>{" "}
              créditos.
            </p>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-[#5A6B7A]"
                style={{ background: "#121A22", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                Cancelar
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #0077FF, #00C2FF)" }}
              >
                Confirmar
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[12px] text-[#5A6B7A] mb-5 leading-relaxed">
              Necesitas{" "}
              <span className="text-[#E8EDF2] font-semibold">{cost} créditos</span> pero solo tienes{" "}
              <span className="text-[#FF4D6A] font-semibold">{credits.credits_available}</span>.
              Compra un pack para continuar.
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-[#5A6B7A]"
                style={{ background: "#121A22", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                Cancelar
              </button>
              <button
                onClick={onBuyCredits}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #0077FF, #00C2FF)" }}
              >
                Comprar créditos
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Credit pack modal ──────────────────────────────────────────────────────────
function CreditPackModal({
  credits, onClose, onBuy,
}: {
  credits: Credits;
  onClose: () => void;
  onBuy: (pack: "s" | "m" | "l") => void;
}) {
  const packs = [
    { key: "s" as const, label: "Pack S", credits: 5,  price: "9,99€",  per: "2,00€/créd." },
    { key: "m" as const, label: "Pack M", credits: 10, price: "18,99€", per: "1,90€/créd." },
    { key: "l" as const, label: "Pack L", credits: 20, price: "34,99€", per: "1,75€/créd.", popular: true },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(8,12,16,0.9)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-7"
        style={{ background: "#0D1218", border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="font-syne font-bold text-[18px] text-[#E8EDF2]">Comprar créditos</h2>
            <p className="text-[12px] text-[#5A6B7A] mt-0.5">
              Tienes {credits.credits_available} crédito{credits.credits_available !== 1 ? "s" : ""} disponible{credits.credits_available !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={onClose} className="text-[#5A6B7A] hover:text-[#E8EDF2] text-xl leading-none">×</button>
        </div>

        <div className="space-y-3 mb-5">
          {packs.map((pack) => (
            <button
              key={pack.key}
              onClick={() => onBuy(pack.key)}
              className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left transition-all"
              style={{
                background: pack.popular ? "rgba(0,119,255,0.06)" : "#121A22",
                border: pack.popular ? "1px solid rgba(0,194,255,0.2)" : "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-syne font-bold text-[13px] shrink-0"
                style={{
                  background: pack.popular ? "rgba(0,194,255,0.12)" : "rgba(255,255,255,0.04)",
                  color: pack.popular ? "#00C2FF" : "#5A6B7A",
                }}
              >
                {pack.credits}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-syne font-semibold text-[14px] text-[#E8EDF2]">{pack.label}</span>
                  {pack.popular && (
                    <span
                      className="font-mono text-[9px] px-1.5 py-px rounded"
                      style={{ background: "rgba(0,194,255,0.1)", color: "#00C2FF" }}
                    >
                      POPULAR
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-[#5A6B7A]">{pack.credits} créditos · {pack.per}</div>
              </div>
              <div className="font-syne font-bold text-[16px] text-[#E8EDF2] shrink-0">{pack.price}</div>
            </button>
          ))}
        </div>

        <p className="text-[11px] text-[#5A6B7A] text-center">
          1 crédito = 1 escaneo (email, dominio o suplantación). Los créditos no caducan.
        </p>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function DarkWebPage() {
  const [summary, setSummary]       = useState<DarkWebSummary | null>(null);
  const [loading, setLoading]       = useState(true);
  const [scanningAll, setScanningAll] = useState(false);
  const [showScanAll, setShowScanAll] = useState(false);
  const [showPacks, setShowPacks]   = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await darkwebApi.summary();
      setSummary(res.data);
    } catch {
      toast.error("Error al cargar datos de Dark Web");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const confirmScanAll = async () => {
    setShowScanAll(false);
    setScanningAll(true);
    try {
      const res = await darkwebApi.scanAll();
      toast.success(
        `Escaneo general iniciado · ${res.data.credits_remaining} créditos restantes`,
      );
      setTimeout(() => load(), 4000);
    } catch (err) {
      handleScanError(err, setShowPacks);
    } finally {
      setScanningAll(false);
    }
  };

  const handleBuyPack = async (pack: "s" | "m" | "l") => {
    try {
      const res = await creditsApi.checkout(pack);
      window.location.href = res.data.url;
    } catch {
      toast.error("Error al iniciar la compra");
    }
  };

  // Reload after individual scan
  const onItemScanned = useCallback(() => {
    setTimeout(() => load(), 3000);
  }, [load]);

  if (loading) {
    return (
      <div className="p-10 flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#00C2FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!summary) return null;

  const totalEmailDanger = summary.emails.filter((e) => e.status === "breached").length;
  const totalDomainDanger = summary.domains.filter((d) => d.status === "found").length;
  const totalImpoDanger = summary.impersonation.filter((i) => i.status === "threatened").length;
  const overallDanger = totalEmailDanger + totalDomainDanger + totalImpoDanger;

  return (
    <div className="p-9">
      {/* Modals */}
      {showScanAll && summary && (
        <ScanAllModal
          cost={summary.scan_all_cost}
          breakdown={summary.scan_all_breakdown}
          credits={summary.credits}
          onConfirm={confirmScanAll}
          onClose={() => setShowScanAll(false)}
          onBuyCredits={() => { setShowScanAll(false); setShowPacks(true); }}
        />
      )}
      {showPacks && (
        <CreditPackModal
          credits={summary.credits}
          onClose={() => setShowPacks(false)}
          onBuy={handleBuyPack}
        />
      )}

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-7 fade-up">
        <div>
          <h1 className="font-syne font-bold text-[22px] text-[#E8EDF2]">Dark Web Monitoring</h1>
          <p className="text-[12px] text-[#5A6B7A] mt-0.5">
            Vigilancia de filtraciones · emails · dominios · suplantación de empresa
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowPacks(true)}
            className="flex items-center gap-1.5 font-semibold text-[12px] px-[14px] py-[9px] rounded-lg border transition-all"
            style={{ color: "#00C2FF", background: "rgba(0,194,255,0.06)", borderColor: "rgba(0,194,255,0.15)" }}
          >
            💳 {summary.credits.credits_available} crédito{summary.credits.credits_available !== 1 ? "s" : ""}
          </button>
          <button
            onClick={() => setShowScanAll(true)}
            disabled={scanningAll}
            className="flex items-center gap-1.5 font-semibold text-[12px] text-white px-[18px] py-[9px] rounded-lg disabled:opacity-60 transition-all"
            style={{
              background: "linear-gradient(135deg, #0077FF, #00C2FF)",
              boxShadow: "0 0 20px rgba(0,194,255,0.2)",
            }}
          >
            {scanningAll ? "⟳ Escaneando…" : `⟳ Escaneo general (${summary.scan_all_cost} créd.)`}
          </button>
        </div>
      </div>

      {/* ── Status bar ──────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl mb-6 fade-up"
        style={{ background: "rgba(0,194,255,0.04)", border: "1px solid rgba(0,194,255,0.12)" }}
      >
        <div className="w-2 h-2 rounded-full shrink-0 pulse-dot" style={{ background: "#00C2FF" }} />
        <span className="font-mono text-[10px] tracking-[0.5px] text-[#00C2FF]">MONITOREO ACTIVO</span>
        <div className="flex items-center gap-4 ml-auto text-[11px] text-[#5A6B7A]">
          {summary.last_scan_at && (
            <span>
              Último escaneo: <span className="text-[#E8EDF2]">{relTime(summary.last_scan_at)}</span>
            </span>
          )}
          <span>
            Próximo auto: <span className="text-[#E8EDF2]">{summary.next_auto_scan}</span>
          </span>
          <span className="text-[10px] text-[#5A6B7A]">Los escaneos automáticos no consumen créditos</span>
        </div>
      </div>

      {/* ── Alert banner ────────────────────────────────────────── */}
      {overallDanger > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-3.5 rounded-xl mb-6 fade-up"
          style={{ background: "rgba(255,77,106,0.06)", border: "1px solid rgba(255,77,106,0.2)" }}
        >
          <span className="text-[18px]">🚨</span>
          <div>
            <div className="font-syne font-bold text-[14px] text-[#FF4D6A]">Filtraciones detectadas</div>
            <div className="text-[12px] text-[#5A6B7A]">
              {overallDanger} activo{overallDanger !== 1 ? "s" : ""} con datos expuestos en la dark web. Revisa los detalles y actúa.
            </div>
          </div>
        </div>
      )}

      {/* ── Stats + credits ──────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 mb-6 fade-up">
        <CreditBadge credits={summary.credits} />
        {[
          {
            label: "Emails afectados",
            value: totalEmailDanger,
            total: summary.emails.length,
            icon: "✉",
            danger: totalEmailDanger > 0,
          },
          {
            label: "Dominios expuestos",
            value: totalDomainDanger,
            total: summary.domains.length,
            icon: "◎",
            danger: totalDomainDanger > 0,
          },
          {
            label: "Dominios impostores",
            value: summary.impersonation_available ? totalImpoDanger : "—",
            total: summary.impersonation.length,
            icon: "🕸",
            danger: summary.impersonation_available && totalImpoDanger > 0,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="relative overflow-hidden rounded-xl p-4"
            style={{ background: "#0D1218", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="text-[18px] mb-2">{stat.icon}</div>
            <div
              className="font-syne font-bold text-[24px] leading-none"
              style={{ color: !stat.danger ? "#00E5A0" : "#FF4D6A" }}
            >
              {stat.value}
            </div>
            <div className="text-[10px] text-[#5A6B7A] mt-1">{stat.label}</div>
            <div
              className="absolute bottom-0 left-0 right-0 h-[2px]"
              style={{
                background: !stat.danger ? "#00E5A0" : "#FF4D6A",
                boxShadow: `0 0 8px ${!stat.danger ? "#00E5A066" : "#FF4D6A66"}`,
              }}
            />
          </div>
        ))}
      </div>

      {/* ── Email section ────────────────────────────────────────── */}
      <div className="space-y-5">
        <Section
          title="Filtraciones de emails"
          icon="✉"
          totalDanger={totalEmailDanger}
        >
          {summary.emails.length === 0 ? (
            <div className="py-6 text-center text-[13px] text-[#5A6B7A]">
              No tienes emails monitorizados. Añade emails desde el dashboard.
            </div>
          ) : (
            <div className="space-y-2">
              {summary.emails.map((item) => (
                <EmailRow
                  key={item.id}
                  item={item}
                  onScan={onItemScanned}
                  setShowPacks={setShowPacks}
                />
              ))}
            </div>
          )}
        </Section>

        {/* ── Domain section ──────────────────────────────────────── */}
        <Section
          title="Dominios en dark web"
          icon="◎"
          totalDanger={totalDomainDanger}
        >
          {summary.domains.length === 0 ? (
            <div className="py-6 text-center text-[13px] text-[#5A6B7A]">
              No tienes dominios registrados. Añade un dominio desde el dashboard.
            </div>
          ) : (
            <div className="space-y-2">
              {summary.domains.map((item) => (
                <DomainRow
                  key={item.id}
                  item={item}
                  onScan={onItemScanned}
                  setShowPacks={setShowPacks}
                  scanType="domain"
                />
              ))}
            </div>
          )}
        </Section>

        {/* ── Impersonation section ───────────────────────────────── */}
        <Section
          title="Company Impersonation (Typosquatting)"
          icon="🕸"
          totalDanger={totalImpoDanger}
          locked={!summary.impersonation_available}
        >
          {summary.impersonation.length === 0 ? (
            <div className="py-6 text-center text-[13px] text-[#5A6B7A]">
              No hay dominios configurados para monitorización de suplantación.
            </div>
          ) : (
            <div className="space-y-2">
              {summary.impersonation.map((item) => (
                <DomainRow
                  key={item.id}
                  item={item}
                  onScan={onItemScanned}
                  setShowPacks={setShowPacks}
                  scanType="impersonation"
                />
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
