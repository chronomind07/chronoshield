"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Shield, LogOut, Globe, Mail, Loader2 } from "lucide-react";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
      } else {
        setUserEmail(data.session.user.email ?? null);
      }
      setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-lg">ChronoShield</span>
        </div>

        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600 transition">
            <Shield className="w-4 h-4" /> Dashboard
          </Link>
          <Link href="/dashboard/domains" className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600 transition">
            <Globe className="w-4 h-4" /> Dominios
          </Link>
          <Link href="/dashboard/emails" className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600 transition">
            <Mail className="w-4 h-4" /> Emails
          </Link>
          <span className="text-sm text-gray-400">{userEmail}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 transition"
          >
            <LogOut className="w-4 h-4" /> Salir
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
