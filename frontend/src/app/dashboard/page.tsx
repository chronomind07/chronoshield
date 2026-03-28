"use client";

import { useEffect, useState } from "react";
import { dashboardApi, emailsApi, domainsApi, alertsApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import toast from "react-hot-toast";

// ── Types ──────────────────────────────────────────────────────────────────────
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

interface Domain {
  id: string;
  domain: string;
  is_active: boolean;
  last_scan_at: string | null;
  overall_score?: number | null;
  ssl_score?: number | null;
  uptime_score?: number | null;
  email_security_score?: number | null;
}

interface MonitoredEmail {
  id: string;
  email: string;
  last_checked_at: string | null;
  breach_count: number | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
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
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return new Date(iso).toLocaleDateString("es-ES");
}

function sevColor(sev: string): string {
  if (sev === "critical" || sev === "high") return "#ef4444";
  if (sev === "medium") return "#f59e0b";
  return "#3b82f6";
}

function domainStatus(d: Domain): { label: string; color: string; bg: string } {
  const score = d.overall_score ?? 0;
  if (!d.is_active) return { label: "Inactivo", color: "#71717a", bg: "rgba(113,113,122,0.12)" };
  if (score >= 80) return { label: "Seguro", color: "#3ecf8e", bg: "rgba(62,207,142,0.12)" };
  if (score >= 60) return { label: "Advertencia", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" };
  return { label: "Error", color: "#ef4444", bg: "rgba(239,68,68,0.12)" };
}

function formatDateFull(d: Date): string {
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// ── Live Clock ─────────────────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const h = time.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = String(time.getMinutes()).padStart(2, "0");
  return (
    <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "3rem", fontWeight: 700, color: "#f5f5f5", letterSpacing: "-0.02em", lineHeight: 1 }}>
      {`${h12}:${mm} `}<span style={{ fontSize: "1.2rem", fontWeight: 500, color: "#b3b4b5" }}>{ampm}</span>
    </span>
  );
}

// ── Shield Icon ────────────────────────────────────────────────────────────────
function ShieldIcon({ size = 48, color = "#3ecf8e" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill={color} fillOpacity="0.15" />
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" strokeWidth="2" />
    </svg>
  );
}

