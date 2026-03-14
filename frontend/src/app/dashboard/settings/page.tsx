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
    // General
    fullName: "Nombre y apellidos", email: "Email", language: "Idioma", timezone: "Zona horaria",
    langEs: "Español", langEn: "English",
    // Account
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
    // Subscription
    currentPlan: "Plan actual", renewal: "Próxima renovación",
    creditsAvail: "Créditos disponibles", creditsReset: "Reset",
    upgradeBtn: "Upgrade a Business", manageBtn: "Gestionar método de pago",
    billingHistory: "Historial de pagos", noBilling: "Sin pagos registrados aún.",
    cancelNote: "Tu suscripción se cancelará al final del período.",
    // Notifications
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
    // General
    fullName: "Full name", email: "Email", language: "Language", timezone: "Timezone",
    langEs: "Español", langEn: "English",
    // Account
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
    // Subscription
    currentPlan: "Current plan", renewal: "Next renewal",
    creditsAvail: "Available credits", creditsReset: "Reset",
    upgradeBtn: "Upgrade to Business", manageBtn: "Manage payment method",
    billingHistory: "Payment history", noBilling: "No payments recorded yet.",
    cancelNote: "Your subscription will cancel at the end of the period.",
    // Notifications
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

function PlanBadge({ plan }: { plan: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    business: { label: "Business", color: "#00C2FF", bg: "rgba(0,194,255,0.12)" },
    starter:  { label: "Starter",  color: "#00E5A0", bg: "rgba(0,229,160,0.1)" },
    trial:    { label: "Trial",    color: "#5A6B7A", bg: "rgba(90,107,122,0.1)" },
  };
  const s = map[plan] ?? map.trial;
  return (
    <span
      className="font-mono text-[10px] uppercase tracking-[1.5px] px-2.5 py-1 rounded-full font-bold"
      style={{ color: s.color, background: s.bg }}
    >
      {s.label}
    </span>
  );
}

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative w-10 h-5 rounded-full transition-all duration-200 shrink-0 disabled:opacity-40"
      style={{ background: checked ? "#00C2FF" : "rgba(255,255,255,0.1)", boxShadow: checked ? "0 0 10px rgba(0,194,255,0.3)" : "none" }}
    >
      <span
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 shadow"
        style={{ left: checked ? "calc(100% - 18px)" : "2px" }}
      />
    </button>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: "#0D1218", border: "1px solid rgba(255,255,255,0.06)" }}>
      <h3 className="font-syne font-bold text-[14px] text-[#E8EDF2] mb-5 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-3.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-[#E8EDF2]">{label}</div>
        {help && <div className="text-[11px] text-[#5A6B7A] mt-0.5 leading-relaxed">{help}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Input({ value, onChange, placeholder, readOnly, type = "text" }: {
  value: string; onChange?: (v: string) => void; placeholder?: string; readOnly?: boolean; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      readOnly={readOnly}
      placeholder={placeholder}
      className="w-64 px-3 py-2 rounded-lg text-[13px] outline-none transition-all"
      style={{
        background: readOnly ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)",
        border: readOnly ? "1px solid rgba(255,255,255,0.04)" : "1px solid rgba(255,255,255,0.1)",
        color: readOnly ? "#5A6B7A" : "#E8EDF2",
      }}
    />
  );
}

