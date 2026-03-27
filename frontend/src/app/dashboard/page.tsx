"use client";

import { useEffect, useState } from "react";
import { dashboardApi, emailsApi, domainsApi } from "@/lib/api";
import Link from "next/link";
import toast from "react-hot-toast";

interface DashboardSummary {
  domains_monitored: number;
  emails_monitored: number;
  active_alerts: number;
  average_score: number;
  domains_with_ssl_issues: number;
  domains_down: number;
  breached_emails: number;
  recent_alerts: Alert[];
}

interface Alert {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  sent_at: string;
  read_at: string | null;
}

interface MonitoredEmail {
  id: string;
  email: string;
  last_checked_at: string | null;
  breach_count: number | null;
}

function scoreGrade(s: number) {
  return s >= 95 ? "A+" : s >= 90 ? "A" : s >= 80 ? "B" : s >= 70 ? "C" : s >= 60 ? "D" : "F";
}

function greetingByHour() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora mismo";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return new Date(iso).toLocaleDateString("es-ES");
}

function sevColor(sev: string): string {
  if (sev === "critical" || sev === "high") return "#ef4444";
  if (sev === "medium") return "#f59e0b";
  return "#3b82f6";
}

// ── Live Clock ────────────────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "1.6rem", fontWeight: 700, color: "#f0f0f0", letterSpacing: "-0.02em" }}>
      {time.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </span>
  );
}

