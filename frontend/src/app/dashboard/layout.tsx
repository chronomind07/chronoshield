"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { ModeContext } from "@/lib/mode-context";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function ShieldLogo() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
      <path
        d="M16 3 L28 8 L28 17 C28 23.5 22.5 28.5 16 30 C9.5 28.5 4 23.5 4 17 L4 8 Z"
        fill="rgba(0,194,255,0.12)"
        stroke="#00C2FF"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M11.5 16.5 L14.5 19.5 L20.5 13"
        stroke="#00C2FF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-4 py-1.5 rounded-lg text-sm transition-all duration-150 ${
        active
          ? "bg-[#00C2FF]/10 text-[#00C2FF] font-medium"
          : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]"
      }`}
    >
      {children}
    </Link>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
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
      if (!data.session) {
        router.replace("/login");
      } else {
        setUserEmail(data.session.user.email ?? null);
      }
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

  return (
    <ModeContext.Provider value={{ techMode, setTechMode }}>
      <div className="min-h-screen bg-[#080C10] font-sans">
        {/* Navbar */}
        <nav className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#080C10]/90 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-2.5 shrink-0">
              <ShieldLogo />
              <span className="font-syne font-bold text-white text-base tracking-tight">
                ChronoShield
              </span>
            </div>

            {/* Nav links */}
            <div className="flex items-center gap-1">
              <NavLink href="/dashboard" active={pathname === "/dashboard"}>
                Dashboard
              </NavLink>
              <NavLink
                href="/dashboard/domains"
                active={pathname === "/dashboard/domains"}
              >
                Dominios
              </NavLink>
              <NavLink
                href="/dashboard/emails"
                active={pathname === "/dashboard/emails"}
              >
                Emails
              </NavLink>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Técnico / Simple toggle */}
              <div className="flex items-center gap-0.5 bg-white/[0.04] border border-white/[0.08] rounded-full p-1">
                <button
                  onClick={() => setTechMode(false)}
                  className={`px-3 py-1 rounded-full text-xs transition-all duration-150 ${
                    !techMode
                      ? "bg-[#00C2FF] text-[#080C10] font-semibold"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  Simple
                </button>
                <button
                  onClick={() => setTechMode(true)}
                  className={`px-3 py-1 rounded-full text-xs transition-all duration-150 font-mono ${
                    techMode
                      ? "bg-[#00C2FF] text-[#080C10] font-semibold"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  Técnico
                </button>
              </div>

              <span className="text-xs text-slate-600 hidden lg:block max-w-[160px] truncate">
                {userEmail}
              </span>

              <button
                onClick={handleLogout}
                className="text-xs text-slate-600 hover:text-red-400 transition-colors"
              >
                Salir
              </button>
            </div>
          </div>
        </nav>

        {/* Main content */}
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </div>
    </ModeContext.Provider>
  );
}
