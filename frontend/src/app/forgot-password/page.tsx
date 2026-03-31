"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { TRANSLATIONS, type Lang } from "@/lib/translations";

function usePublicLang() {
  const [lang, setLang] = useState<Lang>("es");
  useEffect(() => {
    try {
      const stored = localStorage.getItem("cs_lang") as Lang;
      if (stored === "en" || stored === "es") setLang(stored);
    } catch {}
  }, []);
  const toggleLang = () => {
    const next: Lang = lang === "es" ? "en" : "es";
    setLang(next);
    try { localStorage.setItem("cs_lang", next); } catch {}
  };
  const t = (key: string) => TRANSLATIONS[lang][key] ?? key;
  return { lang, toggleLang, t };
}

function ForgotPasswordInner() {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState("");
  const { lang, toggleLang, t } = usePublicLang();

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
    <div style={{ minHeight: "100vh", background: "#050507", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "var(--font-jakarta-family,'Plus Jakarta Sans',system-ui,sans-serif)", position: "relative", overflow: "hidden" }} className="auth-layout">
      {/* Ambient orbs */}
      <div className="auth-brand-orb1" />
      <div className="auth-brand-orb2" />

      <div style={{ width: "100%", maxWidth: 400, animation: "authFormReveal 0.6s cubic-bezier(0.16,1,0.3,1) both", position: "relative", zIndex: 1 }}>
        {/* Back */}
        <Link href="/login" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", color: "#55556a", textDecoration: "none", marginBottom: "32px", transition: "color 0.2s" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#00e5bf")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#55556a")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          {t("auth.forgot.backToLogin")}
        </Link>

        {done ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(0,229,191,0.08)", border: "1px solid rgba(0,229,191,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", color: "#00e5bf" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h1 style={{ fontFamily: "var(--font-serif-family,'Instrument Serif',Georgia,serif)", fontSize: "1.8rem", fontWeight: 400, color: "#f0f0f5", marginBottom: "12px", letterSpacing: "-0.02em" }}>{t("auth.forgot.successTitle")}</h1>
            <p style={{ fontSize: "0.9rem", color: "#9999ad", lineHeight: 1.7, marginBottom: "28px" }}>
              {t("auth.forgot.successMsg")}
            </p>
            <Link href="/login" style={{ display: "block", textAlign: "center", padding: "14px", background: "#00e5bf", color: "#000", borderRadius: "10px", fontWeight: 700, fontSize: "0.9rem", textDecoration: "none" }}>
              {t("auth.forgot.backToLoginBtn")}
            </Link>
          </div>
        ) : (
          <>
            <h1 style={{ fontFamily: "var(--font-serif-family,'Instrument Serif',Georgia,serif)", fontSize: "2rem", fontWeight: 400, color: "#f0f0f5", marginBottom: "8px", letterSpacing: "-0.02em" }}>
              {t("auth.forgot.title")}
            </h1>
            <p style={{ fontSize: "0.9rem", color: "#55556a", marginBottom: "32px" }}>
              {t("auth.forgot.subtitle")}
            </p>

            {error && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 16px", background: "rgba(255,77,106,0.06)", border: "1px solid rgba(255,77,106,0.12)", borderRadius: "10px", fontSize: "0.82rem", color: "#ff4d6a", marginBottom: "20px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#9999ad", marginBottom: "8px" }}>{t("auth.forgot.email")}</label>
                <input
                  type="email" required
                  placeholder={t("auth.forgot.emailPlaceholder")}
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
                  <><span style={{ width: 16, height: 16, border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "#000", borderRadius: "50%", animation: "authSpin 0.7s linear infinite", display: "inline-block" }} />{t("auth.forgot.loading")}</>
                ) : t("auth.forgot.submit")}
              </button>
            </form>
          </>
        )}

        <div style={{ marginTop: "40px", textAlign: "center" }}>
          <p style={{ fontSize: "0.72rem", color: "#33334a" }}>{t("auth.copyright")}</p>
          <button
            onClick={toggleLang}
            style={{ fontSize: "0.72rem", fontWeight: 600, color: "#55556a", background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", letterSpacing: "0.05em", transition: "all 0.2s", fontFamily: "var(--font-mono-family)", display: "block", margin: "8px auto 0" }}
          >
            {lang === "es" ? "EN" : "ES"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes authFormReveal {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes authSpin { to { transform: rotate(360deg); } }
        .auth-layout::before {
          content: '';
          position: fixed; inset: 0; z-index: 9999;
          pointer-events: none; opacity: 0.018;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 256px;
        }
        .auth-brand-orb1 {
          position: absolute;
          width: 600px; height: 600px;
          top: -200px; left: -150px;
          background: radial-gradient(circle, rgba(0,229,191,0.04) 0%, transparent 70%);
          animation: authOrbFloat 16s ease-in-out infinite;
          pointer-events: none;
        }
        .auth-brand-orb2 {
          position: absolute;
          width: 400px; height: 400px;
          bottom: -100px; right: -100px;
          background: radial-gradient(circle, rgba(99,102,241,0.03) 0%, transparent 70%);
          animation: authOrbFloat 22s ease-in-out infinite reverse;
          pointer-events: none;
        }
        @keyframes authOrbFloat {
          0%, 100% { transform: translate(0,0) scale(1); }
          50%       { transform: translate(30px,20px) scale(1.1); }
        }
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
