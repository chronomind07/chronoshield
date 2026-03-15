"use client";

import { useEffect, useState } from "react";
import { domainsApi, alertsApi } from "@/lib/api";
import { useTechMode } from "@/lib/mode-context";
import BuyCreditsModal from "@/components/BuyCreditsModal";
import toast from "react-hot-toast";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Domain {
  id: string;
  domain: string;
  is_active: boolean;
  created_at: string;
  last_scanned_at: string | null;
  security_score: number | null;
  ssl_status: string | null;        // "valid" | "expired" | "error"
  ssl_days_remaining: number | null;
  uptime_status: string | null;     // "up" | "down" | "error"
  last_response_ms: number | null;
  spf_status: string | null;        // "pass" | "fail" | "none"
  dkim_status: string | null;
  dmarc_status: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
type BarColor = "green" | "yellow" | "red" | "neutral";

const BAR_COLORS: Record<BarColor, string> = {
  green:   "#00E5A0",
  yellow:  "#F59E0B",
  red:     "#FF4757",
  neutral: "rgba(255,255,255,0.1)",
};

function domainBarColor(d: Domain): BarColor {
  if (!d.ssl_status && !d.uptime_status) return "neutral";
  if (d.uptime_status === "down" || d.uptime_status === "error") return "red";
  if (d.ssl_status === "expired" || d.ssl_status === "error") return "yellow";
  return "green";
}

function ScorePill({ score }: { score: number }) {
  const color = score >= 80 ? "#00E5A0" : score >= 60 ? "#F59E0B" : "#FF4757";
  return (
    <span
      className="font-mono text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ color, backgroundColor: `${color}18` }}
    >
      {score}
    </span>
  );
}

function StatusChip({ status, labelMap }: {
  status: string | null;
  labelMap: Record<string, { label: string; color: string; bg: string }>;
}) {
  if (!status) return null;
  const s = labelMap[status] ?? { label: status, color: "#5A6B7A", bg: "rgba(90,107,122,0.1)" };
  return (
    <span
      className="text-[11px] font-medium px-2 py-0.5 rounded-full"
      style={{ color: s.color, backgroundColor: s.bg }}
    >
      {s.label}
    </span>
  );
}

const SSL_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  valid:   { label: "SSL OK",    color: "#00E5A0", bg: "rgba(0,229,160,0.1)"  },
  expired: { label: "SSL Venc.", color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
  error:   { label: "SSL Error", color: "#FF4757", bg: "rgba(255,71,87,0.1)"  },
};

const UPTIME_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  up:    { label: "Online", color: "#00E5A0", bg: "rgba(0,229,160,0.1)"  },
  down:  { label: "Caída",  color: "#FF4757", bg: "rgba(255,71,87,0.1)"  },
  error: { label: "Error",  color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pass: { label: "✓ Pass", color: "#00E5A0", bg: "rgba(0,229,160,0.1)"  },
  fail: { label: "✗ Fail", color: "#FF4757", bg: "rgba(255,71,87,0.1)"  },
  none: { label: "— N/A",  color: "#5A6B7A", bg: "rgba(90,107,122,0.1)" },
};

/** Derive actionable recommendations from scan data */
function getRecommendations(d: Domain): { icon: string; text: string }[] {
  const recs: { icon: string; text: string }[] = [];

  if (d.ssl_status === "expired") {
    recs.push({ icon: "🔴", text: "Tu certificado SSL ha caducado. Renuévalo urgentemente para evitar alertas de seguridad en los navegadores." });
  } else if (d.ssl_status === "error") {
    recs.push({ icon: "🟠", text: "Hay un problema con tu certificado SSL. Verifica la configuración de tu servidor." });
  } else if (d.ssl_days_remaining !== null && d.ssl_days_remaining < 30) {
    recs.push({ icon: "⚠️", text: `Tu certificado SSL caduca en ${d.ssl_days_remaining} días. Renuévalo pronto para evitar interrupciones.` });
  }

  if (d.uptime_status === "down") {
    recs.push({ icon: "🔴", text: "Tu servidor está caído. Contacta con tu proveedor de hosting o reinicia el servidor." });
  } else if (d.uptime_status === "error") {
    recs.push({ icon: "🟠", text: "No se puede acceder a tu servidor. Revisa el firewall o la configuración DNS." });
  }

  if (d.spf_status && d.spf_status !== "pass") {
    recs.push({ icon: "⚡", text: "Configura un registro SPF en tu DNS para evitar que otros envíen correos suplantando tu dominio." });
  }
  if (d.dkim_status && d.dkim_status !== "pass") {
    recs.push({ icon: "⚡", text: "Activa DKIM para firmar criptográficamente los correos salientes y mejorar la entregabilidad." });
  }
  if (d.dmarc_status && d.dmarc_status !== "pass") {
    recs.push({ icon: "⚡", text: "Añade un registro DMARC para definir qué hacer con correos que no pasen SPF/DKIM." });
  }

  return recs;
}

// ── Domain Detail Panel ────────────────────────────────────────────────────────
function DomainDetailPanel({ domain, onClose }: { domain: Domain; onClose: () => void }) {
  const recs = getRecommendations(domain);

  const secRow = (label: string, status: string | null) => {
    const s = STATUS_LABELS[status ?? "none"] ?? STATUS_LABELS["none"];
    return (
      <div className="flex items-center justify-between py-2"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <span className="text-[12px] text-[#5A6B7A] font-mono">{label}</span>
        <span className="text-[12px] font-medium px-2 py-0.5 rounded-full"
          style={{ color: s.color, backgroundColor: s.bg }}>
          {s.label}
        </span>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(8,12,16,0.85)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: "#0D1218", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-[#5A6B7A] mb-0.5">Análisis</p>
            <h2 className="font-syne font-bold text-[16px] text-[#E8EDF2]">{domain.domain}</h2>
          </div>
          <div className="flex items-center gap-3">
            {domain.security_score !== null && (
              <div className="text-center">
                <div className="font-syne font-bold text-[20px]"
                  style={{ color: domain.security_score >= 80 ? "#00E5A0" : domain.security_score >= 60 ? "#F59E0B" : "#FF4757" }}>
                  {domain.security_score}
                </div>
                <div className="font-mono text-[9px] text-[#5A6B7A]">SCORE</div>
              </div>
            )}
            <button onClick={onClose}
              className="text-[#5A6B7A] hover:text-[#E8EDF2] transition-colors">
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Last scan */}
          {domain.last_scanned_at && (
            <p className="font-mono text-[11px] text-[#5A6B7A]">
              Último escaneo: {new Date(domain.last_scanned_at).toLocaleString("es-ES")}
            </p>
          )}

          {/* SSL */}
          <div className="rounded-xl p-4" style={{ background: "#121A22" }}>
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-[#5A6B7A] mb-3">
              🔒 Certificado SSL
            </p>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium"
                style={{ color: domain.ssl_status === "valid" ? "#00E5A0" : domain.ssl_status ? "#FF4757" : "#5A6B7A" }}>
                {domain.ssl_status === "valid" ? "Válido" :
                 domain.ssl_status === "expired" ? "Caducado" :
                 domain.ssl_status === "error" ? "Error" : "Sin datos"}
              </span>
              {domain.ssl_days_remaining !== null && (
                <span className="font-mono text-[12px] text-[#5A6B7A]">
                  {domain.ssl_days_remaining} días restantes
                </span>
              )}
            </div>
          </div>

          {/* Uptime */}
          <div className="rounded-xl p-4" style={{ background: "#121A22" }}>
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-[#5A6B7A] mb-3">
              ↑ Disponibilidad
            </p>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium"
                style={{ color: domain.uptime_status === "up" ? "#00E5A0" : domain.uptime_status ? "#FF4757" : "#5A6B7A" }}>
                {domain.uptime_status === "up" ? "Online" :
                 domain.uptime_status === "down" ? "Caído" :
                 domain.uptime_status === "error" ? "Error" : "Sin datos"}
              </span>
              {domain.last_response_ms !== null && (
                <span className="font-mono text-[12px] text-[#5A6B7A]">
                  {domain.last_response_ms} ms
                </span>
              )}
            </div>
          </div>

          {/* Email Security */}
          <div className="rounded-xl p-4" style={{ background: "#121A22" }}>
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-[#5A6B7A] mb-3">
              ✉ Seguridad de Email
            </p>
            {secRow("SPF",   domain.spf_status)}
            {secRow("DKIM",  domain.dkim_status)}
            {secRow("DMARC", domain.dmarc_status)}
          </div>

          {/* Recommendations */}
          {recs.length > 0 ? (
            <div className="rounded-xl p-4" style={{ background: "#121A22" }}>
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-[#5A6B7A] mb-3">
                ⚡ Recomendaciones
              </p>
              <div className="space-y-3">
                {recs.map((r, i) => (
                  <div key={i} className="flex gap-2.5">
                    <span className="text-[14px] shrink-0 mt-0.5">{r.icon}</span>
                    <p className="text-[12px] text-[#A8B8C8] leading-relaxed">{r.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : domain.last_scanned_at ? (
            <div className="flex items-center gap-2 rounded-xl p-4"
              style={{ background: "rgba(0,229,160,0.05)", border: "1px solid rgba(0,229,160,0.1)" }}>
              <span className="text-lg">✅</span>
              <p className="text-[12px] text-[#00E5A0]">Sin recomendaciones críticas. Tu dominio está bien configurado.</p>
            </div>
          ) : null}

        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function DomainsPage() {
  const { techMode } = useTechMode();
  const [domains, setDomains]       = useState<Domain[]>([]);
  const [loading, setLoading]       = useState(true);
  const [adding, setAdding]         = useState(false);
  const [newDomain, setNewDomain]   = useState("");
  const [scanning, setScanning]     = useState<string | null>(null);
  const [selected, setSelected]     = useState<Domain | null>(null);
  const [showCredits, setShowCredits] = useState(false);

  const load = async () => {
    try {
      const res = await domainsApi.list();
      setDomains(res.data);
    } catch {
      toast.error("Error al cargar dominios");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const domain = newDomain.trim().replace(/^https?:\/\//, "");
    if (!domain) return;
    setAdding(true);
    try {
      const res = await domainsApi.add(domain);
      setDomains((prev) => [...prev, res.data]);
      setNewDomain("");
      toast.success("Dominio añadido");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Error al añadir dominio";
      toast.error(msg);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: string, domain: string) => {
    if (!confirm(`¿Eliminar ${domain}?`)) return;
    try {
      await domainsApi.remove(id);
      setDomains((prev) => prev.filter((d) => d.id !== id));
      toast.success("Dominio eliminado");
    } catch {
      toast.error("Error al eliminar dominio");
    }
  };

  const handleScan = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Don't open detail panel
    setScanning(id);
    try {
      const res = await domainsApi.scan(id);
      const remaining = res.data?.credits_remaining;
      toast.success(
        `Escaneo iniciado${remaining !== undefined ? ` · ${remaining} crédito${remaining !== 1 ? "s" : ""} restante${remaining !== 1 ? "s" : ""}` : ""}`
      );
      setTimeout(load, 6000);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 402 || detail?.code === "NO_CREDITS") {
        setShowCredits(true);
      } else {
        toast.error(typeof detail === "string" ? detail : "Error al iniciar escaneo");
      }
    } finally {
      setScanning(null);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-9 space-y-6 min-h-screen">

      {/* Modals */}
      {showCredits && <BuyCreditsModal onClose={() => setShowCredits(false)} />}
      {selected    && <DomainDetailPanel domain={selected} onClose={() => setSelected(null)} />}

      {/* Header */}
      <div>
        <h1 className="font-syne text-2xl font-bold text-white">
          {techMode ? "Domain Monitor" : "Tus webs"}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {techMode
            ? "SSL, uptime & security score per domain"
            : "Comprueba que tus webs funcionan y están protegidas"}
        </p>
      </div>

      {/* Add domain */}
      <div className="bg-[#0D1117] border border-white/[0.06] rounded-xl p-5">
        <p className="text-xs text-slate-500 mb-3">
          {techMode ? "Add domain" : "Añadir una web"}
        </p>
        <form onSubmit={handleAdd} className="flex gap-3">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder={techMode ? "ejemplo.com" : "La dirección de tu web, ej: miagencia.com"}
            className="flex-1 bg-[#080C10] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#00C2FF]/50 transition-colors font-mono"
            disabled={adding}
          />
          <button
            type="submit"
            disabled={adding || !newDomain.trim()}
            className="flex items-center gap-2 bg-[#00C2FF] text-[#080C10] text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-[#00C2FF]/90 disabled:opacity-40 transition-all"
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            {adding ? "Añadiendo..." : "Añadir"}
          </button>
        </form>
      </div>

      {/* Credits hint */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-[#5A6B7A]">
          Los escaneos manuales consumen 1 crédito por dominio
        </p>
        <button
          onClick={() => setShowCredits(true)}
          className="font-mono text-[11px] text-[#00C2FF] hover:underline"
        >
          Comprar créditos →
        </button>
      </div>

      {/* Domain list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#00C2FF] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : domains.length === 0 ? (
        <div className="bg-[#0D1117] border border-white/[0.06] rounded-xl p-12 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-slate-600">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M2 12 C5 8 9 6 12 6 C15 6 19 8 22 12 C19 16 15 18 12 18 C9 18 5 16 2 12Z" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M12 2 C10 6 10 18 12 22M12 2 C14 6 14 18 12 22" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-400">Sin dominios</p>
          <p className="text-xs text-slate-600">
            {techMode ? "Add your first domain to start monitoring." : "Añade tu web para empezar a vigilarla."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {domains.map((d) => {
            const barColor = domainBarColor(d);
            return (
              <div
                key={d.id}
                className="relative bg-[#0D1117] border border-white/[0.06] rounded-xl p-5 overflow-hidden cursor-pointer hover:border-white/[0.12] transition-colors"
                onClick={() => setSelected(d)}
              >
                {/* Bottom color bar */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-[3px]"
                  style={{ backgroundColor: BAR_COLORS[barColor] }}
                />

                <div className="flex items-center justify-between gap-4">
                  {/* Left: domain name + last scan */}
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-white truncate">{d.domain}</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {d.last_scanned_at
                        ? `${techMode ? "Last scan" : "Revisado"}: ${new Date(d.last_scanned_at).toLocaleString("es-ES")}`
                        : (techMode ? "Never scanned" : "Sin revisar aún")}
                    </p>
                  </div>

                  {/* Right: status chips + actions */}
                  <div className="flex items-center gap-2.5 shrink-0 flex-wrap justify-end">
                    <StatusChip status={d.uptime_status} labelMap={UPTIME_LABELS} />
                    <StatusChip status={d.ssl_status}    labelMap={SSL_LABELS}    />
                    {d.security_score !== null && <ScorePill score={d.security_score} />}

                    {/* Scan button */}
                    <button
                      onClick={(e) => handleScan(e, d.id)}
                      disabled={scanning === d.id}
                      title="Escanear (1 crédito)"
                      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#00C2FF] disabled:opacity-40 transition-colors"
                    >
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        className={`w-3.5 h-3.5 ${scanning === d.id ? "animate-spin" : ""}`}
                      >
                        <path
                          d="M13.5 8A5.5 5.5 0 1 1 8 2.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                        <path d="M8 1v3l2-1.5L8 1Z" fill="currentColor"/>
                      </svg>
                      {techMode ? "Scan" : "Revisar"}
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemove(d.id, d.domain); }}
                      className="text-slate-700 hover:text-[#FF4757] transition-colors"
                    >
                      <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                        <path
                          d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
