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
  if (e.total_breaches === 0) return "#3ecf8e";
  return "#ef4444";
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
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(6px)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "#161616",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 14,
          width: "100%",
          maxWidth: 480,
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 22px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div>
            <span
              style={{
                fontFamily: "var(--font-dm-mono, monospace)",
                fontSize: "0.62rem",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "#52525b",
                fontWeight: 600,
                display: "block",
                marginBottom: 4,
              }}
            >
              Breach Report
            </span>
            <h2
              style={{
                fontSize: "1.1rem",
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: "#f0f0f0",
                maxWidth: 300,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                margin: 0,
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
              color: "#52525b",
              padding: 6,
              borderRadius: 6,
              transition: "color 0.15s",
              display: "flex",
              alignItems: "center",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "#f0f0f0")}
            onMouseLeave={e => (e.currentTarget.style.color = "#52525b")}
          >
            <svg viewBox="0 0 16 16" fill="none" style={{ width: 15, height: 15 }}>
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14, maxHeight: "65vh", overflowY: "auto" }}>

          {/* Last scan timestamp */}
          {email.latest_breach && (
            <p style={{ fontFamily: "var(--font-dm-mono, monospace)", fontSize: "0.72rem", color: "#52525b", margin: 0 }}>
              Último escaneo: {new Date(email.latest_breach.scanned_at).toLocaleString("es-ES")}
            </p>
          )}

          {/* Summary banner */}
          <div
            style={{
              borderRadius: 10,
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 14,
              background: email.total_breaches === 0
                ? "rgba(62,207,142,0.06)" : "rgba(239,68,68,0.06)",
              border: email.total_breaches === 0
                ? "1px solid rgba(62,207,142,0.12)" : "1px solid rgba(239,68,68,0.12)",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: email.total_breaches === 0 ? "rgba(62,207,142,0.12)" : "rgba(239,68,68,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {email.total_breaches === 0 ? (
                <svg viewBox="0 0 16 16" fill="none" style={{ width: 14, height: 14 }}>
                  <path d="M3 8l3.5 3.5L13 4" stroke="#3ecf8e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" fill="none" style={{ width: 14, height: 14 }}>
                  <path d="M8 5v4M8 11v1" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round"/>
                  <path d="M7.134 2.5l-5.5 9.526A1 1 0 0 0 2.5 13.5h11a1 1 0 0 0 .866-1.474l-5.5-9.526a1 1 0 0 0-1.732 0Z" stroke="#ef4444" strokeWidth="1.2"/>
                </svg>
              )}
            </div>
            <div>
              <p
                style={{
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  color: email.total_breaches === 0 ? "#3ecf8e" : "#ef4444",
                  margin: "0 0 2px",
                }}
              >
                {email.total_breaches === 0
                  ? "Sin brechas detectadas"
                  : `${email.total_breaches} brecha${email.total_breaches !== 1 ? "s" : ""} detectada${email.total_breaches !== 1 ? "s" : ""}`}
              </p>
              {email.total_breaches > 0 && (
                <p style={{ fontSize: "0.75rem", color: "#a1a1aa", margin: 0 }}>
                  Cambia las contraseñas asociadas a este email inmediatamente.
                </p>
              )}
            </div>
          </div>

          {/* Breach list */}
          {breaches.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span
                style={{
                  fontFamily: "var(--font-dm-mono, monospace)",
                  fontSize: "0.62rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: "#52525b",
                  fontWeight: 600,
                  marginBottom: 2,
                  display: "block",
                }}
              >
                Detalle de brechas
              </span>
              {breaches.map((b, i) => (
                <div
                  key={i}
                  style={{
                    borderRadius: 8,
                    padding: "10px 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    background: "#1c1c1c",
                    border: "1px solid rgba(239,68,68,0.08)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "var(--font-dm-mono, monospace)",
                        fontSize: "0.62rem",
                        fontWeight: 700,
                        flexShrink: 0,
                        background: "rgba(239,68,68,0.10)",
                        color: "#ef4444",
                      }}
                    >
                      {b.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ fontSize: "0.83rem", fontWeight: 600, color: "#f0f0f0", margin: "0 0 1px" }}>{b.name}</p>
                      {b.date && (
                        <p style={{ fontFamily: "var(--font-dm-mono, monospace)", fontSize: "0.68rem", color: "#52525b", margin: 0 }}>{b.date}</p>
                      )}
                    </div>
                  </div>
                  {b.count !== undefined && (
                    <span style={{ fontFamily: "var(--font-dm-mono, monospace)", fontSize: "0.7rem", color: "#52525b", flexShrink: 0 }}>
                      {b.count.toLocaleString()} reg.
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : email.total_breaches > 0 ? (
            <div style={{ borderRadius: 8, padding: 14, textAlign: "center", background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p style={{ fontSize: "0.78rem", color: "#52525b", margin: 0 }}>
                Detalles de las brechas no disponibles en este escaneo.
              </p>
            </div>
          ) : null}

          {/* Recommendations if breached */}
          {email.total_breaches > 0 && (
            <div style={{ borderRadius: 8, padding: "14px 16px", background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span
                style={{
                  fontFamily: "var(--font-dm-mono, monospace)",
                  fontSize: "0.62rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: "#52525b",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: 10,
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
                  <li key={i} style={{ display: "flex", gap: 8, fontSize: "0.78rem", color: "#a1a1aa" }}>
                    <span style={{ fontFamily: "var(--font-dm-mono, monospace)", color: "#3ecf8e", flexShrink: 0, fontSize: "0.72rem" }}>{i + 1}.</span>
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
    e.stopPropagation();
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
    <div
      style={{
        background: "#0a0a0a",
        padding: "28px 32px 60px",
        minHeight: "100vh",
        fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
        position: "relative",
        zIndex: 1,
      }}
    >
      {/* Modals */}
      {showCredits && <BuyCreditsModal onClose={() => setShowCredits(false)} />}
      {selected    && <BreachDetailPanel email={selected} onClose={() => setSelected(null)} />}

      {/* Page Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1
            style={{
              fontSize: "1.4rem",
              fontWeight: 700,
              color: "#f0f0f0",
              letterSpacing: "-0.01em",
              margin: 0,
            }}
          >
            Email Breach Monitor
          </h1>
          <p style={{ color: "#52525b", fontSize: "0.8rem", marginTop: 4, marginBottom: 0 }}>
            Monitorización continua contra bases de datos de brechas conocidas
          </p>
        </div>
        <button
          onClick={() => setShowCredits(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "9px 18px",
            borderRadius: 8,
            background: "#1c1c1c",
            color: "#a1a1aa",
            fontSize: "0.875rem",
            fontWeight: 600,
            border: "1px solid rgba(255,255,255,0.06)",
            cursor: "pointer",
            transition: "all 0.15s",
            fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
            flexShrink: 0,
            marginTop: 2,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = "#3ecf8e";
            e.currentTarget.style.borderColor = "rgba(62,207,142,0.2)";
            e.currentTarget.style.background = "#242424";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = "#a1a1aa";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
            e.currentTarget.style.background = "#1c1c1c";
          }}
        >
          <svg viewBox="0 0 16 16" fill="none" style={{ width: 13, height: 13 }}>
            <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Comprar créditos
        </button>
      </div>

      {/* Add email card */}
      <div
        style={{
          background: "#1c1c1c",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 12,
          padding: "20px",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-dm-mono, monospace)",
            fontSize: "0.62rem",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "#52525b",
            fontWeight: 600,
            display: "block",
            marginBottom: 12,
          }}
        >
          Añadir email
        </span>
        <form onSubmit={handleAdd} style={{ display: "flex", gap: 8 }}>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="usuario@empresa.com"
            disabled={adding}
            style={{
              flex: 1,
              padding: "10px 14px",
              background: "#161616",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              color: "#f0f0f0",
              fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
              fontSize: "0.875rem",
              outline: "none",
              transition: "border-color 0.15s",
            }}
            onFocus={e => (e.currentTarget.style.borderColor = "rgba(62,207,142,0.3)")}
            onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
          />
          <button
            type="submit"
            disabled={adding || !newEmail.trim()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 18px",
              borderRadius: 8,
              background: "#3ecf8e",
              color: "#000",
              fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
              fontSize: "0.875rem",
              fontWeight: 700,
              border: "none",
              cursor: adding || !newEmail.trim() ? "not-allowed" : "pointer",
              opacity: adding || !newEmail.trim() ? 0.45 : 1,
              transition: "opacity 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            <svg viewBox="0 0 16 16" fill="none" style={{ width: 13, height: 13 }}>
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            {adding ? "Añadiendo..." : "Añadir"}
          </button>
        </form>
      </div>

      {/* Credits hint */}
      <p
        style={{
          fontFamily: "var(--font-dm-mono, monospace)",
          fontSize: "0.7rem",
          color: "#3a3a3a",
          marginBottom: 20,
          marginTop: 8,
        }}
      >
        Los escaneos manuales consumen 1 crédito por email · Haz clic en un email para ver el detalle
      </p>

      {/* Email list */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0" }}>
          <div
            style={{
              width: 26,
              height: 26,
              border: "2px solid rgba(62,207,142,0.15)",
              borderTopColor: "#3ecf8e",
              borderRadius: "50%",
            }}
            className="animate-spin"
          />
        </div>
      ) : emails.length === 0 ? (
        <div
          style={{
            background: "#1c1c1c",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 12,
            padding: "20px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "56px 0", textAlign: "center" }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "rgba(62,207,142,0.06)",
                border: "1px solid rgba(62,207,142,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" style={{ width: 22, height: 22 }}>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#3ecf8e" strokeWidth="1.4"/>
                <path d="M22 6l-10 7L2 6" stroke="#3ecf8e" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  color: "#f0f0f0",
                  margin: "0 0 6px",
                }}
              >
                Sin emails monitorizados
              </p>
              <p style={{ fontSize: "0.82rem", color: "#52525b", maxWidth: 300, margin: 0 }}>
                Añade direcciones de email para escanearlas contra bases de datos de brechas.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                  background: "#1c1c1c",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12,
                  padding: "14px 18px",
                  overflow: "hidden",
                  cursor: "pointer",
                  transition: "background 0.15s, border-color 0.15s",
                }}
                onClick={() => setSelected(e)}
                onMouseEnter={e2 => {
                  e2.currentTarget.style.background = "#242424";
                  e2.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                }}
                onMouseLeave={e2 => {
                  e2.currentTarget.style.background = "#1c1c1c";
                  e2.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
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

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {/* Avatar */}
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      background: "#111111",
                      border: "1px solid rgba(255,255,255,0.06)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--font-dm-mono, monospace)",
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      color: "#52525b",
                      flexShrink: 0,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {initials}
                  </div>

                  {/* Email + date */}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p
                      style={{
                        fontFamily: "var(--font-dm-mono, monospace)",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        color: "#f0f0f0",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        margin: 0,
                      }}
                    >
                      {e.email}
                    </p>
                    <p
                      style={{
                        fontFamily: "var(--font-dm-mono, monospace)",
                        fontSize: "0.68rem",
                        color: "#3a3a3a",
                        marginTop: 3,
                        marginBottom: 0,
                      }}
                    >
                      {lastCheck
                        ? `Revisado: ${new Date(lastCheck).toLocaleString("es-ES")}`
                        : "Pendiente primer escaneo"}
                    </p>
                  </div>

                  {/* Right: badge + actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {/* Breach badge */}
                    {isScanned ? (
                      <span
                        style={{
                          fontFamily: "var(--font-dm-mono, monospace)",
                          fontSize: "0.62rem",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: isBreached ? "rgba(239,68,68,0.10)" : "rgba(62,207,142,0.10)",
                          color: isBreached ? "#ef4444" : "#3ecf8e",
                        }}
                      >
                        {isBreached
                          ? `${e.total_breaches} breach${e.total_breaches !== 1 ? "es" : ""}`
                          : "0 breaches"}
                      </span>
                    ) : (
                      <span
                        style={{
                          fontFamily: "var(--font-dm-mono, monospace)",
                          fontSize: "0.62rem",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: "rgba(255,255,255,0.05)",
                          color: "#52525b",
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
                        padding: "6px 10px",
                        borderRadius: 8,
                        background: "#111111",
                        color: scanning === e.id ? "#3ecf8e" : "#a1a1aa",
                        fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        border: "1px solid rgba(255,255,255,0.06)",
                        cursor: scanning === e.id ? "not-allowed" : "pointer",
                        opacity: scanning === e.id ? 0.6 : 1,
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={e2 => {
                        if (scanning !== e.id) {
                          e2.currentTarget.style.color = "#3ecf8e";
                          e2.currentTarget.style.borderColor = "rgba(62,207,142,0.2)";
                        }
                      }}
                      onMouseLeave={e2 => {
                        e2.currentTarget.style.color = "#a1a1aa";
                        e2.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                      }}
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
                        padding: "6px 10px",
                        borderRadius: 8,
                        background: "rgba(239,68,68,0.08)",
                        color: "#ef4444",
                        border: "1px solid rgba(239,68,68,0.15)",
                        cursor: "pointer",
                        transition: "background 0.15s",
                        display: "flex",
                        alignItems: "center",
                      }}
                      onMouseEnter={e2 => { e2.currentTarget.style.background = "rgba(239,68,68,0.15)"; }}
                      onMouseLeave={e2 => { e2.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                    >
                      <svg viewBox="0 0 16 16" fill="none" style={{ width: 13, height: 13 }}>
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
