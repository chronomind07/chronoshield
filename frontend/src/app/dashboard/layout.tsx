"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { alertsApi } from "@/lib/api";
import Link from "next/link";
import { Toaster } from "@/components/Toast";
import { CreditsProvider, useCredits } from "@/contexts/CreditsContext";
import { LanguageProvider, useTranslation } from "@/contexts/LanguageContext";
import { PlanProvider, usePlan } from "@/contexts/PlanContext";
import { LogoFull } from "@/components/logos";

// ── Types ──────────────────────────────────────────────────────────────────────
interface AlertItem {
  id: string;
  severity: string;
  title: string;
  message: string;
  sent_at: string;
  is_unread: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

const SEV_COLOR: Record<string, string> = {
  critical: "#ef4444",
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#3b82f6",
};

// ── SVG Icons ──────────────────────────────────────────────────────────────────
const IcoOverview = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
);
const IcoAssistant = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10a10 10 0 0 1-10-10C2 6.48 6.48 2 12 2z"/>
    <path d="M12 6v6l4 2"/>
  </svg>
);
const IcoEmails = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
);
const IcoDomains = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);
const IcoDarkWeb = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IcoAlerts = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const IcoHistory = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="12 8 12 12 14 14"/>
    <path d="M3.05 11a9 9 0 1 1 .5 4m-.5-4V7l3 3-3 3"/>
  </svg>
);
const IcoSettings = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);
const IcoReports = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);
const IcoLogout = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);
const IcoHome = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);
const IcoBell = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

// ── Nav item ──────────────────────────────────────────────────────────────────
function NavItem({ href, icon, label, active, badge }: {
  href: string; icon: React.ReactNode; label: string; active: boolean; badge?: number;
}) {
  return (
    <Link
      href={href}
      className="cs-nav-item"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 11px",
        borderRadius: 6,
        fontSize: 14,
        fontWeight: active ? 500 : 400,
        textDecoration: "none",
        transition: "all 0.15s",
        margin: "1px 8px",
        color: active ? "#f5f5f5" : "#b3b4b5",
        background: active ? "rgba(240,240,240,0.18)" : "transparent",
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.color = "#e5e5e5";
          e.currentTarget.style.background = "rgba(255,255,255,0.06)";
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.color = "#b3b4b5";
          e.currentTarget.style.background = "transparent";
        }
      }}
    >
      <span style={{ width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span style={{
          minWidth: 18, height: 18,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "#ef4444",
          color: "#fff",
          fontSize: "0.62rem",
          fontWeight: 700,
          borderRadius: 9,
          padding: "0 5px",
          fontFamily: "var(--font-dm-mono)",
        }}>
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <p style={{
        fontSize: "0.62rem",
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        color: "#71717a",
        padding: "16px 16px 6px 16px",
        fontWeight: 600,
        margin: 0,
      }}>
        {label}
      </p>
      {children}
    </div>
  );
}

