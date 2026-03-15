"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

function ShieldIcon() {
  return (
    <div
      className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center"
      style={{ background: "#080C10", boxShadow: "0 8px 32px rgba(0,119,255,0.25)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.jpeg" alt="ChronoShield" width={56} height={56} className="w-full h-full object-contain" />
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);

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
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) throw error;
      setDone(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al crear la cuenta";
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

          {done ? (
            /* ── Success state ── */
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="font-syne font-bold text-[20px] text-[#E8EDF2] mb-2">¡Cuenta creada!</h2>
              <p className="text-[14px] text-[#5A6B7A] leading-[1.65] mb-6">
                Hemos enviado un email de confirmación a{" "}
                <span className="text-[#9AACBA] font-medium">{email}</span>.
                Revisa tu bandeja de entrada y haz clic en el enlace para activar tu cuenta.
              </p>
              <Link href="/login"
                className="block text-center py-3 rounded-xl text-[14px] font-bold text-white transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg,#0077FF,#00A8E8)" }}>
                Ir a iniciar sesión
              </Link>
            </div>
          ) : (
            /* ── Register form ── */
            <>
              <h2 className="font-syne font-bold text-[18px] text-[#E8EDF2] mb-6">Crear cuenta gratuita</h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block font-mono text-[11px] text-[#5A6B7A] mb-1.5 uppercase tracking-[1.5px]">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Tu nombre o el de tu empresa"
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>

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
                    minLength={8}
                    placeholder="Mínimo 8 caracteres"
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
                  {loading ? "Creando cuenta..." : "Crear cuenta gratis"}
                </button>
              </form>

              <p className="text-center text-[13px] text-[#5A6B7A] mt-5">
                ¿Ya tienes cuenta?{" "}
                <Link href="/login" className="text-[#00C2FF] hover:text-white transition-colors font-medium">
                  Inicia sesión
                </Link>
              </p>
            </>
          )}
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
