"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const ACCENT = "#f59e0b";

interface Stats {
  total_users: number;
  active_users_7d: number;
  new_users_7d: number;
  new_users_30d: number;
  total_domains: number;
  mrr: number;
  plan_distribution: Record<string, number>;
  alerts_7d: number;
  growth_series: { date: string; users: number }[];
}

function KpiCard({ label, value, sub, color = "#e2e8f0" }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: "#0a0b0f", border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 12, padding: "18px 20px", minWidth: 0 }}>
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 500, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color, letterSpacing: "-0.03em" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.stats().then(r => { setStats(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: "#64748b" }}>Cargando…</div>;
  if (!stats) return <div style={{ color: "#f87171" }}>Error al cargar estadísticas</div>;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#e2e8f0", marginBottom: 6, letterSpacing: "-0.03em" }}>
        Panel de Administración
      </h1>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 28 }}>
        Vista general de la plataforma ChronoShield
      </p>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 28 }}>
        <KpiCard label="Total usuarios" value={stats.total_users} />
        <KpiCard label="Activos (7d)" value={stats.active_users_7d} color="#4ade80" />
        <KpiCard label="Nuevos (7d)" value={stats.new_users_7d} color={ACCENT} />
        <KpiCard label="Nuevos (30d)" value={stats.new_users_30d} />
        <KpiCard label="MRR" value={`${stats.mrr}€`} color="#4ade80" sub="Monthly Recurring Revenue" />
        <KpiCard label="Dominios activos" value={stats.total_domains} />
        <KpiCard label="Alertas (7d)" value={stats.alerts_7d} color={stats.alerts_7d > 10 ? "#f87171" : "#e2e8f0"} />
      </div>

      {/* Plan distribution + Growth chart */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 28 }}>
        <div style={{ background: "#0a0b0f", border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 14 }}>
            Distribución de planes
          </div>
          {Object.entries(stats.plan_distribution).map(([plan, count]) => (
            <div key={plan} style={{ display: "flex", justifyContent: "space-between",
                                     alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: "#94a3b8", textTransform: "capitalize" }}>{plan}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>{count}</span>
            </div>
          ))}
        </div>

        {/* Growth chart */}
        <div style={{ background: "#0a0b0f", border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 14 }}>
            Crecimiento de usuarios (30d)
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={stats.growth_series}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#475569" }}
                     tickFormatter={(d: string) => d.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: "#475569" }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#111318", border: "1px solid rgba(255,255,255,0.1)",
                                       borderRadius: 8, fontSize: 12, color: "#e2e8f0" }} />
              <Line type="monotone" dataKey="users" stroke={ACCENT} strokeWidth={2}
                    dot={false} activeDot={{ r: 4, fill: ACCENT }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
