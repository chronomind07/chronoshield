"use client";

import { useEffect, useState } from "react";
import { emailsApi } from "@/lib/api";
import BuyCreditsModal from "@/components/BuyCreditsModal";
import toast from "react-hot-toast";

// ── Types ─────────────────────────────────────────────────────────────────────
interface BreachResult {
  id: string;
  scanned_at: string;
  breaches_found: number;
  breach_data: Record<string, any> | null;
  is_new: boolean;
}

interface MonitoredEmail {
  id: string;
  email: string;
  created_at: string;
  total_breaches: number;
  latest_breach: BreachResult | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function emailBarColor(e: MonitoredEmail): string {
  if (!e.latest_breach) return "rgba(255,255,255,0.08)";
  if (e.total_breaches === 0) return "#00e5bf";
  return "#ff4d6a";
}

/** Extract a readable list of breaches from InsecureWeb breach_data payload */
function parseBreaches(data: Record<string, any> | null): { name: string; date?: string; count?: number }[] {
  if (!data) return [];
  const list = data.breaches ?? data.Breaches ?? data.results ?? [];
  if (!Array.isArray(list)) return [];
  return list.map((b: any) => ({
    name:  b.name ?? b.Name ?? b.breach_name ?? b.BreachName ?? "Breach desconocido",
    date:  b.date ?? b.Date ?? b.breach_date ?? b.BreachDate,
    count: b.pwnCount ?? b.PwnCount ?? b.data_count,
  }));
}

// ── Breach Detail Panel ───────────────────────────────────────────────────────
function BreachDetailPanel({
  email,
  onClose,
}: {
  email: MonitoredEmail;
  onClose: () => void;
}) {
  const breaches = parseBreaches(email.latest_breach?.breach_data ?? null);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(5,5,7,0.85)",
        backdropFilter: "blur(8px)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "#0a0a0f",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20,
          width: "100%",
          maxWidth: 480,
          boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div>
            <span
              style={{
                fontFamily: "var(--font-mono-family)",
                fontSize: "0.7rem",
                textTransform: "uppercase",
                letterSpacing: "0.18em",
                color: "#00e5bf",
                fontWeight: 500,
                display: "block",
                marginBottom: 4,
              }}
            >
              Breach Report
            </span>
            <h2
              style={{
                fontFamily: "var(--font-serif-family)",
                fontSize: "1.3rem",
                fontWeight: 400,
                letterSpacing: "-0.02em",
                color: "#f0f0f5",
                maxWidth: 300,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {email.email}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#55556a",
              padding: 4,
              transition: "color 0.2s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "#f0f0f5")}
            onMouseLeave={e => (e.currentTarget.style.color = "#55556a")}
          >
            <svg viewBox="0 0 16 16" fill="none" style={{ width: 16, height: 16 }}>
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16, maxHeight: "65vh", overflowY: "auto" }}>

          {/* Last scan */}
          {email.latest_breach && (
            <p style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.72rem", color: "#55556a" }}>
              Último escaneo: {new Date(email.latest_breach.scanned_at).toLocaleString("es-ES")}
            </p>
          )}

          {/* Summary */}
          <div
            style={{
              borderRadius: 12,
              padding: "16px",
              display: "flex",
              alignItems: "center",
              gap: 16,
              background: email.total_breaches === 0
                ? "rgba(34,197,94,0.05)" : "rgba(255,77,106,0.05)",
              border: email.total_breaches === 0
                ? "1px solid rgba(34,197,94,0.12)" : "1px solid rgba(255,77,106,0.12)",
            }}
          >
            <span style={{ fontSize: "1.4rem" }}>{email.total_breaches === 0 ? "✅" : "🚨"}</span>
            <div>
              <p
                style={{
                  fontFamily: "var(--font-jakarta-family)",
                  fontSize: "0.92rem",
                  fontWeight: 600,
                  color: email.total_breaches === 0 ? "#22c55e" : "#ff4d6a",
                  marginBottom: 2,
                }}
              >
                {email.total_breaches === 0
                  ? "Sin brechas detectadas"
                  : `${email.total_breaches} brecha${email.total_breaches !== 1 ? "s" : ""} detectada${email.total_breaches !== 1 ? "s" : ""}`}
              </p>
              {email.total_breaches > 0 && (
                <p style={{ fontSize: "0.78rem", color: "#9999ad" }}>
                  Cambia las contraseñas asociadas a este email inmediatamente.
                </p>
              )}
            </div>
          </div>

          {/* Breach list */}
          {breaches.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span
                style={{
                  fontFamily: "var(--font-mono-family)",
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.18em",
                  color: "#00e5bf",
                  fontWeight: 500,
                }}
              >
                Detalle de brechas
              </span>
              {breaches.map((b, i) => (
                <div
                  key={i}
                  style={{
                    borderRadius: 10,
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    background: "#0f0f16",
                    border: "1px solid rgba(255,77,106,0.08)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "var(--font-mono-family)",
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        flexShrink: 0,
                        background: "rgba(255,77,106,0.10)",
                        color: "#ff4d6a",
                      }}
                    >
                      {b.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ fontSize: "0.85rem", fontWeight: 500, color: "#f0f0f5", marginBottom: 1 }}>{b.name}</p>
                      {b.date && (
                        <p style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.68rem", color: "#55556a" }}>{b.date}</p>
                      )}
                    </div>
                  </div>
                  {b.count !== undefined && (
                    <span style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.72rem", color: "#55556a", flexShrink: 0 }}>
                      {b.count.toLocaleString()} reg.
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : email.total_breaches > 0 ? (
            <div style={{ borderRadius: 10, padding: 16, textAlign: "center", background: "#0f0f16" }}>
              <p style={{ fontSize: "0.78rem", color: "#55556a" }}>
                Detalles de las brechas no disponibles en este escaneo.
              </p>
            </div>
          ) : null}

          {/* Recommendations if breached */}
          {email.total_breaches > 0 && (
            <div style={{ borderRadius: 10, padding: 16, background: "#0f0f16" }}>
              <span
                style={{
                  fontFamily: "var(--font-mono-family)",
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.18em",
                  color: "#00e5bf",
                  fontWeight: 500,
                  display: "block",
                  marginBottom: 12,
                }}
              >
                Acciones recomendadas
              </span>
              <ul style={{ display: "flex", flexDirection: "column", gap: 8, listStyle: "none", padding: 0, margin: 0 }}>
                {[
                  "Cambia la contraseña de esta dirección de email inmediatamente.",
                  "Activa la verificación en dos pasos (2FA) en todos los servicios donde uses este email.",
                  "Revisa si usabas la misma contraseña en otros servicios y cámbiala también.",
                  "Considera usar un gestor de contraseñas para crear contraseñas únicas.",
                ].map((tip, i) => (
                  <li key={i} style={{ display: "flex", gap: 8, fontSize: "0.78rem", color: "#9999ad" }}>
                    <span style={{ color: "#6366f1", flexShrink: 0, fontFamily: "var(--font-mono-family)" }}>{i + 1}.</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function EmailsPage() {
  const [emails, setEmails]           = useState<MonitoredEmail[]>([]);
  const [loading, setLoading]         = useState(true);
  const [adding, setAdding]           = useState(false);
  const [newEmail, setNewEmail]       = useState("");
  const [scanning, setScanning]       = useState<string | null>(null);
  const [selected, setSelected]       = useState<MonitoredEmail | null>(null);
  const [showCredits, setShowCredits] = useState(false);

  const load = async () => {
    try {
      const res = await emailsApi.list();
      setEmails(res.data ?? []);
    } catch {
      toast.error("Error al cargar emails");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim();
    if (!email) return;
    setAdding(true);
    try {
      const res = await emailsApi.add(email);
      setEmails((prev) => [...prev, res.data]);
      setNewEmail("");
      toast.success("Email añadido correctamente");
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 409) {
        toast.error("Este email ya está siendo monitorizado");
      } else {
        toast.error(typeof detail === "string" ? detail : "Error al añadir email");
      }
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: string, email: string) => {
    if (!confirm(`¿Eliminar ${email}?`)) return;
    try {
      await emailsApi.remove(id);
      setEmails((prev) => prev.filter((e) => e.id !== id));
      toast.success("Email eliminado");
    } catch {
      toast.error("Error al eliminar email");
    }
  };

  const handleScan = async (e: React.MouseEvent, emailItem: MonitoredEmail) => {
    e.stopPropagation(); // Don't open detail panel
    setScanning(emailItem.id);
    try {
      const res = await emailsApi.scan(emailItem.id);
      const remaining = res.data?.credits_remaining;
      toast.success(
        `Escaneo iniciado${remaining !== undefined ? ` · ${remaining} crédito${remaining !== 1 ? "s" : ""} restante${remaining !== 1 ? "s" : ""}` : ""}`
      );
      setTimeout(load, 6000);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 402 || detail?.code === "NO_CREDITS") {
        setShowCredits(true);
      } else {
        toast.error(typeof detail === "string" ? detail : "Error al iniciar escaneo");
      }
    } finally {
      setScanning(null);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div style={{ padding: "32px 36px 60px", background: "#050507", minHeight: "100vh", position: "relative", zIndex: 1 }}>

      {/* Modals */}
      {showCredits && <BuyCreditsModal onClose={() => setShowCredits(false)} />}
      {selected    && <BreachDetailPanel email={selected} onClose={() => setSelected(null)} />}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1
            style={{
              fontFamily: "var(--font-serif-family)",
              fontSize: "1.75rem",
              fontWeight: 400,
              letterSpacing: "-0.02em",
              color: "#f0f0f5",
            }}
          >
            Email Breach Monitor
          </h1>
          <p style={{ color: "#55556a", fontSize: "0.82rem", marginTop: 4 }}>
            Monitorización continua contra bases de datos de brechas conocidas
          </p>
        </div>
        <button
          onClick={() => setShowCredits(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "8px 16px",
            borderRadius: 8,
            background: "#0f0f16",
            color: "#9999ad",
            fontFamily: "var(--font-jakarta-family)",
            fontSize: "0.8rem",
            fontWeight: 600,
            border: "1px solid rgba(255,255,255,0.06)",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = "#00e5bf"; e.currentTarget.style.borderColor = "rgba(0,229,191,0.2)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "#9999ad"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
        >
          Comprar créditos
        </button>
      </div>

      {/* Add email */}
      <div
        style={{
          background: "#0f0f16",
          border: "1px solid rgba(255,255,255,0.03)",
          borderRadius: 16,
          padding: "22px 24px",
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono-family)",
            fontSize: "0.7rem",
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            color: "#00e5bf",
            fontWeight: 500,
            display: "block",
            marginBottom: 14,
          }}
        >
          Añadir email
        </span>
        <form onSubmit={handleAdd} style={{ display: "flex", gap: 10 }}>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="usuario@empresa.com"
            disabled={adding}
            style={{
              flex: 1,
              padding: "10px 14px",
              background: "#0a0a0f",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 8,
              color: "#f0f0f5",
              fontFamily: "var(--font-jakarta-family)",
              fontSize: "0.88rem",
              outline: "none",
              transition: "border-color 0.2s",
            }}
            onFocus={e => (e.currentTarget.style.borderColor = "rgba(0,229,191,0.3)")}
            onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
          />
          <button
            type="submit"
            disabled={adding || !newEmail.trim()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "9px 20px",
              borderRadius: 100,
              background: "#00e5bf",
              color: "#000",
              fontFamily: "var(--font-jakarta-family)",
              fontSize: "0.82rem",
              fontWeight: 700,
              border: "none",
              cursor: adding || !newEmail.trim() ? "not-allowed" : "pointer",
              opacity: adding || !newEmail.trim() ? 0.45 : 1,
              boxShadow: "0 0 24px rgba(0,229,191,0.12)",
              transition: "all 0.25s",
            }}
          >
            <svg viewBox="0 0 16 16" fill="none" style={{ width: 14, height: 14 }}>
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            {adding ? "Añadiendo..." : "Añadir"}
          </button>
        </form>
      </div>

      {/* Credits hint */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <p style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.72rem", color: "#33334a" }}>
          Los escaneos manuales consumen 1 crédito por email · Haz clic en un email para ver el detalle
        </p>
      </div>

      {/* Email list */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0" }}>
          <div
            style={{
              width: 28,
              height: 28,
              border: "2px solid rgba(0,229,191,0.15)",
              borderTopColor: "#00e5bf",
              borderRadius: "50%",
            }}
            className="animate-spin"
          />
        </div>
      ) : emails.length === 0 ? (
        <div
          style={{
            background: "#0f0f16",
            border: "1px solid rgba(255,255,255,0.03)",
            borderRadius: 16,
            padding: "22px 24px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "64px 0", textAlign: "center" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: "rgba(0,229,191,0.06)",
                border: "1px solid rgba(0,229,191,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
              }}
            >
              ✉
            </div>
            <div>
              <div
                style={{
                  fontFamily: "var(--font-serif-family)",
                  fontSize: "1.1rem",
                  fontWeight: 400,
                  color: "#f0f0f5",
                  marginBottom: 6,
                }}
              >
                Sin emails monitorizados
              </div>
              <div style={{ fontSize: "0.85rem", color: "#55556a", maxWidth: 320 }}>
                Añade direcciones de email para escanearlas contra bases de datos de brechas.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {emails.map((e) => {
            const barColor   = emailBarColor(e);
            const isBreached = e.total_breaches > 0;
            const isScanned  = !!e.latest_breach;
            const lastCheck  = e.latest_breach?.scanned_at;
            const initials   = e.email.slice(0, 2).toUpperCase();

            return (
              <div
                key={e.id}
                style={{
                  position: "relative",
                  background: "#0f0f16",
                  border: "1px solid rgba(255,255,255,0.03)",
                  borderRadius: 16,
                  padding: "16px 20px",
                  overflow: "hidden",
                  cursor: "pointer",
                  transition: "border-color 0.2s, transform 0.2s",
                }}
                onClick={() => setSelected(e)}
                onMouseEnter={e2 => {
                  e2.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                  e2.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={e2 => {
                  e2.currentTarget.style.borderColor = "rgba(255,255,255,0.03)";
                  e2.currentTarget.style.transform = "";
                }}
              >
                {/* Bottom color bar */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    backgroundColor: barColor,
                  }}
                />

                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  {/* Avatar */}
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "#1a1a26",
                      border: "1px solid rgba(255,255,255,0.06)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--font-mono-family)",
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      color: "#9999ad",
                      flexShrink: 0,
                    }}
                  >
                    {initials}
                  </div>

                  {/* Email + date */}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p
                      style={{
                        fontFamily: "var(--font-mono-family)",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        color: "#f0f0f5",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {e.email}
                    </p>
                    <p style={{ fontSize: "0.72rem", color: "#33334a", marginTop: 2 }}>
                      {lastCheck
                        ? `Revisado: ${new Date(lastCheck).toLocaleString("es-ES")}`
                        : "Pendiente primer escaneo"}
                    </p>
                  </div>

                  {/* Right: badge + actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    {/* Breach badge */}
                    {isScanned && (
                      <span
                        style={{
                          fontFamily: "var(--font-mono-family)",
                          fontSize: "0.58rem",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: isBreached ? "rgba(255,77,106,0.10)" : "rgba(34,197,94,0.10)",
                          color: isBreached ? "#ff4d6a" : "#22c55e",
                        }}
                      >
                        {isBreached
                          ? `${e.total_breaches} breach${e.total_breaches !== 1 ? "es" : ""}`
                          : "0 breaches"}
                      </span>
                    )}

                    {!isScanned && (
                      <span
                        style={{
                          fontFamily: "var(--font-mono-family)",
                          fontSize: "0.58rem",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: "rgba(255,255,255,0.05)",
                          color: "#55556a",
                        }}
                      >
                        Pending
                      </span>
                    )}

                    {/* Scan button */}
                    <button
                      onClick={(ev) => handleScan(ev, e)}
                      disabled={scanning === e.id}
                      title="Escanear (1 crédito)"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "6px 12px",
                        borderRadius: 8,
                        background: "#0f0f16",
                        color: scanning === e.id ? "#00e5bf" : "#9999ad",
                        fontFamily: "var(--font-jakarta-family)",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        border: "1px solid rgba(255,255,255,0.06)",
                        cursor: scanning === e.id ? "not-allowed" : "pointer",
                        opacity: scanning === e.id ? 0.6 : 1,
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={e2 => { if (scanning !== e.id) { e2.currentTarget.style.color = "#00e5bf"; e2.currentTarget.style.borderColor = "rgba(0,229,191,0.2)"; } }}
                      onMouseLeave={e2 => { e2.currentTarget.style.color = "#9999ad"; e2.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
                    >
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        style={{ width: 12, height: 12 }}
                        className={scanning === e.id ? "animate-spin" : ""}
                      >
                        <path
                          d="M13.5 8A5.5 5.5 0 1 1 8 2.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                        <path d="M8 1v3l2-1.5L8 1Z" fill="currentColor"/>
                      </svg>
                      Scan
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={(ev) => { ev.stopPropagation(); handleRemove(e.id, e.email); }}
                      style={{
                        padding: "6px 8px",
                        borderRadius: 8,
                        background: "rgba(255,77,106,0.08)",
                        color: "#ff4d6a",
                        border: "1px solid rgba(255,77,106,0.15)",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.2s",
                        display: "flex",
                        alignItems: "center",
                      }}
                      onMouseEnter={e2 => { e2.currentTarget.style.background = "rgba(255,77,106,0.15)"; }}
                      onMouseLeave={e2 => { e2.currentTarget.style.background = "rgba(255,77,106,0.08)"; }}
                    >
                      <svg viewBox="0 0 16 16" fill="none" style={{ width: 14, height: 14 }}>
                        <path
                          d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
