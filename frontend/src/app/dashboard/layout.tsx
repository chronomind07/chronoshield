"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { ModeContext } from "@/lib/mode-context";

// ─── Nav item ─────────────────────────────────────────────────────────────────
function NavItem({
  href,
  icon,
  label,
  active,
  badge,
  techOnly,
  techMode,
}: {
  href: string;
  icon: string;
  label: string;
  active: boolean;
  badge?: number;
  techOnly?: boolean;
  techMode: boolean;
}) {
  if (techOnly && !techMode) return null;
  return (
    <Link
      href={href}
      className={`relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${
        active
          ? "bg-[rgba(0,194,255,0.08)] text-[#00C2FF] border border-[rgba(0,194,255,0.15)]"
          : "text-[#5A6B7A] hover:bg-white/[0.04] hover:text-[#E8EDF2]"
      }`}
    >
      {active && (
        <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#00C2FF] rounded-r" />
      )}
      <span className="w-[18px] text-center text-[15px]">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="ml-auto bg-[#FF4D6A] text-white text-[9px] font-bold px-1.5 py-px rounded-full leading-none">
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
      <p className="font-mono text-[9px] uppercase tracking-[2px] text-[#5A6B7A] px-3 mb-1.5 mt-3">
        {label}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

// ─── Logo icon ────────────────────────────────────────────────────────────────
function LogoIcon() {
  return (
    <div
      className="w-7 h-7 rounded-lg flex items-center justify-center text-[13px] shrink-0"
      style={{
        background: "linear-gradient(135deg, #0077FF, #00C2FF)",
        boxShadow: "0 0 16px rgba(0,194,255,0.3)",
      }}
    >
      🛡
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [checking, setChecking]   = useState(true);
  const [techMode, setTechModeState] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("cs_tech_mode");
    if (stored !== null) setTechModeState(stored === "true");
  }, []);

  const setTechMode = (v: boolean) => {
    setTechModeState(v);
    localStorage.setItem("cs_tech_mode", String(v));
  };

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
      <div className="min-h-screen bg-[#080C10] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#00C2FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Initials from email
  const initials = userEmail
    ? userEmail.split("@")[0].slice(0, 2).toUpperCase()
    : "??";

  return (
    <ModeContext.Provider value={{ techMode, setTechMode }}>
      <div className="flex min-h-screen font-sans">

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <aside
          className="fixed left-0 top-0 bottom-0 w-[220px] flex flex-col z-20"
          style={{
            background: "#0D1218",
            borderRight: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {/* Logo */}
          <div
            className="px-5 pt-6 pb-6"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <LogoIcon />
              <div className="min-w-0 overflow-hidden">
                <div className="font-syne font-extrabold text-[15px] text-[#E8EDF2] tracking-tight leading-none truncate">
                  ChronoShield
                </div>
              </div>
            </div>
            <div className="font-mono text-[9px] text-[#5A6B7A] tracking-[2px] uppercase mt-1.5 ml-[38px]">
              Security Platform
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-2">
            <NavSection label="Monitor">
              <NavItem href="/dashboard"          icon="◈" label="Dashboard" active={pathname === "/dashboard"}         techMode={techMode} />
              <NavItem href="/dashboard/emails"   icon="✉" label="Emails"    active={pathname === "/dashboard/emails"}  techMode={techMode} />
              <NavItem href="/dashboard/domains"  icon="◎" label="Dominios"  active={pathname === "/dashboard/domains"} techMode={techMode} />
            </NavSection>

            <NavSection label="Gestión">
              <NavItem href="/dashboard"          icon="⚡" label="Alertas"  active={false} techMode={techMode} />
              <NavItem href="/dashboard"          icon="≡" label="Historial" active={false} techOnly techMode={techMode} />
              <NavItem href="/dashboard"          icon="◷" label="Informes"  active={false} techOnly techMode={techMode} />
            </NavSection>

            <NavSection label="Cuenta">
              <NavItem href="/dashboard"          icon="⊙" label="Ajustes"   active={false} techMode={techMode} />
            </NavSection>
          </nav>

          {/* Footer — org pill */}
          <div
            className="px-6 py-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-white/[0.06] bg-[#121A22] hover:border-white/10 transition-colors text-left"
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center font-syne font-bold text-[11px] text-white shrink-0"
                style={{ background: "linear-gradient(135deg, #1A3A5C, #0077FF)" }}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <div className="text-[12px] font-medium text-[#E8EDF2] truncate">
                  {userEmail?.split("@")[0] ?? "Usuario"}
                </div>
                <div className="text-[10px] text-[#5A6B7A]">Plan Starter</div>
              </div>
            </button>
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <main className="flex-1 ml-[220px] min-h-screen">
          {children}
        </main>

      </div>
    </ModeContext.Provider>
  );
}
