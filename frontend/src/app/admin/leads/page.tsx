"use client";

import { useEffect, useState, useCallback } from "react";
import { adminApi } from "@/lib/api";

const ACCENT = "#f59e0b";

interface Lead {
  id: string;
  company_name: string | null;
  domain: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  industry: string | null;
  spf_status: string | null;
  dkim_status: string | null;
  dmarc_status: string | null;
  ssl_status: string | null;
  score: number | null;
  status: string;
  notes: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  new: "#3b82f6",
  contacted: ACCENT,
  interested: "#8b5cf6",
  converted: "#4ade80",
  rejected: "#f87171",
};

const inputStyle: React.CSSProperties = {
  padding: "8px 12px", background: "#111318",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
  color: "#e2e8f0", fontSize: 13, outline: "none",
  fontFamily: "'Plus Jakarta Sans', sans-serif", width: "100%", boxSizing: "border-box",
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // New lead form
  const [form, setForm] = useState({
    company_name: "", domain: "", email: "", phone: "",
    location: "", industry: "", notes: "",
  });

  const PER_PAGE = 20;

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3500); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.leads({ status: statusFilter, search, page });
      setLeads(r.data.leads);
      setTotal(r.data.total);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, page]);

  useEffect(() => { load(); }, [load]);

  const handleAddLead = async () => {
    if (!form.domain && !form.email && !form.company_name) {
      showMsg("Indica al menos empresa, dominio o email"); return;
    }
    setSaving(true);
    try {
      const data: Record<string, string> = {};
      Object.entries(form).forEach(([k, v]) => { if (v.trim()) data[k] = v.trim(); });
      await adminApi.addLead(data);
      showMsg("Lead añadido correctamente");
      setShowModal(false);
      setForm({ company_name: "", domain: "", email: "", phone: "", location: "", industry: "", notes: "" });
      load();
    } catch {
      showMsg("Error al añadir lead");
    } finally { setSaving(false); }
  };

  const handleUpdateStatus = async (lead: Lead, newStatus: string) => {
    setSaving(true);
    try {
      await adminApi.updateLead(lead.id, { status: newStatus });
      showMsg("Estado actualizado");
      load();
    } catch {
      showMsg("Error al actualizar");
    } finally { setSaving(false); }
  };

  const handleUpdateNotes = async () => {
    if (!editLead) return;
    setSaving(true);
    try {
      await adminApi.updateLead(editLead.id, { notes: editLead.notes || "" });
      showMsg("Notas guardadas");
      setEditLead(null);
      load();
    } catch {
      showMsg("Error al guardar notas");
    } finally { setSaving(false); }
  };

  const fmt = (iso: string) => iso ? new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" }) : "—";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", marginBottom: 6, letterSpacing: "-0.03em" }}>
            Leads ({total})
          </h1>
          <p style={{ fontSize: 13, color: "#64748b" }}>Gestión de prospectos comerciales</p>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ padding: "8px 18px", background: `${ACCENT}18`,
                   border: `1px solid ${ACCENT}44`, borderRadius: 8,
                   color: ACCENT, fontSize: 13, fontWeight: 600, cursor: "pointer",
                   fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          + Añadir lead
        </button>
      </div>

      {msg && (
        <div style={{ padding: "10px 14px",
                      background: msg.startsWith("Error") ? "#f8717118" : "#4ade8018",
                      border: `1px solid ${msg.startsWith("Error") ? "#f87171" : "#4ade80"}44`,
                      borderRadius: 8,
                      color: msg.startsWith("Error") ? "#f87171" : "#4ade80",
                      fontSize: 13, marginBottom: 16 }}>{msg}</div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Buscar empresa, email, dominio…"
          style={{ flex: 1, minWidth: 200, padding: "8px 12px", background: "#0a0b0f",
                   border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                   color: "#e2e8f0", fontSize: 13, outline: "none",
                   fontFamily: "'Plus Jakarta Sans', sans-serif" }} />
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ padding: "8px 12px", background: "#0a0b0f",
                   border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                   color: "#e2e8f0", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <option value="">Todos los estados</option>
          <option value="new">Nuevo</option>
          <option value="contacted">Contactado</option>
          <option value="interested">Interesado</option>
          <option value="converted">Convertido</option>
          <option value="rejected">Rechazado</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: "#0a0b0f", border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["Empresa", "Dominio", "Email", "Score", "Estado", "Creado", "Acción"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left",
                                     fontSize: 11, fontWeight: 600, color: "#475569",
                                     textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 30, textAlign: "center", color: "#475569" }}>Cargando…</td></tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 30, textAlign: "center", color: "#475569" }}>Sin leads</td></tr>
            ) : leads.map((lead, i) => (
              <tr key={lead.id}
                style={{ borderBottom: i < leads.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <td style={{ padding: "10px 14px", color: "#e2e8f0" }}>{lead.company_name || "—"}</td>
                <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{lead.domain || "—"}</td>
                <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{lead.email || "—"}</td>
                <td style={{ padding: "10px 14px" }}>
                  {lead.score != null ? (
                    <span style={{ fontSize: 13, fontWeight: 600,
                                   color: lead.score >= 70 ? "#4ade80" : lead.score >= 50 ? ACCENT : "#f87171" }}>
                      {lead.score}
                    </span>
                  ) : "—"}
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <select
                    value={lead.status}
                    onChange={e => handleUpdateStatus(lead, e.target.value)}
                    disabled={saving}
                    style={{ background: `${STATUS_COLORS[lead.status] || "#64748b"}18`,
                             border: `1px solid ${STATUS_COLORS[lead.status] || "#64748b"}44`,
                             color: STATUS_COLORS[lead.status] || "#64748b",
                             padding: "3px 8px", borderRadius: 4, fontSize: 11,
                             fontWeight: 600, cursor: "pointer",
                             fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    <option value="new">Nuevo</option>
                    <option value="contacted">Contactado</option>
                    <option value="interested">Interesado</option>
                    <option value="converted">Convertido</option>
                    <option value="rejected">Rechazado</option>
                  </select>
                </td>
                <td style={{ padding: "10px 14px", color: "#64748b" }}>{fmt(lead.created_at)}</td>
                <td style={{ padding: "10px 14px" }}>
                  <button onClick={() => setEditLead({ ...lead })}
                    style={{ padding: "4px 10px", background: "rgba(255,255,255,0.04)",
                             border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
                             color: "#94a3b8", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                    Notas
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > PER_PAGE && (
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "center" }}>
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            style={{ padding: "6px 14px", background: "#0a0b0f",
                     border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
                     color: page === 1 ? "#475569" : "#e2e8f0", cursor: page === 1 ? "default" : "pointer",
                     fontSize: 12, fontFamily: "inherit" }}>← Anterior</button>
          <span style={{ padding: "6px 14px", fontSize: 12, color: "#64748b" }}>
            Pág {page} / {Math.ceil(total / PER_PAGE)}
          </span>
          <button disabled={page >= Math.ceil(total / PER_PAGE)} onClick={() => setPage(p => p + 1)}
            style={{ padding: "6px 14px", background: "#0a0b0f",
                     border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
                     color: page >= Math.ceil(total / PER_PAGE) ? "#475569" : "#e2e8f0",
                     cursor: page >= Math.ceil(total / PER_PAGE) ? "default" : "pointer",
                     fontSize: 12, fontFamily: "inherit" }}>Siguiente →</button>
        </div>
      )}

      {/* Add Lead Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      zIndex: 1000 }}>
          <div style={{ background: "#0a0b0f", border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 16, padding: 28, width: 480, maxWidth: "90vw",
                        maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>Nuevo lead</div>
              <button onClick={() => setShowModal(false)}
                style={{ background: "none", border: "none", color: "#64748b",
                         cursor: "pointer", fontSize: 18, padding: 0 }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(["company_name", "domain", "email", "phone", "location", "industry"] as const).map(field => (
                <div key={field}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, textTransform: "capitalize" }}>
                    {field.replace("_", " ")}
                  </div>
                  <input
                    value={form[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    placeholder={field.replace("_", " ")}
                    style={inputStyle}
                  />
                </div>
              ))}
              <div>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Notas</div>
                <textarea value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Notas adicionales…"
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => setShowModal(false)}
                  style={{ flex: 1, padding: "9px", background: "rgba(255,255,255,0.04)",
                           border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                           color: "#64748b", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                  Cancelar
                </button>
                <button onClick={handleAddLead} disabled={saving}
                  style={{ flex: 2, padding: "9px", background: `${ACCENT}18`,
                           border: `1px solid ${ACCENT}44`, borderRadius: 8,
                           color: ACCENT, fontSize: 13, fontWeight: 600, cursor: "pointer",
                           fontFamily: "inherit" }}>
                  {saving ? "Guardando…" : "Añadir lead"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Notes Modal */}
      {editLead && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      zIndex: 1000 }}>
          <div style={{ background: "#0a0b0f", border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 16, padding: 28, width: 420, maxWidth: "90vw" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>
                Notas: {editLead.company_name || editLead.domain || editLead.email}
              </div>
              <button onClick={() => setEditLead(null)}
                style={{ background: "none", border: "none", color: "#64748b",
                         cursor: "pointer", fontSize: 18, padding: 0 }}>×</button>
            </div>
            <textarea
              value={editLead.notes || ""}
              onChange={e => setEditLead(l => l ? { ...l, notes: e.target.value } : null)}
              rows={5}
              style={{ ...inputStyle, resize: "vertical", marginBottom: 12 }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setEditLead(null)}
                style={{ flex: 1, padding: "8px", background: "rgba(255,255,255,0.04)",
                         border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                         color: "#64748b", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                Cancelar
              </button>
              <button onClick={handleUpdateNotes} disabled={saving}
                style={{ flex: 2, padding: "8px", background: `${ACCENT}18`,
                         border: `1px solid ${ACCENT}44`, borderRadius: 8,
                         color: ACCENT, fontSize: 13, fontWeight: 600, cursor: "pointer",
                         fontFamily: "inherit" }}>
                {saving ? "Guardando…" : "Guardar notas"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
