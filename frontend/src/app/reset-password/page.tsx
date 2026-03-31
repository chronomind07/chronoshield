"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { LogoFull } from "@/components/logos";
import { TRANSLATIONS, type Lang } from "@/lib/translations";

// ── Eye icons ────────────────────────────────────────────────────────────────
function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

// ── Check icon ────────────────────────────────────────────────────────────────
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner() {
  return <span className="auth-spinner" />;
}

// ── usePublicLang hook ────────────────────────────────────────────────────────
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

// ── Brand panel (left side) — identical to login ──────────────────────────────
function BrandPanel({ t, lang }: { t: (k: string) => string; lang: Lang }) {
  return (
    <div className="auth-brand">
      <div className="auth-brand-orb1" />
      <div className="auth-brand-orb2" />
      <div className="auth-scan" />
      <div className="brand-content">
        <div className="brand-logo">
          <LogoFull height={40} />
        </div>
        <h2 className="brand-headline">
          {lang === "es" ? <>Tu cuenta, bajo<br />tu <em>control</em></> : <>Your account, under<br />your <em>control</em></>}
        </h2>
        <p className="brand-sub">
          {t("auth.resetBrand.sub")}
        </p>
        <div className="brand-features">
          {[
            t("auth.resetBrand.f1"),
            t("auth.resetBrand.f2"),
            t("auth.resetBrand.f3"),
            t("auth.resetBrand.f4"),
          ].map((f) => (
            <div key={f} className="brand-feature">
              <div className="feature-check"><CheckIcon /></div>
              {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ResetPasswordPage() {
  const router = useRouter();
  const { lang, toggleLang, t } = usePublicLang();

  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd,         setShowPwd]         = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState("");
  const [done,            setDone]            = useState(false);

  // Session readiness: Supabase fires PASSWORD_RECOVERY when the hash is valid
  const [isReady,   setIsReady]   = useState(false);
  const [checking,  setChecking]  = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Primary: listen for the PASSWORD_RECOVERY event Supabase fires from hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && !cancelled) {
        setIsReady(true);
        setChecking(false);
      }
    });

    // Fallback: after 600ms check if a session already exists (e.g. token was
    // processed on a previous visit or by a fast client)
    const timer = setTimeout(async () => {
      if (cancelled) return;
      const { data } = await supabase.auth.getSession();
      if (data.session) setIsReady(true);
      setChecking(false);
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError(t("auth.validation.passwordShort"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("auth.validation.passwordMismatch"));
      return;
    }

    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      await supabase.auth.signOut();
      setDone(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "Error al cambiar la contraseña";
      setError(raw);
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="auth-layout">
        <BrandPanel t={t} lang={lang} />
        <div className="auth-form-panel">
          <div className="auth-container" style={{ textAlign: "center" }}>
            <div className="auth-success-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h1 className="auth-title" style={{ marginTop: 20, marginBottom: 10 }}>
              {t("auth.reset.successTitle")}
            </h1>
            <p style={{ fontSize: "0.9rem", color: "var(--auth-text-mid)", lineHeight: 1.7, marginBottom: 28 }}>
              {t("auth.reset.successMsg")}
            </p>
            <button className="form-submit" onClick={() => router.push("/login")}>
              {t("auth.reset.successBtn")}
            </button>
            <div className="auth-footer">
              <p>{t("auth.copyright")}</p>
              <button
                onClick={toggleLang}
                style={{ fontSize: "0.72rem", fontWeight: 600, color: "#55556a", background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", letterSpacing: "0.05em", transition: "all 0.2s", fontFamily: "var(--font-mono-family)", display: "block", margin: "8px auto 0" }}
              >
                {lang === "es" ? "EN" : "ES"}
              </button>
            </div>
          </div>
        </div>
        <style>{AUTH_STYLES}</style>
      </div>
    );
  }

  // ── Loading while Supabase processes the hash ───────────────────────────────
  if (checking) {
    return (
      <div style={{ minHeight: "100vh", background: "#050507", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, border: "2px solid rgba(0,229,191,0.2)", borderTopColor: "#00e5bf", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Expired / invalid link screen ───────────────────────────────────────────
  if (!isReady) {
    return (
      <div className="auth-layout">
        <BrandPanel t={t} lang={lang} />
        <div className="auth-form-panel">
          <div className="auth-container" style={{ textAlign: "center" }}>
            <div className="auth-success-icon" style={{ background: "rgba(255,77,106,0.08)", border: "1px solid rgba(255,77,106,0.15)", color: "var(--auth-red)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h1 className="auth-title" style={{ marginTop: 20, marginBottom: 10 }}>
              {t("auth.reset.expiredTitle")}
            </h1>
            <p style={{ fontSize: "0.9rem", color: "var(--auth-text-mid)", lineHeight: 1.7, marginBottom: 28 }}>
              {t("auth.reset.expiredMsg")}
            </p>
            <button className="form-submit" onClick={() => router.push("/forgot-password")}>
              {t("auth.reset.expiredBtn")}
            </button>
            <div className="auth-footer">
              <p>{t("auth.copyright")}</p>
              <button
                onClick={toggleLang}
                style={{ fontSize: "0.72rem", fontWeight: 600, color: "#55556a", background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", letterSpacing: "0.05em", transition: "all 0.2s", fontFamily: "var(--font-mono-family)", display: "block", margin: "8px auto 0" }}
              >
                {lang === "es" ? "EN" : "ES"}
              </button>
            </div>
          </div>
        </div>
        <style>{AUTH_STYLES}</style>
      </div>
    );
  }

  // ── Reset password form ─────────────────────────────────────────────────────
  return (
    <div className="auth-layout">
      <BrandPanel t={t} lang={lang} />
      <div className="auth-form-panel">
        <div className="auth-container">
          <div className="auth-header">
            <h1 className="auth-title">{t("auth.reset.title")}</h1>
            <p className="auth-subtitle">
              {t("auth.reset.subtitle")}
            </p>
          </div>

          {/* Error box */}
          {error && (
            <div className="form-error-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Nueva contraseña */}
            <div className="form-group">
              <label className="form-label">{t("auth.reset.newPassword")}</label>
              <div className="input-wrapper">
                <input
                  type={showPwd ? "text" : "password"}
                  className="form-input"
                  placeholder="••••••••"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                />
                <button
                  type="button"
                  className="input-toggle"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={t("auth.reset.showPassword")}
                >
                  {showPwd ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {/* Confirmar contraseña */}
            <div className="form-group">
              <label className="form-label">{t("auth.reset.confirmPassword")}</label>
              <div className="input-wrapper">
                <input
                  type={showPwd ? "text" : "password"}
                  className="form-input"
                  placeholder="••••••••"
                  required
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                />
              </div>
            </div>

            {/* Password strength hint */}
            {password.length > 0 && (
              <div style={{
                fontSize: "0.75rem",
                color: password.length >= 8 ? "var(--auth-accent)" : "var(--auth-text-dim)",
                marginTop: -12,
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}>
                <span style={{
                  display: "inline-block",
                  width: 6, height: 6,
                  borderRadius: "50%",
                  background: password.length >= 8 ? "var(--auth-accent)" : "var(--auth-text-faint)",
                }} />
                {password.length >= 8 ? t("auth.reset.passwordHintOk") : t("auth.reset.passwordHintMissing").replace("{n}", String(8 - password.length))}
              </div>
            )}

            <button
              type="submit"
              className="form-submit"
              disabled={loading}
            >
              {loading ? <><Spinner />{t("auth.reset.loading")}</> : t("auth.reset.submit")}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              <a href="/login">{t("auth.reset.backToLogin")}</a>
              <br />{t("auth.copyright")}
            </p>
            <button
              onClick={toggleLang}
              style={{ fontSize: "0.72rem", fontWeight: 600, color: "#55556a", background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", letterSpacing: "0.05em", transition: "all 0.2s", fontFamily: "var(--font-mono-family)", display: "block", margin: "8px auto 0" }}
            >
              {lang === "es" ? "EN" : "ES"}
            </button>
          </div>
        </div>
      </div>
      <style>{AUTH_STYLES}</style>
    </div>
  );
}

// ── Styles (identical to login page) ─────────────────────────────────────────
const AUTH_STYLES = `
  :root {
    --auth-bg-void:     #050507;
    --auth-bg-surface:  #0a0a0f;
    --auth-bg-card:     #0f0f16;
    --auth-bg-elevated: #1a1a26;
    --auth-bg-input:    #0c0c14;
    --auth-border-ghost:   rgba(255,255,255,0.03);
    --auth-border-whisper: rgba(255,255,255,0.06);
    --auth-border-soft:    rgba(255,255,255,0.10);
    --auth-border-focus:   rgba(0,229,191,0.30);
    --auth-text-bright: #f0f0f5;
    --auth-text-mid:    #9999ad;
    --auth-text-dim:    #55556a;
    --auth-text-faint:  #33334a;
    --auth-accent:      #00e5bf;
    --auth-accent-glow: rgba(0,229,191,0.12);
    --auth-accent-sec:  #6366f1;
    --auth-red:         #ff4d6a;
  }

  .auth-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    min-height: 100vh;
    background: var(--auth-bg-void);
    font-family: var(--font-jakarta-family, 'Plus Jakarta Sans', system-ui, sans-serif);
    position: relative;
  }
  .auth-layout::before {
    content: '';
    position: fixed; inset: 0; z-index: 9999;
    pointer-events: none; opacity: 0.018;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 256px;
  }

  .auth-brand {
    position: relative;
    display: flex; flex-direction: column;
    justify-content: center;
    padding: 60px 72px;
    overflow: hidden;
    background: var(--auth-bg-surface);
    border-right: 1px solid var(--auth-border-ghost);
  }
  .auth-brand::before {
    content: '';
    position: absolute; inset: 0;
    background-image:
      linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px),
      linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px);
    background-size: 60px 60px;
    mask-image: radial-gradient(ellipse 80% 70% at 50% 50%, black 20%, transparent 100%);
    pointer-events: none;
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
  .auth-scan {
    position: absolute;
    left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, var(--auth-accent), transparent);
    opacity: 0.08;
    animation: authScanDrift 8s ease-in-out infinite;
    pointer-events: none;
  }
  @keyframes authScanDrift {
    0%   { top: 15%; }
    50%  { top: 85%; }
    100% { top: 15%; }
  }

  .brand-content { position: relative; z-index: 2; }
  .brand-logo {
    display: flex; align-items: center; gap: 14px;
    margin-bottom: 56px;
  }
  .brand-headline {
    font-family: var(--font-serif-family, 'Instrument Serif', Georgia, serif);
    font-size: 3.2rem;
    font-weight: 400;
    line-height: 1.1;
    letter-spacing: -0.03em;
    color: var(--auth-text-bright);
    margin-bottom: 20px;
  }
  .brand-headline em {
    font-style: italic;
    background: linear-gradient(135deg, var(--auth-accent), #00ffd5);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .brand-sub {
    font-size: 1.05rem;
    color: var(--auth-text-mid);
    line-height: 1.7;
    max-width: 400px;
    margin-bottom: 48px;
  }
  .brand-features { display: flex; flex-direction: column; gap: 16px; }
  .brand-feature {
    display: flex; align-items: center; gap: 12px;
    font-size: 0.88rem; color: var(--auth-text-mid);
  }
  .feature-check {
    width: 28px; height: 28px; border-radius: 8px;
    background: var(--auth-accent-glow);
    border: 1px solid rgba(0,229,191,0.08);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    color: var(--auth-accent);
  }

  .auth-form-panel {
    display: flex; align-items: center; justify-content: center;
    padding: 60px;
  }
  .auth-container {
    width: 100%; max-width: 400px;
    animation: authFormReveal 0.7s cubic-bezier(0.16,1,0.3,1) both;
  }
  @keyframes authFormReveal {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .auth-header { margin-bottom: 36px; }
  .auth-title {
    font-family: var(--font-serif-family, 'Instrument Serif', Georgia, serif);
    font-size: 2rem;
    font-weight: 400;
    letter-spacing: -0.02em;
    color: var(--auth-text-bright);
    margin-bottom: 8px;
  }
  .auth-subtitle {
    font-size: 0.9rem;
    color: var(--auth-text-dim);
  }
  .auth-subtitle a {
    color: var(--auth-accent);
    text-decoration: none;
    font-weight: 600;
    transition: opacity 0.2s;
  }
  .auth-subtitle a:hover { opacity: 0.8; }

  .form-group { margin-bottom: 20px; }
  .form-label {
    display: block;
    font-size: 0.78rem; font-weight: 600;
    color: var(--auth-text-mid);
    margin-bottom: 8px; letter-spacing: 0.01em;
  }
  .form-input {
    width: 100%;
    padding: 12px 16px;
    background: var(--auth-bg-input);
    border: 1px solid var(--auth-border-whisper);
    border-radius: 10px;
    color: var(--auth-text-bright);
    font-family: inherit;
    font-size: 0.9rem;
    outline: none;
    transition: all 0.25s;
    -webkit-font-smoothing: antialiased;
    box-sizing: border-box;
  }
  .form-input::placeholder { color: var(--auth-text-faint); }
  .form-input:hover  { border-color: var(--auth-border-soft); }
  .form-input:focus  {
    border-color: var(--auth-border-focus);
    box-shadow: 0 0 0 3px var(--auth-accent-glow);
  }

  .input-wrapper { position: relative; }
  .input-wrapper .form-input { padding-right: 44px; }
  .input-toggle {
    position: absolute;
    right: 12px; top: 50%; transform: translateY(-50%);
    background: none; border: none;
    color: var(--auth-text-dim); cursor: pointer;
    padding: 4px; transition: color 0.2s;
    display: flex; align-items: center; justify-content: center;
  }
  .input-toggle:hover { color: var(--auth-text-mid); }

  .form-submit {
    width: 100%; padding: 14px;
    background: var(--auth-accent);
    color: #000; border: none;
    border-radius: 10px;
    font-family: inherit;
    font-size: 0.9rem; font-weight: 700;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.16,1,0.3,1);
    box-shadow: 0 0 24px var(--auth-accent-glow);
    position: relative; overflow: hidden;
    letter-spacing: -0.01em;
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .form-submit:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 0 40px rgba(0,229,191,0.2);
  }
  .form-submit:disabled { opacity: 0.6; cursor: not-allowed; }
  .form-submit::after {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
    transform: translateX(-100%);
    transition: transform 0.5s;
  }
  .form-submit:hover:not(:disabled)::after { transform: translateX(100%); }

  .form-error-box {
    display: flex; align-items: center; gap: 8px;
    padding: 12px 16px;
    background: rgba(255,77,106,0.06);
    border: 1px solid rgba(255,77,106,0.12);
    border-radius: 10px;
    font-size: 0.82rem;
    color: var(--auth-red);
    margin-bottom: 20px;
    animation: authErrorShake 0.4s ease;
  }
  @keyframes authErrorShake {
    0%, 100% { transform: translateX(0); }
    25%       { transform: translateX(-5px); }
    75%       { transform: translateX(5px); }
  }

  .auth-footer { margin-top: 40px; text-align: center; }
  .auth-footer p {
    font-size: 0.72rem; color: var(--auth-text-faint); line-height: 1.6;
  }
  .auth-footer a { color: var(--auth-text-dim); text-decoration: none; }
  .auth-footer a:hover { color: var(--auth-accent); }

  .auth-success-icon {
    width: 64px; height: 64px;
    border-radius: 50%;
    background: rgba(0,229,191,0.08);
    border: 1px solid rgba(0,229,191,0.15);
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto;
    color: var(--auth-accent);
  }

  .auth-spinner {
    display: inline-block;
    width: 16px; height: 16px;
    border: 2px solid rgba(0,0,0,0.3);
    border-top-color: #000;
    border-radius: 50%;
    animation: authSpin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes authSpin { to { transform: rotate(360deg); } }

  @media (max-width: 1024px) {
    .auth-layout { grid-template-columns: 1fr; }
    .auth-brand  { display: none; }
    .auth-form-panel { padding: 40px 24px; }
  }
`;
