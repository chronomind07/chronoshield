"use client";

import { useEffect, useState } from "react";
import { domainsApi } from "@/lib/api";
import { Globe, Trash2, RefreshCw, Plus, Shield, AlertTriangle, CheckCircle } from "lucide-react";
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

export default function DomainsPage() {
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
      toast.success("Escaneo iniciado — los resultados aparecerán en unos segundos");
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dominios</h1>
        <p className="text-gray-500">Gestiona y monitoriza tus dominios</p>
      </div>

      {/* Add domain form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Añadir dominio</h2>
        <form onSubmit={handleAdd} className="flex gap-3">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="ejemplo.com"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={adding}
          />
          <button
            type="submit"
            disabled={adding || !newDomain.trim()}
            className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
          >
            <Plus className="w-4 h-4" />
            {adding ? "Añadiendo..." : "Añadir"}
          </button>
        </form>
      </div>

      {/* Domain list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : domains.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-12 text-center">
          <Globe className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No tienes dominios añadidos</p>
          <p className="text-sm text-gray-400 mt-1">Añade tu primer dominio para empezar a monitorizar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {domains.map((d) => (
            <div key={d.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-blue-50 rounded-lg shrink-0">
                    <Globe className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{d.domain}</p>
                    <p className="text-xs text-gray-400">
                      {d.last_scanned_at
                        ? `Último escaneo: ${new Date(d.last_scanned_at).toLocaleString("es-ES")}`
                        : "Sin escanear aún"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Status badges */}
                  {d.is_up !== null && (
                    d.is_up
                      ? <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle className="w-3.5 h-3.5" />Online</span>
                      : <span className="flex items-center gap-1 text-xs text-red-600 font-medium"><AlertTriangle className="w-3.5 h-3.5" />Caído</span>
                  )}
                  {d.ssl_valid !== null && (
                    d.ssl_valid
                      ? <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><Shield className="w-3.5 h-3.5" />SSL OK</span>
                      : <span className="flex items-center gap-1 text-xs text-red-600 font-medium"><Shield className="w-3.5 h-3.5" />SSL Error</span>
                  )}
                  {d.overall_score !== null && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      d.overall_score >= 80 ? "bg-green-100 text-green-700"
                        : d.overall_score >= 60 ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}>
                      {d.overall_score}
                    </span>
                  )}

                  <button
                    onClick={() => handleScan(d.id)}
                    disabled={scanning === d.id}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${scanning === d.id ? "animate-spin" : ""}`} />
                    Escanear
                  </button>
                  <button
                    onClick={() => handleRemove(d.id, d.domain)}
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
