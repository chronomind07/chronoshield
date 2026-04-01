"use client";

import { useEffect, useState, useCallback } from "react";
import { adminApi } from "@/lib/api";

interface AuditEntry {
  id: string;
  admin_user_id: string;
  admin_email: string;
  action: string;
  target_user_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  change_plan: "#f59e0b",
  change_credits: "#3b82f6",
  change_ai_tokens: "#8b5cf6",
  add_admin: "#4ade80",
  remove_admin: "#f87171",
  account_suspended: "#f87171",
  account_active: "#4ade80",
  account_inactive: "#64748b",
  add_lead: "#06b6d4",
  update_lead: "#06b6d4",
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const PER_PAGE = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.audit(page);
      setLogs(r.data.logs);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const fmt = (iso: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) +
      " " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", marginBottom: 6, letterSpacing: "-0.03em" }}>
        Audit Log
      </h1>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
        Registro de todas las acciones administrativas
      </p>

      <div style={{ background: "#0a0b0f", border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["Fecha", "Admin", "Acción", "Target ID", "IP", "Detalles"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left",
                                     fontSize: 11, fontWeight: 600, color: "#475569",
                                     textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 30, textAlign: "center", color: "#475569" }}>Cargando…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 30, textAlign: "center", color: "#475569" }}>Sin registros</td></tr>
            ) : logs.map((entry, i) => (
              <>
                <tr key={entry.id}
                  onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                  style={{ borderBottom: i < logs.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                           cursor: "pointer", transition: "background 0.1s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <td style={{ padding: "9px 14px", color: "#64748b", fontSize: 12 }}>{fmt(entry.created_at)}</td>
                  <td style={{ padding: "9px 14px", color: "#94a3b8", fontSize: 12 }}>
                    {entry.admin_email || entry.admin_user_id?.slice(0, 8) + "…"}
                  </td>
                  <td style={{ padding: "9px 14px" }}>
                    <span style={{ fontSize: 11, fontWeight: 600,
                                   color: ACTION_COLORS[entry.action] || "#94a3b8",
                                   background: `${ACTION_COLORS[entry.action] || "#94a3b8"}18`,
                                   padding: "2px 8px", borderRadius: 4 }}>
                      {entry.action}
                    </span>
                  </td>
                  <td style={{ padding: "9px 14px", color: "#64748b", fontSize: 11,
                               fontFamily: "'DM Mono', monospace" }}>
                    {entry.target_user_id ? entry.target_user_id.slice(0, 12) + "…" : "—"}
                  </td>
                  <td style={{ padding: "9px 14px", color: "#64748b", fontSize: 11 }}>
                    {entry.ip_address || "—"}
                  </td>
                  <td style={{ padding: "9px 14px", color: "#475569", fontSize: 11 }}>
                    {expanded === entry.id ? "▲ cerrar" : "▼ ver"}
                  </td>
                </tr>
                {expanded === entry.id && (
                  <tr key={`${entry.id}-details`}>
                    <td colSpan={6} style={{ padding: "0 14px 12px 14px",
                                             background: "rgba(255,255,255,0.02)" }}>
                      <pre style={{ fontSize: 11, color: "#94a3b8", margin: 0,
                                    fontFamily: "'DM Mono', monospace",
                                    whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                        {JSON.stringify(entry.details, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "center" }}>
        <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
          style={{ padding: "6px 14px", background: "#0a0b0f",
                   border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
                   color: page === 1 ? "#475569" : "#e2e8f0", cursor: page === 1 ? "default" : "pointer",
                   fontSize: 12, fontFamily: "inherit" }}>← Anterior</button>
        <span style={{ padding: "6px 14px", fontSize: 12, color: "#64748b" }}>Pág {page}</span>
        <button disabled={logs.length < PER_PAGE} onClick={() => setPage(p => p + 1)}
          style={{ padding: "6px 14px", background: "#0a0b0f",
                   border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
                   color: logs.length < PER_PAGE ? "#475569" : "#e2e8f0",
                   cursor: logs.length < PER_PAGE ? "default" : "pointer",
                   fontSize: 12, fontFamily: "inherit" }}>Siguiente →</button>
      </div>
    </div>
  );
}
