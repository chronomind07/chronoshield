"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "@/components/Toast";
import { emailsApi } from "@/lib/api";
import { useTranslation } from "@/contexts/LanguageContext";
import { usePlan } from "@/contexts/PlanContext";
import type { AxiosError } from "axios";

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
  quarantine_status?: "active" | "quarantined" | "recovered" | null;
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

function relTime(iso: string, lang = "es"): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return lang === "en" ? "just now" : "ahora mismo";
  if (m < 60) return lang === "en" ? `${m}m ago` : `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return lang === "en" ? `${h}h ago` : `hace ${h}h`;
  return new Date(iso).toLocaleDateString(lang === "en" ? "en-US" : "es-ES");
}

function getOverallStatus(email: MonitoredEmail, tFn?: (k: string) => string): {
  label: string;
  color: string;
  bg: string;
  border: string;
  leftBorder: string;
} {
  const tl = tFn ?? ((k: string) => k);
  if (!email.last_email_sec_scan_at) {
    return {
      label: tl("emails.status.unscanned"),
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
      label: tl("emails.status.protected"),
      color: "#3ecf8e",
      bg: "rgba(62,207,142,0.10)",
      border: "rgba(62,207,142,0.2)",
      leftBorder: "#3ecf8e",
    };
  }
  return {
    label: tl("emails.status.attention"),
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

function OverallBadge({ email, tFn }: { email: MonitoredEmail; tFn?: (k: string) => string }) {
  const s = getOverallStatus(email, tFn);
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

// ─── Quarantine Badge ─────────────────────────────────────────────────────────

function QuarantineBadge({ status }: { status: "quarantined" | "recovered" }) {
  const { t } = useTranslation();
  const isQ = status === "quarantined";
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "3px 10px",
      borderRadius: "6px",
      background: isQ ? "rgba(249,115,22,0.10)" : "rgba(99,102,241,0.10)",
      border: `0.8px solid ${isQ ? "rgba(249,115,22,0.25)" : "rgba(99,102,241,0.25)"}`,
      fontFamily: "var(--font-dm-mono)",
      fontSize: "10px",
      fontWeight: 700,
      color: isQ ? "#fb923c" : "#818cf8",
      whiteSpace: "nowrap",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
    }}>
      {isQ ? "⚠ " : "↻ "}
      {t(`darkweb.quarantine.${status}`)}
    </span>
  );
}

// ─── Email Card ───────────────────────────────────────────────────────────────

interface EmailCardProps {
  emailItem: MonitoredEmail;
  isExpanded: boolean;
  isScanning: boolean;
  isRecovering: boolean;
  onToggle: () => void;
  onScan: (e: React.MouseEvent, emailItem: MonitoredEmail) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onRecover: (e: React.MouseEvent, id: string) => void;
}

function EmailCard({
  emailItem,
  isExpanded,
  isScanning,
  isRecovering,
  onToggle,
  onScan,
  onDelete,
  onRecover,
}: EmailCardProps) {
  const { t, lang } = useTranslation();
  const overall = getOverallStatus(emailItem, t);
  const qStatus = emailItem.quarantine_status;

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
      className="cs-domain-item"
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
              ? relTime(emailItem.last_email_sec_scan_at, lang)
              : t("emails.neverScanned")}
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

        {/* Quarantine badge */}
        {(qStatus === "quarantined" || qStatus === "recovered") && (
          <div style={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
            <QuarantineBadge status={qStatus} />
          </div>
        )}

        {/* Overall badge */}
        <div
          style={{ flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <OverallBadge email={emailItem} tFn={t} />
        </div>

        {/* Scan button */}
        <button
          className="cs-btn"
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
          {isScanning ? t("emails.scanningBtn") : t("common.scan")}
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
          {t("emails.deleteBtn")}
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
          {/* Quarantine info banner */}
          {qStatus === "quarantined" && (
            <div style={{
              padding: "12px 14px",
              borderRadius: "8px",
              background: "rgba(249,115,22,0.06)",
              border: "0.8px solid rgba(249,115,22,0.2)",
              marginBottom: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}>
              <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "12px", color: "#fb923c", margin: 0, lineHeight: 1.5 }}>
                {t("darkweb.quarantine.quarantinedInfo")}
              </p>
              <button
                onClick={(e) => onRecover(e, emailItem.id)}
                disabled={isRecovering}
                style={{
                  alignSelf: "flex-start",
                  padding: "6px 14px",
                  borderRadius: "7px",
                  background: isRecovering ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.12)",
                  border: "0.8px solid rgba(99,102,241,0.25)",
                  color: "#818cf8",
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: isRecovering ? "not-allowed" : "pointer",
                  opacity: isRecovering ? 0.6 : 1,
                  transition: "all 150ms",
                }}
              >
                {isRecovering ? t("darkweb.quarantine.recovering") : t("darkweb.quarantine.recoverBtn")}
              </button>
            </div>
          )}
          {qStatus === "recovered" && (
            <div style={{
              padding: "12px 14px",
              borderRadius: "8px",
              background: "rgba(99,102,241,0.06)",
              border: "0.8px solid rgba(99,102,241,0.2)",
              marginBottom: "12px",
            }}>
              <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "12px", color: "#818cf8", margin: 0, lineHeight: 1.5 }}>
                {t("darkweb.quarantine.recoveredInfo")}
              </p>
            </div>
          )}
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
                  : t("emails.unknownStatus");

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
              {t("emails.lastScan")}{" "}
              {new Date(emailItem.last_email_sec_scan_at).toLocaleString(
                lang === "en" ? "en-US" : "es-ES",
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
  const { t, lang } = useTranslation();
  const { isFree } = usePlan();
  const [emails, setEmails] = useState<MonitoredEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scanning, setScanning] = useState<string | null>(null);
  const [recovering, setRecovering] = useState<string | null>(null);
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
        toast.error(t("emails.errorLoad"));
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
    if (isFree) {
      toast.error("Los escaneos manuales requieren créditos. Mejora tu plan →");
      return;
    }
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
      toast.success(`${t("emails.scanComplete")} — ${res.data.domain}`);
    } catch {
      toast.error(t("emails.errorScan"));
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
      toast.success(t("emails.addedOk"));
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { status?: number; data?: { detail?: string } };
      };
      const status = axiosErr?.response?.status;
      const detail = axiosErr?.response?.data?.detail;
      if (status === 402) {
        toast.error(t("common.planLimit"));
      } else if (status === 409) {
        toast.error(t("emails.alreadyMonitored"));
      } else {
        toast.error(
          typeof detail === "string" ? detail : t("emails.errorAdd")
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
      toast.success(t("emails.deletedOk"));
    } catch {
      toast.error(t("emails.errorDelete"));
    }
  };

  const handleRecover = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setRecovering(id);
    try {
      await emailsApi.recover(id);
      setEmails((prev) =>
        prev.map((em) =>
          em.id === id ? { ...em, quarantine_status: "recovered" } : em
        )
      );
      toast.success(t("darkweb.quarantine.recoveredInfo").slice(0, 60) + "…");
    } catch (err: unknown) {
      const axErr = err as AxiosError;
      toast.error(typeof axErr?.message === "string" ? axErr.message : "Error al actualizar");
    } finally {
      setRecovering(null);
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
        <div style={{ marginBottom: "32px" }} className="cs-fadeup-1">
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
            {t("emails.title2")}
          </h1>
          <p
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "0.875rem",
              color: "#71717a",
              margin: 0,
            }}
          >
            {t("emails.subtitle2")}
          </p>
        </div>

        {/* ── Add email form ───────────────────────────────────────────────────── */}
        <div
          className="cs-fadeup-2"
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
            placeholder={t("emails.inputPlaceholder")}
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
            {adding ? t("emails.addingBtn") : t("emails.addBtn2")}
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
              {t("emails.noEmailsLong")}
            </p>
            <p
              style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: "0.8rem",
                color: "#71717a",
                margin: 0,
              }}
            >
              {t("emails.addFirst")}
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
                isRecovering={recovering === emailItem.id}
                onToggle={() => handleToggle(emailItem.id)}
                onScan={handleScan}
                onDelete={handleDelete}
                onRecover={handleRecover}
              />
            ))}
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────────────── */}
        <div
          style={{
            background: "#151515",
            border: "0.8px solid #1a1a1a",
            borderRadius: 16,
            padding: "12px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 16,
          }}
        >
          <span style={{ fontSize: "12px", color: "#71717a" }}>© 2026 • v1.0.0</span>
          <span style={{ fontSize: "12px", color: "#71717a" }}>
            by <span style={{ color: "#b3b4b5", fontWeight: 500 }}>ChronoShield</span>
          </span>
        </div>
      </div>
    </div>
  );
}
