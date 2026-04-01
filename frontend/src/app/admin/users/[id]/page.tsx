"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { adminApi } from "@/lib/api";

const ACCENT = "#f59e0b";

interface UserDetail {
  id: string;
  email: string;
  profile: Record<string, unknown>;
  subscription: Record<string, unknown>;
  credits: Record<string, unknown>;
  domains: { id: string; domain: string; is_active: boolean; created_at: string }[];
  emails: { id: string; email: string; is_active: boolean; created_at: string }[];
  scores: Record<string, unknown>[];
  alerts: { id: string; title: string; severity: string; sent_at: string }[];
}

type Tab = "info" | "subscription" | "credits" | "ai" | "status";

const TABS: { key: Tab; label: string }[] = [
  { key: "info",         label: "Info" },
  { key: "subscription", label: "Suscripción" },
  { key: "credits",      label: "Créditos" },
  { key: "ai",           label: "Tokens IA" },
  { key: "status",       label: "Estado" },
];

const inputStyle: React.CSSProperties = {
  padding: "8px 12px", background: "#111318",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
  color: "#e2e8f0", fontSize: 13, outline: "none",
  fontFamily: "'Plus Jakarta Sans', sans-serif", width: "100%", boxSizing: "border-box",
};

const btnStyle = (color = ACCENT): React.CSSProperties => ({
  padding: "8px 18px", background: `${color}18`,
  border: `1px solid ${color}44`, borderRadius: 8,
  color, fontSize: 13, fontWeight: 600, cursor: "pointer",
  fontFamily: "'Plus Jakarta Sans', sans-serif",
});

