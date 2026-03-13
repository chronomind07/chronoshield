"use client";

import { useEffect, useState } from "react";
import { emailsApi } from "@/lib/api";
import { useTechMode } from "@/lib/mode-context";
import toast from "react-hot-toast";

interface MonitoredEmail {
  id: string;
  email: string;
  created_at: string;
  last_checked_at: string | null;
  breach_count: number | null;
}

function emailBarColor(e: MonitoredEmail): string {
  if (e.breach_count === null) return "rgba(255,255,255,0.08)";
  if (e.breach_count === 0) return "#00E5A0";
  return "#FF4757";
}

export default function EmailsPage() {
  const { techMode } = useTechMode();
  const [emails, setEmails] = useState<MonitoredEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  const load = async () => {
    try {
      const res = await emailsApi.list();
      setEmails(res.data);
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
      toast.success("Email añadido");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Error al añadir email";
      toast.error(msg);
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

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-syne text-2xl font-bold text-white">
          {techMode ? "Email Breach Monitor" : "Vigilancia de emails"}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {techMode
            ? "Continuous monitoring against known breach databases"
            : "Te avisamos si un email de tu agencia ha sido filtrado"}
        </p>
      </div>

      {/* Add email */}
      <div className="bg-[#0D1117] border border-white/[0.06] rounded-xl p-5">
        <p className="text-xs text-slate-500 mb-3">
          {techMode ? "Add email address" : "Añadir un email a vigilar"}
        </p>
        <form onSubmit={handleAdd} className="flex gap-3">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder={techMode ? "usuario@empresa.com" : "El email que quieres proteger"}
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
          <p className="text-sm font-medium text-slate-400">Sin emails monitorizados</p>
          <p className="text-xs text-slate-600">
            {techMode
              ? "Add email addresses to scan against breach databases."
              : "Añade los emails de tu agencia para saber si han sido comprometidos."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {emails.map((e) => {
            const barColor = emailBarColor(e);
            const isBreached = e.breach_count !== null && e.breach_count > 0;
            const isSafe = e.breach_count === 0;

            return (
              <div
                key={e.id}
                className="relative bg-[#0D1117] border border-white/[0.06] rounded-xl p-5 overflow-hidden"
              >
                {/* Bottom color bar */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-[3px]"
                  style={{ backgroundColor: barColor }}
                />

                <div className="flex items-center justify-between gap-4">
                  {/* Left */}
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-white truncate">
                      {e.email}
                    </p>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {e.last_checked_at
                        ? (techMode
                            ? `Last checked: ${new Date(e.last_checked_at).toLocaleString("es-ES")}`
                            : `Revisado: ${new Date(e.last_checked_at).toLocaleString("es-ES")}`)
                        : (techMode
                            ? "Pending first scan"
                            : "Se verificará esta noche")}
                    </p>
                  </div>

                  {/* Right: breach status + delete */}
                  <div className="flex items-center gap-3 shrink-0">
                    {e.breach_count !== null && (
                      <span
                        className="text-[11px] font-medium px-2.5 py-1 rounded-full"
                        style={{
                          color: isSafe ? "#00E5A0" : "#FF4757",
                          backgroundColor: isSafe
                            ? "rgba(0,229,160,0.1)"
                            : "rgba(255,71,87,0.1)",
                        }}
                      >
                        {isSafe
                          ? (techMode ? "0 breaches" : "Sin filtraciones")
                          : (techMode
                              ? `${e.breach_count} breach${e.breach_count !== 1 ? "es" : ""}`
                              : `${e.breach_count} filtración${e.breach_count !== 1 ? "es" : ""}`)}
                      </span>
                    )}

                    {isBreached && !techMode && (
                      <span className="text-[10px] text-[#FF4757] bg-[#FF4757]/10 px-2 py-0.5 rounded-full font-medium">
                        Cambia la contraseña
                      </span>
                    )}

                    <button
                      onClick={() => handleRemove(e.id, e.email)}
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
