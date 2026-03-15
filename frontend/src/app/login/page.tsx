"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

function ShieldIcon() {
  return (
    <div
      className="w-12 h-12 rounded-2xl flex items-center justify-center"
      style={{ background: "linear-gradient(135deg,#0077FF,#00C2FF)", boxShadow: "0 8px 32px rgba(0,119,255,0.35)" }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7L12 2z"
          fill="white" fillOpacity="0.92" />
        <path d="M9 12l2 2 4-4" stroke="rgba(0,220,255,0.9)" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("¡Bienvenido a ChronoShield!");
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error de autenticación";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = [
    "w-full rounded-xl px-4 py-3 text-[14px] text-[#E8EDF2]",
    "placeholder-[#3D4F5E] focus:outline-none transition-all",
    "bg-[#121A22]",
  ].join(" ");

  const inputStyle = { border: "1px solid rgba(255,255,255,0.08)" };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "#080C10" }}
    >
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(0,119,255,0.1) 0%, transparent 70%)" }} />

      <div className="relative w-full max-w-[420px]">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <ShieldIcon />
          <h1 className="font-syne font-bold text-[22px] text-[#E8EDF2] mt-4">ChronoShield</h1>
          <p className="text-[13px] text-[#5A6B7A] mt-1">Ciberseguridad para empresas</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-7"
          style={{ background: "#0D1218", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 32px 80px rgba(0,0,0,0.5)" }}>

          <h2 className="font-syne font-bold text-[18px] text-[#E8EDF2] mb-6">Iniciar sesión</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-[11px] text-[#5A6B7A] mb-1.5 uppercase tracking-[1.5px]">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="tu@empresa.com"
                className={inputCls}
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block font-mono text-[11px] text-[#5A6B7A] mb-1.5 uppercase tracking-[1.5px]">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className={inputCls}
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-[14px] font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              style={{ background: "linear-gradient(135deg,#0077FF,#00A8E8)", boxShadow: "0 4px 24px rgba(0,119,255,0.28)" }}
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <p className="text-center text-[13px] text-[#5A6B7A] mt-5">
            ¿No tienes cuenta?{" "}
            <Link href="/register" className="text-[#00C2FF] hover:text-white transition-colors font-medium">
              Crear una gratis
            </Link>
          </p>
        </div>

        {/* Back to landing */}
        <div className="text-center mt-5">
          <Link href="/" className="text-[12px] text-[#3D4F5E] hover:text-[#5A6B7A] transition-colors">
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
