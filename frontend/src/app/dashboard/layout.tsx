"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { alertsApi, creditsApi } from "@/lib/api";
import Link from "next/link";

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
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

const SEV_ICONS: Record<string, string> = {
  critical: "🔴",
  medium:   "🟡",
  low:      "🔵",
};

// ─── Nav item ─────────────────────────────────────────────────────────────────
function NavItem({
  href, icon, label, active, badge,
}: {
  href: string; icon: string; label: string; active: boolean; badge?: number;
}) {
  return (
    <Link href={href}
      className={`relative flex items-center gap-[11px] px-3 py-[9px] rounded-lg text-[0.84rem] font-medium transition-all duration-200 mb-px ${
        active ? 'text-[#00e5bf]' : 'text-[#55556a] hover:text-[#9999ad] hover:bg-white/[0.02]'
      }`}
      style={active ? { background: 'rgba(0,229,191,0.06)' } : {}}
    >
      {active && (
        <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-[2px] h-[18px] rounded-r" style={{ background: '#00e5bf' }} />
      )}
      <span className="w-[17px] text-center text-[15px]" style={{ opacity: active ? 1 : 0.5 }}>{icon}</span>
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center bg-[#ff4d6a] text-white text-[0.6rem] font-bold rounded-full px-[5px]">
          {badge}
        </span>
      )}
    </Link>
  );
}