// ── Delete modal ───────────────────────────────────────────────────────────────
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(8,12,16,0.92)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-7" style={{ background: "#0D1218", border: "1px solid rgba(255,77,106,0.3)" }} onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-5" style={{ background: "rgba(255,77,106,0.1)" }}>⚠️</div>
        <h2 className="font-syne font-bold text-[17px] text-[#FF4D6A] mb-2">{t.deleteModal}</h2>
        <p className="text-[12px] text-[#5A6B7A] mb-5 leading-relaxed">
          {t.deleteModalDesc} <span className="font-mono font-bold text-[#E8EDF2]">ELIMINAR</span> {t.deleteModalConfirm}
        </p>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="ELIMINAR"
          className="w-full px-3 py-2.5 rounded-xl text-[13px] font-mono outline-none mb-4"
          style={{ background: "#121A22", border: `1px solid ${text === "ELIMINAR" ? "rgba(255,77,106,0.4)" : "rgba(255,255,255,0.08)"}`, color: "#E8EDF2" }}
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-[#5A6B7A]" style={{ background: "#121A22", border: "1px solid rgba(255,255,255,0.06)" }}>Cancelar</button>
          <button
            onClick={handleDelete}
            disabled={text !== "ELIMINAR" || deleting}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #C0392B, #FF4D6A)" }}
          >
            {deleting ? "Eliminando…" : t.deleteModalBtn}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab: General ──────────────────────────────────────────────────────────────
function TabGeneral({ profile, lang, onChange, onSave, saving }: {
  profile: Profile; lang: "es" | "en"; onChange: (p: Partial<Profile>) => void; onSave: () => void; saving: boolean;
}) {
  const t = T[lang];
  return (
    <div className="space-y-5">
      <SectionCard title={t.tabs.general}>
        <Field label={t.fullName}>
          <Input value={profile.full_name} onChange={(v) => onChange({ full_name: v })} placeholder="Tu nombre" />
        </Field>
        <Field label={t.email}>
          <Input value={profile.email} readOnly />
        </Field>
        <Field label={t.language}>
          <div className="flex items-center rounded-xl overflow-hidden" style={{ background: "#121A22", border: "1px solid rgba(255,255,255,0.08)" }}>
            {(["es", "en"] as const).map((l) => (
              <button
                key={l}
                onClick={() => onChange({ language: l })}
                className="px-4 py-2 text-[12px] font-semibold transition-all"
                style={lang === l ? { color: "#00C2FF", background: "rgba(0,194,255,0.1)" } : { color: "#5A6B7A" }}
              >
                {l === "es" ? "🇪🇸 " + t.langEs : "🇬🇧 " + t.langEn}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t.timezone}>
          <select
            value={profile.timezone}
            onChange={(e) => onChange({ timezone: e.target.value })}
            className="w-64 px-3 py-2 rounded-lg text-[13px] outline-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#E8EDF2" }}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz} style={{ background: "#0D1218" }}>{tz}</option>
            ))}
          </select>
        </Field>
      </SectionCard>
      <div className="flex justify-end">
        <button
          onClick={onSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-xl text-[13px] font-semibold text-white disabled:opacity-60 transition-all"
          style={{ background: "linear-gradient(135deg, #0077FF, #00C2FF)", boxShadow: "0 0 20px rgba(0,194,255,0.2)" }}
        >
          {saving ? t.saving : t.save}
        </button>
      </div>
    </div>
  );
}

