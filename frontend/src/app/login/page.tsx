"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";
import { LogoFull } from "@/components/logos";

// ── Google colour SVG ────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

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

// ── Check icon for feature list ──────────────────────────────────────────────
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

// ── Spinner ──────────────────────────────────────────────────────────────────
function Spinner() {
  return <span className="auth-spinner" />;
}

// ── Main inner component (uses useSearchParams) ──────────────────────────────
function AuthPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const initialTab   = searchParams.get("tab") === "register" ? "register" : "login";

  const [mode,            setMode]           = useState<"login" | "register">(initialTab);
  const [email,           setEmail]          = useState("");
  const [password,        setPassword]       = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [companyName,     setCompanyName]    = useState("");
  const [showPwd,         setShowPwd]        = useState(false);
  const [terms,           setTerms]          = useState(false);
  const [loading,         setLoading]        = useState(false);
  const [googleLoading,   setGoogleLoading]  = useState(false);
  const [error,           setError]          = useState("");
  const [done,            setDone]           = useState(false);   // register success

  // Redirect if already authenticated
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  const clearError = () => setError("");

  const switchMode = useCallback((next: "login" | "register") => {
    setMode(next);
    clearError();
    setPassword("");
    setConfirmPassword("");
  }, []);

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      toast.success("¡Bienvenido a ChronoShield!");
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "Error de autenticación";
      const msg = raw.toLowerCase().includes("email not confirmed")
        ? "Debes confirmar tu email antes de acceder. Revisa tu bandeja de entrada."
        : raw.toLowerCase().includes("invalid login credentials")
        ? "Email o contraseña incorrectos."
        : raw;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Register ───────────────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (!terms) {
      setError("Debes aceptar los términos de servicio.");
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: companyName || email.split("@")[0] } },
      });
      if (err) throw err;
      setDone(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al crear la cuenta";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Google OAuth ───────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    clearError();
    setGoogleLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/dashboard` },
      });
      if (err) throw err;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error con Google";
      setError(msg);
      setGoogleLoading(false);
    }
  };

  // ── Registration success screen ────────────────────────────────────────────
  if (done) {
    return (
      <div className="auth-layout">
        <BrandPanel />
        <div className="auth-form-panel">
          <div className="auth-container" style={{ textAlign: "center" }}>
            <div className="auth-success-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h1 className="auth-title" style={{ marginTop: "20px", marginBottom: "10px" }}>¡Cuenta creada!</h1>
            <p style={{ fontSize: "0.9rem", color: "var(--auth-text-mid)", lineHeight: 1.7, marginBottom: "28px" }}>
              Hemos enviado un email de confirmación a{" "}
              <strong style={{ color: "var(--auth-text-bright)" }}>{email}</strong>.
              <br />Revisa tu bandeja de entrada y haz clic en el enlace para activar tu cuenta.
            </p>
            <button
              className="form-submit"
              onClick={() => { setDone(false); switchMode("login"); }}
            >
              Ir a iniciar sesión
            </button>
            <div className="auth-footer">
              <p>© 2026 ChronoShield</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-layout">
      {/* ── Left: branding ── */}
      <BrandPanel />

      {/* ── Right: form ── */}
      <div className="auth-form-panel">
        <div className="auth-container">
          {/* Header */}
          <div className="auth-header">
            <h1 className="auth-title">
              {mode === "login" ? "Bienvenido" : "Crear cuenta"}
            </h1>
            <p className="auth-subtitle">
              {mode === "login" ? (
                <>¿No tienes cuenta?{" "}
                  <a href="#" onClick={(e) => { e.preventDefault(); switchMode("register"); }}>
                    Crear una
                  </a>
                </>
              ) : (
                <>¿Ya tienes cuenta?{" "}
                  <a href="#" onClick={(e) => { e.preventDefault(); switchMode("login"); }}>
                    Inicia sesión
                  </a>
                </>
              )}
            </p>
          </div>

          {/* Tabs */}
          <div className="auth-tabs">
            <button
              className={`auth-tab${mode === "login" ? " active" : ""}`}
              onClick={() => switchMode("login")}
              type="button"
            >
              Iniciar sesión
            </button>
            <button
              className={`auth-tab${mode === "register" ? " active" : ""}`}
              onClick={() => switchMode("register")}
              type="button"
            >
              Crear cuenta
            </button>
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

          {/* Form */}
          <form onSubmit={mode === "login" ? handleLogin : handleRegister}>
            {/* Register only: company name */}
            {mode === "register" && (
              <div className="form-group">
                <label className="form-label">Nombre de empresa</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Tu empresa S.L."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
            )}

            {/* Email */}
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="tu@empresa.com"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearError(); }}
              />
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <div className="input-wrapper">
                <input
                  type={showPwd ? "text" : "password"}
                  className="form-input"
                  placeholder="••••••••"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError(); }}
                />
                <button
                  type="button"
                  className="input-toggle"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label="Mostrar contraseña"
                >
                  {showPwd ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {/* Register only: confirm + terms */}
            {mode === "register" && (
              <>
                <div className="form-group">
                  <label className="form-label">Confirmar contraseña</label>
                  <div className="input-wrapper">
                    <input
                      type={showPwd ? "text" : "password"}
                      className="form-input"
                      placeholder="••••••••"
                      required
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); clearError(); }}
                    />
                  </div>
                </div>

                <label className="form-check">
                  <input
                    type="checkbox"
                    checked={terms}
                    onChange={(e) => setTerms(e.target.checked)}
                  />
                  <span className="form-check-label">
                    Acepto los <a href="/terminos">términos de servicio</a> y la <a href="/privacidad">política de privacidad</a>
                  </span>
                </label>
              </>
            )}

            {/* Login only: remember + forgot */}
            {mode === "login" && (
              <div className="form-login-extras">
                <label className="form-check" style={{ marginBottom: 0 }}>
                  <input type="checkbox" defaultChecked />
                  <span className="form-check-label">Recordarme</span>
                </label>
                <Link href="/forgot-password" className="form-forgot-link">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="form-submit"
              disabled={loading}
            >
              {loading ? (
                <><Spinner />{mode === "login" ? "Entrando..." : "Creando cuenta..."}</>
              ) : (
                mode === "login" ? "Iniciar sesión" : "Crear cuenta"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="form-divider">
            <div className="form-divider-line" />
            <span className="form-divider-text">o continúa con</span>
            <div className="form-divider-line" />
          </div>

          {/* Google */}
          <button
            type="button"
            className="social-btn"
            onClick={handleGoogle}
            disabled={googleLoading}
          >
            {googleLoading ? <Spinner /> : <GoogleIcon />}
            Google
          </button>

          {/* Footer */}
          <div className="auth-footer">
            <p>
              Al continuar, aceptas nuestros <a href="/terminos">Términos</a> y <a href="/privacidad">Privacidad</a>
              <br />© 2026 ChronoShield
            </p>
          </div>
        </div>
      </div>

      {/* Styles */}
      <style>{AUTH_STYLES}</style>
    </div>
  );
}

// ── Brand panel (left side) ──────────────────────────────────────────────────
function BrandPanel() {
  return (
    <div className="auth-brand">
      <div className="auth-brand-orb1" />
      <div className="auth-brand-orb2" />
      <div className="auth-scan" />

      <div className="brand-content">
        {/* Logo */}
        <div className="brand-logo">
          <LogoFull height={40} />
        </div>

        {/* Headline */}
        <h2 className="brand-headline">
          Protege tu empresa<br />de forma <em>inteligente</em>
        </h2>
        <p className="brand-sub">
          Monitoreo de seguridad automatizado 24/7. Sin equipo técnico, sin complicaciones.
        </p>

        {/* Features */}
        <div className="brand-features">
          {[
            "Monitoreo SSL, uptime y email security",
            "Detección de brechas en dark web",
            "Extensión Chrome anti-phishing",
            "Alertas claras sin jerga técnica",
          ].map((f) => (
            <div key={f} className="brand-feature">
              <div className="feature-check">
                <CheckIcon />
              </div>
              {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
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

  /* Layout */
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

  /* ── Brand panel ── */
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
  .brand-icon {
    width: 44px; height: 44px;
    background: linear-gradient(135deg, var(--auth-accent), var(--auth-accent-sec));
    border-radius: 11px;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 0 24px var(--auth-accent-glow);
    flex-shrink: 0;
  }
  .brand-wordmark {
    font-family: var(--font-mono, 'Geist Mono', monospace);
    font-size: 0.88rem; font-weight: 600;
    letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--auth-text-bright);
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

  /* ── Form panel ── */
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

  /* Tabs */
  .auth-tabs {
    display: flex;
    background: var(--auth-bg-card);
    border: 1px solid var(--auth-border-ghost);
    border-radius: 10px;
    padding: 3px;
    margin-bottom: 32px;
  }
  .auth-tab {
    flex: 1; padding: 10px;
    text-align: center;
    font-size: 0.82rem; font-weight: 600;
    color: var(--auth-text-dim);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.25s;
    border: none; background: none;
    font-family: inherit;
  }
  .auth-tab:hover { color: var(--auth-text-mid); }
  .auth-tab.active {
    background: var(--auth-bg-elevated);
    color: var(--auth-text-bright);
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  }

  /* Form elements */
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

  /* Checkbox */
  .form-check {
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 24px; cursor: pointer;
  }
  .form-check input[type="checkbox"] {
    appearance: none; -webkit-appearance: none;
    width: 18px; height: 18px;
    border: 1px solid var(--auth-border-soft);
    border-radius: 5px;
    background: var(--auth-bg-input);
    cursor: pointer; position: relative;
    transition: all 0.2s; flex-shrink: 0;
  }
  .form-check input[type="checkbox"]:checked {
    background: var(--auth-accent); border-color: var(--auth-accent);
  }
  .form-check input[type="checkbox"]:checked::after {
    content: '✓';
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.7rem; font-weight: 800; color: #000;
  }
  .form-check-label { font-size: 0.82rem; color: var(--auth-text-mid); }
  .form-check-label a { color: var(--auth-accent); text-decoration: none; }

  /* Login extras row */
  .form-login-extras {
    display: flex; align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
  }
  .form-forgot-link {
    font-size: 0.78rem;
    color: var(--auth-text-dim);
    text-decoration: none;
    transition: color 0.2s;
  }
  .form-forgot-link:hover { color: var(--auth-accent); }

  /* Submit button */
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

  /* Error box */
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

  /* Divider */
  .form-divider {
    display: flex; align-items: center; gap: 16px;
    margin: 24px 0;
  }
  .form-divider-line { flex: 1; height: 1px; background: var(--auth-border-whisper); }
  .form-divider-text {
    font-size: 0.72rem; color: var(--auth-text-faint);
    text-transform: uppercase; letter-spacing: 0.1em; font-weight: 500;
  }

  /* Social button */
  .social-btn {
    width: 100%; padding: 12px;
    background: var(--auth-bg-card);
    border: 1px solid var(--auth-border-whisper);
    border-radius: 10px;
    color: var(--auth-text-mid);
    font-family: inherit;
    font-size: 0.85rem; font-weight: 600;
    cursor: pointer;
    transition: all 0.25s;
    display: flex; align-items: center; justify-content: center; gap: 10px;
  }
  .social-btn:hover:not(:disabled) {
    background: #14141d;
    border-color: var(--auth-border-soft);
    color: var(--auth-text-bright);
  }
  .social-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Footer */
  .auth-footer { margin-top: 40px; text-align: center; }
  .auth-footer p {
    font-size: 0.72rem; color: var(--auth-text-faint); line-height: 1.6;
  }
  .auth-footer a { color: var(--auth-text-dim); text-decoration: none; }
  .auth-footer a:hover { color: var(--auth-text-mid); }

  /* Success icon */
  .auth-success-icon {
    width: 64px; height: 64px;
    border-radius: 50%;
    background: rgba(0,229,191,0.08);
    border: 1px solid rgba(0,229,191,0.15);
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto;
    color: var(--auth-accent);
  }

  /* Spinner */
  .auth-spinner {
    display: inline-block;
    width: 16px; height: 16px;
    border: 2px solid rgba(0,0,0,0.3);
    border-top-color: #000;
    border-radius: 50%;
    animation: authSpin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes authSpin {
    to { transform: rotate(360deg); }
  }

  /* Responsive */
  @media (max-width: 1024px) {
    .auth-layout { grid-template-columns: 1fr; }
    .auth-brand  { display: none; }
    .auth-form-panel { padding: 40px 24px; }
  }
`;

// ── Page export (wrapped in Suspense for useSearchParams) ────────────────────
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#050507", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, border: "2px solid rgba(0,229,191,0.2)", borderTopColor: "#00e5bf", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      </div>
    }>
      <AuthPageInner />
    </Suspense>
  );
}
