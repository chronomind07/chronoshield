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
  packs: Record<string, { credits: number; amount_eur: number }>;
}

interface BreachRecord {
  id: string;
  email?: string;
  domain?: string;
  username?: string;
  password?: string;
  hashedPassword?: string;
  ipAddress?: string;
  timestamp?: string;
  createdAt?: string;
  source?: string;
  breachName?: string;
}

interface ScanResult {
  id: string;
  scan_type: "email_breach" | "domain_breach" | "typosquatting";
  query_value: string;
  total_results: number;
  results: BreachRecord[];
  is_manual: boolean;
  scanned_at: string;
}

interface DarkWebSummary {
  plan: string;
  credits: Credits;
  email_breaches: ScanResult[];
  domain_breaches: ScanResult[];
  typosquatting: ScanResult[];
  typosquatting_available: boolean;
  last_scan_at: string | null;
  next_auto_scan: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "ahora";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)} días`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ── Credit badge ───────────────────────────────────────────────────────────────
function CreditBadge({ credits }: { credits: Credits }) {
  const pct = credits.credits_available / Math.max(1, credits.credits_available + credits.credits_used);
  const color = credits.credits_available > 2 ? "#00E5A0" : credits.credits_available > 0 ? "#FFB340" : "#FF4D6A";
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{ background: "#0D1218", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="flex-1">
        <div className="font-mono text-[9px] uppercase tracking-[2px] text-[#5A6B7A] mb-1">Créditos disponibles</div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-syne font-bold text-[22px]" style={{ color }}>{credits.credits_available}</span>
          <span className="text-[12px] text-[#5A6B7A]">/ {credits.credits_available + credits.credits_used} este mes</span>
        </div>
        <div className="h-1 rounded-full mt-2 overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct * 100}%`, background: color }} />
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-mono text-[9px] uppercase tracking-[2px] text-[#5A6B7A]">Reset</div>
        <div className="text-[12px] text-[#E8EDF2] mt-0.5">{formatDate(credits.reset_date)}</div>
      </div>
    </div>
  );
}

