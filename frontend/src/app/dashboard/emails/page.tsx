"use client";

import { useEffect, useState } from "react";
import { emailsApi } from "@/lib/api";
import BuyCreditsModal from "@/components/BuyCreditsModal";
import toast from "react-hot-toast";

// ── Types ─────────────────────────────────────────────────────────────────────
interface BreachResult {
  id: string;
  scanned_at: string;
  breaches_found: number;
  breach_data: Record<string, any> | null;
  is_new: boolean;
}

interface MonitoredEmail {
  id: string;
  email: string;
  created_at: string;
  total_breaches: number;
  latest_breach: BreachResult | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function emailBarColor(e: MonitoredEmail): string {
  if (!e.latest_breach) return "rgba(255,255,255,0.08)";
  if (e.total_breaches === 0) return "#00E5A0";
  return "#FF4757";
}

/** Extract a readable list of breaches from InsecureWeb breach_data payload */
function parseBreaches(data: Record<string, any> | null): { name: string; date?: string; count?: number }[] {
  if (!data) return [];
  const list = data.breaches ?? data.Breaches ?? data.results ?? [];
  if (!Array.isArray(list)) return [];
  return list.map((b: any) => ({
    name:  b.name ?? b.Name ?? b.breach_name ?? b.BreachName ?? "Breach desconocido",
    date:  b.date ?? b.Date ?? b.breach_date ?? b.BreachDate,
    count: b.pwnCount ?? b.PwnCount ?? b.data_count,
  }));
}

// ── Breach Detail Panel ───────────────────────────────────────────────────────
function BreachDetailPanel({
  email,
  onClose,
}: {
  email: MonitoredEmail;
  onClose: () => void;
}) {
  const breaches = parseBreaches(email.latest_breach?.breach_data ?? null);

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
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-[#5A6B7A] mb-0.5">
              Breach Report
            </p>
            <h2 className="font-syne font-bold text-[15px] text-[#E8EDF2] truncate max-w-[280px]">
              {email.email}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#5A6B7A] hover:text-[#E8EDF2] transition-colors"
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">

          {/* Last scan */}
          {email.latest_breach && (
            <p className="font-mono text-[11px] text-[#5A6B7A]">
              Último escaneo: {new Date(email.latest_breach.scanned_at).toLocaleString("es-ES")}
            </p>
          )}

          {/* Summary */}
          <div
            className="rounded-xl p-4 flex items-center gap-4"
            style={{
              background: email.total_breaches === 0
                ? "rgba(0,229,160,0.05)" : "rgba(255,71,87,0.05)",
              border: email.total_breaches === 0
                ? "1px solid rgba(0,229,160,0.12)" : "1px solid rgba(255,71,87,0.12)",
            }}
          >
            <span className="text-2xl">{email.total_breaches === 0 ? "✅" : "🚨"}</span>
            <div>
              <p
                className="font-syne font-bold text-[15px]"
                style={{ color: email.total_breaches === 0 ? "#00E5A0" : "#FF4757" }}
              >
                {email.total_breaches === 0
                  ? "Sin brechas detectadas"
                  : `${email.total_breaches} brecha${email.total_breaches !== 1 ? "s" : ""} detectada${email.total_breaches !== 1 ? "s" : ""}`}
              </p>
              {email.total_breaches > 0 && (
                <p className="text-[12px] text-[#A8B8C8] mt-0.5">
                  Cambia las contraseñas asociadas a este email inmediatamente.
                </p>
              )}
            </div>
          </div>

          {/* Breach list */}
          {breaches.length > 0 ? (
            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-[#5A6B7A]">
                Detalle de brechas
              </p>
              {breaches.map((b, i) => (
                <div
                  key={i}
                  className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                  style={{ background: "#121A22", border: "1px solid rgba(255,71,87,0.08)" }}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center font-syne font-bold text-[11px] shrink-0"
                      style={{ background: "rgba(255,71,87,0.1)", color: "#FF4757" }}
                    >
                      {b.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-[#E8EDF2]">{b.name}</p>
                      {b.date && (
                        <p className="font-mono text-[10px] text-[#5A6B7A]">{b.date}</p>
                      )}
                    </div>
                  </div>
                  {b.count !== undefined && (
                    <span className="font-mono text-[11px] text-[#5A6B7A] shrink-0">
                      {b.count.toLocaleString()} reg.
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : email.total_breaches > 0 ? (
            <div className="rounded-xl p-4 text-center" style={{ background: "#121A22" }}>
              <p className="text-[12px] text-[#5A6B7A]">
                Detalles de las brechas no disponibles en este escaneo.
              </p>
            </div>
          ) : null}

          {/* Recommendations if breached */}
          {email.total_breaches > 0 && (
            <div className="rounded-xl p-4" style={{ background: "#121A22" }}>
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-[#5A6B7A] mb-3">
                ⚡ Acciones recomendadas
              </p>
              <ul className="space-y-2">
                {[
                  "Cambia la contraseña de esta dirección de email inmediatamente.",
                  "Activa la verificación en dos pasos (2FA) en todos los servicios donde uses este email.",
                  "Revisa si usabas la misma contraseña en otros servicios y cámbiala también.",
                  "Considera usar un gestor de contraseñas para crear contraseñas únicas.",
                ].map((tip, i) => (
                  <li key={i} className="flex gap-2 text-[12px] text-[#A8B8C8]">
                    <span className="text-[#00C2FF] shrink-0 font-mono">{i + 1}.</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function EmailsPage() {
  const [emails, setEmails]           = useState<MonitoredEmail[]>([]);
  const [loading, setLoading]         = useState(true);
  const [adding, setAdding]           = useState(false);
  const [newEmail, setNewEmail]       = useState("");
  const [scanning, setScanning]       = useState<string | null>(null);
  const [selected, setSelected]       = useState<MonitoredEmail | null>(null);
  const [showCredits, setShowCredits] = useState(false);

  const load = async () => {
    try {
      const res = await emailsApi.list();
      setEmails(res.data ?? []);
    } catch {
      toast.error("Error al cargar emails");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim();
    if (!email) return;
    setAdding(true);
    try {
      const res = await emailsApi.add(email);
      setEmails((prev) => [...prev, res.data]);
      setNewEmail("");
      toast.success("Email añadido correctamente");
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 409) {
        toast.error("Este email ya está siendo monitorizado");
      } else {
        toast.error(typeof detail === "string" ? detail : "Error al añadir email");
      }
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: string, email: string) => {
    if (!confirm(`¿Eliminar ${email}?`)) return;
    try {
      await emailsApi.remove(id);
      setEmails((prev) => prev.filter((e) => e.id !== id));
      toast.success("Email eliminado");
    } catch {
      toast.error("Error al eliminar email");
    }
  };

  const handleScan = async (e: React.MouseEvent, emailItem: MonitoredEmail) => {
    e.stopPropagation(); // Don't open detail panel
    setScanning(emailItem.id);
    try {
      const res = await emailsApi.scan(emailItem.id);
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
      {selected    && <BreachDetailPanel email={selected} onClose={() => setSelected(null)} />}

      {/* Header */}
      <div>
        <h1 className="font-syne text-2xl font-bold text-white">Email Breach Monitor</h1>
        <p className="text-sm text-slate-500 mt-1">
          Continuous monitoring against known breach databases
        </p>
      </div>

      {/* Add email */}
      <div className="bg-[#0D1117] border border-white/[0.06] rounded-xl p-5">
        <p className="text-xs text-slate-500 mb-3">Add email address to monitor</p>
        <form onSubmit={handleAdd} className="flex gap-3">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="usuario@empresa.com"
            className="flex-1 bg-[#080C10] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#00C2FF]/50 transition-colors font-mono"
            disabled={adding}
          />
          <button
            type="submit"
            disabled={adding || !newEmail.trim()}
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
          Los escaneos manuales consumen 1 crédito por email · Haz clic en un email para ver el detalle
        </p>
        <button
          onClick={() => setShowCredits(true)}
          className="font-mono text-[11px] text-[#00C2FF] hover:underline"
        >
          Comprar créditos →
        </button>
      </div>

      {/* Email list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#00C2FF] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : emails.length === 0 ? (
        <div className="bg-[#0D1117] border border-white/[0.06] rounded-xl p-12 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-slate-600">
              <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M2 8 L12 14 L22 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-400">No monitored emails</p>
          <p className="text-xs text-slate-600">
            Add email addresses to scan against breach databases.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {emails.map((e) => {
            const barColor   = emailBarColor(e);
            const isBreached = e.total_breaches > 0;
            const isScanned  = !!e.latest_breach;
            const lastCheck  = e.latest_breach?.scanned_at;

            return (
              <div
                key={e.id}
                className="relative bg-[#0D1117] border border-white/[0.06] rounded-xl p-5 overflow-hidden cursor-pointer hover:border-white/[0.12] transition-colors"
                onClick={() => setSelected(e)}
              >
                <div
                  className="absolute bottom-0 left-0 right-0 h-[3px]"
                  style={{ backgroundColor: barColor }}
                />

                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-white truncate">{e.email}</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {lastCheck
                        ? `Last checked: ${new Date(lastCheck).toLocaleString("es-ES")}`
                        : "Pending first scan"}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Breach badge */}
                    {isScanned && (
                      <span
                        className="text-[11px] font-medium px-2.5 py-1 rounded-full"
                        style={{
                          color: isBreached ? "#FF4757" : "#00E5A0",
                          backgroundColor: isBreached ? "rgba(255,71,87,0.1)" : "rgba(0,229,160,0.1)",
                        }}
                      >
                        {isBreached
                          ? `${e.total_breaches} breach${e.total_breaches !== 1 ? "es" : ""}`
                          : "0 breaches"}
                      </span>
                    )}

                    {/* Scan button */}
                    <button
                      onClick={(ev) => handleScan(ev, e)}
                      disabled={scanning === e.id}
                      title="Escanear (1 crédito)"
                      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#00C2FF] disabled:opacity-40 transition-colors"
                    >
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        className={`w-3.5 h-3.5 ${scanning === e.id ? "animate-spin" : ""}`}
                      >
                        <path
                          d="M13.5 8A5.5 5.5 0 1 1 8 2.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                        <path d="M8 1v3l2-1.5L8 1Z" fill="currentColor"/>
                      </svg>
                      Scan
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={(ev) => { ev.stopPropagation(); handleRemove(e.id, e.email); }}
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