// ── Score Donut ───────────────────────────────────────────────────────────────
function ScoreDonut({ score, ssl, emailSec, breach, uptime }: {
  score: number; ssl: number; emailSec: number; breach: number; uptime: number;
}) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const grade = scoreGrade(score);
  const gradeColor = score >= 90 ? "#3ecf8e" : score >= 70 ? "#f59e0b" : "#ef4444";

  const rows = [
    { label: "SSL", val: ssl, color: "#3ecf8e" },
    { label: "Email Sec.", val: emailSec, color: "#3b82f6" },
    { label: "Breaches", val: breach, color: "#ef4444" },
    { label: "Uptime", val: uptime, color: "#f59e0b" },
  ];

  return (
    <div>
      {/* Donut */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
        <div style={{ position: "relative", width: 120, height: 120 }}>
          <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
            <circle cx="60" cy="60" r={r} fill="none" stroke={gradeColor} strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)" }}
            />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "1.3rem", fontWeight: 700, color: gradeColor, lineHeight: 1 }}>{grade}</span>
            <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.7rem", color: "#52525b", marginTop: 2 }}>{score}</span>
          </div>
        </div>
      </div>

      {/* Component rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map(row => (
          <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: row.color, flexShrink: 0 }} />
            <span style={{ fontSize: "0.78rem", color: "#a1a1aa", flex: 1 }}>{row.label}</span>
            <div style={{ flex: 2, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${row.val}%`, background: row.color, borderRadius: 2, transition: "width 1s ease" }} />
            </div>
            <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.72rem", color: "#52525b", width: 28, textAlign: "right" }}>{row.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Metric Card ───────────────────────────────────────────────────────────────
function MetricCard({ icon, label, value, delta, deltaPositive }: {
  icon: React.ReactNode; label: string; value: string | number;
  delta?: string; deltaPositive?: boolean;
}) {
  return (
    <div style={{ background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "18px 20px", transition: "border-color 0.2s, background 0.2s" }}
      onMouseEnter={e => { e.currentTarget.style.background = "#242424"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "#1c1c1c"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(62,207,142,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3ecf8e" }}>
          {icon}
        </div>
        <span style={{ color: "#3a3a3a", fontSize: "1rem", lineHeight: 1, cursor: "default" }}>⋯</span>
      </div>
      <div style={{ fontSize: "0.75rem", color: "#52525b", marginBottom: 6, fontWeight: 500 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-dm-mono)", fontSize: "1.75rem", fontWeight: 700, color: "#f0f0f0", lineHeight: 1 }}>{value}</div>
      {delta && (
        <div style={{ fontSize: "0.72rem", color: deltaPositive ? "#3ecf8e" : "#ef4444", marginTop: 6, display: "flex", alignItems: "center", gap: 3 }}>
          {deltaPositive ? "↑" : "↓"} {delta}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [emails, setEmails] = useState<MonitoredEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);

  const load = async () => {
    try {
      const [sumRes, emlRes] = await Promise.all([dashboardApi.summary(), emailsApi.list()]);
      setSummary(sumRes.data);
      setEmails(emlRes.data ?? []);
    } catch {
      toast.error("Error al cargar el dashboard");
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (alertId: string) => {
    try {
      await dashboardApi.markAlertRead(alertId);
      setSummary(prev => prev ? {
        ...prev,
        recent_alerts: prev.recent_alerts.map(a => a.id === alertId ? { ...a, read_at: new Date().toISOString() } : a),
        active_alerts: Math.max(0, prev.active_alerts - 1),
      } : prev);
    } catch { /* silent */ }
  };

  const [scanning2, setScanning2] = useState(false);
  const handleScanAll = async () => {
    if (scanning2) return;
    setScanning2(true);
    try {
      const domsRes = await domainsApi.list();
      const doms: { id: string }[] = domsRes.data ?? [];
      if (doms.length === 0) { toast("Sin dominios que escanear"); setScanning2(false); return; }
      await Promise.allSettled(doms.map(d => domainsApi.scan(d.id)));
      await new Promise(resolve => setTimeout(resolve, 12000));
      const [sumRes, emlRes] = await Promise.all([dashboardApi.summary(), emailsApi.list()]);
      const fresh: DashboardSummary = sumRes.data;
      setSummary(fresh);
      setEmails(emlRes.data ?? []);
      setLastScanTime(new Date());
      const score = Math.round(fresh?.average_score ?? 0);
      const issues = fresh?.active_alerts ?? 0;
      if (score >= 90 && issues === 0) toast.success("✅ Tu dominio está correctamente configurado y protegido");
      else if (score >= 70) toast.success(`Scan completado · Score: ${score}${issues > 0 ? ` · ${issues} alerta${issues !== 1 ? "s" : ""}` : ""}`);
      else toast.error(`Score: ${score} · Revisa las alertas activas`);
    } catch { toast.error("Error al escanear"); } finally { setScanning2(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div style={{ padding: "40px 32px", background: "#0a0a0a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 28, height: 28, border: "2px solid #3ecf8e", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!summary) {
    return (
      <div style={{ padding: "40px 32px", background: "#0a0a0a", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(62,207,142,0.08)", border: "1px solid rgba(62,207,142,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem" }}>🛡</div>
        <div>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#f0f0f0" }}>Empieza añadiendo tu primer dominio</h2>
          <p style={{ fontSize: "0.82rem", color: "#52525b", marginTop: 6 }}>Monitoriza la seguridad desde un solo lugar.</p>
        </div>
        <Link href="/dashboard/domains" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 8, background: "#3ecf8e", color: "#000", fontWeight: 700, fontSize: "0.875rem", textDecoration: "none" }}>
          Añadir dominio
        </Link>
      </div>
    );
  }

  const td = Math.max(1, summary.domains_monitored);
  const te = Math.max(1, summary.emails_monitored);
  const sslScore = Math.round(Math.max(0, (1 - summary.domains_with_ssl_issues / td) * 100));
  const uptimeScore = Math.round(Math.max(0, (1 - summary.domains_down / td) * 100));
  const breachScore = Math.round(Math.max(0, (1 - summary.breached_emails / te) * 100));
  const emailSecScore = Math.round(Math.max(0, Math.min(100, (summary.average_score - breachScore * 0.30 - sslScore * 0.25 - uptimeScore * 0.25) / 0.20)));
  const avg = Math.round(summary.average_score);

  const hasAlerts = summary.active_alerts > 0;
  const statusMsg = hasAlerts
    ? `${summary.active_alerts} alerta${summary.active_alerts !== 1 ? "s" : ""} requiere${summary.active_alerts !== 1 ? "n" : ""} atención`
    : "Tu infraestructura está protegida";

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", padding: "28px 32px 60px" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>

      {/* 2-column grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>

        {/* ── LEFT: main content ─────────────────────────────────────────── */}
        <div>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#f0f0f0", margin: 0, letterSpacing: "-0.01em" }}>Overview</h1>
              <p style={{ fontSize: "0.8rem", color: "#52525b", margin: "4px 0 0" }}>Panel de monitorización de seguridad</p>
            </div>
            <button
              onClick={handleScanAll}
              disabled={scanning2}
              style={{
                display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 8,
                background: "#3ecf8e", color: "#000", fontWeight: 700, fontSize: "0.82rem", border: "none",
                cursor: scanning2 ? "not-allowed" : "pointer", opacity: scanning2 ? 0.7 : 1,
                transition: "opacity 0.2s",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ animation: scanning2 ? "spin 0.8s linear infinite" : "none" }}>
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.84"/>
              </svg>
              {scanning2 ? "Escaneando..." : "Escanear"}
            </button>
          </div>

          {/* Hero banner */}
          <div style={{
            background: "linear-gradient(135deg, #0f1a14 0%, #111111 100%)",
            border: "1px solid rgba(62,207,142,0.1)",
            borderRadius: 14,
            padding: "22px 24px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: "0.72rem", color: "#52525b", fontFamily: "var(--font-dm-mono)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                {greetingByHour()}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: hasAlerts ? "#f59e0b" : "#3ecf8e", animation: "pulse 2s ease-in-out infinite" }} />
                <span style={{ fontSize: "1rem", fontWeight: 600, color: "#f0f0f0" }}>{statusMsg}</span>
              </div>
              <p style={{ fontSize: "0.75rem", color: "#52525b", margin: 0 }}>
                {lastScanTime ? `Último scan: ${relTime(lastScanTime.toISOString())}` : "Monitoreo activo · escanea para actualizar"}
              </p>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <LiveClock />
              <div style={{ fontSize: "0.72rem", color: "#52525b", marginTop: 4, fontFamily: "var(--font-dm-mono)" }}>
                {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
              </div>
            </div>
          </div>

          {/* Metric cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
            <MetricCard
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
              label="SSL" value={`${sslScore}%`}
              delta={summary.domains_with_ssl_issues === 0 ? "Sin issues" : `${summary.domains_with_ssl_issues} issue${summary.domains_with_ssl_issues !== 1 ? "s" : ""}`}
              deltaPositive={summary.domains_with_ssl_issues === 0}
            />
            <MetricCard
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>}
              label="Email Sec." value={`${emailSecScore}%`}
              delta={emailSecScore >= 80 ? "Protegido" : "Atención"} deltaPositive={emailSecScore >= 80}
            />
            <MetricCard
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
              label="Uptime" value={`${uptimeScore}%`}
              delta={summary.domains_down === 0 ? "Todos online" : `${summary.domains_down} caído${summary.domains_down !== 1 ? "s" : ""}`}
              deltaPositive={summary.domains_down === 0}
            />
            <MetricCard
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
              label="Breaches" value={summary.breached_emails}
              delta={summary.breached_emails === 0 ? "Sin filtraciones" : `de ${summary.emails_monitored} emails`}
              deltaPositive={summary.breached_emails === 0}
            />
          </div>

          {/* Recent alerts */}
          {summary.recent_alerts && summary.recent_alerts.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <h2 style={{ fontSize: "0.78rem", fontFamily: "var(--font-dm-mono)", textTransform: "uppercase", letterSpacing: "0.12em", color: "#52525b", fontWeight: 600, margin: 0 }}>Alertas recientes</h2>
                <Link href="/dashboard/alerts" style={{ fontSize: "0.75rem", color: "#3ecf8e", textDecoration: "none", fontWeight: 500 }}>Ver todas →</Link>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {summary.recent_alerts.slice(0, 5).map(alert => (
                  <div key={alert.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: sevColor(alert.severity), flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "0.82rem", fontWeight: 600, color: alert.read_at ? "#52525b" : "#f0f0f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{alert.title}</p>
                      <p style={{ fontSize: "0.7rem", color: "#3a3a3a", margin: "2px 0 0" }}>{relTime(alert.sent_at)}</p>
                    </div>
                    {!alert.read_at && (
                      <button onClick={() => markRead(alert.id)} style={{ fontSize: "0.68rem", color: "#3ecf8e", background: "rgba(62,207,142,0.08)", border: "none", cursor: "pointer", padding: "3px 8px", borderRadius: 6 }}>
                        Marcar leída
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL: Score ─────────────────────────────────────────── */}
        <div style={{ position: "sticky", top: 68 }}>
          <div style={{ background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "22px 20px" }}>
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: "0.62rem", fontFamily: "var(--font-dm-mono)", textTransform: "uppercase", letterSpacing: "0.12em", color: "#52525b", fontWeight: 600, margin: "0 0 2px" }}>Security Score</p>
              <p style={{ fontSize: "0.78rem", color: "#a1a1aa", margin: 0 }}>Puntuación de seguridad</p>
            </div>
            <ScoreDonut score={avg} ssl={sslScore} emailSec={emailSecScore} breach={breachScore} uptime={uptimeScore} />

            {/* Monitors count */}
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.04)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-dm-mono)", fontSize: "1.1rem", fontWeight: 700, color: "#f0f0f0" }}>{summary.domains_monitored}</div>
                <div style={{ fontSize: "0.7rem", color: "#52525b", marginTop: 2 }}>dominios</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-dm-mono)", fontSize: "1.1rem", fontWeight: 700, color: "#f0f0f0" }}>{summary.emails_monitored}</div>
                <div style={{ fontSize: "0.7rem", color: "#52525b", marginTop: 2 }}>emails</div>
              </div>
            </div>

            {/* Active alerts */}
            <div style={{ marginTop: 12 }}>
              <Link href="/dashboard/alerts" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: hasAlerts ? "rgba(245,158,11,0.05)" : "rgba(62,207,142,0.04)", border: `1px solid ${hasAlerts ? "rgba(245,158,11,0.15)" : "rgba(62,207,142,0.12)"}`, borderRadius: 8, textDecoration: "none" }}>
                <span style={{ fontSize: "0.78rem", color: "#a1a1aa" }}>Alertas activas</span>
                <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.88rem", fontWeight: 700, color: hasAlerts ? "#f59e0b" : "#3ecf8e" }}>{summary.active_alerts}</span>
              </Link>
            </div>
          </div>

          {/* AI Assistant quick link */}
          <Link href="/dashboard/assistant" style={{
            display: "flex", alignItems: "center", gap: 12, marginTop: 12, padding: "14px 16px",
            background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, textDecoration: "none",
            transition: "all 0.15s",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(62,207,142,0.2)"; (e.currentTarget as HTMLElement).style.background = "#242424"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.background = "#1c1c1c"; }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(62,207,142,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4l3 3"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#f0f0f0" }}>AI Assistant</div>
              <div style={{ fontSize: "0.72rem", color: "#52525b", marginTop: 1 }}>Analiza tus alertas con IA</div>
            </div>
            <span style={{ marginLeft: "auto", color: "#52525b", fontSize: "0.8rem" }}>→</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
