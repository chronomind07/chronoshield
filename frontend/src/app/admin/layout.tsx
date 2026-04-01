"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

const ACCENT = "#f59e0b";

const NAV = [
  { href: "/admin",          label: "Dashboard",  icon: "▦" },
  { href: "/admin/users",    label: "Usuarios",   icon: "👥" },
  { href: "/admin/leads",    label: "Leads",      icon: "🎯" },
  { href: "/admin/platform", label: "Plataforma", icon: "📊" },
  { href: "/admin/audit",    label: "Audit Log",  icon: "📋" },
];

const NAV_SUPERADMIN = { href: "/admin/team", label: "Equipo", icon: "🏅" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/dashboard"); return; }
      setEmail(user.email ?? "");
      supabase.from("profiles").select("role").eq("id", user.id).single()
        .then(({ data }) => {
          if (!data || !["admin", "superadmin"].includes(data.role ?? "")) {
            router.push("/dashboard");
          } else {
            setRole(data.role);
          }
        });
    });
  }, [router]);

  if (!role) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                  height: "100vh", background: "#050507", color: "#64748b",
                  fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      Verificando acceso…
    </div>
  );

  const navItems = role === "superadmin" ? [...NAV, NAV_SUPERADMIN] : NAV;

  return (
    <div style={{ display: "flex", height: "100vh", background: "#050507",
                  fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: "#0a0b0f",
                      borderRight: "1px solid rgba(255,255,255,0.06)",
                      display: "flex", flexDirection: "column", flexShrink: 0 }}>
        {/* Logo */}
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 6v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V6L12 2z"
                    fill={ACCENT} fillOpacity="0.2" stroke={ACCENT} strokeWidth="1.5" strokeLinejoin="round"/>
              <circle cx="12" cy="12" r="3" stroke={ACCENT} strokeWidth="1.4"/>
              <path d="M12 9.5V12l1.5 1" stroke={ACCENT} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", letterSpacing: "-0.02em" }}>
              ChronoShield
            </span>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                         color: ACCENT, background: `${ACCENT}18`,
                         border: `1px solid ${ACCENT}33`, borderRadius: 4,
                         padding: "2px 7px" }}>
            {role === "superadmin" ? "SUPERADMIN" : "ADMIN"}
          </span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
          {navItems.map(item => {
            const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}
                style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px",
                         borderRadius: 8, marginBottom: 2, textDecoration: "none",
                         fontSize: 13, fontWeight: active ? 600 : 400,
                         color: active ? "#e2e8f0" : "#64748b",
                         background: active ? `${ACCENT}14` : "transparent",
                         borderLeft: active ? `2px solid ${ACCENT}` : "2px solid transparent",
                         transition: "all 0.15s" }}>
                <span style={{ fontSize: 14 }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>{email}</div>
          <button
            onClick={() => { supabase.auth.signOut(); router.push("/login"); }}
            style={{ fontSize: 12, color: "#64748b", background: "none", border: "none",
                     cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
            ← Volver al dashboard
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
        {children}
      </main>
    </div>
  );
}
