"use client";

import { useEffect, useState } from "react";
import { emailsApi } from "@/lib/api";
import { Mail, Trash2, Plus, AlertTriangle, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";

interface MonitoredEmail {
  id: string;
  email: string;
  created_at: string;
  last_checked_at: string | null;
  breach_count: number | null;
}

export default function EmailsPage() {
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Emails</h1>
        <p className="text-gray-500">Monitoriza si tus emails han aparecido en brechas de datos</p>
      </div>

      {/* Add email form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Añadir email</h2>
        <form onSubmit={handleAdd} className="flex gap-3">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="usuario@empresa.com"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={adding}
          />
          <button
            type="submit"
            disabled={adding || !newEmail.trim()}
            className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
          >
            <Plus className="w-4 h-4" />
            {adding ? "Añadiendo..." : "Añadir"}
          </button>
        </form>
      </div>

      {/* Email list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : emails.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-12 text-center">
          <Mail className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No tienes emails monitorizados</p>
          <p className="text-sm text-gray-400 mt-1">Añade emails para detectar si han sido comprometidos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {emails.map((e) => (
            <div key={e.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-blue-50 rounded-lg shrink-0">
                    <Mail className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{e.email}</p>
                    <p className="text-xs text-gray-400">
                      {e.last_checked_at
                        ? `Última comprobación: ${new Date(e.last_checked_at).toLocaleString("es-ES")}`
                        : "Sin comprobar aún — se verificará esta noche"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {e.breach_count !== null && (
                    e.breach_count === 0
                      ? <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle className="w-3.5 h-3.5" />Sin brechas</span>
                      : <span className="flex items-center gap-1 text-xs text-red-600 font-medium"><AlertTriangle className="w-3.5 h-3.5" />{e.breach_count} brecha{e.breach_count !== 1 ? "s" : ""}</span>
                  )}
                  <button
                    onClick={() => handleRemove(e.id, e.email)}
                    className="text-gray-400 hover:text-red-500 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
