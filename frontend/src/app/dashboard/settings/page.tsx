"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { settingsApi, billingApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Profile {
  full_name: string;
  company_name: string;
  email: string;
  org_id: string;
  language: "es" | "en";
  timezone: string;
  created_at: string | null;
}

interface NotifPrefs {
  email_alerts: boolean;
  alert_medium: boolean;
  weekly_report: boolean;
  alert_breach: boolean;
  alert_ssl_expiry: boolean;
  alert_ssl_invalid: boolean;
  alert_downtime: boolean;
  alert_email_security: boolean;
}

interface SubscriptionInfo {
  plan: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  has_stripe: boolean;
  credits_available: number;
  credits_used: number;
  credits_reset_date: string;
  billing_history: { date: string; amount: number; currency: string; description: string; invoice_url?: string }[];
}

type Tab = "general" | "account" | "subscription" | "notifications";

// ── Translations ───────────────────────────────────────────────────────────────
const T = {
  es: {
    title: "Ajustes",
    tabs: { general: "General", account: "Cuenta", subscription: "Suscripción", notifications: "Notificaciones" },
    save: "Guardar cambios",
    saving: "Guardando…",
    fullName: "Nombre y apellidos", email: "Email", language: "Idioma", timezone: "Zona horaria",
    langEs: "Español", langEn: "English",
    orgId: "ID de organización", orgIdHelp: "Usa este ID al contactar con soporte técnico.",
    activeSessions: "Sesiones activas", currentDevice: "Este dispositivo (sesión actual)",
    signOutOthers: "Cerrar todas las otras sesiones",
    changePassword: "Cambiar contraseña",
    currentPw: "Contraseña actual", newPw: "Nueva contraseña", confirmPw: "Confirmar nueva contraseña",
    updatePw: "Actualizar contraseña",
    signOut: "Cerrar sesión", signOutDesc: "Cierra tu sesión en este dispositivo.",
    dangerZone: "Zona de peligro",
    deleteAccount: "Eliminar cuenta",
    deleteDesc: "Esta acción es permanente e irreversible. Se borrarán todos tus datos, dominios, emails y resultados de escaneo.",
    deleteBtn: "Eliminar cuenta permanentemente",
    deleteModal: "Confirmación de eliminación",
    deleteModalDesc: "Esta acción NO se puede deshacer. Escribe",
    deleteModalConfirm: "para confirmar:",
    deleteModalBtn: "Eliminar mi cuenta",
    currentPlan: "Plan actual", renewal: "Próxima renovación",
    creditsAvail: "Créditos disponibles", creditsReset: "Reset",
    upgradeBtn: "Upgrade a Business", manageBtn: "Gestionar método de pago",
    billingHistory: "Historial de pagos", noBilling: "Sin pagos registrados aún.",
    cancelNote: "Tu suscripción se cancelará al final del período.",
    notifTitle: "Preferencias de notificación",
    notifCritical: "Alertas críticas por email",
    notifCriticalDesc: "SSL caducado, web caída, filtraciones graves. Siempre recomendado.",
    notifMedium: "Alertas medias por email",
    notifMediumDesc: "SSL próximo a caducar, SPF/DMARC no configurados.",
    notifWeekly: "Resumen semanal de seguridad",
    notifWeeklyDesc: "Un email cada lunes con el estado de tus dominios y emails.",
    savePrefs: "Guardar preferencias",
  },
  en: {
    title: "Settings",
    tabs: { general: "General", account: "Account", subscription: "Subscription", notifications: "Notifications" },
    save: "Save changes",
    saving: "Saving…",
    fullName: "Full name", email: "Email", language: "Language", timezone: "Timezone",
    langEs: "Español", langEn: "English",
    orgId: "Organization ID", orgIdHelp: "Use this ID when contacting technical support.",
    activeSessions: "Active sessions", currentDevice: "This device (current session)",
    signOutOthers: "Sign out all other sessions",
    changePassword: "Change password",
    currentPw: "Current password", newPw: "New password", confirmPw: "Confirm new password",
    updatePw: "Update password",
    signOut: "Sign out", signOutDesc: "Sign out from this device.",
    dangerZone: "Danger zone",
    deleteAccount: "Delete account",
    deleteDesc: "This action is permanent and irreversible. All your data, domains, emails and scan results will be deleted.",
    deleteBtn: "Delete account permanently",
    deleteModal: "Confirm deletion",
    deleteModalDesc: "This action CANNOT be undone. Type",
    deleteModalConfirm: "to confirm:",
    deleteModalBtn: "Delete my account",
    currentPlan: "Current plan", renewal: "Next renewal",
    creditsAvail: "Available credits", creditsReset: "Reset",
    upgradeBtn: "Upgrade to Business", manageBtn: "Manage payment method",
    billingHistory: "Payment history", noBilling: "No payments recorded yet.",
    cancelNote: "Your subscription will cancel at the end of the period.",
    notifTitle: "Notification preferences",
    notifCritical: "Critical alerts by email",
    notifCriticalDesc: "Expired SSL, site down, serious breaches. Always recommended.",
    notifMedium: "Medium alerts by email",
    notifMediumDesc: "SSL expiring soon, SPF/DMARC not configured.",
    notifWeekly: "Weekly security summary",
    notifWeeklyDesc: "An email every Monday with the status of your domains and emails.",
    savePrefs: "Save preferences",
  },
} as const;

