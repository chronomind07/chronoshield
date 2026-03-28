"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "@/components/Toast";
import { emailsApi } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonitoredEmail {
  id: string;
  email: string;
  created_at: string;
  is_active: boolean;
  spf_status: string | null;
  dkim_status: string | null;
  dmarc_status: string | null;
  last_email_sec_scan_at: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DNS_STATUS: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  valid: {
    label: "OK",
    color: "#3ecf8e",
    bg: "rgba(62,207,142,0.10)",
    border: "rgba(62,207,142,0.2)",
  },
  invalid: {
    label: "Inválido",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.10)",
    border: "rgba(239,68,68,0.2)",
  },
  missing: {
    label: "Falta",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.10)",
    border: "rgba(245,158,11,0.2)",
  },
  error: {
    label: "Error",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.10)",
    border: "rgba(245,158,11,0.2)",
  },
};

const DNS_DESCRIPTIONS: Record<string, Record<string, string>> = {
  spf: {
    valid: "El registro SPF está correctamente configurado.",
    invalid: "El registro SPF tiene errores de configuración.",
    missing: "No se encontró registro SPF para este dominio.",
    error: "No se pudo verificar el registro SPF.",
  },
  dkim: {
    valid: "La firma DKIM está activa y es válida.",
    invalid: "La firma DKIM presenta problemas de configuración.",
    missing: "No se detectó configuración DKIM.",
    error: "No se pudo verificar DKIM.",
  },
  dmarc: {
    valid: "La política DMARC está activa y protege el dominio.",
    invalid: "La política DMARC tiene errores.",
    missing: "No existe política DMARC configurada.",
    error: "No se pudo verificar DMARC.",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora mismo";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return new Date(iso).toLocaleDateString("es-ES");
}

function getOverallStatus(email: MonitoredEmail): {
  label: string;
  color: string;
  bg: string;
  border: string;
  leftBorder: string;
} {
  if (!email.last_email_sec_scan_at) {
    return {
      label: "Sin escanear",
      color: "#71717a",
      bg: "rgba(113,113,122,0.10)",
      border: "rgba(113,113,122,0.2)",
      leftBorder: "#2a2a2a",
    };
  }
  const allValid =
    email.spf_status === "valid" &&
    email.dkim_status === "valid" &&
    email.dmarc_status === "valid";
  if (allValid) {
    return {
      label: "Protegido",
      color: "#3ecf8e",
      bg: "rgba(62,207,142,0.10)",
      border: "rgba(62,207,142,0.2)",
      leftBorder: "#3ecf8e",
    };
  }
  return {
    label: "Atención",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.10)",
    border: "rgba(245,158,11,0.2)",
    leftBorder: "#f59e0b",
  };
}

function getInitials(email: string): string {
  return email.slice(0, 2).toUpperCase();
}

// ─── DNS Status Badge ─────────────────────────────────────────────────────────

function DnsBadge({
  label,
  status,
}: {
  label: string;
  status: string | null;
}) {
  const cfg = status ? DNS_STATUS[status] : null;
  const color = cfg?.color ?? "#71717a";
  const bg = cfg?.bg ?? "rgba(113,113,122,0.10)";
  const border = cfg?.border ?? "rgba(113,113,122,0.2)";
  const statusLabel = cfg?.label ?? "—";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "2px 7px",
        borderRadius: "5px",
        background: bg,
        border: `0.8px solid ${border}`,
        fontFamily: "var(--font-dm-mono)",
        fontSize: "11px",
        fontWeight: 500,
        color,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ color: "#71717a", fontWeight: 400 }}>{label}</span>
      <span>{statusLabel}</span>
    </span>
  );
}

// ─── Overall Badge ────────────────────────────────────────────────────────────

function OverallBadge({ email }: { email: MonitoredEmail }) {
  const s = getOverallStatus(email);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: "6px",
        background: s.bg,
        border: `0.8px solid ${s.border}`,
        fontFamily: "var(--font-dm-sans)",
        fontSize: "11px",
        fontWeight: 600,
        color: s.color,
        whiteSpace: "nowrap",
        letterSpacing: "0.01em",
      }}
    >
      {s.label}
    </span>
  );
}