// ── Alert row ─────────────────────────────────────────────────────────────────
function AlertRow({ alert, onDismiss, onDelete, onClose }: {
  alert: AlertItem; onDismiss: (id: string) => void; onDelete: (id: string) => void; onClose: () => void;
}) {
  const [dismissing, setDismissing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const c = SEV_COLOR[alert.severity] ?? "#3b82f6";
  const { t } = useTranslation();

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      padding: "12px 16px",
      background: alert.is_unread ? "rgba(255,255,255,0.025)" : "transparent",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
    }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: c, marginTop: 5, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: "0.78rem", fontWeight: 600, lineHeight: 1.3,
          color: alert.is_unread ? "#f5f5f5" : "#b3b4b5",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          margin: 0,
        }}>
          {alert.title}
        </p>
        <p style={{ fontSize: "0.68rem", color: "#71717a", marginTop: 2, margin: "2px 0 0 0" }}>{relTime(alert.sent_at)}</p>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <Link href="/dashboard/alerts" onClick={onClose}
            style={{ fontSize: "0.68rem", fontWeight: 600, color: "#3ecf8e", padding: "3px 8px", background: "rgba(62,207,142,0.08)", border: "1px solid rgba(62,207,142,0.15)", borderRadius: 6, textDecoration: "none" }}>
            Ver
          </Link>
          {alert.is_unread && (
            <button
              onClick={async (e) => { e.stopPropagation(); setDismissing(true); await onDismiss(alert.id); setDismissing(false); }}
              disabled={dismissing}
              style={{ fontSize: "0.68rem", fontWeight: 500, color: "#71717a", padding: "3px 8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, cursor: "pointer" }}>
              {dismissing ? "…" : t("topbar.dismiss")}
            </button>
          )}
          <button
            onClick={async (e) => {
              e.stopPropagation();
              setDeleting(true);
              await onDelete(alert.id);
              setDeleting(false);
            }}
            disabled={deleting}
            title="Eliminar notificación"
            style={{
              fontSize: "0.68rem", fontWeight: 500, color: "#71717a",
              padding: "3px 7px", background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6,
              cursor: "pointer", display: "flex", alignItems: "center",
            }}
          >
            {deleting ? "…" : "✕"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Buy credits modal ─────────────────────────────────────────────────────────
const PACKS = [
  { key: "s" as const, label: "Pack S", credits: 5,  price: "6,99€",  per: "1,40€/créd." },
  { key: "m" as const, label: "Pack M", credits: 12, price: "10,99€", per: "0,92€/créd." },
  { key: "l" as const, label: "Pack L", credits: 30, price: "20,99€", per: "0,70€/créd.", popular: true },
];

function BuyCreditsModal({ creditsAvailable, onClose }: { creditsAvailable: number | null; onClose: () => void }) {
  const [buying, setBuying] = useState<string | null>(null);
  const { t } = useTranslation();
  const handleBuy = async (pack: "s" | "m" | "l") => {
    if (buying) return;
    setBuying(pack);
    try {
      const { creditsApi } = await import("@/lib/api");
      const res = await creditsApi.checkout(pack);
      window.location.href = res.data.url;
    } catch { setBuying(null); }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div style={{ width: "100%", maxWidth: 400, background: "#151515", border: "1px solid #1a1a1a", borderRadius: 16, padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#f5f5f5", margin: 0 }}>{t("credits.title")}</h2>
            <p style={{ fontSize: "0.78rem", color: "#71717a", marginTop: 2, margin: "2px 0 0 0" }}>
              {creditsAvailable !== null ? `${creditsAvailable} crédito${creditsAvailable !== 1 ? "s" : ""} disponible${creditsAvailable !== 1 ? "s" : ""}` : t("credits.balance")}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#71717a", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {PACKS.map(pack => (
            <button key={pack.key} onClick={() => handleBuy(pack.key)} disabled={!!buying}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, textAlign: "left",
                background: pack.popular ? "rgba(62,207,142,0.04)" : "#1c1c1c",
                border: pack.popular ? "1px solid rgba(62,207,142,0.2)" : "1px solid #1a1a1a",
                cursor: buying ? "not-allowed" : "pointer", opacity: buying ? 0.6 : 1, transition: "all 0.15s",
              }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.85rem", fontFamily: "var(--font-dm-mono)", background: pack.popular ? "rgba(62,207,142,0.12)" : "rgba(255,255,255,0.04)", color: pack.popular ? "#3ecf8e" : "#71717a", flexShrink: 0 }}>
                {buying === pack.key ? <span style={{ width: 14, height: 14, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} /> : pack.credits}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: "0.88rem", color: "#f5f5f5" }}>{pack.label}</span>
                  {pack.popular && <span style={{ fontSize: "0.6rem", padding: "2px 6px", borderRadius: 4, background: "rgba(62,207,142,0.1)", color: "#3ecf8e", fontFamily: "var(--font-dm-mono)", textTransform: "uppercase" }}>Popular</span>}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#71717a" }}>{pack.credits} créditos · {pack.per}</div>
              </div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#f5f5f5", flexShrink: 0 }}>{pack.price}</div>
            </button>
          ))}
        </div>
        <p style={{ fontSize: "0.72rem", color: "#71717a", textAlign: "center", margin: 0 }}>{t("credits.footer")}</p>
      </div>
    </div>
  );
}

