"use client";

import { useEffect, useState, useRef } from "react";
import { dashboardApi, emailsApi, domainsApi, alertsApi, settingsApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { toast } from "@/components/Toast";
import { useCredits } from "@/contexts/CreditsContext";
import { useTranslation } from "@/contexts/LanguageContext";

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
  // Individual score components from backend
  avg_ssl_score: number;
  avg_uptime_score: number;
  avg_email_sec_score: number;
  avg_breach_score: number;
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
  last_scanned_at: string | null;
  security_score?: number | null;
  ssl_status?: string | null;
  uptime_status?: string | null;
  spf_status?: string | null;
  dkim_status?: string | null;
  dmarc_status?: string | null;
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

function greetingByHour(t: (k: string) => string) {
  const h = new Date().getHours();
  if (h < 12) return t("overview.greeting.morning");
  if (h < 20) return t("overview.greeting.afternoon");
  return t("overview.greeting.evening");
}

function relTime(iso: string, t: (k: string) => string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t("time.now");
  if (m < 60) return t("time.minutesAgo").replace("{n}", String(m));
  const h = Math.floor(m / 60);
  if (h < 24) return t("time.hoursAgo").replace("{n}", String(h));
  return t("time.daysAgo").replace("{n}", String(Math.floor(h / 24)));
}

function sevColor(sev: string): string {
  if (sev === "critical" || sev === "high") return "#ef4444";
  if (sev === "medium") return "#f59e0b";
  return "#3b82f6";
}

function domainStatus(d: Domain, t: (k: string) => string): { label: string; color: string; bg: string } {
  const score = d.security_score ?? 0;
  if (!d.is_active) return { label: t("overview.domainStatus.inactive"), color: "#71717a", bg: "rgba(113,113,122,0.12)" };
  if (score >= 80) return { label: t("overview.domainStatus.secure"), color: "#3ecf8e", bg: "rgba(62,207,142,0.12)" };
  if (score >= 60) return { label: t("overview.domainStatus.warning"), color: "#f59e0b", bg: "rgba(245,158,11,0.12)" };
  if (score === 0 && d.last_scanned_at == null) return { label: t("overview.domainStatus.unscanned"), color: "#71717a", bg: "rgba(113,113,122,0.12)" };
  return { label: t("overview.domainStatus.error"), color: "#ef4444", bg: "rgba(239,68,68,0.12)" };
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

// ── Score Ring (animated — replaces MultiRingDonut) ───────────────────────────
function ScoreRing({ score, ssl, email, uptime, darkweb }: {
  score: number; ssl: number; email: number; uptime: number; darkweb: number;
}) {
  const grade = scoreGrade(score);
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayScore, setDisplayScore] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Count-up animation on mount
  useEffect(() => {
    setMounted(true);
    if (score === 0) { setDisplayScore(0); return; }
    const target = score;
    const dur = 1500;
    const t0 = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const prog = Math.min((now - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - prog, 3);
      setDisplayScore(Math.round(eased * target));
      if (prog < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  // 3D parallax on mousemove
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const dy = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    containerRef.current.style.transition = "transform 0.1s ease";
    containerRef.current.style.transform = `perspective(400px) rotateX(${-dy * 8}deg) rotateY(${dx * 8}deg)`;
  };
  const onMouseLeave = () => {
    if (!containerRef.current) return;
    containerRef.current.style.transition = "transform 0.6s ease";
    containerRef.current.style.transform = "perspective(400px) rotateX(0deg) rotateY(0deg)";
  };

  const R = 68;
  const circ = 2 * Math.PI * R;
  const offset = mounted ? circ * (1 - Math.min(100, Math.max(0, score)) / 100) : circ;

  const barGrad = (v: number) => v >= 80
    ? "linear-gradient(90deg,#4ade80,#3ecf8e)"
    : v >= 60 ? "linear-gradient(90deg,#f59e0b,#f97316)"
    : "linear-gradient(90deg,#ef4444,#ff3b6b)";
  const valCol = (v: number) => v >= 80 ? "#4ade80" : v >= 60 ? "#f59e0b" : "#ef4444";

  const rows = [
    { key: "ssl",     label: "SSL Certificate", desc: "Estado del certificado", val: ssl,     iBg: "rgba(62,207,142,0.1)",  iCol: "#3ecf8e", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> },
    { key: "email",   label: "Email Security",  desc: "SPF · DKIM · DMARC",    val: email,   iBg: "rgba(59,130,246,0.1)",  iCol: "#3b82f6", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> },
    { key: "uptime",  label: "Uptime",          desc: "Disponibilidad 30d",    val: uptime,  iBg: "rgba(167,139,250,0.1)", iCol: "#a78bfa", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
    { key: "darkweb", label: "Dark Web",         desc: "Brechas detectadas",    val: darkweb, iBg: "rgba(239,68,68,0.1)",   iCol: "#ef4444", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> },
  ];

  return (
    <>
      {/* Animated ring — centered */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
        <div ref={containerRef} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}
          style={{ position: "relative", width: 160, height: 160, cursor: "default" }}>
          {/* Radial bg + inset depth shadow */}
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle at 30% 30%,#16161f,#0a0a0f)", boxShadow: "inset 0 2px 20px rgba(0,0,0,.6),0 0 40px rgba(62,207,142,.05)" }} />
          {/* Pulsing glow layer */}
          <div className="cs-score-glow" style={{ position: "absolute", inset: 8, borderRadius: "50%", background: "radial-gradient(circle,rgba(62,207,142,.07) 0%,transparent 70%)" }} />
          {/* SVG ring with gradient + dashoffset animation */}
          <svg width="160" height="160" viewBox="0 0 160 160" style={{ position: "relative", transform: "rotate(-90deg)", display: "block" }}>
            <defs>
              <linearGradient id="csScoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3ecf8e" />
                <stop offset="50%" stopColor="#00c4a3" />
                <stop offset="100%" stopColor="#4ade80" />
              </linearGradient>
            </defs>
            <circle cx="80" cy="80" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" strokeLinecap="round" />
            <circle cx="80" cy="80" r={R} fill="none" stroke="url(#csScoreGrad)" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circ} strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 2s cubic-bezier(.4,0,.2,1)", filter: "drop-shadow(0 0 6px rgba(62,207,142,.45))" }} />
          </svg>
          {/* Inner circle: gradient number + label + grade badge */}
          <div style={{ position: "absolute", inset: 22, borderRadius: "50%", background: "#0a0a0f", border: "1px solid rgba(255,255,255,.06)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
            <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "1.9rem", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1,
              background: "linear-gradient(135deg,#f5f5f5,#3ecf8e)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              {displayScore}
            </span>
            <span style={{ fontSize: "0.55rem", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 3 }}>Score</span>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", background: "rgba(62,207,142,.1)", color: "#3ecf8e", fontSize: "0.72rem", fontWeight: 800, marginTop: 5, border: "1px solid rgba(62,207,142,.18)" }}>
              {grade}
            </span>
          </div>
          {/* Orbiting particles */}
          <div className="cs-orbit-p1" />
          <div className="cs-orbit-p2" />
          <div className="cs-orbit-p3" />
        </div>
      </div>

      {/* Breakdown rows with gradient bars + animated fill */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {rows.map(({ key, label, desc, val, iBg, iCol, icon }) => (
          <div key={key} className="cs-score-row"
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: iBg, color: iCol, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "#b3b4b5" }}>{label}</div>
              <div style={{ fontSize: 11, color: "#71717a" }}>{desc}</div>
            </div>
            <div style={{ width: 76, flexShrink: 0 }}>
              <div style={{ height: 3, background: "rgba(255,255,255,.06)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: mounted ? `${val}%` : "0%", borderRadius: 3, background: barGrad(val), transition: "width 1.5s cubic-bezier(.4,0,.2,1) .5s" }} />
              </div>
            </div>
            <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.7rem", fontWeight: 600, color: valCol(val), width: 28, textAlign: "right", flexShrink: 0 }}>{val}%</span>
          </div>
        ))}
      </div>
    </>
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
    <div className="cs-kpi-card" style={{
      background: "#151515",
      border: "0.8px solid #1a1a1a",
      borderRadius: 16,
      padding: 16,
      height: 110,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      transition: "transform 0.2s ease, box-shadow 0.2s ease",
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

// ── Single-domain Score Ring (used in Trends tab) ─────────────────────────────
function DomainScoreRing({ score, label }: { score: number; label: string }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.max(0, Math.min(100, score)) / 100;
  const gap = circ - dash;
  const color = score >= 80 ? "#3ecf8e" : score >= 60 ? "#f59e0b" : "#ef4444";
  // Trim label: show last two dot-separated parts (e.g. "chronoshield.eu")
  const parts = label.split(".");
  const shortLabel = parts.length > 2 ? parts.slice(-2).join(".") : label;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 70 }}>
      <div style={{ position: "relative", width: 68, height: 68 }}>
        <svg width="68" height="68" viewBox="0 0 68 68" style={{ transform: "rotate(-90deg)", display: "block" }}>
          <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
          <circle
            cx="34" cy="34" r={r}
            fill="none"
            stroke={color}
            strokeWidth="7"
            strokeLinecap="butt"
            strokeDasharray={`${dash} ${gap}`}
            style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.16,1,0.3,1)" }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.9rem", fontWeight: 700, color: "#f5f5f5", lineHeight: 1 }}>
            {score > 0 ? score : "—"}
          </span>
        </div>
      </div>
      <span style={{ fontSize: 10, color: "#b3b4b5", textAlign: "center", maxWidth: 72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {shortLabel}
      </span>
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
  const { refreshCredits } = useCredits();
  const { t } = useTranslation();
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
      setEmails(Array.isArray(emlRes.data) ? emlRes.data : (emlRes.data?.data ?? []));
      setDomains(Array.isArray(domRes.data) ? domRes.data : (domRes.data?.data ?? []));
      setAlerts(Array.isArray(alRes.data) ? alRes.data : (alRes.data?.alerts ?? alRes.data?.data ?? []));
    } catch {
      toast.error(t("overview.scanError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Get username: prefer profile full_name, fall back to auth metadata, then email prefix
    supabase.auth.getSession().then(async ({ data }) => {
      const meta = data.session?.user?.user_metadata;
      const emailPrefix = data.session?.user?.email?.split("@")[0] || "Usuario";
      try {
        const profileRes = await settingsApi.getProfile();
        const profileName = profileRes.data?.full_name || profileRes.data?.name;
        setUsername(profileName || meta?.full_name || emailPrefix);
      } catch {
        setUsername(meta?.full_name || emailPrefix);
      }
    });
  }, []);

  const markRead = async (alertId: string) => {
    try {
      await dashboardApi.markAlertRead(alertId);
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read_at: new Date().toISOString() } : a));
      setSummary(prev => prev ? {
        ...prev,
        recent_alerts: (prev.recent_alerts ?? []).map(a => a.id === alertId ? { ...a, read_at: new Date().toISOString() } : a),
        active_alerts: Math.max(0, prev.active_alerts - 1),
      } : prev);
    } catch { /* silent */ }
  };

  const handleScanAll = async () => {
    if (scanning2) return;
    setScanning2(true);
    try {
      const doms = domains.length > 0 ? domains : (await domainsApi.list()).data ?? [];
      if (doms.length === 0) { toast.info(t("overview.noDomainsToScan")); setScanning2(false); return; }
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
      setEmails(Array.isArray(emlRes.data) ? emlRes.data : (emlRes.data?.data ?? []));
      setDomains(Array.isArray(domRes.data) ? domRes.data : (domRes.data?.data ?? []));
      setAlerts(Array.isArray(alRes.data) ? alRes.data : (alRes.data?.alerts ?? alRes.data?.data ?? []));
      setLastScanTime(new Date());
      refreshCredits();
      const score = Math.round(fresh?.average_score ?? 0);
      const issues = fresh?.active_alerts ?? 0;
      if (score >= 90 && issues === 0) toast.success("✅ " + t("overview.scanCompleted"));
      else if (score >= 70) toast.success(`${t("overview.scanCompleted")} · Score: ${score}${issues > 0 ? ` · ${issues}` : ""}`);
      else toast.error(`Score: ${score} · ${t("overview.scanError")}`);
    } catch { toast.error(t("overview.scanError")); } finally { setScanning2(false); }
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

  // ── Derived values — use backend-computed individual scores when available ──
  const avg         = Math.round(summary?.average_score       ?? 0);
  // Prefer direct score components from API (accurate); fall back to proxy computations
  const sslScore    = summary?.avg_ssl_score       ?? Math.round(Math.max(0, (1 - (summary?.domains_with_ssl_issues ?? 0) / Math.max(1, summary?.domains_monitored ?? 1)) * 100));
  const uptimeScore = summary?.avg_uptime_score    ?? Math.round(Math.max(0, (1 - (summary?.domains_down ?? 0) / Math.max(1, summary?.domains_monitored ?? 1)) * 100));
  const emailSecScore = summary?.avg_email_sec_score ?? 0;
  const darkwebScore  = summary?.avg_breach_score    ?? Math.round(Math.max(0, (1 - (summary?.breached_emails ?? 0) / Math.max(1, summary?.emails_monitored ?? 1)) * 100));
  const hasAlerts = (summary?.active_alerts ?? 0) > 0;

  const activeAlerts = alerts.filter(a => !a.read_at);
  const resolvedAlerts = alerts.filter(a => !!a.read_at);

  const totalScans = domains.reduce((acc, _) => acc + 1, 0) * 30 + (summary?.domains_monitored ?? 0) * 4;

  return (
    <div style={{ background: "#0b0b0b", minHeight: "100vh", padding: "0 32px 60px" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes csScoreGlow { 0%,100%{opacity:.5;transform:scale(.95)} 50%{opacity:1;transform:scale(1.02)} }
        @keyframes csOrbit { 0%{transform:rotate(0deg) translateX(76px) rotate(0deg);opacity:.8} 50%{opacity:.3} 100%{transform:rotate(360deg) translateX(76px) rotate(-360deg);opacity:.8} }
        @keyframes csAmbFloat { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(30px,-20px) scale(1.1)} 66%{transform:translate(-20px,30px) scale(.9)} }
        @keyframes csFadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .cs-score-glow { animation: csScoreGlow 3s ease-in-out infinite; }
        .cs-orbit-p1,.cs-orbit-p2,.cs-orbit-p3 { position:absolute;width:4px;height:4px;border-radius:50%;background:#3ecf8e;box-shadow:0 0 6px #3ecf8e;z-index:3;top:50%;left:50%;margin:-2px 0 0 -2px; }
        .cs-orbit-p1 { animation:csOrbit 8s linear infinite; }
        .cs-orbit-p2 { animation:csOrbit 8s linear infinite 2.67s; }
        .cs-orbit-p3 { animation:csOrbit 8s linear infinite 5.33s; }
        .cs-score-row { transition:padding-left .2s ease; }
        .cs-score-row:hover { padding-left:6px !important; }
        .cs-kpi-card:hover { transform:translateY(-2px) !important; box-shadow:0 8px 24px rgba(0,0,0,.3) !important; }
        .cs-domain-item:hover { background:rgba(255,255,255,.04) !important; }
        .cs-amb { position:fixed;pointer-events:none;z-index:0;border-radius:50%; }
        .cs-amb-1 { width:600px;height:600px;top:-200px;left:-100px;background:radial-gradient(circle,rgba(62,207,142,.04) 0%,transparent 70%);filter:blur(80px);animation:csAmbFloat 20s ease-in-out infinite; }
        .cs-amb-2 { width:400px;height:400px;bottom:-100px;right:-50px;background:radial-gradient(circle,rgba(96,165,250,.03) 0%,transparent 70%);filter:blur(60px);animation:csAmbFloat 25s ease-in-out infinite reverse; }
        .cs-amb-3 { width:300px;height:300px;top:40%;left:50%;background:radial-gradient(circle,rgba(167,139,250,.025) 0%,transparent 70%);filter:blur(50px);animation:csAmbFloat 30s ease-in-out infinite 5s; }
        .cs-noise { position:fixed;inset:0;opacity:.4;pointer-events:none;z-index:9998;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='csn'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23csn)' opacity='.04'/%3E%3C/svg%3E"); }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,.08);border-radius:3px; }
        ::-webkit-scrollbar-thumb:hover { background:rgba(255,255,255,.15); }
        .cs-fadeup-1 { animation:csFadeUp .5s cubic-bezier(.4,0,.2,1) both .05s; }
        .cs-fadeup-2 { animation:csFadeUp .5s cubic-bezier(.4,0,.2,1) both .12s; }
        .cs-fadeup-3 { animation:csFadeUp .5s cubic-bezier(.4,0,.2,1) both .19s; }
        .cs-fadeup-4 { animation:csFadeUp .5s cubic-bezier(.4,0,.2,1) both .26s; }
        .cs-fadeup-5 { animation:csFadeUp .5s cubic-bezier(.4,0,.2,1) both .33s; }
        .cs-fadeup-6 { animation:csFadeUp .5s cubic-bezier(.4,0,.2,1) both .40s; }
      `}</style>

      {/* Ambient orbs */}
      <div className="cs-amb cs-amb-1" />
      <div className="cs-amb cs-amb-2" />
      <div className="cs-amb cs-amb-3" />
      {/* Noise overlay */}
      <div className="cs-noise" />

      {/* ── Page Header ── */}
      <div style={{ padding: "8px 0 24px 0" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f5f5f5", margin: 0 }}>{t("overview.title")}</h1>
        <p style={{ fontSize: "0.875rem", color: "#b3b4b5", marginTop: 4, margin: "4px 0 0" }}>{t("overview.subtitle")}</p>
      </div>

      {/* ── 12-column Grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 16, alignItems: "start" }}>

        {/* ════════════════════════════════════════════
            LEFT CONTENT — col-span 8
        ════════════════════════════════════════════ */}
        <div style={{ gridColumn: "span 8", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* ── Welcome Banner ── */}
          <div className="cs-fadeup-1" style={{
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
                  {greetingByHour(t)}, {username} 👋
                </h2>
                <p style={{ fontSize: 13, color: "#b3b4b5", marginTop: 8, margin: "8px 0 0" }}>
                  {t("overview.readyProtect")}
                </p>
              </div>
              <div style={{ marginTop: 20 }}>
                <LiveClock />
                <div style={{ fontSize: 13, color: "#71717a", marginTop: 8 }}>
                  {lastScanTime
                    ? `${t("overview.lastScan")} ${relTime(lastScanTime.toISOString(), t)}`
                    : `${t("overview.lastScan")} ${summary?.domains_monitored ? t("time.minutesAgo").replace("{n}", "5") : "—"}`}
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
                  {hasAlerts ? t("overview.attentionRequired") : t("overview.systemOk")}
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
                {scanning2 ? t("common.scanningAll") : t("common.scanAll")}
              </button>
            </div>
          </div>

          {/* ── KPI Cards (4 in a row) ── */}
          <div className="cs-fadeup-2" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            <KpiCard
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              }
              label={t("overview.kpi.securityScore")}
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
              label={t("overview.kpi.uptime")}
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
              label={t("overview.kpi.emailSecurity")}
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
              label={t("overview.kpi.breaches")}
              value={String(summary?.breached_emails ?? 0)}
              delta="→0"
              deltaType="neutral"
            />
          </div>

          {/* ── Alertas Recientes ── */}
          <div className="cs-fadeup-3" style={cardStyle}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f5" }}>{t("overview.recentAlerts")}</div>
                <div style={{ fontSize: 12, color: "#b3b4b5", marginTop: 2 }}>{t("overview.latestIncidents")}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <TabPills
                  tabs={[`${t("overview.activeTab")} (${activeAlerts.length})`, `${t("overview.resolvedTab")} (${resolvedAlerts.length})`]}
                  active={alertTab === "Activas" ? `${t("overview.activeTab")} (${activeAlerts.length})` : `${t("overview.resolvedTab")} (${resolvedAlerts.length})`}
                  onChange={(tab) => setAlertTab(tab.includes(t("overview.activeTab")) ? "Activas" : "Resueltas")}
                />
                <Link href="/dashboard/alerts" style={{ fontSize: 11, color: "#3ecf8e", textDecoration: "none", fontWeight: 500 }}>
                  {t("common.viewAll")}
                </Link>
              </div>
            </div>

            {/* Alert list */}
            {(() => {
              const list = alertTab === "Activas" ? activeAlerts : resolvedAlerts;
              if (list.length === 0) {
                return (
                  <div style={{ textAlign: "center", padding: "24px 0", color: "#71717a", fontSize: 13 }}>
                    {alertTab === "Activas" ? t("overview.noActiveAlerts") : t("overview.noResolvedAlerts")}
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
                      <span style={{ fontSize: 11, color: "#71717a", flexShrink: 0 }}>{relTime(alert.sent_at, t)}</span>
                      {!alert.read_at && (
                        <button
                          onClick={() => markRead(alert.id)}
                          style={{ fontSize: 11, color: "#3ecf8e", background: "rgba(62,207,142,0.08)", border: "0.8px solid rgba(62,207,142,0.2)", cursor: "pointer", padding: "3px 8px", borderRadius: 6 }}
                        >
                          {t("overview.markAlert")}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* ── Dominios Monitorizados ── */}
          <div className="cs-fadeup-4" style={cardStyle}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f5" }}>{t("overview.domains")}</div>
                <div style={{ fontSize: 12, color: "#b3b4b5", marginTop: 2 }}>{t("overview.domainsSubtitle")}</div>
              </div>
              <Link href="/dashboard/domains" style={{ fontSize: 11, color: "#3ecf8e", textDecoration: "none", fontWeight: 500 }}>
                {t("overview.manageDomains")}
              </Link>
            </div>

            {domains.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "#71717a", fontSize: 13 }}>
                {t("overview.noDomains")}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {domains.map(d => {
                  const st = domainStatus(d, t);
                  return (
                    <div key={d.id} className="cs-domain-item" style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 12px",
                      background: "rgba(255,255,255,0.02)",
                      border: "0.8px solid #1a1a1a",
                      borderRadius: 10,
                      transition: "background 0.15s ease",
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: "#f5f5f5", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {d.domain}
                        </div>
                        <div style={{ fontSize: 11, color: "#71717a", marginTop: 2 }}>
                          {d.last_scanned_at ? `${t("overview.lastScan")} ${relTime(d.last_scanned_at, t)}` : t("overview.lastScanNever")}
                        </div>
                      </div>
                      {/* Status chip */}
                      <span style={{ fontSize: 11, fontWeight: 500, color: st.color, background: st.bg, padding: "3px 8px", borderRadius: 99, flexShrink: 0 }}>
                        {st.label}
                      </span>
                      {/* Score */}
                      <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: 13, fontWeight: 600, color: "#3ecf8e", flexShrink: 0, minWidth: 28, textAlign: "right" }}>
                        {d.security_score != null ? Math.round(d.security_score) : "—"}
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
          <div className="cs-fadeup-5" style={cardStyle}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f5" }}>{t("overview.insights")}</div>
                <div style={{ fontSize: 12, color: "#b3b4b5", marginTop: 2 }}>{t("overview.securityAnalysis")}</div>
              </div>
              <TabPills
                tabs={[t("overview.performance"), t("overview.trends")]}
                active={insightTab === "Performance" ? t("overview.performance") : t("overview.trends")}
                onChange={(tab) => setInsightTab(tab === t("overview.performance") ? "Performance" : "Trends")}
              />
            </div>

            {/* ── Performance tab: animated score ring + breakdown ── */}
            {(insightTab === "Performance" || insightTab === t("overview.performance")) && (
              <ScoreRing score={avg} ssl={sslScore} email={emailSecScore} uptime={uptimeScore} darkweb={darkwebScore} />
            )}

            {/* ── Trends tab: one score ring per domain ── */}
            {(insightTab === "Trends" || insightTab === t("overview.trends")) && (
              <>
                {domains.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "#71717a", fontSize: 13 }}>
                    {t("overview.noDomains")}
                  </div>
                ) : (
                  <>
                    <div style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 16,
                      justifyContent: domains.length <= 3 ? "center" : "flex-start",
                      padding: "8px 0 16px",
                    }}>
                      {domains.map(d => (
                        <DomainScoreRing
                          key={d.id}
                          score={d.security_score != null ? Math.round(d.security_score) : 0}
                          label={d.domain}
                        />
                      ))}
                    </div>
                    <div style={{ borderTop: "0.8px solid #1a1a1a", paddingTop: 12 }}>
                      <div style={{ fontSize: 11, color: "#71717a", marginBottom: 6 }}>{t("overview.legend.label")}</div>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        {([["#3ecf8e", t("overview.legend.safe")], ["#f59e0b", t("overview.legend.warning")], ["#ef4444", t("overview.legend.critical")]] as [string,string][]).map(([c, l]) => (
                          <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
                            <span style={{ fontSize: 10, color: "#b3b4b5" }}>{l}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* ── Actividad de Escaneo ── */}
          <div className="cs-fadeup-6" style={cardStyle}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f5" }}>{t("overview.scanActivity")}</div>
                <div style={{ fontSize: 12, color: "#b3b4b5", marginTop: 2 }}>{t("overview.scanHistory")}</div>
              </div>
              {/* Time range pill */}
              <div style={{ background: "#1c1c1c", border: "0.8px solid #1a1a1a", borderRadius: 6, padding: "5px 10px", fontSize: 11, color: "#b3b4b5", display: "flex", alignItems: "center", gap: 4 }}>
                {t("overview.thisMonth")}
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
                <span style={{ fontSize: 11, color: "#71717a", marginLeft: 4 }}>{t("overview.scans")}</span>
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
              <div style={{ fontSize: 13, fontWeight: 600, color: "#f5f5f5" }}>{t("overview.aiAssistantTitle")}</div>
              <div style={{ fontSize: 11, color: "#71717a", marginTop: 2 }}>{t("overview.aiAssistantDesc")}</div>
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
