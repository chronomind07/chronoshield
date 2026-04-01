"use client";

import { useEffect, useState, useCallback } from "react";
import { adminApi } from "@/lib/api";

const ACCENT = "#f59e0b";

interface ScanStats {
  range_hours: number;
  ssl_scans: number;
  uptime_scans: number;
  email_security_scans: number;
  ssl_errors: number;
  uptime_downs: number;
}

function StatCard({ label, value, sub, alert = false }: { label: string; value: number | string; sub?: string; alert?: boolean }) {
  return (
    <div style={{ background: "#0a0b0f", border: `1px solid ${alert && Number(value) > 0 ? "#f87171" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 500, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700,
                    color: alert && Number(value) > 0 ? "#f87171" : "#e2e8f0",
                    letterSpacing: "-0.03em" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function PlatformPage() {
  const [stats, setStats] = useState<ScanStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.platformScans(hours);
      setStats(r.data);
    } finally {
      setLoading(false);
    }
  }, [hours]);

  useEffect(() => { load(); }, [load]);

  const totalScans = stats ? stats.ssl_scans + stats.uptime_scans + stats.email_security_scans : 0;
  const totalErrors = stats ? stats.ssl_errors + stats.uptime_downs : 0;
  const errorRate = totalScans > 0 ? ((totalErrors / totalScans) * 100).toFixed(1) : "0";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", marginBottom: 6, letterSpacing: "-0.03em" }}>
            Monitorización de plataforma
          </h1>
          <p style={{ fontSize: 13, color: "#64748b" }}>Estado de los workers de escaneo</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[6, 24, 48, 168].map(h => (
            <button key={h} onClick={() => setHours(h)}
              style={{ padding: "6px 14px", background: hours === h ? `${ACCENT}18` : "#0a0b0f",
                       border: `1px solid ${hours === h ? ACCENT + "44" : "rgba(255,255,255,0.1)"}`,
                       borderRadius: 6, color: hours === h ? ACCENT : "#64748b",
                       fontSize: 12, fontWeight: hours === h ? 600 : 400,
                       cursor: "pointer", fontFamily: "inherit" }}>
              {h < 24 ? `${h}h` : h === 24 ? "24h" : h === 48 ? "48h" : "7d"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ color: "#64748b" }}>Cargando…</div>
      ) : !stats ? (
        <div style={{ color: "#f87171" }}>Error al cargar estadísticas</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
            <StatCard label="Total escaneos" value={totalScans} sub={`últimas ${hours}h`} />
            <StatCard label="Escaneos SSL" value={stats.ssl_scans} />
            <StatCard label="Checks uptime" value={stats.uptime_scans} />
            <StatCard label="Escaneos email" value={stats.email_security_scans} />
            <StatCard label="Errores SSL" value={stats.ssl_errors} alert={true} />
            <StatCard label="Caídas uptime" value={stats.uptime_downs} alert={true} />
          </div>

          {/* Summary */}
          <div style={{ background: "#0a0b0f", border: "1px solid rgba(255,255,255,0.07)",
                        borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 16 }}>
              Resumen del periodo
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Tasa de error</div>
                <div style={{ fontSize: 22, fontWeight: 700,
                               color: Number(errorRate) > 5 ? "#f87171" : "#4ade80",
                               letterSpacing: "-0.02em" }}>{errorRate}%</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Estado general</div>
                <div style={{ fontSize: 16, fontWeight: 600,
                               color: totalErrors === 0 ? "#4ade80" : totalErrors < 5 ? ACCENT : "#f87171" }}>
                  {totalErrors === 0 ? "✓ Todo en orden" :
                   totalErrors < 5 ? "⚠ Alertas menores" : "✗ Requiere atención"}
                </div>
              </div>
            </div>
          </div>

          <button onClick={load}
            style={{ marginTop: 12, padding: "7px 16px", background: "rgba(255,255,255,0.04)",
                     border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                     color: "#64748b", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            ↻ Refrescar
          </button>
        </>
      )}
    </div>
  );
}