// ── Common timezones ───────────────────────────────────────────────────────────
const TIMEZONES = [
  "Europe/Madrid", "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Rome",
  "Europe/Amsterdam", "Europe/Lisbon", "Europe/Zurich", "Europe/Warsaw",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Mexico_City", "America/Bogota", "America/Lima", "America/Santiago",
  "America/Buenos_Aires", "America/Sao_Paulo",
  "UTC",
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Plan Badge ─────────────────────────────────────────────────────────────────
function PlanBadge({ plan }: { plan: string }) {
  const map: Record<string, { label: string; color: string; bg: string; border: string }> = {
    business: { label: "Business", color: "#3ecf8e", bg: "rgba(62,207,142,0.08)", border: "rgba(62,207,142,0.2)" },
    starter:  { label: "Starter",  color: "#3ecf8e", bg: "rgba(62,207,142,0.06)", border: "rgba(62,207,142,0.15)" },
    trial:    { label: "Trial",    color: "#71717a", bg: "rgba(113,113,122,0.08)", border: "rgba(113,113,122,0.18)" },
  };
  const s = map[plan] ?? map.trial;
  return (
    <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.6rem", textTransform: "uppercase" as const, letterSpacing: "0.12em", padding: "3px 10px", borderRadius: 20, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
      {s.label}
    </span>
  );
}

// ── Toggle Switch ──────────────────────────────────────────────────────────────
function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{ width: 44, height: 24, borderRadius: 12, background: checked ? "#3ecf8e" : "#3a3a3a", border: "none", cursor: disabled ? "default" : "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0, opacity: disabled ? 0.4 : 1, padding: 0 }}
    >
      <span style={{ position: "absolute", top: 3, left: checked ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: checked ? "#000" : "#6b6b6b", transition: "left 0.2s", display: "block" }} />
    </button>
  );
}

// ── Section Card ───────────────────────────────────────────────────────────────
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, marginBottom: 12, overflow: "hidden" }}>
      <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#f0f0f0", fontFamily: "var(--font-dm-sans)" }}>{title}</div>
      </div>
      <div style={{ padding: "0 24px" }}>{children}</div>
    </div>
  );
}