// ─── Email Card ───────────────────────────────────────────────────────────────

interface EmailCardProps {
  emailItem: MonitoredEmail;
  isExpanded: boolean;
  isScanning: boolean;
  onToggle: () => void;
  onScan: (e: React.MouseEvent, emailItem: MonitoredEmail) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
}

function EmailCard({
  emailItem,
  isExpanded,
  isScanning,
  onToggle,
  onScan,
  onDelete,
}: EmailCardProps) {
  const overall = getOverallStatus(emailItem);

  const dnsChecks: Array<{
    key: string;
    label: string;
    status: string | null;
  }> = [
    { key: "spf", label: "SPF", status: emailItem.spf_status },
    { key: "dkim", label: "DKIM", status: emailItem.dkim_status },
    { key: "dmarc", label: "DMARC", status: emailItem.dmarc_status },
  ];

  return (
    <div
      style={{
        background: "#151515",
        border: "0.8px solid #1a1a1a",
        borderRadius: "10px",
        overflow: "hidden",
        transition: "border-color 150ms",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "#222";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "#1a1a1a";
      }}
    >
      {/* Card header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "14px 16px",
          borderLeft: `2px solid ${overall.leftBorder}`,
        }}
        onClick={onToggle}
      >
        {/* Avatar */}
        <div
          style={{
            width: "34px",
            height: "34px",
            minWidth: "34px",
            borderRadius: "8px",
            background: "#0b0b0b",
            border: "0.8px solid #1a1a1a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-dm-mono)",
            fontSize: "11px",
            fontWeight: 600,
            color: "#71717a",
            letterSpacing: "0.02em",
          }}
        >
          {getInitials(emailItem.email)}
        </div>

        {/* Email info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-dm-mono)",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#f5f5f5",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {emailItem.email}
          </div>
          <div
            style={{
              fontFamily: "var(--font-dm-mono)",
              fontSize: "0.68rem",
              color: "#71717a",
              marginTop: "2px",
            }}
          >
            {emailItem.last_email_sec_scan_at
              ? relTime(emailItem.last_email_sec_scan_at)
              : "Sin escanear"}
          </div>
        </div>

        {/* DNS badges */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            flexShrink: 0,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {dnsChecks.map((check) => (
            <DnsBadge
              key={check.key}
              label={check.label}
              status={check.status}
            />
          ))}
        </div>

        {/* Overall badge */}
        <div
          style={{ flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <OverallBadge email={emailItem} />
        </div>

        {/* Scan button */}
        <button
          onClick={(e) => onScan(e, emailItem)}
          disabled={isScanning}
          style={{
            flexShrink: 0,
            padding: "6px 14px",
            borderRadius: "7px",
            background: isScanning ? "rgba(62,207,142,0.15)" : "#3ecf8e",
            border: "none",
            color: isScanning ? "#3ecf8e" : "#000",
            fontFamily: "var(--font-dm-sans)",
            fontSize: "12px",
            fontWeight: 600,
            cursor: isScanning ? "not-allowed" : "pointer",
            transition: "opacity 150ms",
            opacity: isScanning ? 0.7 : 1,
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => {
            if (!isScanning)
              (e.currentTarget as HTMLButtonElement).style.opacity = "0.85";
          }}
          onMouseLeave={(e) => {
            if (!isScanning)
              (e.currentTarget as HTMLButtonElement).style.opacity = "1";
          }}
        >
          {isScanning ? "Escaneando…" : "Escanear"}
        </button>

        {/* Delete button */}
        <button
          onClick={(e) => onDelete(e, emailItem.id)}
          style={{
            flexShrink: 0,
            padding: "6px 10px",
            borderRadius: "7px",
            background: "rgba(239,68,68,0.08)",
            border: "0.8px solid rgba(239,68,68,0.18)",
            color: "#ef4444",
            fontFamily: "var(--font-dm-sans)",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "background 150ms",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "rgba(239,68,68,0.14)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "rgba(239,68,68,0.08)";
          }}
        >
          Eliminar
        </button>

        {/* Expand chevron */}
        <div
          style={{
            color: "#71717a",
            fontSize: "13px",
            flexShrink: 0,
            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms",
            userSelect: "none",
          }}
        >
          ▾
        </div>
      </div>

      {/* Expandable section */}
      {isExpanded && (
        <div
          style={{
            padding: "16px",
            borderTop: "0.8px solid #1a1a1a",
            background: "rgba(255,255,255,0.01)",
          }}
        >
          {/* DNS rows */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              marginBottom: emailItem.last_email_sec_scan_at ? "14px" : "0",
            }}
          >
            {dnsChecks.map((check) => {
              const cfg = check.status ? DNS_STATUS[check.status] : null;
              const color = cfg?.color ?? "#71717a";
              const bg = cfg?.bg ?? "rgba(113,113,122,0.10)";
              const border = cfg?.border ?? "rgba(113,113,122,0.2)";
              const statusLabel = cfg?.label ?? "—";
              const description =
                check.status && DNS_DESCRIPTIONS[check.key]?.[check.status]
                  ? DNS_DESCRIPTIONS[check.key][check.status]
                  : "Estado desconocido.";

              return (
                <div
                  key={check.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    background: "#0d0d0d",
                    border: "0.8px solid #1a1a1a",
                  }}
                >
                  {/* Check label */}
                  <span
                    style={{
                      fontFamily: "var(--font-dm-mono)",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#b3b4b5",
                      width: "44px",
                      flexShrink: 0,
                    }}
                  >
                    {check.label}
                  </span>

                  {/* Status badge */}
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "2px 9px",
                      borderRadius: "5px",
                      background: bg,
                      border: `0.8px solid ${border}`,
                      fontFamily: "var(--font-dm-mono)",
                      fontSize: "11px",
                      fontWeight: 600,
                      color,
                      flexShrink: 0,
                    }}
                  >
                    {statusLabel}
                  </span>

                  {/* Description */}
                  <span
                    style={{
                      fontFamily: "var(--font-dm-sans)",
                      fontSize: "12px",
                      color: "#71717a",
                      lineHeight: "1.4",
                    }}
                  >
                    {description}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Last scan timestamp */}
          {emailItem.last_email_sec_scan_at && (
            <div
              style={{
                fontFamily: "var(--font-dm-mono)",
                fontSize: "11px",
                color: "#71717a",
                paddingTop: "4px",
              }}
            >
              Último escaneo:{" "}
              {new Date(emailItem.last_email_sec_scan_at).toLocaleString(
                "es-ES",
                {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmailsPage() {
  const [emails, setEmails] = useState<MonitoredEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scanning, setScanning] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Load emails ─────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const res = await emailsApi.list();
        setEmails(Array.isArray(res.data) ? res.data : []);
      } catch {
        toast.error("Error al cargar los emails");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleToggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleScan = async (
    e: React.MouseEvent,
    emailItem: MonitoredEmail
  ) => {
    e.stopPropagation();
    setScanning(emailItem.id);
    try {
      const res = await emailsApi.scan(emailItem.id);
      setEmails((prev) =>
        prev.map((em) =>
          em.id === emailItem.id
            ? {
                ...em,
                spf_status: res.data.spf_status,
                dkim_status: res.data.dkim_status,
                dmarc_status: res.data.dmarc_status,
                last_email_sec_scan_at: res.data.last_email_sec_scan_at,
              }
            : em
        )
      );
      setExpandedId(emailItem.id);
      toast.success(`Escaneo completado — ${res.data.domain}`);
    } catch {
      toast.error("Error al escanear");
    } finally {
      setScanning(null);
    }
  };

  const handleAdd = async () => {
    const trimmed = newEmail.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      const res = await emailsApi.add(trimmed);
      setEmails((prev) => [...prev, res.data]);
      setNewEmail("");
      inputRef.current?.focus();
      toast.success("Email añadido correctamente");
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { status?: number; data?: { detail?: string } };
      };
      const status = axiosErr?.response?.status;
      const detail = axiosErr?.response?.data?.detail;
      if (status === 402) {
        toast.error("Límite de plan alcanzado");
      } else if (status === 409) {
        toast.error("Este email ya está siendo monitorizado");
      } else {
        toast.error(
          typeof detail === "string" ? detail : "Error al añadir el email"
        );
      }
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await emailsApi.remove(id);
      setEmails((prev) => prev.filter((em) => em.id !== id));
      if (expandedId === id) setExpandedId(null);
      toast.success("Email eliminado");
    } catch {
      toast.error("Error al eliminar el email");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleAdd();
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b0b0b",
        fontFamily: "var(--font-dm-sans)",
        color: "#f5f5f5",
      }}
    >
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "40px 24px 80px",
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: "32px" }}>
          <h1
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "#f5f5f5",
              margin: "0 0 6px",
              letterSpacing: "-0.02em",
            }}
          >
            Emails Monitorizados
          </h1>
          <p
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "0.875rem",
              color: "#71717a",
              margin: 0,
            }}
          >
            Verifica SPF, DKIM y DMARC de tus dominios de correo al instante.
          </p>
        </div>

        {/* ── Add email form ───────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            marginBottom: "28px",
          }}
        >
          <input
            ref={inputRef}
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="nombre@empresa.com"
            style={{
              flex: 1,
              padding: "10px 14px",
              background: "#151515",
              border: "0.8px solid #1a1a1a",
              borderRadius: "8px",
              color: "#f5f5f5",
              fontFamily: "var(--font-dm-mono)",
              fontSize: "0.85rem",
              outline: "none",
              transition: "border-color 150ms",
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLInputElement).style.borderColor =
                "rgba(62,207,142,0.4)";
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLInputElement).style.borderColor =
                "#1a1a1a";
            }}
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newEmail.trim()}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              background:
                adding || !newEmail.trim()
                  ? "rgba(62,207,142,0.15)"
                  : "#3ecf8e",
              border: "none",
              color: adding || !newEmail.trim() ? "#3ecf8e" : "#000",
              fontFamily: "var(--font-dm-sans)",
              fontSize: "13px",
              fontWeight: 600,
              cursor: adding || !newEmail.trim() ? "not-allowed" : "pointer",
              transition: "opacity 150ms",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              if (!adding && newEmail.trim())
                (e.currentTarget as HTMLButtonElement).style.opacity = "0.85";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = "1";
            }}
          >
            {adding ? "Añadiendo…" : "+ Añadir"}
          </button>
        </div>

        {/* ── Content ─────────────────────────────────────────────────────────── */}
        {loading ? (
          /* Loading skeleton */
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: "68px",
                  borderRadius: "10px",
                  background: "#151515",
                  border: "0.8px solid #1a1a1a",
                  opacity: 1 - i * 0.2,
                }}
              />
            ))}
          </div>
        ) : emails.length === 0 ? (
          /* Empty state */
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "80px 24px",
              background: "#151515",
              border: "0.8px solid #1a1a1a",
              borderRadius: "12px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "#0b0b0b",
                border: "0.8px solid #1a1a1a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
                marginBottom: "16px",
              }}
            >
              ✉
            </div>
            <p
              style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: "0.9rem",
                fontWeight: 600,
                color: "#b3b4b5",
                margin: "0 0 6px",
              }}
            >
              No hay emails monitorizados
            </p>
            <p
              style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: "0.8rem",
                color: "#71717a",
                margin: 0,
              }}
            >
              Añade un email para empezar a verificar su configuración DNS.
            </p>
          </div>
        ) : (
          /* Email cards */
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {emails.map((emailItem) => (
              <EmailCard
                key={emailItem.id}
                emailItem={emailItem}
                isExpanded={expandedId === emailItem.id}
                isScanning={scanning === emailItem.id}
                onToggle={() => handleToggle(emailItem.id)}
                onScan={handleScan}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────────────── */}
        <div
          style={{
            marginTop: "60px",
            paddingTop: "20px",
            borderTop: "0.8px solid #1a1a1a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-dm-mono)",
              fontSize: "11px",
              color: "#2a2a2a",
              letterSpacing: "0.02em",
            }}
          >
            © 2026 ChronoShield • v1.0.0
          </span>
        </div>
      </div>
    </div>
  );
}
