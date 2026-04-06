"use client";

import { useEffect, useState } from "react";
import { domainsApi } from "@/lib/api";
import { useTechMode } from "@/lib/mode-context";
import BuyCreditsModal from "@/components/BuyCreditsModal";
import { toast } from "@/components/Toast";
import { useCredits } from "@/contexts/CreditsContext";
import { useTranslation } from "@/contexts/LanguageContext";
import { usePlan } from "@/contexts/PlanContext";
import { DomainsSkeleton } from "@/components/Skeleton";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Domain {
  id: string;
  domain: string;
  is_active: boolean;
  created_at: string;
  last_scanned_at: string | null;
  security_score: number | null;
  ssl_status: string | null;        // "valid" | "expired" | "error"
  ssl_days_remaining: number | null;
  uptime_status: string | null;     // "up" | "down" | "error"
  last_response_ms: number | null;
  spf_status: string | null;        // "pass" | "fail" | "none"
  dkim_status: string | null;
  dmarc_status: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function domainBorderColor(d: Domain): string {
  if (!d.last_scanned_at) return "#2a2a2a";
  if (d.uptime_status === "down") return "#ef4444";
  if (d.ssl_status && d.ssl_status !== "valid") return "#f59e0b";
  if (d.security_score !== null && d.security_score >= 80) return "#3ecf8e";
  if (d.security_score !== null && d.security_score >= 60) return "#f59e0b";
  return "#ef4444";
}

function scoreColor(score: number): string {
  if (score >= 80) return "#3ecf8e";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
}

function ScorePill({ score }: { score: number }) {
  const color = scoreColor(score);
  const isGreen = color === "#3ecf8e";
  const isYellow = color === "#f59e0b";
  const bg = isGreen
    ? "rgba(62,207,142,0.1)"
    : isYellow
    ? "rgba(245,158,11,0.1)"
    : "rgba(239,68,68,0.1)";
  const border = isGreen
    ? "0.8px solid rgba(62,207,142,0.2)"
    : isYellow
    ? "0.8px solid rgba(245,158,11,0.2)"
    : "0.8px solid rgba(239,68,68,0.2)";

  return (
    <span
      style={{
        fontFamily: "var(--font-dm-mono, monospace)",
        fontSize: "11px",
        fontWeight: 500,
        padding: "2px 8px",
        borderRadius: 6,
        color,
        background: bg,
        border,
        letterSpacing: "0.01em",
      }}
    >
      {score}
    </span>
  );
}

type StatusDef = { label: string; color: string; bg: string };

function StatusChip({ status, labelMap }: {
  status: string | null;
  labelMap: Record<string, StatusDef>;
}) {
  if (!status) return null;
  const s: StatusDef = labelMap[status] ?? { label: status, color: "#71717a", bg: "rgba(255,255,255,0.05)" };
  const borderColor = s.color === "#3ecf8e"
    ? "rgba(62,207,142,0.2)"
    : s.color === "#f59e0b"
    ? "rgba(245,158,11,0.2)"
    : s.color === "#ef4444"
    ? "rgba(239,68,68,0.2)"
    : "rgba(113,113,122,0.2)";
  return (
    <span
      style={{
        fontFamily: "var(--font-dm-mono, monospace)",
        fontSize: "11px",
        fontWeight: 500,
        padding: "2px 8px",
        borderRadius: 6,
        color: s.color,
        background: s.bg,
        border: `0.8px solid ${borderColor}`,
      }}
    >
      {s.label}
    </span>
  );
}

const SSL_LABELS: Record<string, StatusDef> = {
  valid:   { label: "SSL OK",    color: "#3ecf8e", bg: "rgba(62,207,142,0.10)"  },
  expired: { label: "SSL Venc.", color: "#f59e0b", bg: "rgba(245,158,11,0.10)"  },
  error:   { label: "SSL Error", color: "#ef4444", bg: "rgba(239,68,68,0.10)"   },
};

const UPTIME_LABELS: Record<string, StatusDef> = {
  up:    { label: "Online", color: "#3ecf8e", bg: "rgba(62,207,142,0.10)"  },
  down:  { label: "Caída",  color: "#ef4444", bg: "rgba(239,68,68,0.10)"   },
  error: { label: "Error",  color: "#f59e0b", bg: "rgba(245,158,11,0.10)"  },
};

const STATUS_LABELS: Record<string, StatusDef> = {
  // Backend scanner values
  valid:   { label: "OK",       color: "#3ecf8e", bg: "rgba(62,207,142,0.10)"  },
  invalid: { label: "Inválido", color: "#ef4444", bg: "rgba(239,68,68,0.10)"   },
  missing: { label: "Falta",    color: "#f59e0b", bg: "rgba(245,158,11,0.10)"  },
  error:   { label: "Error",    color: "#f59e0b", bg: "rgba(245,158,11,0.10)"  },
  // Legacy / compatibility values
  pass:    { label: "Pass",     color: "#3ecf8e", bg: "rgba(62,207,142,0.10)"  },
  fail:    { label: "Fail",     color: "#ef4444", bg: "rgba(239,68,68,0.10)"   },
  none:    { label: "N/A",      color: "#71717a", bg: "rgba(255,255,255,0.05)" },
};

// ── Badge maps for header chips ───────────────────────────────────────────────
const SSL_BADGE_MAP: Record<string, StatusDef> = {
  valid:   { label: "OK",    color: "#3ecf8e", bg: "rgba(62,207,142,0.10)"  },
  expired: { label: "Venc.", color: "#f59e0b", bg: "rgba(245,158,11,0.10)"  },
  error:   { label: "Error", color: "#ef4444", bg: "rgba(239,68,68,0.10)"   },
};

const UPTIME_BADGE_MAP: Record<string, StatusDef> = {
  up:    { label: "Online", color: "#3ecf8e", bg: "rgba(62,207,142,0.10)"  },
  down:  { label: "Caída",  color: "#ef4444", bg: "rgba(239,68,68,0.10)"   },
  error: { label: "Error",  color: "#f59e0b", bg: "rgba(245,158,11,0.10)"  },
};

function getDomainOverallStatus(d: Domain, tFn?: (k: string) => string): { label: string; color: string; bg: string; border: string } {
  const tl = tFn ?? ((k: string) => k);
  if (!d.last_scanned_at) {
    return { label: tl("domains.status.unscanned"), color: "#71717a", bg: "rgba(113,113,122,0.10)", border: "rgba(113,113,122,0.2)" };
  }
  const bc = domainBorderColor(d);
  if (bc === "#3ecf8e") {
    return { label: tl("domains.status.protected"), color: "#3ecf8e", bg: "rgba(62,207,142,0.10)", border: "rgba(62,207,142,0.2)" };
  }
  if (bc === "#ef4444") {
    return { label: tl("domains.status.attention"),  color: "#ef4444", bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.2)"  };
  }
  return { label: tl("domains.status.attention"), color: "#f59e0b", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.2)" };
}

function DomainDnsBadge({ label, status, statusMap }: {
  label: string;
  status: string | null;
  statusMap?: Record<string, StatusDef>;
}) {
  const map = statusMap ?? STATUS_LABELS;
  const s: StatusDef = status ? (map[status] ?? { label: status, color: "#71717a", bg: "rgba(113,113,122,0.10)" }) : { label: "—", color: "#71717a", bg: "rgba(113,113,122,0.10)" };
  const borderColor =
    s.color === "#3ecf8e" ? "rgba(62,207,142,0.2)"  :
    s.color === "#f59e0b" ? "rgba(245,158,11,0.2)"  :
    s.color === "#ef4444" ? "rgba(239,68,68,0.2)"   :
    "rgba(113,113,122,0.2)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 7px", borderRadius: "5px", background: s.bg, border: `0.8px solid ${borderColor}`, fontFamily: "var(--font-dm-mono, monospace)", fontSize: "11px", fontWeight: 500, color: s.color, whiteSpace: "nowrap" }}>
      <span style={{ color: "#71717a", fontWeight: 400 }}>{label}</span>
      <span>{s.label}</span>
    </span>
  );
}