// ── Setting Row ────────────────────────────────────────────────────────────────
function SettingRow({ label, help, children, last }: { label: string; help?: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: last ? "none" : "1px solid rgba(255,255,255,0.04)", gap: 16 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "0.82rem", fontWeight: 500, color: "#f0f0f0", fontFamily: "var(--font-dm-sans)" }}>{label}</div>
        {help && <div style={{ fontSize: "0.72rem", color: "#52525b", marginTop: 2, fontFamily: "var(--font-dm-sans)" }}>{help}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

// ── Styled Input ───────────────────────────────────────────────────────────────
function StyledInput({ value, onChange, placeholder, readOnly, type = "text" }: { value: string; onChange?: (v: string) => void; placeholder?: string; readOnly?: boolean; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      readOnly={readOnly}
      placeholder={placeholder}
      style={{ padding: "10px 14px", background: readOnly ? "rgba(255,255,255,0.02)" : "#161616", border: `1px solid ${readOnly ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)"}`, borderRadius: 8, color: readOnly ? "#52525b" : "#f0f0f0", fontFamily: "var(--font-dm-sans)", fontSize: "0.84rem", outline: "none", transition: "border-color 0.2s", width: 240, boxSizing: "border-box" as const }}
      onFocus={readOnly ? undefined : (e) => { e.currentTarget.style.borderColor = "rgba(62,207,142,0.3)"; }}
      onBlur={readOnly ? undefined : (e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
    />
  );
}

// ── Primary Button ─────────────────────────────────────────────────────────────
function PrimaryButton({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding: "9px 18px", background: "#3ecf8e", color: "#000", fontWeight: 700, fontSize: "0.82rem", borderRadius: 8, border: "none", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, transition: "opacity 0.2s", fontFamily: "var(--font-dm-sans)" }}>
      {children}
    </button>
  );
}

// ── Secondary Button ───────────────────────────────────────────────────────────
function SecondaryButton({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding: "9px 18px", background: "#1c1c1c", color: "#a1a1aa", fontWeight: 500, fontSize: "0.82rem", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, transition: "opacity 0.2s", fontFamily: "var(--font-dm-sans)" }}>
      {children}
    </button>
  );
}