// ── Notification bell ─────────────────────────────────────────────────────────
function NotificationBell({ unreadCount, setUnreadCount }: { unreadCount: number; setUnreadCount: (n: number) => void }) {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await alertsApi.list();
      setAlerts((res.data.alerts as AlertItem[]).slice(0, 8));
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (open) fetchAlerts(); }, [open, fetchAlerts]);

  const handleDismiss = async (id: string) => {
    try {
      await alertsApi.markRead(id);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_unread: false } : a));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch { /* silent */ }
  };

  const handleDelete = async (id: string) => {
    try {
      const alert = alerts.find(a => a.id === id);
      await alertsApi.delete(id);
      setAlerts(prev => prev.filter(a => a.id !== id));
      if (alert?.is_unread) {
        setUnreadCount(Math.max(0, unreadCount - 1));
      }
    } catch { /* silent */ }
  };

  const handleMarkAllRead = async () => {
    try {
      await alertsApi.markAllRead();
      setAlerts(prev => prev.map(a => ({ ...a, is_unread: false })));
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  return (
    <div ref={panelRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
          background: "transparent",
          border: "none",
          borderRadius: 8, cursor: "pointer", transition: "color 0.15s",
          color: open ? "#f5f5f5" : "#71717a",
          padding: 0,
        }}
        onMouseEnter={e => (e.currentTarget.style.color = "#f5f5f5")}
        onMouseLeave={e => { if (!open) e.currentTarget.style.color = "#71717a"; }}
        aria-label={t("topbar.notifications")}
      >
        <IcoBell />
        {unreadCount > 0 && (
          <span className="cs-notif-pulse" style={{ position: "absolute", top: 2, right: 2, width: 6, height: 6, background: "#ef4444", borderRadius: "50%", display: "block" }} />
        )}
      </button>

      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 340, background: "#151515", border: "1px solid #1a1a1a", borderRadius: 12, overflow: "hidden", boxShadow: "0 16px 48px rgba(0,0,0,0.5)", zIndex: 50 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #1a1a1a" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#f5f5f5" }}>{t("topbar.notifications")}</span>
              {unreadCount > 0 && <span style={{ fontSize: "0.6rem", fontWeight: 700, background: "#ef4444", color: "#fff", borderRadius: 6, padding: "1px 5px", fontFamily: "var(--font-dm-mono)" }}>{unreadCount}</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} style={{ fontSize: "0.72rem", fontWeight: 600, color: "#3ecf8e", background: "none", border: "none", cursor: "pointer" }}>
                  {t("topbar.markRead")}
                </button>
              )}
              <button onClick={async () => {
                try {
                  const { alertsApi: api } = await import("@/lib/api");
                  await api.deleteAll();
                  setAlerts([]);
                  setUnreadCount(0);
                } catch { /* silent */ }
              }} style={{ fontSize: "0.72rem", fontWeight: 600, color: "#71717a", background: "none", border: "none", cursor: "pointer" }}>
                {t("topbar.deleteAll")}
              </button>
            </div>
          </div>
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
                <div style={{ width: 20, height: 20, border: "2px solid #3ecf8e", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              </div>
            ) : alerts.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>🛡</div>
                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#f5f5f5" }}>{t("topbar.allClear")}</div>
                <div style={{ fontSize: "0.72rem", color: "#71717a", marginTop: 4 }}>{t("topbar.noActiveAlerts")}</div>
              </div>
            ) : alerts.map(a => <AlertRow key={a.id} alert={a} onDismiss={handleDismiss} onDelete={handleDelete} onClose={() => setOpen(false)} />)}
          </div>
          {!loading && alerts.length > 0 && (
            <div style={{ padding: "10px 16px", borderTop: "1px solid #1a1a1a" }}>
              <Link href="/dashboard/alerts" onClick={() => setOpen(false)} style={{ fontSize: "0.78rem", fontWeight: 600, color: "#3ecf8e", textDecoration: "none", display: "block", textAlign: "center" }}>
                {t("topbar.viewAllAlerts")}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page title key map ────────────────────────────────────────────────────────
const PAGE_TITLE_KEYS: Record<string, string> = {
  "/dashboard": "nav.overview",
  "/dashboard/assistant": "nav.aiAssistant",
  "/dashboard/emails": "nav.emails",
  "/dashboard/domains": "nav.domains",
  "/dashboard/darkweb": "nav.darkweb",
  "/dashboard/alerts": "nav.alerts",
  "/dashboard/history": "nav.history",
  "/dashboard/reports": "nav.reports",
  "/dashboard/settings": "nav.settings",
};

// ── Layout ────────────────────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <CreditsProvider>
        <PlanProvider>
          <LayoutInner>{children}</LayoutInner>
        </PlanProvider>
      </CreditsProvider>
    </LanguageProvider>
  );
}

function LayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const { credits, refreshCredits } = useCredits();
  const { t } = useTranslation();
  const { plan: userPlan, isFree } = usePlan();

  // Poll unread count every 2 min
  useEffect(() => {
    const fetch = async () => {
      try { const r = await alertsApi.unreadCount(); setUnreadAlerts(r.data.unread_count ?? 0); } catch { /* silent */ }
    };
    fetch();
    const t = setInterval(fetch, 120_000);
    return () => clearInterval(t);
  }, []);

  // Auth guard
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace("/login"); return; }
      setUserEmail(data.session.user.email ?? null);
      setChecking(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login");
    });
    return () => listener.subscription.unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", background: "#0b0b0b", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 28, height: 28, border: "2px solid #3ecf8e", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const initials = userEmail ? userEmail.split("@")[0].slice(0, 2).toUpperCase() : "??";
  const username = userEmail?.split("@")[0] ?? "Usuario";
  const currentTitle = t(PAGE_TITLE_KEYS[pathname] ?? "nav.overview");
  const isLowCredits = credits !== null && credits <= 5;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0b0b0b", fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        @keyframes csBellPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.45); }
          50% { box-shadow: 0 0 0 4px rgba(239,68,68,0); }
        }
        .cs-notif-pulse { animation: csBellPulse 2s ease-in-out infinite; }
        .cs-nav-item { position: relative !important; overflow: visible !important; }
        .cs-nav-item::before {
          content: ''; position: absolute; left: 0; top: 50%;
          transform: translateY(-50%); width: 2px; height: 0;
          background: #3ecf8e; border-radius: 0 3px 3px 0; transition: height 0.2s ease;
        }
        .cs-nav-item:hover::before { height: 55%; }
        .cs-nav-item:hover { transform: translateX(2px); }

        /* ── Global fade-up animations ── */
        @keyframes csFadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .cs-fadeup-1 { animation: csFadeUp 0.45s cubic-bezier(.4,0,.2,1) both; }
        .cs-fadeup-2 { animation: csFadeUp 0.45s cubic-bezier(.4,0,.2,1) 0.08s both; }
        .cs-fadeup-3 { animation: csFadeUp 0.45s cubic-bezier(.4,0,.2,1) 0.16s both; }
        .cs-fadeup-4 { animation: csFadeUp 0.45s cubic-bezier(.4,0,.2,1) 0.24s both; }

        /* ── Ambient background orbs ── */
        @keyframes csAmbFloat {
          0%,100% { transform: translateY(0) scale(1); }
          50%      { transform: translateY(-24px) scale(1.04); }
        }

        /* ── Domain / email item hover ── */
        .cs-domain-item { transition: transform 0.18s ease, box-shadow 0.18s ease !important; }
        .cs-domain-item:hover { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(62,207,142,.06) !important; }

        /* ── Score row hover ── */
        .cs-score-row { transition: background 0.15s; border-radius: 6px; }
        .cs-score-row:hover { background: rgba(255,255,255,0.02); }

        /* ── KPI card hover ── */
        .cs-kpi-card:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(62,207,142,.07) !important; }

        /* ── Button shimmer ── */
        @keyframes csShimmer {
          from { background-position: -200% center; }
          to   { background-position:  200% center; }
        }
        .cs-btn { position: relative; overflow: hidden; }
        .cs-btn::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.08) 50%,transparent 100%);
          background-size: 200% 100%; opacity: 0; transition: opacity 0.2s;
        }
        .cs-btn:hover::after { opacity: 1; animation: csShimmer 0.6s ease; }

        /* ── Score ring glow ── */
        @keyframes csScoreGlow {
          0%,100% { opacity: 0.4; transform: scale(1); }
          50%      { opacity: 0.7; transform: scale(1.08); }
        }
        .cs-score-glow { animation: csScoreGlow 3s ease-in-out infinite; }

        /* ── Orbiting particles ── */
        @keyframes csOrbit {
          from { transform: rotate(0deg) translateX(84px) rotate(0deg); }
          to   { transform: rotate(360deg) translateX(84px) rotate(-360deg); }
        }
        .cs-orbit-p1,.cs-orbit-p2,.cs-orbit-p3 {
          position: absolute; border-radius: 50%; top: 50%; left: 50%;
          margin: -3px 0 0 -3px; width: 6px; height: 6px;
        }
        .cs-orbit-p1 { background: rgba(62,207,142,0.8); animation: csOrbit 6s linear infinite; }
        .cs-orbit-p2 { background: rgba(0,229,191,0.6); animation: csOrbit 9s linear infinite reverse; width: 4px; height: 4px; margin: -2px 0 0 -2px; }
        .cs-orbit-p3 { background: rgba(74,222,128,0.5); animation: csOrbit 12s linear 2s infinite; width: 5px; height: 5px; margin: -2.5px 0 0 -2.5px; }

        /* ── Skeleton shimmer ── */
        @keyframes csSkeleton {
          from { background-position: -400px 0; }
          to   { background-position:  400px 0; }
        }
        .cs-skeleton {
          background: linear-gradient(90deg,#1a1a1a 25%,#222 50%,#1a1a1a 75%);
          background-size: 400px 100%; animation: csSkeleton 1.4s ease infinite;
        }

        /* ── Reduced motion ── */
        @media (prefers-reduced-motion: reduce) {
          .cs-fadeup-1,.cs-fadeup-2,.cs-fadeup-3,.cs-fadeup-4 { animation: none !important; opacity: 1 !important; transform: none !important; }
          .cs-domain-item:hover { transform: none !important; }
          .cs-kpi-card:hover { transform: none !important; }
          .cs-score-glow,.cs-orbit-p1,.cs-orbit-p2,.cs-orbit-p3 { animation: none !important; }
          .cs-amb { animation: none !important; }
          .cs-btn::after { animation: none !important; }
          .cs-skeleton { animation: none !important; }
        }
      `}</style>

      {/* Ambient background orbs */}
      <div className="cs-amb" style={{ position: "fixed", top: "15%", left: "10%", width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle,rgba(62,207,142,0.04) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0, animation: "csAmbFloat 14s ease-in-out infinite" }} />
      <div className="cs-amb" style={{ position: "fixed", bottom: "20%", right: "8%", width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle,rgba(0,229,191,0.035) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0, animation: "csAmbFloat 18s ease-in-out 3s infinite reverse" }} />
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0.018, backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundRepeat: "repeat", backgroundSize: "128px" }} />

      {/* Buy credits modal */}
      {showBuyModal && <BuyCreditsModal creditsAvailable={credits} onClose={() => setShowBuyModal(false)} />}

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside style={{
        position: "fixed", left: 0, top: 0, bottom: 0, width: 220,
        display: "flex", flexDirection: "column",
        background: "#151515",
        borderRight: "0.8px solid #1a1a1a",
        zIndex: 40,
        paddingBottom: 20,
      }}>
        {/* Brand */}
        <div style={{
          height: 64,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 16px",
          borderBottom: "0.8px solid #1a1a1a",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <LogoFull height={28} />
          </div>
          <button
            style={{ background: "none", border: "none", cursor: "pointer", color: "#71717a", padding: 4, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4 }}
            onMouseEnter={e => (e.currentTarget.style.color = "#f5f5f5")}
            onMouseLeave={e => (e.currentTarget.style.color = "#71717a")}
            aria-label="Toggle menu"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: "auto" }}>
          <NavSection label={t("nav.section.main")}>
            <NavItem href="/dashboard" icon={<IcoOverview />} label={t("nav.overview")} active={pathname === "/dashboard"} />
            <NavItem href="/dashboard/assistant" icon={<IcoAssistant />} label={t("nav.aiAssistant")} active={pathname === "/dashboard/assistant"} />
            <NavItem href="/dashboard/darkweb" icon={<IcoDarkWeb />} label={t("nav.darkweb")} active={pathname === "/dashboard/darkweb"} />
          </NavSection>

          <NavSection label={t("nav.section.monitor")}>
            <NavItem href="/dashboard/emails" icon={<IcoEmails />} label={t("nav.emails")} active={pathname === "/dashboard/emails"} />
            <NavItem href="/dashboard/domains" icon={<IcoDomains />} label={t("nav.domains")} active={pathname === "/dashboard/domains"} />
            <NavItem href="/dashboard/alerts" icon={<IcoAlerts />} label={t("nav.alerts")} active={pathname === "/dashboard/alerts"} badge={unreadAlerts} />
          </NavSection>

          <NavSection label={t("nav.section.account")}>
            <NavItem href="/dashboard/history" icon={<IcoHistory />} label={t("nav.history")} active={pathname === "/dashboard/history"} />
            <NavItem href="/dashboard/reports" icon={<IcoReports />} label={t("nav.reports")} active={pathname.startsWith("/dashboard/reports")} />
            <NavItem href="/dashboard/settings" icon={<IcoSettings />} label={t("nav.settings")} active={pathname === "/dashboard/settings"} />
          </NavSection>
        </nav>

        {/* User footer */}
        <div style={{ borderTop: "0.8px solid #1a1a1a", padding: "12px 12px 0 12px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "#262626",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 600, color: "#b3b4b5",
              fontFamily: "var(--font-dm-mono)", flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "nowrap" }}>
                <span style={{ fontSize: 13, fontWeight: 400, color: "#f5f5f5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>
                  {username}
                </span>
                {isFree && (
                  <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 4, padding: "1px 5px", letterSpacing: "0.08em", flexShrink: 0 }}>
                    FREE
                  </span>
                )}
              </div>
            </div>
            <button onClick={handleLogout} title={t("nav.settings")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#71717a", padding: 4, borderRadius: 6, display: "flex", transition: "color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
              onMouseLeave={e => (e.currentTarget.style.color = "#71717a")}
            >
              <IcoLogout />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main area ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, marginLeft: 220, minHeight: "100vh", background: "#0b0b0b" }}>

        {/* Topbar */}
        <header style={{
          position: "fixed", top: 0, left: 220, right: 0, zIndex: 30,
          height: 64, display: "flex", alignItems: "center",
          padding: "0 24px",
          background: "rgba(11,11,11,0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "0.8px solid #1a1a1a",
          justifyContent: "space-between",
        }}>
          {/* Left: breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#71717a", display: "flex", alignItems: "center" }}>
              <IcoHome />
            </span>
            <span style={{ fontSize: 13, color: "#71717a" }}>Dashboard</span>
            <span style={{ fontSize: 13, color: "#71717a" }}>›</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#f5f5f5" }}>{currentTitle}</span>
          </div>

          {/* Right: credits pill + bell */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Credits pill */}
            <button
              onClick={() => setShowBuyModal(true)}
              style={{
                display: "flex", alignItems: "center", gap: 6, height: 28, padding: "0 12px", borderRadius: 20,
                background: "#151515",
                border: "0.8px solid #1a1a1a",
                cursor: "pointer", transition: "all 0.15s",
              }}
              title={t("topbar.buyCredits")}
            >
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: isLowCredits ? "#f59e0b" : "#3ecf8e", flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 500, fontFamily: "var(--font-dm-mono)", color: isLowCredits ? "#f59e0b" : "#f5f5f5" }}>
                {credits === null ? "—" : credits}
              </span>
              <span style={{ fontSize: 12, color: "#b3b4b5" }}>
                {t("topbar.credits")}
              </span>
            </button>

            {/* Bell */}
            <NotificationBell unreadCount={unreadAlerts} setUnreadCount={setUnreadAlerts} />
          </div>
        </header>

        {/* Upgrade banner for free/trial users */}
        {isFree && showBanner && (
          <div style={{
            position: "sticky", top: 64, zIndex: 29,
            background: "rgba(245,158,11,0.07)",
            borderBottom: "1px solid rgba(245,158,11,0.15)",
            padding: "10px 24px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          }}>
            <span style={{ fontSize: "0.82rem", color: "#d4a017" }}>
              Estás en el plan gratuito. Mejora tu plan para desbloquear monitoreo continuo y todas las funciones.
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <Link
                href="/select-plan"
                style={{
                  fontSize: "0.78rem", fontWeight: 700, color: "#f59e0b",
                  background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)",
                  borderRadius: 6, padding: "4px 12px", textDecoration: "none",
                  transition: "all 0.15s",
                }}
              >
                Mejorar plan →
              </Link>
              <button
                onClick={() => setShowBanner(false)}
                style={{ background: "none", border: "none", color: "#71717a", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 4px" }}
                aria-label="Cerrar banner"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Page content */}
        <main style={{ paddingTop: isFree && showBanner ? 64 : 64, paddingLeft: 24, paddingRight: 24, paddingBottom: 40 }}>
          {children}
        </main>

      </div>
      <Toaster />
    </div>
  );
}