const dangerBtn: React.CSSProperties = {
  ...btnStyle("#f87171"),
  color: "#f87171",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#0a0b0f", border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 12, padding: "18px 20px", marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span style={{ fontSize: 12, color: "#64748b" }}>{label}</span>
      <span style={{ fontSize: 13, color: "#e2e8f0" }}>{value ?? "—"}</span>
    </div>
  );
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Forms
  const [newPlan, setNewPlan] = useState("trial");
  const [creditDelta, setCreditDelta] = useState("0");
  const [creditReason, setCreditReason] = useState("");
  const [newTokenLimit, setNewTokenLimit] = useState("10000");
  const [resetTokens, setResetTokens] = useState(false);
  const [newStatus, setNewStatus] = useState("active");
  const [statusReason, setStatusReason] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const r = await adminApi.userDetail(id);
      setUser(r.data);
      setNewPlan((r.data.subscription?.plan as string) || "trial");
      setNewStatus((r.data.profile?.account_status as string) || "active");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const handleChangePlan = async () => {
    if (!confirm(`¿Cambiar plan a "${newPlan}"?`)) return;
    setSaving(true);
    try {
      await adminApi.changePlan(id, newPlan);
      showMsg("Plan actualizado correctamente");
      load();
    } catch {
      showMsg("Error al cambiar plan");
    } finally { setSaving(false); }
  };

  const handleChangeCredits = async () => {
    const delta = parseInt(creditDelta, 10);
    if (isNaN(delta)) { showMsg("Delta inválido"); return; }
    if (!confirm(`¿${delta >= 0 ? "Añadir" : "Restar"} ${Math.abs(delta)} créditos?`)) return;
    setSaving(true);
    try {
      await adminApi.changeCredits(id, delta, creditReason);
      showMsg("Créditos actualizados");
      setCreditDelta("0");
      setCreditReason("");
      load();
    } catch {
      showMsg("Error al cambiar créditos");
    } finally { setSaving(false); }
  };

  const handleChangeAiTokens = async () => {
    const limit = parseInt(newTokenLimit, 10);
    if (isNaN(limit) || limit < 0) { showMsg("Límite inválido"); return; }
    if (!confirm(`¿Establecer límite de tokens a ${limit}?`)) return;
    setSaving(true);
    try {
      await adminApi.changeAiTokens(id, limit, resetTokens);
      showMsg("Tokens actualizados");
      load();
    } catch {
      showMsg("Error al cambiar tokens");
    } finally { setSaving(false); }
  };

  const handleChangeStatus = async () => {
    if (newStatus === "suspended" && !statusReason.trim()) {
      showMsg("Debes indicar una razón para suspender"); return;
    }
    if (!confirm(`¿Cambiar estado a "${newStatus}"?`)) return;
    setSaving(true);
    try {
      await adminApi.changeStatus(id, newStatus, statusReason);
      showMsg("Estado actualizado");
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      showMsg(err?.response?.data?.detail || "Error al cambiar estado");
    } finally { setSaving(false); }
  };

  if (loading) return <div style={{ color: "#64748b" }}>Cargando…</div>;
  if (!user) return <div style={{ color: "#f87171" }}>Usuario no encontrado</div>;

  const sub = user.subscription as Record<string, unknown>;
  const cred = user.credits as Record<string, unknown>;
  const profile = user.profile as Record<string, unknown>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={() => router.push("/admin/users")}
          style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer",
                   fontSize: 20, padding: 0, lineHeight: 1 }}>←</button>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0", margin: 0, letterSpacing: "-0.02em" }}>
            {user.email}
          </h1>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>ID: {user.id}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.07)",
                    paddingBottom: 0 }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{ padding: "8px 16px", background: "none", border: "none",
                     borderBottom: activeTab === tab.key ? `2px solid ${ACCENT}` : "2px solid transparent",
                     color: activeTab === tab.key ? "#e2e8f0" : "#64748b",
                     fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400,
                     cursor: "pointer", fontFamily: "inherit", marginBottom: -1 }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {msg && (
        <div style={{ padding: "10px 14px", background: msg.startsWith("Error") ? "#f8717118" : "#4ade8018",
                      border: `1px solid ${msg.startsWith("Error") ? "#f87171" : "#4ade80"}44`,
                      borderRadius: 8, color: msg.startsWith("Error") ? "#f87171" : "#4ade80",
                      fontSize: 13, marginBottom: 16 }}>{msg}</div>
      )}

      {/* Tab: Info */}
      {activeTab === "info" && (
        <>
          <Section title="Perfil">
            <Field label="Email" value={user.email} />
            <Field label="Nombre" value={profile.full_name as string} />
            <Field label="Rol" value={profile.role as string} />
            <Field label="Estado" value={profile.account_status as string} />
            <Field label="Idioma" value={profile.language as string} />
            <Field label="Zona horaria" value={profile.timezone as string} />
          </Section>

          <Section title={`Dominios (${user.domains.length})`}>
            {user.domains.length === 0 ? (
              <div style={{ color: "#475569", fontSize: 13 }}>Sin dominios</div>
            ) : user.domains.map(d => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between",
                                       padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: 13, color: "#e2e8f0" }}>{d.domain}</span>
                <span style={{ fontSize: 11, color: d.is_active ? "#4ade80" : "#f87171" }}>
                  {d.is_active ? "activo" : "inactivo"}
                </span>
              </div>
            ))}
          </Section>

          <Section title={`Emails monitorizados (${user.emails.length})`}>
            {user.emails.length === 0 ? (
              <div style={{ color: "#475569", fontSize: 13 }}>Sin emails</div>
            ) : user.emails.map(e => (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between",
                                       padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: 13, color: "#e2e8f0" }}>{e.email}</span>
                <span style={{ fontSize: 11, color: e.is_active ? "#4ade80" : "#f87171" }}>
                  {e.is_active ? "activo" : "inactivo"}
                </span>
              </div>
            ))}
          </Section>

          <Section title={`Alertas recientes (${user.alerts.length})`}>
            {user.alerts.length === 0 ? (
              <div style={{ color: "#475569", fontSize: 13 }}>Sin alertas</div>
            ) : user.alerts.map(a => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between",
                                       padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: 13, color: "#e2e8f0" }}>{a.title}</span>
                <span style={{ fontSize: 11, color: "#64748b" }}>
                  {new Date(a.sent_at).toLocaleDateString("es-ES")}
                </span>
              </div>
            ))}
          </Section>
        </>
      )}

      {/* Tab: Suscripción */}
      {activeTab === "subscription" && (
        <Section title="Gestionar suscripción">
          <Field label="Plan actual" value={sub.plan as string} />
          <Field label="Estado" value={sub.status as string} />
          <Field label="Máx. dominios" value={sub.max_domains as number} />
          <Field label="Máx. emails" value={sub.max_emails as number} />
          <Field label="Stripe sub ID" value={sub.stripe_subscription_id as string} />

          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Cambiar plan</div>
            <div style={{ display: "flex", gap: 8 }}>
              <select value={newPlan} onChange={e => setNewPlan(e.target.value)}
                style={{ ...inputStyle, width: "auto" }}>
                <option value="trial">Trial</option>
                <option value="starter">Starter (29€/mes)</option>
                <option value="business">Business (59€/mes)</option>
              </select>
              <button onClick={handleChangePlan} disabled={saving} style={btnStyle()}>
                {saving ? "Guardando…" : "Aplicar plan"}
              </button>
            </div>
          </div>
        </Section>
      )}

      {/* Tab: Créditos */}
      {activeTab === "credits" && (
        <Section title="Gestionar créditos">
          <Field label="Créditos disponibles" value={cred.credits_available as number} />
          <Field label="Créditos usados" value={cred.credits_used as number} />

          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Ajustar créditos</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input type="number" value={creditDelta}
                onChange={e => setCreditDelta(e.target.value)}
                placeholder="Delta (positivo=añadir, negativo=restar)"
                style={inputStyle} />
              <input value={creditReason} onChange={e => setCreditReason(e.target.value)}
                placeholder="Razón (opcional)"
                style={inputStyle} />
              <button onClick={handleChangeCredits} disabled={saving} style={btnStyle()}>
                {saving ? "Guardando…" : "Aplicar cambio"}
              </button>
            </div>
          </div>
        </Section>
      )}

      {/* Tab: Tokens IA */}
      {activeTab === "ai" && (
        <Section title="Tokens de IA">
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Nuevo límite mensual de tokens</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input type="number" value={newTokenLimit}
                onChange={e => setNewTokenLimit(e.target.value)}
                placeholder="Límite de tokens"
                style={inputStyle} />
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#94a3b8" }}>
                <input type="checkbox" checked={resetTokens}
                  onChange={e => setResetTokens(e.target.checked)} />
                Resetear tokens usados este mes
              </label>
              <button onClick={handleChangeAiTokens} disabled={saving} style={btnStyle()}>
                {saving ? "Guardando…" : "Actualizar tokens"}
              </button>
            </div>
          </div>
        </Section>
      )}

      {/* Tab: Estado */}
      {activeTab === "status" && (
        <Section title="Estado de la cuenta">
          <Field label="Estado actual" value={profile.account_status as string || "active"} />
          {profile.suspension_reason && (
            <Field label="Razón suspensión" value={profile.suspension_reason as string} />
          )}

          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Cambiar estado</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                style={{ ...inputStyle, width: "auto" }}>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
                <option value="suspended">Suspendido</option>
              </select>
              {newStatus === "suspended" && (
                <input value={statusReason} onChange={e => setStatusReason(e.target.value)}
                  placeholder="Razón de la suspensión (requerida)"
                  style={inputStyle} />
              )}
              <button
                onClick={handleChangeStatus}
                disabled={saving}
                style={newStatus === "suspended" ? dangerBtn : btnStyle()}>
                {saving ? "Guardando…" : "Aplicar estado"}
              </button>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}