// ─── Nav section ─────────────────────────────────────────────────────────────
function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-3 mb-1">
      <p style={{ fontFamily: 'var(--font-mono-family)', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.16em', color: '#33334a', padding: '14px 12px 8px', fontWeight: 500 }}>
        {label}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

// ─── Alert row (notification panel) ──────────────────────────────────────────
function AlertRow({
  alert, onDismiss, onClose,
}: {
  alert: AlertItem;
  onDismiss: (id: string) => void;
  onClose: () => void;
}) {
  const [dismissing, setDismissing] = useState(false);
  const icon = SEV_ICONS[alert.severity] ?? "🔵";

  const handleDismiss = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissing(true);
    await onDismiss(alert.id);
    setDismissing(false);
  };

  return (
    <div
      className="flex items-start gap-3 px-4 py-3.5 transition-colors"
      style={{
        background: alert.is_unread ? "rgba(255,255,255,0.025)" : "transparent",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      {/* Severity icon */}
      <span className="text-[13px] mt-px shrink-0">{icon}</span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className="text-[12px] font-semibold leading-snug"
            style={{ color: alert.is_unread ? "#f0f0f5" : "#9999ad" }}
          >
            {alert.title}
          </p>
          {alert.is_unread && (
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
              style={{ background: "#ff4d6a" }}
            />
          )}
        </div>
        <p className="text-[10px] mt-0.5" style={{ color: '#55556a' }}>{relTime(alert.sent_at)}</p>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-2">
          <Link
            href="/dashboard/alerts"
            onClick={onClose}
            className="text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors"
            style={{ color: "#00e5bf", background: "rgba(0,229,191,0.08)", border: "1px solid rgba(0,229,191,0.12)" }}
          >
            Ver alerta
          </Link>
          {alert.is_unread && (
            <button
              onClick={handleDismiss}
              disabled={dismissing}
              className="text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors disabled:opacity-40"
              style={{ color: "#55556a", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              {dismissing ? "…" : "Descartar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Buy credits modal ────────────────────────────────────────────────────────
const PACKS = [
  { key: "s" as const, label: "Pack S", credits: 5,  price: "9,99€",  per: "2,00€/créd." },
  { key: "m" as const, label: "Pack M", credits: 10, price: "18,99€", per: "1,90€/créd." },
  { key: "l" as const, label: "Pack L", credits: 20, price: "34,99€", per: "1,75€/créd.", popular: true },
];

function BuyCreditsModal({
  creditsAvailable, onClose,
}: {
  creditsAvailable: number | null;
  onClose: () => void;
}) {
  const [buying, setBuying] = useState<string | null>(null);

  const handleBuy = async (pack: "s" | "m" | "l") => {
    if (buying) return;
    setBuying(pack);
    try {
      const res = await creditsApi.checkout(pack);
      window.location.href = res.data.url;
    } catch {
      setBuying(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(5,5,7,0.88)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] rounded-2xl p-7"
        style={{
          background: "#0a0a0f",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="font-bold text-[18px]" style={{ fontFamily: 'var(--font-serif-family)', color: '#f0f0f5' }}>Comprar créditos</h2>
            <p className="text-[12px] mt-0.5" style={{ color: '#55556a' }}>
              {creditsAvailable !== null
                ? `Tienes ${creditsAvailable} crédito${creditsAvailable !== 1 ? "s" : ""} disponible${creditsAvailable !== 1 ? "s" : ""}`
                : "Saldo de créditos"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="transition-colors text-[22px] leading-none mt-0.5"
            style={{ color: '#55556a' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f0f0f5')}
            onMouseLeave={e => (e.currentTarget.style.color = '#55556a')}
          >
            ×
          </button>
        </div>

        {/* Packs */}
        <div className="space-y-3 mb-5">
          {PACKS.map((pack) => (
            <button
              key={pack.key}
              onClick={() => handleBuy(pack.key)}
              disabled={!!buying}
              className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left transition-all disabled:opacity-60"
              style={{
                background: pack.popular ? "rgba(0,229,191,0.04)" : "#0f0f16",
                border:     pack.popular ? "1px solid rgba(0,229,191,0.15)" : "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-[13px] shrink-0"
                style={{
                  fontFamily: 'var(--font-serif-family)',
                  background: pack.popular ? "rgba(0,229,191,0.12)" : "rgba(255,255,255,0.04)",
                  color:      pack.popular ? "#00e5bf" : "#55556a",
                }}
              >
                {buying === pack.key
                  ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin block" />
                  : pack.credits
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[14px]" style={{ color: '#f0f0f5' }}>{pack.label}</span>
                  {pack.popular && (
                    <span className="text-[9px] px-1.5 py-px rounded" style={{ fontFamily: 'var(--font-mono-family)', background: "rgba(0,229,191,0.10)", color: "#00e5bf" }}>
                      POPULAR
                    </span>
                  )}
                </div>
                <div className="text-[12px]" style={{ color: '#55556a' }}>{pack.credits} créditos · {pack.per}</div>
              </div>
              <div className="font-bold text-[16px] shrink-0" style={{ color: '#f0f0f5' }}>{pack.price}</div>
            </button>
          ))}
        </div>

        <p className="text-[11px] text-center leading-relaxed" style={{ color: '#55556a' }}>
          1 crédito = 1 escaneo (email, dominio o suplantación). Los créditos no caducan.
        </p>
      </div>
    </div>
  );
}

// ─── Credits pill ─────────────────────────────────────────────────────────────
function CreditsPill({ credits, onClick }: { credits: number | null; onClick: () => void }) {
  const isLow = credits !== null && credits <= 5;

  const colors = isLow
    ? { bg: "rgba(255,176,32,0.08)", border: "rgba(255,176,32,0.2)", text: "#ffb020", dot: "#ffb020" }
    : { bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.06)", text: "#9999ad", dot: "#00e5bf" };

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 h-9 px-3 rounded-xl transition-all cursor-pointer"
      style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
      title="Comprar créditos"
    >
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <circle cx="6.5" cy="6.5" r="5.5" stroke={colors.dot} strokeWidth="1.2" />
        <text x="6.5" y="9.5" textAnchor="middle" fontSize="7" fill={colors.dot} fontFamily="monospace" fontWeight="700">C</text>
      </svg>
      <span className="font-mono text-[12px] font-semibold leading-none" style={{ color: colors.text }}>
        {credits === null ? "—" : credits}
      </span>
      <span className="font-mono text-[9px] uppercase tracking-[1px] leading-none" style={{ color: isLow ? "#ffb020" : "#33334a" }}>
        créditos
      </span>
      {isLow && (
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#ffb020", boxShadow: "0 0 6px rgba(255,176,32,0.6)" }} />
      )}
    </button>
  );
}

// ─── Notification bell ────────────────────────────────────────────────────────
function NotificationBell({
  unreadCount, setUnreadCount,
}: {
  unreadCount: number;
  setUnreadCount: (n: number) => void;
}) {
  const [open, setOpen]     = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await alertsApi.list();
      setAlerts((res.data.alerts as AlertItem[]).slice(0, 8));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchAlerts();
  }, [open, fetchAlerts]);

  const handleDismiss = async (id: string) => {
    try {
      await alertsApi.markRead(id);
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_unread: false } : a))
      );
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch {
      // silent
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await alertsApi.markAllRead();
      setAlerts((prev) => prev.map((a) => ({ ...a, is_unread: false })));
      setUnreadCount(0);
    } catch {
      // silent
    }
  };

  return (
    <div ref={panelRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all"
        style={{
          background: open
            ? "rgba(0,229,191,0.08)"
            : "rgba(255,255,255,0.03)",
          border: `1px solid ${open ? "rgba(0,229,191,0.2)" : "rgba(255,255,255,0.06)"}`,
        }}
        aria-label="Notificaciones"
      >
        <span className="text-[15px] select-none">🔔</span>
        {unreadCount > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-[#ff4d6a] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 leading-none"
            style={{ boxShadow: "0 0 8px rgba(255,77,106,0.5)" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 top-[calc(100%+10px)] w-[360px] rounded-2xl overflow-hidden"
          style={{
            background: "#0a0a0f",
            border: "1px solid rgba(255,255,255,0.06)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,229,191,0.04)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3.5"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center gap-2">
              <span className="font-bold text-[14px]" style={{ fontFamily: 'var(--font-serif-family)', color: '#f0f0f5' }}>
                Notificaciones
              </span>
              {unreadCount > 0 && (
                <span
                  className="font-mono text-[9px] font-bold px-1.5 py-px rounded-full text-white"
                  style={{ background: "#ff4d6a" }}
                >
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] font-semibold transition-colors"
                style={{ color: "#00e5bf" }}
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-[#00e5bf] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center px-6">
                <span className="text-3xl">🛡</span>
                <div>
                  <div className="font-bold text-[15px]" style={{ fontFamily: 'var(--font-serif-family)', color: '#f0f0f5' }}>
                    Todo en orden
                  </div>
                  <div className="text-[12px] mt-0.5" style={{ color: '#55556a' }}>
                    Sin alertas activas. Tu seguridad está vigilada.
                  </div>
                </div>
              </div>
            ) : (
              alerts.map((alert) => (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  onDismiss={handleDismiss}
                  onClose={() => setOpen(false)}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {!loading && alerts.length > 0 && (
            <div
              className="px-4 py-3"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
            >
              <Link
                href="/dashboard/alerts"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-1 text-[12px] font-semibold transition-colors"
                style={{ color: "#00e5bf" }}
              >
                Ver todas las alertas →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [userEmail, setUserEmail]       = useState<string | null>(null);
  const [checking, setChecking]         = useState(true);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [credits, setCredits]           = useState<number | null>(null);
  const [showBuyModal, setShowBuyModal] = useState(false);

  // Poll unread count every 2 min
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await alertsApi.unreadCount();
        setUnreadAlerts(res.data.unread_count ?? 0);
      } catch {
        // silent
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 120_000);
    return () => clearInterval(interval);
  }, []);

  // Fetch credits on mount (refresh every 5 min)
  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const res = await creditsApi.get();
        setCredits(res.data.credits_available ?? 0);
      } catch {
        // silent
      }
    };
    fetchCredits();
    const interval = setInterval(fetchCredits, 300_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
      else setUserEmail(data.session.user.email ?? null);
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
      <div className="min-h-screen bg-[#050507] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#00e5bf] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const initials = userEmail
    ? userEmail.split("@")[0].slice(0, 2).toUpperCase()
    : "??";

  return (
    <div className="flex min-h-screen" style={{ background: '#050507', fontFamily: 'var(--font-jakarta-family)' }}>
      <div className="dash-ambient" />

      {/* ── Buy credits modal (global, z-50) ─────────────────────────── */}
      {showBuyModal && (
        <BuyCreditsModal
          creditsAvailable={credits}
          onClose={() => setShowBuyModal(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside
        className="fixed left-0 top-0 bottom-0 w-[256px] flex flex-col"
        style={{ background: '#0a0a0f', borderRight: '1px solid rgba(255,255,255,0.03)', zIndex: 20 }}
      >
        {/* Brand */}
        <div style={{ padding: '24px 20px 28px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #00e5bf, #6366f1)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(0,229,191,0.12)', flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-mono-family)', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#f0f0f5' }}>ChronoShield</div>
            <div style={{ fontFamily: 'var(--font-mono-family)', fontSize: '0.6rem', color: '#33334a', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 1 }}>Security Platform</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          <NavSection label="Monitor">
            <NavItem href="/dashboard"         icon="◈" label="Dashboard" active={pathname === "/dashboard"} />
            <NavItem href="/dashboard/emails"  icon="✉" label="Emails"    active={pathname === "/dashboard/emails"} />
            <NavItem href="/dashboard/domains" icon="◎" label="Dominios"  active={pathname === "/dashboard/domains"} />
            <NavItem href="/dashboard/darkweb" icon="🕸" label="Dark Web"  active={pathname === "/dashboard/darkweb"} />
          </NavSection>

          <NavSection label="Gestión">
            <NavItem href="/dashboard/alerts"  icon="⚡" label="Alertas"   active={pathname === "/dashboard/alerts"}  badge={unreadAlerts} />
            <NavItem href="/dashboard/history" icon="≡"  label="Historial" active={pathname === "/dashboard/history"} />
            <NavItem href="/dashboard"         icon="◷"  label="Informes"  active={false} />
          </NavSection>

          <NavSection label="Cuenta">
            <NavItem href="/dashboard/settings" icon="⊙" label="Ajustes" active={pathname === "/dashboard/settings"} />
          </NavSection>
        </nav>

        {/* Footer */}
        <div style={{ marginTop: 'auto', padding: '12px 12px 0', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
          <button onClick={handleLogout}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', transition: 'background 0.2s', background: 'transparent', border: 'none', textAlign: 'left' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #1a1a26, #0f0f16)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono-family)', fontSize: '0.65rem', fontWeight: 600, color: '#00e5bf', flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f0f0f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userEmail?.split('@')[0] ?? 'Usuario'}
              </div>
              <div style={{ fontFamily: 'var(--font-mono-family)', fontSize: '0.62rem', color: '#55556a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Plan Starter
              </div>
            </div>
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="flex-1 ml-[256px] min-h-screen flex flex-col" style={{ background: '#050507' }}>

        {/* ── Topbar ── */}
        <div
          className="sticky top-0 z-10 flex items-center justify-end gap-2 h-[52px] px-6 shrink-0"
          style={{
            background: 'rgba(10,10,15,0.9)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
          }}
        >
          <CreditsPill credits={credits} onClick={() => setShowBuyModal(true)} />
          <NotificationBell
            unreadCount={unreadAlerts}
            setUnreadCount={setUnreadAlerts}
          />
        </div>

        {/* ── Page content ── */}
        <div className="flex-1 w-full max-w-[1200px] mx-auto">
          {children}
        </div>

      </main>

    </div>
  );
}