// ── Delete Modal ───────────────────────────────────────────────────────────────
function DeleteModal({ lang, onConfirm, onClose }: { lang: "es" | "en"; onConfirm: () => void; onClose: () => void }) {
  const t = T[lang];
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(10,10,10,0.88)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 380, borderRadius: 12, padding: 28, background: "#1c1c1c", border: "1px solid rgba(239,68,68,0.2)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(239,68,68,0.08)", marginBottom: 18, fontSize: 18 }}>⚠️</div>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#ef4444", marginBottom: 8, fontFamily: "var(--font-dm-sans)" }}>{t.deleteModal}</h2>
        <p style={{ fontSize: "0.78rem", color: "#52525b", marginBottom: 20, lineHeight: 1.6, fontFamily: "var(--font-dm-sans)" }}>
          {t.deleteModalDesc} <span style={{ fontFamily: "var(--font-dm-mono)", fontWeight: 700, color: "#f0f0f0" }}>ELIMINAR</span> {t.deleteModalConfirm}
        </p>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="ELIMINAR"
          style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: "0.84rem", fontFamily: "var(--font-dm-mono)", outline: "none", marginBottom: 16, boxSizing: "border-box" as const, background: "#161616", border: `1px solid ${text === "ELIMINAR" ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.08)"}`, color: "#f0f0f0", transition: "border-color 0.2s" }}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 8, fontSize: "0.82rem", fontWeight: 500, color: "#a1a1aa", background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}>
            Cancelar
          </button>
          <button onClick={handleDelete} disabled={text !== "ELIMINAR" || deleting} style={{ flex: 1, padding: "10px 0", borderRadius: 8, fontSize: "0.82rem", fontWeight: 700, color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", cursor: "pointer", opacity: (text !== "ELIMINAR" || deleting) ? 0.4 : 1, fontFamily: "var(--font-dm-sans)", transition: "opacity 0.2s" }}>
            {deleting ? "Eliminando…" : t.deleteModalBtn}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab: General ──────────────────────────────────────────────────────────────
function TabGeneral({ profile, lang, onChange, onSave, saving }: { profile: Profile; lang: "es" | "en"; onChange: (p: Partial<Profile>) => void; onSave: () => void; saving: boolean }) {
  const t = T[lang];
  return (
    <div>
      <SectionCard title={t.tabs.general}>
        <SettingRow label={t.fullName}>
          <StyledInput value={profile.full_name} onChange={(v) => onChange({ full_name: v })} placeholder="Tu nombre" />
        </SettingRow>
        <SettingRow label={t.email}>
          <StyledInput value={profile.email} readOnly />
        </SettingRow>
        <SettingRow label={t.language}>
          <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#161616" }}>
            {(["es", "en"] as const).map((l) => (
              <button
                key={l}
                onClick={() => onChange({ language: l })}
                style={{ padding: "9px 16px", fontSize: "0.82rem", fontWeight: 600, border: "none", cursor: "pointer", transition: "all 0.15s", color: lang === l ? "#3ecf8e" : "#52525b", background: lang === l ? "rgba(62,207,142,0.1)" : "transparent", fontFamily: "var(--font-dm-sans)" }}
              >
                {l === "es" ? "ES " + t.langEs : "EN " + t.langEn}
              </button>
            ))}
          </div>
        </SettingRow>
        <SettingRow label={t.timezone} last>
          <select
            value={profile.timezone}
            onChange={(e) => onChange({ timezone: e.target.value })}
            style={{ padding: "10px 14px", background: "#161616", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#f0f0f0", fontFamily: "var(--font-dm-sans)", fontSize: "0.84rem", outline: "none", width: 240, cursor: "pointer" }}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz} style={{ background: "#1c1c1c" }}>{tz}</option>
            ))}
          </select>
        </SettingRow>
      </SectionCard>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
        <PrimaryButton onClick={onSave} disabled={saving}>{saving ? t.saving : t.save}</PrimaryButton>
      </div>
    </div>
  );
}

// ── Tab: Account ──────────────────────────────────────────────────────────────
function TabAccount({ profile, lang, onSignOut, onDelete }: { profile: Profile; lang: "es" | "en"; onSignOut: () => void; onDelete: () => void }) {
  const t = T[lang];
  const [pw, setPw] = useState({ current: "", new: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [soLoading, setSoLoading] = useState(false);

  const handleChangePw = async () => {
    if (pw.new !== pw.confirm) return toast.error("Las contraseñas no coinciden");
    if (pw.new.length < 8) return toast.error("La contraseña debe tener al menos 8 caracteres");
    setPwSaving(true);
    try {
      await settingsApi.changePassword({ current_password: pw.current, new_password: pw.new });
      toast.success("Contraseña actualizada");
      setPw({ current: "", new: "", confirm: "" });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      toast.error(e?.response?.data?.detail || "Error al cambiar la contraseña");
    } finally {
      setPwSaving(false);
    }
  };

  const handleSignOutOthers = async () => {
    setSoLoading(true);
    try {
      await settingsApi.signOutOthers();
      toast.success("Otras sesiones cerradas");
    } catch { toast.error("Error al cerrar sesiones"); }
    finally { setSoLoading(false); }
  };

  return (
    <div>
      {/* Org ID */}
      <SectionCard title={t.orgId}>
        <div style={{ padding: "16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <code style={{ flex: 1, fontFamily: "var(--font-dm-mono)", fontSize: "0.78rem", color: "#a1a1aa", padding: "9px 12px", borderRadius: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, background: "#161616", border: "1px solid rgba(255,255,255,0.06)", minWidth: 0 }}>
              {profile.org_id}
            </code>
            <button
              onClick={() => { navigator.clipboard.writeText(profile.org_id); toast.success("Copiado"); }}
              style={{ padding: "9px 14px", borderRadius: 8, fontSize: "0.78rem", fontWeight: 600, color: "#a1a1aa", background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", flexShrink: 0, fontFamily: "var(--font-dm-sans)" }}
            >
              Copiar
            </button>
          </div>
          <p style={{ fontSize: "0.72rem", color: "#52525b", fontFamily: "var(--font-dm-sans)", margin: 0 }}>{t.orgIdHelp}</p>
        </div>
      </SectionCard>

      {/* Sessions */}
      <SectionCard title={t.activeSessions}>
        <div style={{ padding: "16px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, marginBottom: 14, background: "#161616", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, background: "rgba(62,207,142,0.06)", flexShrink: 0 }}>💻</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.84rem", fontWeight: 500, color: "#f0f0f0", fontFamily: "var(--font-dm-sans)" }}>{t.currentDevice}</div>
              <div style={{ fontSize: "0.72rem", color: "#52525b", marginTop: 2, fontFamily: "var(--font-dm-sans)" }}>{new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}</div>
            </div>
            <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.6rem", padding: "3px 8px", borderRadius: 20, background: "rgba(34,197,94,0.08)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.15)", letterSpacing: "0.08em" }}>ACTIVA</span>
          </div>
          <button
            onClick={handleSignOutOthers}
            disabled={soLoading}
            style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", fontWeight: 600, padding: "9px 16px", borderRadius: 8, cursor: "pointer", color: "#f59e0b", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", opacity: soLoading ? 0.5 : 1, fontFamily: "var(--font-dm-sans)", transition: "opacity 0.2s" }}
          >
            {soLoading ? "⟳ " : "⊘ "}{t.signOutOthers}
          </button>
        </div>

        {/* Change password */}
        <div style={{ padding: "16px 0 20px" }}>
          <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#f0f0f0", marginBottom: 14, fontFamily: "var(--font-dm-sans)" }}>{t.changePassword}</div>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
            {[
              { key: "current", label: t.currentPw },
              { key: "new",     label: t.newPw },
              { key: "confirm", label: t.confirmPw },
            ].map((f) => (
              <div key={f.key}>
                <label style={{ fontSize: "0.72rem", color: "#52525b", display: "block", marginBottom: 5, fontFamily: "var(--font-dm-sans)" }}>{f.label}</label>
                <input
                  type="password"
                  value={pw[f.key as keyof typeof pw]}
                  onChange={(e) => setPw((p) => ({ ...p, [f.key]: e.target.value }))}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: "0.84rem", outline: "none", boxSizing: "border-box" as const, background: "#161616", border: "1px solid rgba(255,255,255,0.08)", color: "#f0f0f0", fontFamily: "var(--font-dm-sans)", transition: "border-color 0.2s" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(62,207,142,0.3)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
                />
              </div>
            ))}
            <button
              onClick={handleChangePw}
              disabled={pwSaving || !pw.current || !pw.new || !pw.confirm}
              style={{ alignSelf: "flex-start", marginTop: 4, padding: "9px 20px", borderRadius: 8, fontSize: "0.82rem", fontWeight: 700, color: "#000", background: "#3ecf8e", border: "none", cursor: "pointer", opacity: (pwSaving || !pw.current || !pw.new || !pw.confirm) ? 0.4 : 1, fontFamily: "var(--font-dm-sans)", transition: "opacity 0.2s" }}
            >
              {pwSaving ? "Actualizando…" : t.updatePw}
            </button>
          </div>
        </div>
      </SectionCard>

      {/* Sign out */}
      <SectionCard title={t.signOut}>
        <div style={{ padding: "16px 0" }}>
          <p style={{ fontSize: "0.78rem", color: "#52525b", marginBottom: 14, fontFamily: "var(--font-dm-sans)", margin: "0 0 14px" }}>{t.signOutDesc}</p>
          <SecondaryButton onClick={onSignOut}>Cerrar sesión</SecondaryButton>
        </div>
      </SectionCard>

      {/* Danger zone */}
      <div style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.12)", borderRadius: 12, padding: "20px 24px", marginTop: 4 }}>
        <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "#ef4444", marginBottom: 6, fontFamily: "var(--font-dm-sans)" }}>{t.dangerZone}</div>
        <div style={{ fontSize: "0.78rem", color: "#52525b", marginBottom: 16, lineHeight: 1.6, maxWidth: 480, fontFamily: "var(--font-dm-sans)" }}>{t.deleteDesc}</div>
        <button
          onClick={onDelete}
          style={{ padding: "9px 18px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8, color: "#ef4444", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}
        >
          {t.deleteBtn}
        </button>
      </div>
    </div>
  );
}

// ── Tab: Subscription ─────────────────────────────────────────────────────────
function TabSubscription({ info, lang }: { info: SubscriptionInfo; lang: "es" | "en" }) {
  const t = T[lang];
  const [portalLoading, setPortalLoading] = useState(false);

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const res = await billingApi.portal();
      window.location.href = res.data.url;
    } catch { toast.error("Error al abrir el portal de pagos"); }
    finally { setPortalLoading(false); }
  };

  const handleUpgrade = async () => {
    try {
      const res = await billingApi.checkout("business");
      window.location.href = res.data.url;
    } catch { toast.error("Error al iniciar el upgrade"); }
  };

  const totalCredits = info.credits_available + info.credits_used;
  const creditPct = totalCredits > 0 ? info.credits_available / totalCredits : 1;
  const creditColor = info.credits_available > 2 ? "#3ecf8e" : info.credits_available > 0 ? "#f59e0b" : "#ef4444";

  return (
    <div>
      {/* Plan card */}
      <div style={{ background: "#1c1c1c", border: "1px solid rgba(62,207,142,0.12)", borderRadius: 12, padding: "22px 24px", marginBottom: 12 }}>
        <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "#52525b", marginBottom: 10, fontFamily: "var(--font-dm-mono)", textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>{t.currentPlan}</div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap" as const, gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: "1.4rem", fontWeight: 700, color: "#f0f0f0", fontFamily: "var(--font-dm-sans)" }}>
                {info.plan.charAt(0).toUpperCase() + info.plan.slice(1)}
              </span>
              <PlanBadge plan={info.plan} />
              {info.cancel_at_period_end && (
                <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.6rem", padding: "3px 8px", borderRadius: 20, color: "#f59e0b", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)" }}>
                  {t.cancelNote}
                </span>
              )}
            </div>
            <div style={{ fontSize: "0.82rem", color: "#a1a1aa", fontFamily: "var(--font-dm-sans)" }}>
              {info.plan === "business" ? "59€/mes" : info.plan === "starter" ? "29€/mes" : "—"}
            </div>
            {info.current_period_end && (
              <div style={{ fontSize: "0.78rem", color: "#52525b", marginTop: 6, fontFamily: "var(--font-dm-sans)" }}>
                {t.renewal}: <span style={{ color: "#a1a1aa" }}>{fmtDate(info.current_period_end)}</span>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const }}>
            {info.plan !== "business" && <PrimaryButton onClick={handleUpgrade}>{t.upgradeBtn}</PrimaryButton>}
            {info.has_stripe && <SecondaryButton onClick={handlePortal} disabled={portalLoading}>{portalLoading ? "⟳" : t.manageBtn}</SecondaryButton>}
          </div>
        </div>
      </div>

      {/* Credits */}
      <SectionCard title={t.creditsAvail}>
        <div style={{ padding: "16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
                <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "1.8rem", fontWeight: 700, color: creditColor, lineHeight: 1 }}>{info.credits_available}</span>
                <span style={{ fontSize: "0.82rem", color: "#52525b", fontFamily: "var(--font-dm-sans)" }}>/ {totalCredits}</span>
              </div>
              <div style={{ height: 4, borderRadius: 4, overflow: "hidden", background: "rgba(255,255,255,0.05)" }}>
                <div style={{ height: "100%", borderRadius: 4, transition: "width 0.7s", width: `${creditPct * 100}%`, background: creditColor }} />
              </div>
            </div>
            <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
              <div style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.6rem", textTransform: "uppercase" as const, letterSpacing: "0.1em", color: "#52525b", marginBottom: 4 }}>{t.creditsReset}</div>
              <div style={{ fontSize: "0.82rem", color: "#a1a1aa", fontFamily: "var(--font-dm-sans)" }}>{info.credits_reset_date || "—"}</div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Billing history */}
      <SectionCard title={t.billingHistory}>
        <div style={{ padding: "8px 0" }}>
          {info.billing_history.length === 0 ? (
            <p style={{ fontSize: "0.82rem", color: "#52525b", padding: "10px 0", fontFamily: "var(--font-dm-sans)", margin: 0 }}>{t.noBilling}</p>
          ) : (
            <div>
              {info.billing_history.map((inv, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: i < info.billing_history.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.84rem", fontWeight: 500, color: "#f0f0f0", fontFamily: "var(--font-dm-sans)" }}>{inv.description}</div>
                    <div style={{ fontSize: "0.72rem", color: "#52525b", marginTop: 2, fontFamily: "var(--font-dm-sans)" }}>{fmtDate(inv.date)}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                    <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.9rem", fontWeight: 700, color: "#3ecf8e" }}>
                      {inv.amount.toFixed(2)} {inv.currency}
                    </span>
                    {inv.invoice_url && (
                      <a href={inv.invoice_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.72rem", fontWeight: 600, padding: "3px 10px", borderRadius: 6, color: "#a1a1aa", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", textDecoration: "none", fontFamily: "var(--font-dm-sans)" }}>
                        PDF
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

// ── Tab: Notifications ────────────────────────────────────────────────────────
function TabNotifications({ prefs, lang, onChange, onSave, saving }: { prefs: NotifPrefs; lang: "es" | "en"; onChange: (p: Partial<NotifPrefs>) => void; onSave: () => void; saving: boolean }) {
  const t = T[lang];

  const mainToggles = [
    { key: "email_alerts",  label: t.notifCritical, desc: t.notifCriticalDesc, alwaysOn: true },
    { key: "alert_medium",  label: t.notifMedium,   desc: t.notifMediumDesc },
    { key: "weekly_report", label: t.notifWeekly,   desc: t.notifWeeklyDesc },
  ];

  return (
    <div>
      <SectionCard title={t.notifTitle}>
        {mainToggles.map((item, idx) => (
          <div key={item.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", borderBottom: idx < mainToggles.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", gap: 16 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 500, color: "#f0f0f0", fontFamily: "var(--font-dm-sans)" }}>{item.label}</span>
                {item.alwaysOn && (
                  <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.6rem", padding: "2px 7px", borderRadius: 4, background: "rgba(62,207,142,0.08)", color: "#3ecf8e", border: "1px solid rgba(62,207,142,0.15)", letterSpacing: "0.08em" }}>
                    RECOMENDADO
                  </span>
                )}
              </div>
              <p style={{ fontSize: "0.72rem", color: "#52525b", lineHeight: 1.5, margin: 0, fontFamily: "var(--font-dm-sans)" }}>{item.desc}</p>
            </div>
            <ToggleSwitch checked={prefs[item.key as keyof NotifPrefs]} onChange={(v) => onChange({ [item.key]: v })} />
          </div>
        ))}
      </SectionCard>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
        <PrimaryButton onClick={onSave} disabled={saving}>{saving ? T[lang].saving : t.savePrefs}</PrimaryButton>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const router = useRouter();

  const [tab, setTab]               = useState<Tab>("general");
  const [profile, setProfile]       = useState<Profile | null>(null);
  const [notifs, setNotifs]         = useState<NotifPrefs | null>(null);
  const [subInfo, setSubInfo]       = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const lang: "es" | "en" = (profile?.language as "es" | "en") ?? "es";
  const t = T[lang];

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, nRes, sRes] = await Promise.all([
        settingsApi.getProfile(),
        settingsApi.getNotifications(),
        settingsApi.getSubscription(),
      ]);
      setProfile(pRes.data);
      setNotifs(nRes.data);
      setSubInfo(sRes.data);
    } catch {
      toast.error("Error al cargar los ajustes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await settingsApi.updateProfile({ full_name: profile.full_name, language: profile.language, timezone: profile.timezone });
      toast.success("Perfil actualizado");
    } catch { toast.error("Error al guardar el perfil"); }
    finally { setSaving(false); }
  };

  const handleSaveNotifs = async () => {
    if (!notifs) return;
    setSaving(true);
    try {
      await settingsApi.updateNotifications(notifs as unknown as Record<string, boolean>);
      toast.success("Preferencias guardadas");
    } catch { toast.error("Error al guardar las preferencias"); }
    finally { setSaving(false); }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const handleDeleteAccount = async () => {
    try {
      await settingsApi.deleteAccount("ELIMINAR");
      await supabase.auth.signOut();
      router.replace("/login");
      toast.success("Cuenta eliminada");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      toast.error(e?.response?.data?.detail || "Error al eliminar la cuenta");
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 256, background: "#0a0a0a" }}>
        <div style={{ width: 26, height: 26, border: "2px solid #3ecf8e", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  if (!profile || !notifs || !subInfo) return null;

  const TABS: { key: Tab; label: string }[] = [
    { key: "general",       label: t.tabs.general },
    { key: "account",       label: t.tabs.account },
    { key: "subscription",  label: t.tabs.subscription },
    { key: "notifications", label: t.tabs.notifications },
  ];

  return (
    <div style={{ padding: "28px 32px 60px", background: "#0a0a0a", minHeight: "100vh", fontFamily: "var(--font-dm-sans)", maxWidth: 820, margin: "0 auto" }}>
      {showDelete && (
        <DeleteModal lang={lang} onConfirm={handleDeleteAccount} onClose={() => setShowDelete(false)} />
      )}

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#f0f0f0", fontFamily: "var(--font-dm-sans)", margin: "0 0 4px" }}>{t.title}</h1>
        <p style={{ color: "#52525b", fontSize: "0.8rem", fontFamily: "var(--font-dm-sans)", margin: 0 }}>
          {profile.email}{profile.company_name ? ` · ${profile.company_name}` : ""}
        </p>
      </div>

      {/* Pill tab bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 24, padding: "4px", background: "#161616", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", width: "fit-content" }}>
        {TABS.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            style={{ padding: "7px 16px", fontSize: "0.82rem", fontWeight: 600, borderRadius: 7, border: "none", cursor: "pointer", transition: "all 0.15s", fontFamily: "var(--font-dm-sans)", color: tab === tb.key ? "#3ecf8e" : "#52525b", background: tab === tb.key ? "rgba(62,207,142,0.1)" : "transparent" }}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === "general" && (
          <TabGeneral profile={profile} lang={lang} onChange={(p) => setProfile((prev) => prev ? { ...prev, ...p } : prev)} onSave={handleSaveProfile} saving={saving} />
        )}
        {tab === "account" && (
          <TabAccount profile={profile} lang={lang} onSignOut={handleSignOut} onDelete={() => setShowDelete(true)} />
        )}
        {tab === "subscription" && <TabSubscription info={subInfo} lang={lang} />}
        {tab === "notifications" && (
          <TabNotifications prefs={notifs} lang={lang} onChange={(p) => setNotifs((prev) => prev ? { ...prev, ...p } : prev)} onSave={handleSaveNotifs} saving={saving} />
        )}
      </div>
    </div>
  );
}