function relTime(iso: string, lang = "es"): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return lang === "en" ? "just now" : "ahora mismo";
  if (m < 60) return lang === "en" ? `${m} min ago` : `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return lang === "en" ? `${h}h ago` : `hace ${h}h`;
  return new Date(iso).toLocaleDateString(lang === "en" ? "en-US" : "es-ES");
}

/** Derive actionable recommendations from scan data */
function getRecommendations(d: Domain): { icon: string; text: string }[] {
  const recs: { icon: string; text: string }[] = [];

  if (d.ssl_status === "expired") {
    recs.push({ icon: "red", text: "Tu certificado SSL ha caducado. Renuévalo urgentemente para evitar alertas de seguridad en los navegadores." });
  } else if (d.ssl_status === "error") {
    recs.push({ icon: "warn", text: "Hay un problema con tu certificado SSL. Verifica la configuración de tu servidor." });
  } else if (d.ssl_days_remaining !== null && d.ssl_days_remaining < 30) {
    recs.push({ icon: "warn", text: `Tu certificado SSL caduca en ${d.ssl_days_remaining} días. Renuévalo pronto para evitar interrupciones.` });
  }

  if (d.uptime_status === "down") {
    recs.push({ icon: "red", text: "Tu servidor está caído. Contacta con tu proveedor de hosting o reinicia el servidor." });
  } else if (d.uptime_status === "error") {
    recs.push({ icon: "warn", text: "No se puede acceder a tu servidor. Revisa el firewall o la configuración DNS." });
  }

  if (d.spf_status && d.spf_status !== "pass" && d.spf_status !== "valid") {
    recs.push({ icon: "info", text: "Configura un registro SPF en tu DNS para evitar que otros envíen correos suplantando tu dominio." });
  }
  if (d.dkim_status && d.dkim_status !== "pass" && d.dkim_status !== "valid") {
    recs.push({ icon: "info", text: "Activa DKIM para firmar criptográficamente los correos salientes y mejorar la entregabilidad." });
  }
  if (d.dmarc_status && d.dmarc_status !== "pass" && d.dmarc_status !== "valid") {
    recs.push({ icon: "info", text: "Añade un registro DMARC para definir qué hacer con correos que no pasen SPF/DKIM." });
  }

  return recs;
}

// ── DomainCard ─────────────────────────────────────────────────────────────────
interface DomainCardProps {
  isFree?: boolean;
  domain: Domain;
  isExpanded: boolean;
  isScanning: boolean;
  onToggle: () => void;
  onScan: (e: React.MouseEvent, id: string) => void;
  onDelete: (id: string, name: string) => void;
}

function DomainCard({ domain: d, isExpanded, isScanning, isFree = false, onToggle, onScan, onDelete }: DomainCardProps) {
  const { t, lang } = useTranslation();
  const recs = getRecommendations(d);
  const borderColor = domainBorderColor(d);

  const secRow = (label: string, status: string | null, isLast = false) => {
    const s = STATUS_LABELS[status ?? "none"] ?? STATUS_LABELS["none"];
    const chipBorder = s.color === "#3ecf8e"
      ? "rgba(62,207,142,0.2)"
      : s.color === "#f59e0b"
      ? "rgba(245,158,11,0.2)"
      : s.color === "#ef4444"
      ? "rgba(239,68,68,0.2)"
      : "rgba(113,113,122,0.2)";
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "9px 0",
          borderBottom: isLast ? "none" : "0.8px solid #1a1a1a",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-dm-mono, monospace)",
            fontSize: "0.75rem",
            color: "#71717a",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: "var(--font-dm-mono, monospace)",
            fontSize: "11px",
            fontWeight: 500,
            padding: "2px 8px",
            borderRadius: 6,
            color: s.color,
            background: s.bg,
            border: `0.8px solid ${chipBorder}`,
          }}
        >
          {s.label}
        </span>
      </div>
    );
  };

  return (
    <div
      className="cs-domain-item"
      style={{
        background: "#151515",
        border: "0.8px solid #1a1a1a",
        borderRadius: 10,
        overflow: "hidden",
        fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          position: "relative",
          overflow: "hidden",
          cursor: "pointer",
          transition: "background 0.15s",
        }}
        onClick={onToggle}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "#1c1c1c"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
      >
        {/* Left color border */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 2,
            background: borderColor,
          }}
        />

        {/* Domain icon */}
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: "rgba(62,207,142,0.08)",
            border: "0.8px solid rgba(62,207,142,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" style={{ width: 16, height: 16 }}>
            <circle cx="12" cy="12" r="10" stroke="#3ecf8e" strokeWidth="1.4" />
            <path d="M12 2C12 2 8 7 8 12s4 10 4 10M12 2c0 0 4 5 4 10s-4 10-4 10" stroke="#3ecf8e" strokeWidth="1.2" />
            <path d="M2 12h20" stroke="#3ecf8e" strokeWidth="1.2" />
          </svg>
        </div>

        {/* Domain info */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              fontFamily: "var(--font-dm-mono, monospace)",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#f5f5f5",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              margin: 0,
            }}
          >
            {d.domain}
          </p>
          <p
            style={{
              fontFamily: "var(--font-dm-mono, monospace)",
              fontSize: "0.68rem",
              color: "#71717a",
              marginTop: 3,
              marginBottom: 0,
            }}
          >
            {d.last_scanned_at
              ? `${t("domains.lastScan")} ${relTime(d.last_scanned_at, lang)}`
              : t("domains.neverScanned")}
          </p>
        </div>

        {/* Badges area */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Individual DNS + SSL + Uptime badges */}
          <DomainDnsBadge label="SPF"   status={d.spf_status}    />
          <DomainDnsBadge label="DKIM"  status={d.dkim_status}   />
          <DomainDnsBadge label="DMARC" status={d.dmarc_status}  />
          <DomainDnsBadge label="SSL"   status={d.ssl_status}    statusMap={SSL_BADGE_MAP}    />
          <DomainDnsBadge label="Web"   status={d.uptime_status} statusMap={UPTIME_BADGE_MAP} />
          {/* Overall status badge */}
          {(() => {
            const os = getDomainOverallStatus(d, t);
            return (
              <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: "6px", background: os.bg, border: `0.8px solid ${os.border}`, fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: "11px", fontWeight: 600, color: os.color, whiteSpace: "nowrap", letterSpacing: "0.01em" }}>
                {os.label}
              </span>
            );
          })()}
          {d.security_score !== null && <ScorePill score={d.security_score} />}

          {/* Scan button — hidden/locked for free users */}
          {isFree ? (
            <span
              title="Mejora tu plan para escanear manualmente"
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: "rgba(255,255,255,0.03)",
                color: "#3a3a3a", borderRadius: 8, padding: "8px 16px",
                fontSize: "13px", fontWeight: 600,
                border: "1px solid rgba(255,255,255,0.05)",
                cursor: "not-allowed", opacity: 0.45,
                fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                userSelect: "none",
              }}
            >
              <svg viewBox="0 0 16 16" fill="none" style={{ width: 11, height: 11 }}>
                <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              {t("domains.scanBtn")}
            </span>
          ) : (
            <button
              className="cs-btn"
              onClick={(e) => { e.stopPropagation(); onScan(e, d.id); }}
              disabled={isScanning}
              title={t("domains.scanTooltip")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: "#3ecf8e", color: "#000",
                borderRadius: 8, padding: "8px 16px",
                fontSize: "13px", fontWeight: 600, border: "none",
                cursor: isScanning ? "not-allowed" : "pointer",
                opacity: isScanning ? 0.6 : 1,
                transition: "opacity 0.15s",
                fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
              }}
            >
              <svg viewBox="0 0 16 16" fill="none" style={{ width: 12, height: 12 }} className={isScanning ? "animate-spin" : ""}>
                <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M8 1v3l2-1.5L8 1Z" fill="currentColor"/>
              </svg>
              {t("domains.scanBtn")}
            </button>
          )}

          {/* Delete button */}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(d.id, d.domain); }}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              background: "rgba(239,68,68,0.1)",
              color: "#ef4444",
              border: "0.8px solid rgba(239,68,68,0.2)",
              cursor: "pointer",
              fontSize: "13px",
              transition: "background 0.15s",
              display: "flex",
              alignItems: "center",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.18)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
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

          {/* Expand chevron */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              color: "#71717a",
              flexShrink: 0,
            }}
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              style={{
                width: 14,
                height: 14,
                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
              }}
            >
              <path
                d="M3 6l5 5 5-5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded section */}
      {isExpanded && (
        <div
          style={{
            padding: 16,
            borderTop: "0.8px solid #1a1a1a",
            background: "rgba(255,255,255,0.01)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* Last scan timestamp */}
          {d.last_scanned_at && (
            <p
              style={{
                fontFamily: "var(--font-dm-mono, monospace)",
                fontSize: "0.72rem",
                color: "#71717a",
                margin: 0,
              }}
            >
              {t("domains.lastScanFull")} {new Date(d.last_scanned_at).toLocaleString(lang === "en" ? "en-US" : "es-ES")}
            </p>
          )}

          {/* SSL card */}
          <div
            style={{
              borderRadius: 12,
              padding: "14px 16px",
              background: "#1c1c1c",
              border: "0.8px solid #1a1a1a",
            }}
          >
            <span
              style={{
                fontSize: "0.62rem",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "#71717a",
                fontWeight: 600,
                display: "block",
                marginBottom: 10,
              }}
            >
              {t("domains.sslCert")}
            </span>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: d.ssl_status === "valid" ? "#3ecf8e" : d.ssl_status ? "#ef4444" : "#71717a",
                }}
              >
                {d.ssl_status === "valid" ? t("domains.ssl.valid") :
                 d.ssl_status === "expired" ? t("domains.ssl.expired") :
                 d.ssl_status === "error" ? t("domains.ssl.error") : t("domains.ssl.noData")}
              </span>
              {d.ssl_days_remaining !== null && (
                <span
                  style={{
                    fontFamily: "var(--font-dm-mono, monospace)",
                    fontSize: "0.75rem",
                    color: "#71717a",
                  }}
                >
                  {d.ssl_days_remaining} {t("domains.daysRemaining")}
                </span>
              )}
            </div>
            {d.security_score !== null && (
              <div style={{ marginTop: 12 }}>
                <div
                  style={{
                    height: 4,
                    borderRadius: 2,
                    background: "#262626",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, d.security_score)}%`,
                      background: "#3ecf8e",
                      borderRadius: 2,
                      transition: "width 0.5s ease",
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Uptime card */}
          <div
            style={{
              borderRadius: 12,
              padding: "14px 16px",
              background: "#1c1c1c",
              border: "0.8px solid #1a1a1a",
            }}
          >
            <span
              style={{
                fontSize: "0.62rem",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "#71717a",
                fontWeight: 600,
                display: "block",
                marginBottom: 10,
              }}
            >
              {t("domains.uptime")}
            </span>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: d.uptime_status === "up" ? "#3ecf8e" : d.uptime_status ? "#ef4444" : "#71717a",
                }}
              >
                {d.uptime_status === "up" ? t("domains.uptime.up") :
                 d.uptime_status === "down" ? t("domains.uptime.down") :
                 d.uptime_status === "error" ? t("domains.uptime.error") : t("domains.uptime.noData")}
              </span>
              {d.last_response_ms !== null && (
                <span
                  style={{
                    fontFamily: "var(--font-dm-mono, monospace)",
                    fontSize: "0.75rem",
                    color: "#71717a",
                  }}
                >
                  {d.last_response_ms} ms
                </span>
              )}
            </div>
          </div>

          {/* Email Security card */}
          <div
            style={{
              borderRadius: 12,
              padding: "14px 16px",
              background: "#1c1c1c",
              border: "0.8px solid #1a1a1a",
            }}
          >
            <span
              style={{
                fontSize: "0.62rem",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "#71717a",
                fontWeight: 600,
                display: "block",
                marginBottom: 6,
              }}
            >
              {t("domains.emailSec")}
            </span>
            {secRow("SPF",   d.spf_status)}
            {secRow("DKIM",  d.dkim_status)}
            {secRow("DMARC", d.dmarc_status, true)}
          </div>

          {/* Recommendations */}
          {recs.length > 0 ? (
            <div
              style={{
                borderRadius: 12,
                padding: "14px 16px",
                background: "#1c1c1c",
                border: "0.8px solid #1a1a1a",
              }}
            >
              <span
                style={{
                  fontSize: "0.62rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: "#f59e0b",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: 10,
                }}
              >
                {t("domains.recommendations")}
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {recs.map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        flexShrink: 0,
                        marginTop: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: r.icon === "red"
                          ? "rgba(239,68,68,0.12)"
                          : r.icon === "warn"
                          ? "rgba(245,158,11,0.12)"
                          : "rgba(62,207,142,0.12)",
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: r.icon === "red"
                            ? "#ef4444"
                            : r.icon === "warn"
                            ? "#f59e0b"
                            : "#3ecf8e",
                        }}
                      />
                    </div>
                    <p style={{ fontSize: "0.78rem", color: "#b3b4b5", lineHeight: 1.6, margin: 0 }}>{r.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : d.last_scanned_at ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                borderRadius: 12,
                padding: "12px 14px",
                background: "rgba(62,207,142,0.05)",
                border: "0.8px solid rgba(62,207,142,0.2)",
              }}
            >
              <svg viewBox="0 0 16 16" fill="none" style={{ width: 14, height: 14, flexShrink: 0 }}>
                <path d="M3 8l3.5 3.5L13 4" stroke="#3ecf8e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p style={{ fontSize: "0.78rem", color: "#3ecf8e", margin: 0 }}>
                {t("domains.noRecommendations")}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function DomainsPage() {
  const { techMode } = useTechMode();
  const { decrementCredits, refreshCredits } = useCredits();
  const { t, lang } = useTranslation();
  const { isFree } = usePlan();
  const [domains, setDomains]         = useState<Domain[]>([]);
  const [loading, setLoading]         = useState(true);
  const [adding, setAdding]           = useState(false);
  const [newDomain, setNewDomain]     = useState("");
  const [scanning, setScanning]       = useState<string | null>(null);
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [showCredits, setShowCredits] = useState(false);

  const load = async () => {
    try {
      const res = await domainsApi.list();
      setDomains(Array.isArray(res.data) ? res.data : (res.data?.data ?? []));
    } catch {
      toast.error(t("domains.errorLoad"));
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    // BUG-2: strip protocol + www. prefix before submitting
    const domain = newDomain.trim()
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/\/$/, "")
      .toLowerCase();
    if (!domain) return;
    setAdding(true);
    try {
      const res = await domainsApi.add(domain);
      setDomains((prev) => [...prev, res.data]);
      setNewDomain("");
      toast.success(t("domains.addedSuccess"));
    } catch (err: any) {
      const msg = err?.response?.data?.detail || t("domains.errorAdd");
      toast.error(msg);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: string, domain: string) => {
    if (!confirm(`${t("domains.confirmDelete")} ${domain}?`)) return;
    try {
      await domainsApi.remove(id);
      setDomains((prev) => prev.filter((d) => d.id !== id));
      if (expandedId === id) setExpandedId(null);
      toast.success(t("domains.deletedSuccess"));
    } catch {
      toast.error(t("domains.errorDelete"));
    }
  };

  const handleScan = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (isFree) {
      toast.error("Los escaneos manuales requieren créditos. Mejora tu plan →");
      return;
    }
    setScanning(id);
    try {
      const res = await domainsApi.scan(id);
      const remaining = res.data?.credits_remaining;

      toast.info(t("domains.scanningMsg"));

      // Wait for the background scan to complete (~12 s)
      await new Promise((resolve) => setTimeout(resolve, 12000));

      // Reload the full domain list
      const freshRes = await domainsApi.list();
      const freshDomains: Domain[] = Array.isArray(freshRes.data) ? freshRes.data : (freshRes.data?.data ?? []);
      setDomains(freshDomains);

      // Keep card expanded with fresh data if it was already expanded
      // (expandedId state stays the same; the domain data is updated in place)

      decrementCredits(1);
      refreshCredits();

      // Result toast
      const d = freshDomains.find((d) => d.id === id);
      if (d) {
        const allOk =
          d.ssl_status === "valid" &&
          d.uptime_status === "up" &&
          d.spf_status === "valid" &&
          d.dkim_status === "valid" &&
          d.dmarc_status === "valid";

        if (allOk) {
          toast.success(t("domains.wellConfigured").replace("{domain}", d.domain));
        } else {
          const issues: string[] = [];
          if (d.ssl_status && d.ssl_status !== "valid") issues.push("SSL");
          if (d.uptime_status && d.uptime_status !== "up") issues.push("Uptime");
          if (d.spf_status   && d.spf_status   !== "valid") issues.push("SPF");
          if (d.dkim_status  && d.dkim_status  !== "valid") issues.push("DKIM");
          if (d.dmarc_status && d.dmarc_status !== "valid") issues.push("DMARC");
          if (issues.length > 0) {
            toast.warning(`${t("domains.reviewIssues")} ${issues.join(", ")}`);
          } else {
            toast.success(t("domains.scanComplete"));
          }
        }
      }

      if (remaining !== undefined) {
        toast.info(`${remaining} ${t("domains.creditsLeft").replace("{s}", remaining !== 1 ? "s" : "")}`);
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 402 || detail?.code === "NO_CREDITS") {
        setShowCredits(true);
      } else {
        toast.error(typeof detail === "string" ? detail : t("domains.errorScan"));
      }
    } finally {
      setScanning(null);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div
      style={{
        background: "#0b0b0b",
        padding: "0 0 40px 0",
        minHeight: "100vh",
        fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
        position: "relative",
        zIndex: 1,
      }}
    >
      {/* Modals */}
      {showCredits && <BuyCreditsModal onClose={() => setShowCredits(false)} isFree={isFree} />}

      {/* Page Header */}
      <div className="cs-fadeup-1" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", paddingBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f5f5f5", margin: 0 }}>
            {techMode ? "Domain Monitor" : t("domains.title")}
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#b3b4b5", marginTop: 4, marginBottom: 0 }}>
            {techMode
              ? "SSL, uptime & security score per domain"
              : t("domains.subtitle")}
          </p>
        </div>
        {!isFree && <button
          onClick={() => setShowCredits(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "#151515",
            color: "#f5f5f5",
            border: "0.8px solid #1a1a1a",
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: "13px",
            cursor: "pointer",
            fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
            flexShrink: 0,
            marginTop: 2,
            transition: "all 0.15s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = "#3ecf8e";
            e.currentTarget.style.borderColor = "rgba(62,207,142,0.2)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = "#f5f5f5";
            e.currentTarget.style.borderColor = "#1a1a1a";
          }}
        >
          <svg viewBox="0 0 16 16" fill="none" style={{ width: 13, height: 13 }}>
            <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {t("domains.buyCredits")}
        </button>}
      </div>

      {/* Add domain card */}
      <div className="cs-fadeup-2"
        style={{
          background: "#151515",
          border: "0.8px solid #1a1a1a",
          borderRadius: 16,
          padding: "16px",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: "0.62rem",
            letterSpacing: "0.12em",
            color: "#71717a",
            fontWeight: 600,
            textTransform: "uppercase",
            marginBottom: 8,
            padding: "16px 0 6px 0",
            display: "block",
          }}
        >
          {techMode ? "Add domain" : t("domains.addLabel")}
        </span>
        <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="tudominio.com"
            disabled={adding}
            style={{
              flex: 1,
              background: "#1c1c1c",
              border: "0.8px solid #1a1a1a",
              borderRadius: 8,
              padding: "10px 12px",
              color: "#f5f5f5",
              fontSize: "13px",
              outline: "none",
              fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
              transition: "border-color 0.15s",
            }}
            onFocus={e => (e.currentTarget.style.borderColor = "#3ecf8e")}
            onBlur={e => (e.currentTarget.style.borderColor = "#1a1a1a")}
          />
          <button
            type="submit"
            disabled={adding || !newDomain.trim()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#3ecf8e",
              color: "#000",
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              border: "none",
              cursor: adding || !newDomain.trim() ? "not-allowed" : "pointer",
              opacity: adding || !newDomain.trim() ? 0.45 : 1,
              transition: "opacity 0.15s",
              whiteSpace: "nowrap",
              fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
            }}
          >
            <svg viewBox="0 0 16 16" fill="none" style={{ width: 13, height: 13 }}>
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {adding ? t("domains.addingBtn") : t("domains.addBtn")}
          </button>
          </div>
          {/* BUG-2: www hint */}
          {/^www\./i.test(newDomain.trim()) && (
            <span style={{ fontSize: "0.72rem", color: "#3ecf8e", display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Se usará: <strong style={{ fontFamily: "var(--font-dm-mono, monospace)" }}>{newDomain.trim().replace(/^www\./i, "")}</strong>
            </span>
          )}
        </form>
      </div>

      {/* Credits hint */}
      <p
        style={{
          fontFamily: "var(--font-dm-mono, monospace)",
          fontSize: "0.7rem",
          color: "#71717a",
          marginBottom: 20,
          marginTop: 8,
        }}
      >
        {t("domains.manualScanNote")}
      </p>

      {/* Domain list */}
      {loading ? (
        <DomainsSkeleton />
      ) : domains.length === 0 ? (
        <div
          style={{
            background: "#151515",
            border: "0.8px solid #1a1a1a",
            borderRadius: 16,
            padding: "16px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "56px 0", textAlign: "center" }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "rgba(62,207,142,0.06)",
                border: "0.8px solid rgba(62,207,142,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" style={{ width: 22, height: 22 }}>
                <circle cx="12" cy="12" r="10" stroke="#3ecf8e" strokeWidth="1.4" />
                <path d="M12 2C12 2 8 7 8 12s4 10 4 10M12 2c0 0 4 5 4 10s-4 10-4 10" stroke="#3ecf8e" strokeWidth="1.2" />
                <path d="M2 12h20" stroke="#3ecf8e" strokeWidth="1.2" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: "0.95rem", fontWeight: 700, color: "#f5f5f5", margin: "0 0 6px" }}>
                {t("domains.noDomains")}
              </p>
              <p style={{ fontSize: "0.82rem", color: "#71717a", maxWidth: 300, margin: 0 }}>
                {techMode ? "Add your first domain to start monitoring." : t("domains.addFirst")}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {domains.map((d) => (
            <DomainCard
              key={d.id}
              domain={d}
              isExpanded={expandedId === d.id}
              isScanning={scanning === d.id}
              isFree={isFree}
              onToggle={() => setExpandedId(expandedId === d.id ? null : d.id)}
              onScan={handleScan}
              onDelete={handleRemove}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ background: "#151515", border: "0.8px solid #1a1a1a", borderRadius: 16, padding: "12px 24px", display: "flex", justifyContent: "space-between", marginTop: 16 }}>
        <span style={{ fontSize: "12px", color: "#71717a" }}>© 2026 • v1.0.0</span>
        <span style={{ fontSize: "12px", color: "#71717a" }}>by <span style={{ color: "#b3b4b5", fontWeight: 500 }}>ChronoShield</span></span>
      </div>
    </div>
  );
}