// ── Tab: Account ──────────────────────────────────────────────────────────────
function TabAccount({ profile, lang, onSignOut, onDelete }: {
  profile: Profile; lang: "es" | "en"; onSignOut: () => void; onDelete: () => void;
}) {
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
    <div className="space-y-5">
      {/* Org ID */}
      <SectionCard title={t.orgId}>
        <div className="flex items-center gap-3">
          <code className="flex-1 font-mono text-[11px] text-[#5A6B7A] px-3 py-2 rounded-lg truncate"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {profile.org_id}
          </code>
          <button
            onClick={() => { navigator.clipboard.writeText(profile.org_id); toast.success("Copiado"); }}
            className="px-3 py-2 rounded-lg text-[11px] font-semibold text-[#5A6B7A] transition-all"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            Copiar
          </button>
        </div>
        <p className="text-[11px] text-[#5A6B7A] mt-2">{t.orgIdHelp}</p>
      </SectionCard>

      {/* Sessions */}
      <SectionCard title={t.activeSessions}>
        <div className="flex items-center gap-3 p-3 rounded-xl mb-4" style={{ background: "#121A22", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: "rgba(0,194,255,0.08)" }}>💻</div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-[#E8EDF2]">{t.currentDevice}</div>
            <div className="text-[10px] text-[#5A6B7A] mt-px">{new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}</div>
          </div>
          <span className="font-mono text-[9px] px-2 py-px rounded-full" style={{ background: "rgba(0,229,160,0.1)", color: "#00E5A0" }}>ACTIVA</span>
        </div>
        <button
          onClick={handleSignOutOthers}
          disabled={soLoading}
          className="flex items-center gap-2 text-[12px] font-semibold px-4 py-2.5 rounded-xl transition-all disabled:opacity-50"
          style={{ color: "#FFB340", background: "rgba(255,179,64,0.06)", border: "1px solid rgba(255,179,64,0.15)" }}
        >
          {soLoading ? "⟳ " : "⊘ "}{t.signOutOthers}
        </button>
      </SectionCard>

      {/* Change password */}
      <SectionCard title={t.changePassword}>
        <div className="space-y-3">
          {[
            { key: "current", label: t.currentPw },
            { key: "new",     label: t.newPw },
            { key: "confirm", label: t.confirmPw },
          ].map((f) => (
            <div key={f.key}>
              <label className="text-[11px] text-[#5A6B7A] mb-1 block">{f.label}</label>
              <input
                type="password"
                value={pw[f.key as keyof typeof pw]}
                onChange={(e) => setPw((p) => ({ ...p, [f.key]: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
                style={{ background: "#121A22", border: "1px solid rgba(255,255,255,0.08)", color: "#E8EDF2" }}
              />
            </div>
          ))}
          <button
            onClick={handleChangePw}
            disabled={pwSaving || !pw.current || !pw.new || !pw.confirm}
            className="mt-1 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white disabled:opacity-50 transition-all"
            style={{ background: "linear-gradient(135deg, #0077FF, #00C2FF)" }}
          >
            {pwSaving ? "Actualizando…" : t.updatePw}
          </button>
        </div>
      </SectionCard>

      {/* Sign out */}
      <SectionCard title={t.signOut}>
        <p className="text-[12px] text-[#5A6B7A] mb-4">{t.signOutDesc}</p>
        <button
          onClick={onSignOut}
          className="px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all"
          style={{ color: "#5A6B7A", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          Cerrar sesión
        </button>
      </SectionCard>

      {/* Danger zone */}
      <div className="rounded-2xl p-6" style={{ background: "rgba(255,77,106,0.04)", border: "1px solid rgba(255,77,106,0.2)" }}>
        <h3 className="font-syne font-bold text-[14px] text-[#FF4D6A] mb-2">{t.dangerZone}</h3>
        <p className="text-[12px] text-[#5A6B7A] mb-4 leading-relaxed max-w-lg">{t.deleteDesc}</p>
        <button
          onClick={onDelete}
          className="px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all"
          style={{ background: "linear-gradient(135deg, #C0392B, #FF4D6A)", boxShadow: "0 0 16px rgba(255,77,106,0.2)" }}
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
  const creditColor = info.credits_available > 2 ? "#00E5A0" : info.credits_available > 0 ? "#FFB340" : "#FF4D6A";

  return (
    <div className="space-y-5">
      {/* Plan info */}
      <SectionCard title={t.currentPlan}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <PlanBadge plan={info.plan} />
            <span className="text-[12px] text-[#5A6B7A] capitalize">{info.status}</span>
            {info.cancel_at_period_end && (
              <span className="font-mono text-[9px] px-2 py-px rounded-full" style={{ color: "#FFB340", background: "rgba(255,179,64,0.1)" }}>
                {t.cancelNote}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {info.plan !== "business" && (
              <button onClick={handleUpgrade} className="px-4 py-2 rounded-xl text-[12px] font-semibold text-white" style={{ background: "linear-gradient(135deg, #0077FF, #00C2FF)" }}>
                {t.upgradeBtn}
              </button>
            )}
            {info.has_stripe && (
              <button onClick={handlePortal} disabled={portalLoading} className="px-4 py-2 rounded-xl text-[12px] font-semibold disabled:opacity-60" style={{ color: "#5A6B7A", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                {portalLoading ? "⟳" : t.manageBtn}
              </button>
            )}
          </div>
        </div>

        {info.current_period_end && (
          <div className="flex items-center gap-2 text-[12px]">
            <span className="text-[#5A6B7A]">{t.renewal}:</span>
            <span className="text-[#E8EDF2] font-semibold">{fmtDate(info.current_period_end)}</span>
          </div>
        )}
      </SectionCard>

      {/* Credits */}
      <SectionCard title={t.creditsAvail}>
        <div className="flex items-center gap-6">
          <div className="flex-1">
            <div className="flex items-baseline gap-1.5 mb-2">
              <span className="font-syne font-bold text-[32px] leading-none" style={{ color: creditColor }}>{info.credits_available}</span>
              <span className="text-[12px] text-[#5A6B7A]">/ {totalCredits}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${creditPct * 100}%`, background: creditColor }} />
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#5A6B7A]">{t.creditsReset}</div>
            <div className="text-[12px] text-[#E8EDF2] mt-0.5">{info.credits_reset_date || "—"}</div>
          </div>
        </div>
      </SectionCard>

      {/* Billing history */}
      <SectionCard title={t.billingHistory}>
        {info.billing_history.length === 0 ? (
          <p className="text-[12px] text-[#5A6B7A] py-2">{t.noBilling}</p>
        ) : (
          <div className="space-y-2">
            {info.billing_history.map((inv, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background: "#121A22", border: "1px solid rgba(255,255,255,0.04)" }}>
                <div>
                  <div className="text-[12px] font-medium text-[#E8EDF2]">{inv.description}</div>
                  <div className="text-[10px] text-[#5A6B7A] mt-0.5">{fmtDate(inv.date)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-syne font-bold text-[14px] text-[#00E5A0]">
                    {inv.amount.toFixed(2)} {inv.currency}
                  </span>
                  {inv.invoice_url && (
                    <a href={inv.invoice_url} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] font-semibold px-2 py-1 rounded-lg"
                      style={{ color: "#00C2FF", background: "rgba(0,194,255,0.08)" }}>
                      PDF
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ── Tab: Notifications ────────────────────────────────────────────────────────
function TabNotifications({ prefs, lang, onChange, onSave, saving }: {
  prefs: NotifPrefs; lang: "es" | "en"; onChange: (p: Partial<NotifPrefs>) => void; onSave: () => void; saving: boolean;
}) {
  const t = T[lang];

  const mainToggles = [
    { key: "email_alerts",  label: t.notifCritical, desc: t.notifCriticalDesc, alwaysOn: true },
    { key: "alert_medium",  label: t.notifMedium,   desc: t.notifMediumDesc },
    { key: "weekly_report", label: t.notifWeekly,   desc: t.notifWeeklyDesc },
  ];

  return (
    <div className="space-y-5">
      <SectionCard title={t.notifTitle}>
        <div className="space-y-1">
          {mainToggles.map((item) => (
            <div key={item.key} className="flex items-start justify-between gap-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-[#E8EDF2]">{item.label}</span>
                  {item.alwaysOn && (
                    <span className="font-mono text-[8px] px-1.5 py-px rounded" style={{ background: "rgba(0,229,160,0.1)", color: "#00E5A0" }}>
                      RECOMENDADO
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#5A6B7A] mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
              <ToggleSwitch
                checked={prefs[item.key as keyof NotifPrefs]}
                onChange={(v) => onChange({ [item.key]: v })}
              />
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <button
          onClick={onSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-xl text-[13px] font-semibold text-white disabled:opacity-60 transition-all"
          style={{ background: "linear-gradient(135deg, #0077FF, #00C2FF)", boxShadow: "0 0 20px rgba(0,194,255,0.2)" }}
        >
          {saving ? T[lang].saving : t.savePrefs}
        </button>
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
      await settingsApi.updateProfile({
        full_name: profile.full_name,
        language: profile.language,
        timezone: profile.timezone,
      });
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
      <div className="p-10 flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#00C2FF] border-t-transparent rounded-full animate-spin" />
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
    <div className="p-9">
      {showDelete && (
        <DeleteModal lang={lang} onConfirm={handleDeleteAccount} onClose={() => setShowDelete(false)} />
      )}

      {/* Header */}
      <div className="mb-7 fade-up">
        <h1 className="font-syne font-bold text-[22px] text-[#E8EDF2]">{t.title}</h1>
        <p className="text-[12px] text-[#5A6B7A] mt-0.5">
          {profile.email}
          {profile.company_name ? ` · ${profile.company_name}` : ""}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-8 fade-up" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "0" }}>
        {TABS.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className="relative px-4 py-2.5 text-[13px] font-semibold transition-all"
            style={{ color: tab === tb.key ? "#00C2FF" : "#5A6B7A" }}
          >
            {tb.label}
            {tab === tb.key && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full" style={{ background: "#00C2FF", boxShadow: "0 0 8px rgba(0,194,255,0.5)" }} />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="fade-up max-w-2xl">
        {tab === "general" && (
          <TabGeneral
            profile={profile}
            lang={lang}
            onChange={(p) => setProfile((prev) => prev ? { ...prev, ...p } : prev)}
            onSave={handleSaveProfile}
            saving={saving}
          />
        )}
        {tab === "account" && (
          <TabAccount
            profile={profile}
            lang={lang}
            onSignOut={handleSignOut}
            onDelete={() => setShowDelete(true)}
          />
        )}
        {tab === "subscription" && (
          <TabSubscription info={subInfo} lang={lang} />
        )}
        {tab === "notifications" && (
          <TabNotifications
            prefs={notifs}
            lang={lang}
            onChange={(p) => setNotifs((prev) => prev ? { ...prev, ...p } : prev)}
            onSave={handleSaveNotifs}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
}
