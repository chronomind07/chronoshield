"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/api";

const ACCENT = "#f59e0b";
const PLAN_COLORS: Record<string, string> = {
  business: "#4ade80", starter: ACCENT, trial: "#64748b"
};

interface User {
  id: string; email: string; full_name: string; role: string;
  plan: string; subscription_status: string; credits_available: number;
  domains_count: number; created_at: string; last_sign_in_at: string;
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [page, setPage] = useState(1);

  const PER_PAGE = 20;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.users({ search, plan: planFilter, page });
      setUsers(r.data.users);
      setTotal(r.data.total);
    } finally {
      setLoading(false);
    }
  }, [search, planFilter, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const fmt = (iso: string) => iso ? new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" }) : "—";

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", marginBottom: 6, letterSpacing: "-0.03em" }}>
        Usuarios ({total})
      </h1>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>Gestión completa de clientes</p>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <input
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Buscar por email o nombre…"
          style={{ flex: 1, minWidth: 200, padding: "8px 12px", background: "#0a0b0f",
                   border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                   color: "#e2e8f0", fontSize: 13, outline: "none",
                   fontFamily: "'Plus Jakarta Sans', sans-serif" }} />
        <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(1); }}
          style={{ padding: "8px 12px", background: "#0a0b0f",
                   border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                   color: "#e2e8f0", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <option value="">Todos los planes</option>
          <option value="trial">Trial</option>
          <option value="starter">Starter</option>
          <option value="business">Business</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: "#0a0b0f", border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["Email", "Nombre", "Plan", "Créditos", "Dominios", "Registro", "Último login"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left",
                                     fontSize: 11, fontWeight: 600, color: "#475569",
                                     textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 30, textAlign: "center", color: "#475569" }}>Cargando…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 30, textAlign: "center", color: "#475569" }}>Sin resultados</td></tr>
            ) : users.map((u, i) => (
              <tr key={u.id}
                onClick={() => router.push(`/admin/users/${u.id}`)}
                style={{ borderBottom: i < users.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                         cursor: "pointer", transition: "background 0.1s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <td style={{ padding: "10px 14px", color: "#e2e8f0" }}>{u.email}</td>
                <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{u.full_name || "—"}</td>
                <td style={{ padding: "10px 14px" }}>
                  <span style={{ fontSize: 11, fontWeight: 600,
                                 color: PLAN_COLORS[u.plan] || "#64748b",
                                 background: `${PLAN_COLORS[u.plan] || "#64748b"}18`,
                                 padding: "2px 8px", borderRadius: 4,
                                 textTransform: "capitalize" }}>{u.plan}</span>
                </td>
                <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{u.credits_available}</td>
                <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{u.domains_count}</td>
                <td style={{ padding: "10px 14px", color: "#64748b" }}>{fmt(u.created_at)}</td>
                <td style={{ padding: "10px 14px", color: "#64748b" }}>{fmt(u.last_sign_in_at)}</td>
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
    </div>
  );
}
