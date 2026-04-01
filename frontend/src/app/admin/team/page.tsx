"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";

const ACCENT = "#f59e0b";

interface TeamMember {
  id: string;
  email: string;
  role: string;
  added_at: string;
}

const inputStyle: React.CSSProperties = {
  padding: "8px 12px", background: "#111318",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
  color: "#e2e8f0", fontSize: 13, outline: "none",
  fontFamily: "'Plus Jakarta Sans', sans-serif",
};

export default function TeamPage() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3500); };

  const load = async () => {
    setLoading(true);
    try {
      const r = await adminApi.team();
      setTeam(r.data.team);
    } catch {
      showMsg("Error al cargar el equipo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newEmail.trim()) return;
    if (!confirm(`¿Convertir a "${newEmail}" en administrador?`)) return;
    setSaving(true);
    try {
      await adminApi.addTeamMember(newEmail.trim());
      showMsg(`${newEmail} añadido como admin`);
      setNewEmail("");
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      showMsg(err?.response?.data?.detail || "Error al añadir miembro");
    } finally { setSaving(false); }
  };

  const handleRemove = async (member: TeamMember) => {
    if (member.role === "superadmin") { showMsg("No se puede demover al superadmin"); return; }
    if (!confirm(`¿Quitar permisos de admin a "${member.email}"?`)) return;
    setSaving(true);
    try {
      await adminApi.removeTeamMember(member.id);
      showMsg(`${member.email} eliminado del equipo`);
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      showMsg(err?.response?.data?.detail || "Error al eliminar miembro");
    } finally { setSaving(false); }
  };

  const fmt = (iso: string) => iso ? new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", marginBottom: 6, letterSpacing: "-0.03em" }}>
        Equipo de administración
      </h1>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
        Solo superadmins pueden gestionar el equipo
      </p>

      {msg && (
        <div style={{ padding: "10px 14px",
                      background: msg.startsWith("Error") || msg.includes("No se puede") ? "#f8717118" : "#4ade8018",
                      border: `1px solid ${msg.startsWith("Error") || msg.includes("No se puede") ? "#f87171" : "#4ade80"}44`,
                      borderRadius: 8,
                      color: msg.startsWith("Error") || msg.includes("No se puede") ? "#f87171" : "#4ade80",
                      fontSize: 13, marginBottom: 16 }}>{msg}</div>
      )}

      {/* Add admin */}
      <div style={{ background: "#0a0b0f", border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 12, padding: "18px 20px", marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 12 }}>
          Añadir administrador
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            placeholder="email@dominio.com"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={handleAdd} disabled={saving || !newEmail.trim()}
            style={{ padding: "8px 18px", background: `${ACCENT}18`,
                     border: `1px solid ${ACCENT}44`, borderRadius: 8,
                     color: ACCENT, fontSize: 13, fontWeight: 600, cursor: "pointer",
                     fontFamily: "inherit", opacity: saving || !newEmail.trim() ? 0.5 : 1 }}>
            {saving ? "Añadiendo…" : "Añadir admin"}
          </button>
        </div>
        <div style={{ fontSize: 11, color: "#475569", marginTop: 8 }}>
          El usuario debe tener cuenta existente en ChronoShield
        </div>
      </div>

      {/* Team table */}
      <div style={{ background: "#0a0b0f", border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["Email", "Rol", "Añadido", "Acción"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left",
                                     fontSize: 11, fontWeight: 600, color: "#475569",
                                     textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: 30, textAlign: "center", color: "#475569" }}>Cargando…</td></tr>
            ) : team.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 30, textAlign: "center", color: "#475569" }}>Sin miembros</td></tr>
            ) : team.map((m, i) => (
              <tr key={m.id}
                style={{ borderBottom: i < team.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <td style={{ padding: "10px 14px", color: "#e2e8f0" }}>{m.email}</td>
                <td style={{ padding: "10px 14px" }}>
                  <span style={{ fontSize: 11, fontWeight: 700,
                                 color: m.role === "superadmin" ? ACCENT : "#94a3b8",
                                 background: m.role === "superadmin" ? `${ACCENT}18` : "rgba(148,163,184,0.1)",
                                 padding: "2px 8px", borderRadius: 4,
                                 textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {m.role}
                  </span>
                </td>
                <td style={{ padding: "10px 14px", color: "#64748b" }}>{fmt(m.added_at)}</td>
                <td style={{ padding: "10px 14px" }}>
                  {m.role !== "superadmin" && (
                    <button onClick={() => handleRemove(m)}
                      style={{ padding: "4px 12px", background: "#f8717118",
                               border: "1px solid #f8717144", borderRadius: 6,
                               color: "#f87171", fontSize: 12, cursor: "pointer",
                               fontFamily: "inherit" }}>
                      Eliminar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
