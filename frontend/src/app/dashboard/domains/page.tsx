"use client";

import { useEffect, useState } from "react";
import { domainsApi } from "@/lib/api";
import { useTechMode } from "@/lib/mode-context";
import toast from "react-hot-toast";

interface Domain {
  id: string;
  domain: string;
  is_active: boolean;
  created_at: string;
  last_scanned_at: string | null;
  overall_score: number | null;
  ssl_valid: boolean | null;
  is_up: boolean | null;
}

type BarColor = "green" | "yellow" | "red" | "neutral";

const BAR_COLORS: Record<BarColor, string> = {
  green:   "#00E5A0",
  yellow:  "#F59E0B",
  red:     "#FF4757",
  neutral: "rgba(255,255,255,0.1)",
};

function domainBarColor(d: Domain): BarColor {
  if (d.is_up === null && d.ssl_valid === null) return "neutral";
  if (d.is_up === false) return "red";
  if (d.ssl_valid === false) return "yellow";
  return "green";
}

function ScorePill({ score }: { score: number }) {
  const color =
    score >= 80 ? "#00E5A0" : score >= 60 ? "#F59E0B" : "#FF4757";
  return (
    <span
      className="font-mono text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ color, backgroundColor: `${color}18` }}
    >
      {score}
    </span>
  );
}

function StatusChip({ ok, labelOk, labelBad }: { ok: boolean; labelOk: string; labelBad: string }) {
  return (
    <span
      className="text-[11px] font-medium px-2 py-0.5 rounded-full"
      style={{
        color: ok ? "#00E5A0" : "#FF4757",
        backgroundColor: ok ? "rgba(0,229,160,0.1)" : "rgba(255,71,87,0.1)",
      }}
    >
      {ok ? labelOk : labelBad}
    </span>
  );
}

export default function DomainsPage() {
  const { techMode } = useTechMode();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [scanning, setScanning] = useState<string | null>(null);

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

  const handleScan = async (id: string) => {
    setScanning(id);
    try {
      await domainsApi.scan(id);
      toast.success("Escaneo iniciado — resultados en unos segundos");
      setTimeout(load, 5000);
    } catch {
      toast.error("Error al iniciar escaneo");
    } finally {
      setScanning(null);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-9 space-y-6 min-h-screen">
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
            {techMode
              ? "Add your first domain to start monitoring."
              : "Añade tu web para empezar a vigilarla."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {domains.map((d) => {
            const barColor = domainBarColor(d);
            return (
              <div
                key={d.id}
                className="relative bg-[#0D1117] border border-white/[0.06] rounded-xl p-5 overflow-hidden"
              >
                {/* Bottom color bar */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-[3px]"
                  style={{ backgroundColor: BAR_COLORS[barColor] }}
                />

                <div className="flex items-center justify-between gap-4">
                  {/* Left: domain name + last scan */}
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-white truncate">
                      {d.domain}
                    </p>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {d.last_scanned_at
                        ? (techMode
                            ? `Last scan: ${new Date(d.last_scanned_at).toLocaleString("es-ES")}`
                            : `Revisado: ${new Date(d.last_scanned_at).toLocaleString("es-ES")}`)
                        : (techMode ? "Never scanned" : "Sin revisar aún")}
                    </p>
                  </div>

                  {/* Right: status chips + actions */}
                  <div className="flex items-center gap-2.5 shrink-0 flex-wrap justify-end">
                    {d.is_up !== null && (
                      <StatusChip
                        ok={d.is_up}
                        labelOk={techMode ? "Online" : "Web activa"}
                        labelBad={techMode ? "Down" : "Web caída"}
                      />
                    )}
                    {d.ssl_valid !== null && (
                      <StatusChip
                        ok={d.ssl_valid}
                        labelOk={techMode ? "SSL OK" : "Segura"}
                        labelBad={techMode ? "SSL Error" : "Sin seguridad"}
                      />
                    )}
                    {d.overall_score !== null && (
                      <ScorePill score={d.overall_score} />
                    )}

                    {/* Scan button */}
                    <button
                      onClick={() => handleScan(d.id)}
                      disabled={scanning === d.id}
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
                      onClick={() => handleRemove(d.id, d.domain)}
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