// ── Scan Activity SVG Chart ────────────────────────────────────────────────────
function ScanActivityChart({ totalScans }: { totalScans: number }) {
  const W = 340, H = 80;
  const pts = 30;
  // Generate deterministic-ish data based on totalScans
  const vals = Array.from({ length: pts }, (_, i) => {
    const base = Math.max(0, totalScans - pts + i + 1);
    const jitter = Math.sin(i * 2.3 + 1.7) * 2 + Math.cos(i * 1.1) * 1.5;
    return Math.max(0, Math.round(base + jitter));
  });
  const maxV = Math.max(...vals, 1);
  const step = W / (pts - 1);
  const toY = (v: number) => H - 8 - ((v / maxV) * (H - 20));
  const points = vals.map((v, i) => `${i * step},${toY(v)}`).join(" ");
  const linePath = `M ${vals.map((v, i) => `${i * step},${toY(v)}`).join(" L ")}`;
  const areaPath = `M 0,${H} L ${vals.map((v, i) => `${i * step},${toY(v)}`).join(" L ")} L ${W},${H} Z`;

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3ecf8e" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#3ecf8e" stopOpacity="0.03" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#areaGrad)" />
      <path d={linePath} fill="none" stroke="#3ecf8e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Multi-ring Donut ───────────────────────────────────────────────────────────
function MultiRingDonut({ ssl, email, uptime, darkweb, score }: {
  ssl: number; email: number; uptime: number; darkweb: number; score: number;
}) {
  const grade = scoreGrade(score);
  const segments = [
    { r: 52, val: ssl,     color: "#3ecf8e", label: "SSL" },
    { r: 42, val: email,   color: "#3b82f6", label: "Email" },
    { r: 32, val: uptime,  color: "#f59e0b", label: "Uptime" },
    { r: 22, val: darkweb, color: "#ef4444", label: "DarkWeb" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ position: "relative", width: 130, height: 130 }}>
        <svg width="130" height="130" viewBox="0 0 130 130" style={{ transform: "rotate(-90deg)" }}>
          {segments.map(({ r }) => (
            <circle
              key={r}
              cx="65" cy="65" r={r}
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="6"
            />
          ))}
          {segments.map(({ r, val, color }) => {
            const circ = 2 * Math.PI * r;
            const dash = circ * (val / 100);
            const gap = circ - dash;
            return (
              <circle
                key={`arc-${r}`}
                cx="65" cy="65" r={r}
                fill="none"
                stroke={color}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${gap}`}
                style={{ transition: "stroke-dasharray 1s cubic-bezier(0.16,1,0.3,1)" }}
              />
            );
          })}
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "1.5rem", fontWeight: 700, color: "#f5f5f5", lineHeight: 1 }}>
            {score}%
          </span>
          <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.875rem", fontWeight: 600, color: score >= 90 ? "#3ecf8e" : score >= 70 ? "#f59e0b" : "#ef4444", marginTop: 2 }}>
            {grade}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, delta, deltaType }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  delta: string;
  deltaType: "positive" | "neutral" | "negative";
}) {
  const deltaColor = deltaType === "positive" ? "#3ecf8e" : deltaType === "negative" ? "#ef4444" : "#71717a";
  const deltaArrow = deltaType === "positive" ? "↑" : deltaType === "negative" ? "↓" : "→";
  return (
    <div style={{
      background: "#151515",
      border: "0.8px solid #1a1a1a",
      borderRadius: 16,
      padding: 16,
      height: 110,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
    }}>
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28,
            background: "rgba(255,255,255,0.06)",
            borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#b3b4b5",
            flexShrink: 0,
          }}>
            {icon}
          </div>
          <span style={{ fontSize: 12, color: "#b3b4b5", fontWeight: 500 }}>{label}</span>
        </div>
        <span style={{ fontSize: 14, color: "#71717a", cursor: "default", lineHeight: 1 }}>⋮</span>
      </div>
      {/* Bottom row */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "1.5rem", fontWeight: 700, color: "#f5f5f5", lineHeight: 1 }}>
          {value}
        </span>
        <span style={{ fontSize: 12, color: deltaColor, display: "flex", alignItems: "center", gap: 2 }}>
          {deltaArrow} {delta}
        </span>
      </div>
    </div>
  );
}

// ── Tab Pills ──────────────────────────────────────────────────────────────────
function TabPills({ tabs, active, onChange }: {
  tabs: string[];
  active: string;
  onChange: (t: string) => void;
}) {
  return (
    <div style={{ background: "#1c1c1c", borderRadius: 8, padding: 4, display: "inline-flex", gap: 2 }}>
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          style={{
            padding: "5px 12px",
            fontSize: 12,
            border: "none",
            cursor: "pointer",
            transition: "all 0.15s",
            borderRadius: 6,
            fontFamily: "var(--font-dm-sans)",
            ...(active === tab
              ? { background: "#151515", border: "0.8px solid #1a1a1a", color: "#f5f5f5", fontWeight: 500 }
              : { background: "transparent", color: "#b3b4b5", fontWeight: 400 }),
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

// ── Card wrapper ───────────────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: "#151515",
  border: "0.8px solid #1a1a1a",
  borderRadius: 16,
  padding: 16,
};

// ── Main ───────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [emails, setEmails] = useState<MonitoredEmail[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanning2, setScanning2] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [username, setUsername] = useState<string>("Usuario");
  const [alertTab, setAlertTab] = useState("Activas");
  const [insightTab, setInsightTab] = useState("Performance");

  const load = async () => {
    try {
      const [sumRes, emlRes, domRes, alRes] = await Promise.all([
        dashboardApi.summary(),
        emailsApi.list(),
        domainsApi.list(),
        alertsApi.list({ unread_only: false }),
      ]);
      setSummary(sumRes.data);
      setEmails(emlRes.data ?? []);
      setDomains(domRes.data ?? []);
      setAlerts(alRes.data ?? []);
    } catch {
      toast.error("Error al cargar el dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Get username from Supabase session
    supabase.auth.getSession().then(({ data }) => {
      const meta = data.session?.user?.user_metadata;
      const name = meta?.full_name || meta?.name || data.session?.user?.email?.split("@")[0] || "Usuario";
      setUsername(name);
    });
  }, []);

  const markRead = async (alertId: string) => {
    try {
      await dashboardApi.markAlertRead(alertId);
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read_at: new Date().toISOString() } : a));
      setSummary(prev => prev ? {
        ...prev,
        recent_alerts: prev.recent_alerts.map(a => a.id === alertId ? { ...a, read_at: new Date().toISOString() } : a),
        active_alerts: Math.max(0, prev.active_alerts - 1),
      } : prev);
    } catch { /* silent */ }
  };

  const handleScanAll = async () => {
    if (scanning2) return;
    setScanning2(true);
    try {
      const doms = domains.length > 0 ? domains : (await domainsApi.list()).data ?? [];
      if (doms.length === 0) { toast("Sin dominios que escanear"); setScanning2(false); return; }
      await Promise.allSettled(doms.map((d: Domain) => domainsApi.scan(d.id)));
      await new Promise(resolve => setTimeout(resolve, 12000));
      const [sumRes, emlRes, domRes, alRes] = await Promise.all([
        dashboardApi.summary(),
        emailsApi.list(),
        domainsApi.list(),
        alertsApi.list({ unread_only: false }),
      ]);
      const fresh: DashboardSummary = sumRes.data;
      setSummary(fresh);
      setEmails(emlRes.data ?? []);
      setDomains(domRes.data ?? []);
      setAlerts(alRes.data ?? []);
      setLastScanTime(new Date());
      const score = Math.round(fresh?.average_score ?? 0);
      const issues = fresh?.active_alerts ?? 0;
      if (score >= 90 && issues === 0) toast.success("✅ Tu dominio está correctamente configurado y protegido");
      else if (score >= 70) toast.success(`Scan completado · Score: ${score}${issues > 0 ? ` · ${issues} alerta${issues !== 1 ? "s" : ""}` : ""}`);
      else toast.error(`Score: ${score} · Revisa las alertas activas`);
    } catch { toast.error("Error al escanear"); } finally { setScanning2(false); }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div style={{ padding: "40px 32px", background: "#0b0b0b", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 28, height: 28, border: "2px solid #3ecf8e", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Derived values ──
  const td = Math.max(1, summary?.domains_monitored ?? 1);
  const te = Math.max(1, summary?.emails_monitored ?? 1);
  const sslScore = Math.round(Math.max(0, (1 - (summary?.domains_with_ssl_issues ?? 0) / td) * 100));
  const uptimeScore = Math.round(Math.max(0, (1 - (summary?.domains_down ?? 0) / td) * 100));
  const breachScore = Math.round(Math.max(0, (1 - (summary?.breached_emails ?? 0) / te) * 100));
  const avg = Math.round(summary?.average_score ?? 0);
  const emailSecScore = Math.min(100, Math.max(0, Math.round(
    (avg - breachScore * 0.30 - sslScore * 0.25 - uptimeScore * 0.25) / 0.20
  )));
  const darkwebScore = breachScore;
  const hasAlerts = (summary?.active_alerts ?? 0) > 0;

  const activeAlerts = alerts.filter(a => !a.read_at);
  const resolvedAlerts = alerts.filter(a => !!a.read_at);

  const totalScans = domains.reduce((acc, _) => acc + 1, 0) * 30 + (summary?.domains_monitored ?? 0) * 4;

  return (
    <div style={{ background: "#0b0b0b", minHeight: "100vh", padding: "0 32px 60px" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>

      {/* ── Page Header ── */}
      <div style={{ padding: "8px 0 24px 0" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f5f5f5", margin: 0 }}>Overview</h1>
        <p style={{ fontSize: "0.875rem", color: "#b3b4b5", marginTop: 4, margin: "4px 0 0" }}>Monitoriza la seguridad de tu organización</p>
      </div>

      {/* ── 12-column Grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 16, alignItems: "start" }}>

        {/* ════════════════════════════════════════════
            LEFT CONTENT — col-span 8
        ════════════════════════════════════════════ */}
        <div style={{ gridColumn: "span 8", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* ── Welcome Banner ── */}
          <div style={{
            ...cardStyle,
            padding: 32,
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "stretch",
            minHeight: 200,
          }}>
            {/* Left side */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f5f5f5", margin: 0 }}>
                  {greetingByHour()}, {username} 👋
                </h2>
                <p style={{ fontSize: 13, color: "#b3b4b5", marginTop: 8, margin: "8px 0 0" }}>
                  Listo para proteger tu organización 🛡️
                </p>
              </div>
              <div style={{ marginTop: 20 }}>
                <LiveClock />
                <div style={{ fontSize: 13, color: "#71717a", marginTop: 8 }}>
                  {lastScanTime
                    ? `Último escaneo: ${relTime(lastScanTime.toISOString())}`
                    : `Último escaneo: hace ${summary?.domains_monitored ? "5m" : "—"}`}
                </div>
              </div>
            </div>

            {/* Right side */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "space-between", textAlign: "right", paddingLeft: 32 }}>
              <div>
                <ShieldIcon size={48} color={hasAlerts ? "#f59e0b" : "#3ecf8e"} />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "#f5f5f5", marginBottom: 4 }}>
                  {hasAlerts ? "Atención Requerida" : "Sistema Seguro"}
                </div>
                <div style={{ fontSize: 13, color: "#b3b4b5", marginBottom: 8 }}>
                  {formatDateFull(new Date())}
                </div>
                <div style={{ fontFamily: "var(--font-dm-mono)", fontSize: 14, color: "#3ecf8e", fontWeight: 600 }}>
                  Score: {avg}
                </div>
              </div>
              {/* Scan button */}
              <button
                onClick={handleScanAll}
                disabled={scanning2}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", borderRadius: 8,
                  background: "#3ecf8e", color: "#000",
                  fontWeight: 700, fontSize: "0.8rem",
                  border: "none", cursor: scanning2 ? "not-allowed" : "pointer",
                  opacity: scanning2 ? 0.7 : 1, transition: "opacity 0.2s",
                  marginTop: 12,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ animation: scanning2 ? "spin 0.8s linear infinite" : "none" }}>
                  <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.84" />
                </svg>
                {scanning2 ? "Escaneando..." : "Escanear Todo"}
              </button>
            </div>
          </div>

          {/* ── KPI Cards (4 in a row) ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            <KpiCard
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              }
              label="Security Score"
              value={String(avg)}
              delta="+2"
              deltaType="positive"
            />
            <KpiCard
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              }
              label="Uptime"
              value={`${uptimeScore}%`}
              delta="+0%"
              deltaType="neutral"
            />
            <KpiCard
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                  <path d="M16 13l2 2 4-4" />
                </svg>
              }
              label="Email Security"
              value={`${emailSecScore}%`}
              delta="+0%"
              deltaType="neutral"
            />
            <KpiCard
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              }
              label="Brechas"
              value={String(summary?.breached_emails ?? 0)}
              delta="→0"
              deltaType="neutral"
            />
          </div>

          {/* ── Alertas Recientes ── */}
          <div style={cardStyle}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f5" }}>Alertas Recientes</div>
                <div style={{ fontSize: 12, color: "#b3b4b5", marginTop: 2 }}>Últimas incidencias de seguridad</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <TabPills
                  tabs={[`Activas (${activeAlerts.length})`, `Resueltas (${resolvedAlerts.length})`]}
                  active={alertTab === "Activas" ? `Activas (${activeAlerts.length})` : `Resueltas (${resolvedAlerts.length})`}
                  onChange={(t) => setAlertTab(t.startsWith("Activas") ? "Activas" : "Resueltas")}
                />
                <Link href="/dashboard/alerts" style={{ fontSize: 11, color: "#3ecf8e", textDecoration: "none", fontWeight: 500 }}>
                  Ver todas →
                </Link>
              </div>
            </div>

            {/* Alert list */}
            {(() => {
              const list = alertTab === "Activas" ? activeAlerts : resolvedAlerts;
              if (list.length === 0) {
                return (
                  <div style={{ textAlign: "center", padding: "24px 0", color: "#71717a", fontSize: 13 }}>
                    {alertTab === "Activas" ? "No hay alertas activas" : "No hay alertas resueltas"}
                  </div>
                );
              }
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {list.slice(0, 5).map(alert => (
                    <div key={alert.id} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px",
                      background: "rgba(255,255,255,0.02)",
                      border: "0.8px solid #1a1a1a",
                      borderRadius: 10,
                    }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: sevColor(alert.severity), flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: alert.read_at ? "#71717a" : "#f5f5f5", fontWeight: alert.read_at ? 400 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {alert.title}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: "#71717a", flexShrink: 0 }}>{relTime(alert.sent_at)}</span>
                      {!alert.read_at && (
                        <button
                          onClick={() => markRead(alert.id)}
                          style={{ fontSize: 11, color: "#3ecf8e", background: "rgba(62,207,142,0.08)", border: "0.8px solid rgba(62,207,142,0.2)", cursor: "pointer", padding: "3px 8px", borderRadius: 6 }}
                        >
                          Marcar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* ── Dominios Monitorizados ── */}
          <div style={cardStyle}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f5" }}>Dominios Monitorizados</div>
                <div style={{ fontSize: 12, color: "#b3b4b5", marginTop: 2 }}>Resumen del estado</div>
              </div>
              <Link href="/dashboard/domains" style={{ fontSize: 11, color: "#3ecf8e", textDecoration: "none", fontWeight: 500 }}>
                Gestionar →
              </Link>
            </div>

            {domains.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "#71717a", fontSize: 13 }}>
                No hay dominios configurados
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {domains.map(d => {
                  const st = domainStatus(d);
                  return (
                    <div key={d.id} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 12px",
                      background: "rgba(255,255,255,0.02)",
                      border: "0.8px solid #1a1a1a",
                      borderRadius: 10,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: "#f5f5f5", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {d.domain}
                        </div>
                        <div style={{ fontSize: 11, color: "#71717a", marginTop: 2 }}>
                          {d.last_scan_at ? relTime(d.last_scan_at) : "Sin escanear"}
                        </div>
                      </div>
                      {/* Status chip */}
                      <span style={{ fontSize: 11, fontWeight: 500, color: st.color, background: st.bg, padding: "3px 8px", borderRadius: 99, flexShrink: 0 }}>
                        {st.label}
                      </span>
                      {/* Score */}
                      <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: 13, fontWeight: 600, color: "#3ecf8e", flexShrink: 0, minWidth: 28, textAlign: "right" }}>
                        {d.overall_score != null ? Math.round(d.overall_score) : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* ════════════════════════════════════════════
            RIGHT PANEL — col-span 4
        ════════════════════════════════════════════ */}
        <div style={{ gridColumn: "span 4", display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 68 }}>

          {/* ── Security Insights ── */}
          <div style={cardStyle}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f5" }}>Insights</div>
                <div style={{ fontSize: 12, color: "#b3b4b5", marginTop: 2 }}>Análisis de seguridad</div>
              </div>
              <TabPills
                tabs={["Performance", "Trends"]}
                active={insightTab}
                onChange={setInsightTab}
              />
            </div>

            {/* Donut chart */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <MultiRingDonut
                ssl={sslScore}
                email={emailSecScore}
                uptime={uptimeScore}
                darkweb={darkwebScore}
                score={avg}
              />
            </div>

            {/* Metric rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* SSL */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(62,207,142,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "#b3b4b5" }}>SSL</div>
                  <div style={{ fontSize: 11, color: "#71717a" }}>Overall SSL health</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#3ecf8e", fontFamily: "var(--font-dm-mono)" }}>{sslScore}%</span>
              </div>
              {/* Email Security */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(59,130,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "#b3b4b5" }}>Email Security</div>
                  <div style={{ fontSize: 11, color: "#71717a" }}>SPF/DKIM/DMARC</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#3b82f6", fontFamily: "var(--font-dm-mono)" }}>{emailSecScore}%</span>
              </div>
              {/* Uptime */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(245,158,11,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "#b3b4b5" }}>Uptime</div>
                  <div style={{ fontSize: 11, color: "#71717a" }}>Disponibilidad 30d</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#f59e0b", fontFamily: "var(--font-dm-mono)" }}>{uptimeScore}%</span>
              </div>
              {/* Dark Web */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "#b3b4b5" }}>Dark Web</div>
                  <div style={{ fontSize: 11, color: "#71717a" }}>Brechas detectadas</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#ef4444", fontFamily: "var(--font-dm-mono)" }}>
                  {summary?.breached_emails ?? 0} brechas
                </span>
              </div>
            </div>
          </div>

          {/* ── Actividad de Escaneo ── */}
          <div style={cardStyle}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f5" }}>Actividad de Escaneo</div>
                <div style={{ fontSize: 12, color: "#b3b4b5", marginTop: 2 }}>Historial de escaneos recientes</div>
              </div>
              {/* Time range pill */}
              <div style={{ background: "#1c1c1c", border: "0.8px solid #1a1a1a", borderRadius: 6, padding: "5px 10px", fontSize: 11, color: "#b3b4b5", display: "flex", alignItems: "center", gap: 4 }}>
                Este Mes
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
              </div>
            </div>

            {/* Area chart */}
            <div style={{ borderRadius: 8, overflow: "hidden", marginBottom: 12, background: "rgba(255,255,255,0.01)" }}>
              <ScanActivityChart totalScans={totalScans} />
            </div>

            {/* Stats row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: 13, fontWeight: 700, color: "#f5f5f5" }}>
                  {totalScans}
                </span>
                <span style={{ fontSize: 11, color: "#71717a", marginLeft: 4 }}>escaneos</span>
              </div>
              <div>
                <span style={{ fontSize: 11, color: "#3ecf8e", fontWeight: 500 }}>+{summary?.domains_monitored ?? 0}%</span>
              </div>
              <div>
                <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: 11, color: "#b3b4b5" }}>
                  {summary?.domains_monitored ?? 0}/{summary?.domains_monitored ?? 0} Dominios
                </span>
              </div>
            </div>
          </div>

          {/* ── AI Assistant quick link ── */}
          <Link href="/dashboard/assistant" style={{
            ...cardStyle,
            display: "flex", alignItems: "center", gap: 12,
            textDecoration: "none", transition: "border-color 0.15s",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(62,207,142,0.25)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#1a1a1a"; }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(62,207,142,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#f5f5f5" }}>AI Assistant</div>
              <div style={{ fontSize: 11, color: "#71717a", marginTop: 2 }}>Analiza tus alertas con IA</div>
            </div>
            <span style={{ color: "#71717a", fontSize: 14 }}>→</span>
          </Link>

        </div>
      </div>

      {/* ── Footer ── */}
      <footer style={{
        background: "#151515",
        borderRadius: 16,
        padding: "12px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 16,
        border: "0.8px solid #1a1a1a",
      }}>
        <span style={{ fontSize: 12, color: "#71717a" }}>© 2026 • v1.0.0</span>
        <span style={{ fontSize: 12, color: "#71717a" }}>
          by <span style={{ color: "#b3b4b5", fontWeight: 500 }}>ChronoShield</span>
        </span>
      </footer>
    </div>
  );
}