// ── Credit pack modal ──────────────────────────────────────────────────────────
function CreditPackModal({ credits, onClose, onBuy }: {
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
      style={{ background: "rgba(8,12,16,0.85)", backdropFilter: "blur(4px)" }}
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
          <button onClick={onClose} className="text-[#5A6B7A] hover:text-[#E8EDF2] transition-colors text-lg leading-none">×</button>
        </div>

        <div className="space-y-3 mb-5">
          {packs.map((pack) => (
            <button
              key={pack.key}
              onClick={() => onBuy(pack.key)}
              className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left transition-all duration-150 hover:border-opacity-50"
              style={{
                background: pack.popular ? "rgba(0,119,255,0.06)" : "#121A22",
                border: pack.popular ? "1px solid rgba(0,194,255,0.2)" : "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-syne font-bold text-[13px] shrink-0"
                style={{ background: pack.popular ? "rgba(0,194,255,0.12)" : "rgba(255,255,255,0.04)", color: pack.popular ? "#00C2FF" : "#5A6B7A" }}
              >
                {pack.credits}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-syne font-semibold text-[14px] text-[#E8EDF2]">{pack.label}</span>
                  {pack.popular && (
                    <span className="font-mono text-[9px] px-1.5 py-px rounded" style={{ background: "rgba(0,194,255,0.1)", color: "#00C2FF" }}>
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
          Los créditos no caducan. Los créditos del plan se resetean mensualmente.
        </p>
      </div>
    </div>
  );
}

// ── Manual scan confirmation modal ────────────────────────────────────────────
function ScanConfirmModal({ credits, onConfirm, onClose, onBuyCredits }: {
  credits: Credits;
  onConfirm: () => void;
  onClose: () => void;
  onBuyCredits: () => void;
}) {
  const hasCredits = credits.credits_available > 0;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(8,12,16,0.85)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-7"
        style={{ background: "#0D1218", border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-4"
          style={{ background: hasCredits ? "rgba(0,194,255,0.08)" : "rgba(255,77,106,0.08)" }}>
          {hasCredits ? "🔍" : "⚠️"}
        </div>
        <h2 className="font-syne font-bold text-[17px] text-[#E8EDF2] mb-2">
          {hasCredits ? "Iniciar escaneo manual" : "Sin créditos disponibles"}
        </h2>
        {hasCredits ? (
          <>
            <p className="text-[13px] text-[#5A6B7A] leading-relaxed mb-1">
              Este escaneo consumirá <span className="text-[#E8EDF2] font-semibold">1 crédito</span>.
            </p>
            <p className="text-[13px] text-[#5A6B7A] mb-5">
              Te quedarán <span className="text-[#E8EDF2] font-semibold">{credits.credits_available - 1}</span> crédito{credits.credits_available - 1 !== 1 ? "s" : ""}.
            </p>
            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-[#5A6B7A]"
                style={{ background: "#121A22", border: "1px solid rgba(255,255,255,0.06)" }}>
                Cancelar
              </button>
              <button onClick={onConfirm}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #0077FF, #00C2FF)" }}>
                Confirmar
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[13px] text-[#5A6B7A] leading-relaxed mb-5">
              Has usado todos tus créditos de este mes. Compra un pack para continuar escaneando.
            </p>
            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-[#5A6B7A]"
                style={{ background: "#121A22", border: "1px solid rgba(255,255,255,0.06)" }}>
                Cancelar
              </button>
              <button onClick={onBuyCredits}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #0077FF, #00C2FF)" }}>
                Comprar créditos
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Breach row ─────────────────────────────────────────────────────────────────
function BreachRow({ record }: { record: BreachRecord }) {
  const [expanded, setExpanded] = useState(false);
  const hasPassword = !!(record.password || record.hashedPassword);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "#121A22", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0"
          style={{ background: hasPassword ? "rgba(255,77,106,0.12)" : "rgba(255,179,64,0.12)",
                   color: hasPassword ? "#FF4D6A" : "#FFB340" }}
        >
          {hasPassword ? "⚠" : "i"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[12px] text-[#E8EDF2] truncate">
            {record.email || record.domain || record.username || record.id}
          </div>
          <div className="text-[10px] text-[#5A6B7A] mt-0.5">
            {record.breachName || record.source || "Fuente desconocida"}
            {record.timestamp && ` · ${formatDate(record.timestamp)}`}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasPassword && (
            <span className="font-mono text-[9px] px-1.5 py-px rounded"
              style={{ background: "rgba(255,77,106,0.1)", color: "#FF4D6A" }}>
              CONTRASEÑA
            </span>
          )}
          <span className="text-[#5A6B7A] text-[12px]">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 grid grid-cols-2 gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          {[
            { label: "Email",      val: record.email },
            { label: "Dominio",    val: record.domain },
            { label: "Usuario",    val: record.username },
            { label: "IP",         val: record.ipAddress },
            { label: "Contraseña", val: record.password ? "•••••••• (expuesta)" : record.hashedPassword ? "•••• (hash)" : null },
            { label: "Fecha",      val: record.timestamp ? formatDate(record.timestamp) : null },
          ].filter((f) => f.val).map((f) => (
            <div key={f.label}>
              <div className="font-mono text-[9px] uppercase tracking-[1px] text-[#5A6B7A]">{f.label}</div>
              <div className="font-mono text-[11px] text-[#E8EDF2] mt-0.5 break-all">{f.val}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Scan section ───────────────────────────────────────────────────────────────
function ScanSection({
  title, icon, badge, results, emptyText, locked,
}: {
  title: string;
  icon: string;
  badge?: { text: string; color: string; bg: string };
  results: ScanResult[];
  emptyText: string;
  locked?: boolean;
}) {
  const totalBreaches = results.reduce((sum, r) => sum + r.total_results, 0);
  const status = locked ? "locked" : totalBreaches > 0 ? "danger" : "ok";

  const borderColor = {
    ok:     "rgba(255,255,255,0.06)",
    danger: "rgba(255,77,106,0.2)",
    locked: "rgba(255,255,255,0.06)",
  }[status];

  const barColor = { ok: "#00E5A0", danger: "#FF4D6A", locked: "#5A6B7A" }[status];

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-6"
      style={{ background: "#0D1218", border: `1px solid ${borderColor}` }}
    >
      <div
        className="absolute bottom-0 left-0 right-0 h-[2px]"
        style={{ background: barColor, boxShadow: `0 0 10px ${barColor}66` }}
      />

      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <span className="text-[18px]">{icon}</span>
          <h3 className="font-syne font-bold text-[15px] text-[#E8EDF2]">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {badge && (
            <span
              className="font-mono text-[9px] uppercase tracking-[1px] px-2 py-px rounded-full border"
              style={{ background: badge.bg, color: badge.color, borderColor: badge.color + "33" }}
            >
              {badge.text}
            </span>
          )}
          {!locked && (
            <span
              className="font-mono text-[9px] uppercase tracking-[1px] px-2 py-px rounded-full"
              style={
                totalBreaches > 0
                  ? { background: "rgba(255,77,106,0.1)", color: "#FF4D6A" }
                  : { background: "rgba(0,229,160,0.1)", color: "#00E5A0" }
              }
            >
              {totalBreaches > 0 ? `${totalBreaches} hallazgos` : "Limpio"}
            </span>
          )}
        </div>
      </div>

      {locked ? (
        <div className="py-6 flex flex-col items-center gap-3 text-center">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >🔒</div>
          <p className="text-[13px] text-[#5A6B7A]">
            Disponible en el plan <span className="text-[#E8EDF2] font-semibold">Business</span>
          </p>
        </div>
      ) : results.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-[13px] text-[#5A6B7A]">{emptyText}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((scan) => (
            <div key={scan.id}>
              <div className="flex items-center justify-between mb-2">
                <div className="font-mono text-[10px] text-[#5A6B7A]">
                  {scan.query_value} · {relTime(scan.scanned_at)}
                  {scan.is_manual && (
                    <span className="ml-2 text-[#00C2FF]">escaneo manual</span>
                  )}
                </div>
                <span className="font-mono text-[9px] text-[#5A6B7A]">
                  {scan.total_results} resultado{scan.total_results !== 1 ? "s" : ""}
                </span>
              </div>
              {scan.results.length > 0 ? (
                <div className="space-y-1.5">
                  {scan.results.slice(0, 5).map((r, i) => (
                    <BreachRow key={r.id || i} record={r} />
                  ))}
                  {scan.results.length > 5 && (
                    <p className="text-[11px] text-[#5A6B7A] text-center pt-1">
                      +{scan.results.length - 5} más en historial
                    </p>
                  )}
                </div>
              ) : (
                <div className="py-3 text-center">
                  <span className="font-mono text-[11px] text-[#00E5A0]">✓ Sin filtraciones</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function DarkWebPage() {
  const [summary, setSummary]     = useState<DarkWebSummary | null>(null);
  const [loading, setLoading]     = useState(true);
  const [scanning, setScanning]   = useState(false);
  const [showScan, setShowScan]   = useState(false);
  const [showPacks, setShowPacks] = useState(false);

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

  const handleScanClick = () => {
    if (!summary) return;
    setShowScan(true);
  };

  const confirmScan = async () => {
    setShowScan(false);
    setScanning(true);
    try {
      const res = await darkwebApi.manualScan();
      toast.success(`Escaneo iniciado · ${res.data.credits_remaining} créditos restantes`);
      // Reload after a moment to pick up results
      setTimeout(() => load(), 3000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: { message?: string } | string } } };
      const msg = typeof e?.response?.data?.detail === "object"
        ? e.response!.data!.detail!.message
        : (e?.response?.data?.detail as string) || "Error al iniciar escaneo";
      toast.error(msg as string);
      // If no credits, open pack modal
      if (typeof e?.response?.data?.detail === "object" && (e.response?.data?.detail as { code?: string })?.code === "NO_CREDITS") {
        setShowPacks(true);
      }
    } finally {
      setScanning(false);
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

  if (loading) {
    return (
      <div className="p-10 flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#00C2FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!summary) return null;

  const totalEmailBreaches  = summary.email_breaches.reduce((s, r) => s + r.total_results, 0);
  const totalDomainBreaches = summary.domain_breaches.reduce((s, r) => s + r.total_results, 0);
  const totalTypo           = summary.typosquatting.reduce((s, r) => s + r.total_results, 0);
  const overallStatus = (totalEmailBreaches + totalDomainBreaches + totalTypo) > 0 ? "danger" : "ok";

  return (
    <div className="p-9">
      {/* Modals */}
      {showScan && (
        <ScanConfirmModal
          credits={summary.credits}
          onConfirm={confirmScan}
          onClose={() => setShowScan(false)}
          onBuyCredits={() => { setShowScan(false); setShowPacks(true); }}
        />
      )}
      {showPacks && (
        <CreditPackModal
          credits={summary.credits}
          onClose={() => setShowPacks(false)}
          onBuy={handleBuyPack}
        />
      )}

      {/* ── Topbar ────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-7 fade-up">
        <div>
          <h1 className="font-syne font-bold text-[22px] text-[#E8EDF2]">Dark Web Monitoring</h1>
          <p className="text-[12px] text-[#5A6B7A] mt-0.5">
            Vigilancia de filtraciones · emails · dominios · suplantación
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowPacks(true)}
            className="flex items-center gap-1.5 font-semibold text-[12px] px-[14px] py-[9px] rounded-lg border"
            style={{ color: "#00C2FF", background: "rgba(0,194,255,0.06)", borderColor: "rgba(0,194,255,0.15)" }}
          >
            💳 Créditos: {summary.credits.credits_available}
          </button>
          <button
            onClick={handleScanClick}
            disabled={scanning}
            className="flex items-center gap-1.5 font-semibold text-[12px] text-white px-[18px] py-[9px] rounded-lg disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg, #0077FF, #00C2FF)",
              boxShadow: "0 0 20px rgba(0,194,255,0.2)",
            }}
          >
            {scanning ? "⟳ Escaneando…" : "⟳ Escanear ahora"}
          </button>
        </div>
      </div>

      {/* ── Status bar ────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl mb-6 fade-up"
        style={{ background: "rgba(0,194,255,0.04)", border: "1px solid rgba(0,194,255,0.12)" }}
      >
        <div className="w-2 h-2 rounded-full shrink-0 pulse-dot" style={{ background: "#00C2FF" }} />
        <span className="font-mono text-[10px] tracking-[0.5px] text-[#00C2FF]">MONITOREO ACTIVO</span>
        <div className="flex items-center gap-4 ml-auto text-[11px] text-[#5A6B7A]">
          {summary.last_scan_at && (
            <span>Último escaneo: <span className="text-[#E8EDF2]">{relTime(summary.last_scan_at)}</span></span>
          )}
          <span>Próximo automático: <span className="text-[#E8EDF2]">{summary.next_auto_scan}</span></span>
        </div>
      </div>

      {/* ── Overall alert banner ──────────────────────────────────────── */}
      {overallStatus === "danger" && (
        <div
          className="flex items-center gap-3 px-4 py-3.5 rounded-xl mb-6 fade-up"
          style={{ background: "rgba(255,77,106,0.06)", border: "1px solid rgba(255,77,106,0.2)" }}
        >
          <span className="text-[18px]">🚨</span>
          <div>
            <div className="font-syne font-bold text-[14px] text-[#FF4D6A]">Filtraciones detectadas</div>
            <div className="text-[12px] text-[#5A6B7A]">
              Hemos encontrado datos de tu empresa en la dark web. Revisa los detalles y cambia las contraseñas afectadas.
            </div>
          </div>
        </div>
      )}

      {/* ── Credits + quick stats ─────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 mb-6 fade-up">
        <div className="col-span-1">
          <CreditBadge credits={summary.credits} />
        </div>
        {[
          {
            label: "Emails con filtraciones",
            value: totalEmailBreaches,
            color: totalEmailBreaches > 0 ? "#FF4D6A" : "#00E5A0",
            icon: "✉",
          },
          {
            label: "Dominios en dark web",
            value: totalDomainBreaches,
            color: totalDomainBreaches > 0 ? "#FF4D6A" : "#00E5A0",
            icon: "◎",
          },
          {
            label: "Dominios impostores",
            value: summary.typosquatting_available ? totalTypo : "—",
            color: !summary.typosquatting_available ? "#5A6B7A" : totalTypo > 0 ? "#FF4D6A" : "#00E5A0",
            icon: "🕸",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="relative overflow-hidden rounded-xl p-4"
            style={{ background: "#0D1218", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="text-[18px] mb-2">{stat.icon}</div>
            <div className="font-syne font-bold text-[22px] leading-none" style={{ color: stat.color }}>
              {stat.value}
            </div>
            <div className="text-[11px] text-[#5A6B7A] mt-1">{stat.label}</div>
            <div
              className="absolute bottom-0 left-0 right-0 h-[2px]"
              style={{ background: stat.color as string, boxShadow: `0 0 8px ${stat.color}66` }}
            />
          </div>
        ))}
      </div>

      {/* ── Scan sections ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5">
        <ScanSection
          title="Filtraciones de emails"
          icon="✉"
          results={summary.email_breaches}
          emptyText="No se han detectado filtraciones en los emails monitorizados. El escaneo automático se ejecuta diariamente."
        />

        <ScanSection
          title="Dominio en la dark web"
          icon="◎"
          results={summary.domain_breaches}
          emptyText="No se han encontrado datos de tus dominios en la dark web."
        />

        <ScanSection
          title="Company Impersonation (Typosquatting)"
          icon="🕸"
          badge={!summary.typosquatting_available ? { text: "Solo Business", color: "#FFB340", bg: "rgba(255,179,64,0.08)" } : undefined}
          results={summary.typosquatting}
          emptyText="No se han detectado dominios que suplanten a tu empresa."
          locked={!summary.typosquatting_available}
        />
      </div>
    </div>
  );
}
