"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

function ForgotPasswordInner() {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) throw err;
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al enviar el email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#050507", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "var(--font-jakarta-family,'Plus Jakarta Sans',system-ui,sans-serif)" }}>
      <div style={{ width: "100%", maxWidth: 400, animation: "authFormReveal 0.6s cubic-bezier(0.16,1,0.3,1) both" }}>
        {/* Back */}
        <Link href="/login" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", color: "#55556a", textDecoration: "none", marginBottom: "32px", transition: "color 0.2s" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#00e5bf")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#55556a")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Volver al login
        </Link>

        {done ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(0,229,191,0.08)", border: "1px solid rgba(0,229,191,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", color: "#00e5bf" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h1 style={{ fontFamily: "var(--font-serif-family,'Instrument Serif',Georgia,serif)", fontSize: "1.8rem", fontWeight: 400, color: "#f0f0f5", marginBottom: "12px", letterSpacing: "-0.02em" }}>Email enviado</h1>
            <p style={{ fontSize: "0.9rem", color: "#9999ad", lineHeight: 1.7, marginBottom: "28px" }}>
              Revisa tu bandeja de entrada en <strong style={{ color: "#f0f0f5" }}>{email}</strong>. Te hemos enviado un enlace para restablecer tu contraseña.
            </p>
            <Link href="/login" style={{ display: "block", textAlign: "center", padding: "14px", background: "#00e5bf", color: "#000", borderRadius: "10px", fontWeight: 700, fontSize: "0.9rem", textDecoration: "none" }}>
              Volver al login
            </Link>
          </div>
        ) : (
          <>
            <h1 style={{ fontFamily: "var(--font-serif-family,'Instrument Serif',Georgia,serif)", fontSize: "2rem", fontWeight: 400, color: "#f0f0f5", marginBottom: "8px", letterSpacing: "-0.02em" }}>
              Recuperar contraseña
            </h1>
            <p style={{ fontSize: "0.9rem", color: "#55556a", marginBottom: "32px" }}>
              Introduce tu email y te enviaremos un enlace de recuperación.
            </p>

            {error && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 16px", background: "rgba(255,77,106,0.06)", border: "1px solid rgba(255,77,106,0.12)", borderRadius: "10px", fontSize: "0.82rem", color: "#ff4d6a", marginBottom: "20px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#9999ad", marginBottom: "8px" }}>Email</label>
                <input
                  type="email" required
                  placeholder="tu@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: "100%", padding: "12px 16px", background: "#0c0c14", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", color: "#f0f0f5", fontFamily: "inherit", fontSize: "0.9rem", outline: "none", transition: "border-color 0.2s, box-shadow 0.2s" }}
                  onFocus={(e) => { e.target.style.borderColor = "rgba(0,229,191,0.3)"; e.target.style.boxShadow = "0 0 0 3px rgba(0,229,191,0.12)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.06)"; e.target.style.boxShadow = "none"; }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{ width: "100%", padding: "14px", background: "#00e5bf", color: "#000", border: "none", borderRadius: "10px", fontFamily: "inherit", fontSize: "0.9rem", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", transition: "all 0.25s" }}
              >
                {loading ? (
                  <><span style={{ width: 16, height: 16, border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "#000", borderRadius: "50%", animation: "authSpin 0.7s linear infinite", display: "inline-block" }} />Enviando...</>
                ) : "Enviar enlace de recuperación"}
              </button>
            </form>
          </>
        )}

        <div style={{ marginTop: "40px", textAlign: "center" }}>
          <p style={{ fontSize: "0.72rem", color: "#33334a" }}>© 2026 ChronoShield</p>
        </div>
      </div>

      <style>{`
        @keyframes authFormReveal {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes authSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#050507" }} />}>
      <ForgotPasswordInner />
    </Suspense>
  );
}
