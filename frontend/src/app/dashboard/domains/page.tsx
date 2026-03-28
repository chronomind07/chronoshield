"use client";

import { useEffect, useState } from "react";
import { domainsApi, alertsApi } from "@/lib/api";
import { useTechMode } from "@/lib/mode-context";
import BuyCreditsModal from "@/components/BuyCreditsModal";
import { toast } from "@/components/Toast";
import { useCredits } from "@/contexts/CreditsContext";

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
type BarColor = "green" | "yellow" | "red" | "neutral";

const BAR_COLORS: Record<BarColor, string> = {
  green:   "#3ecf8e",
  yellow:  "#f59e0b",
  red:     "#ef4444",
  neutral: "rgba(255,255,255,0.08)",
};

function domainBarColor(d: Domain): BarColor {
  if (!d.ssl_status && !d.uptime_status) return "neutral";
  if (d.uptime_status === "down" || d.uptime_status === "error") return "red";
  if (d.ssl_status === "expired" || d.ssl_status === "error") return "yellow";
  return "green";
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

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora mismo";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return new Date(iso).toLocaleDateString("es-ES");
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

// ── Domain Detail Panel ────────────────────────────────────────────────────────
function DomainDetailPanel({ domain, onClose }: { domain: Domain; onClose: () => void }) {
  const recs = getRecommendations(domain);

  const secRow = (label: string, status: string | null, isLast = false) => {
    const s = STATUS_LABELS[status ?? "none"] ?? STATUS_LABELS["none"];
    const borderColor = s.color === "#3ecf8e"
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
            border: `0.8px solid ${borderColor}`,
          }}
        >
          {s.label}
        </span>
      </div>
    );
  };

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
          background: "#151515",
          border: "0.8px solid #1a1a1a",
          borderRadius: 16,
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
            borderBottom: "0.8px solid #1a1a1a",
          }}
        >
          <div>
            <span
              style={{
                fontSize: "0.62rem",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "#71717a",
                fontWeight: 600,
                display: "block",
                marginBottom: 4,
              }}
            >
              Análisis
            </span>
            <h2
              style={{
                fontSize: "1.1rem",
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: "#f5f5f5",
                margin: 0,
              }}
            >
              {domain.domain}
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {domain.security_score !== null && (
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontFamily: "var(--font-dm-mono, monospace)",
                    fontSize: "1.6rem",
                    fontWeight: 700,
                    color: scoreColor(domain.security_score),
                    lineHeight: 1,
                  }}
                >
                  {domain.security_score}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-dm-mono, monospace)",
                    fontSize: "0.6rem",
                    color: "#71717a",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    marginTop: 3,
                  }}
                >
                  Score
                </div>
              </div>
            )}
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#71717a",
                padding: 6,
                borderRadius: 6,
                transition: "color 0.15s",
                display: "flex",
                alignItems: "center",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "#f5f5f5")}
              onMouseLeave={e => (e.currentTarget.style.color = "#71717a")}
            >
              <svg viewBox="0 0 16 16" fill="none" style={{ width: 15, height: 15 }}>
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 12, maxHeight: "70vh", overflowY: "auto" }}>

          {/* Last scan */}
          {domain.last_scanned_at && (
            <p
              style={{
                fontFamily: "var(--font-dm-mono, monospace)",
                fontSize: "0.72rem",
                color: "#71717a",
                margin: 0,
              }}
            >
              Último escaneo: {new Date(domain.last_scanned_at).toLocaleString("es-ES")}
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
              Certificado SSL
            </span>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: domain.ssl_status === "valid" ? "#3ecf8e" : domain.ssl_status ? "#ef4444" : "#71717a",
                }}
              >
                {domain.ssl_status === "valid" ? "Válido" :
                 domain.ssl_status === "expired" ? "Caducado" :
                 domain.ssl_status === "error" ? "Error" : "Sin datos"}
              </span>
              {domain.ssl_days_remaining !== null && (
                <span
                  style={{
                    fontFamily: "var(--font-dm-mono, monospace)",
                    fontSize: "0.75rem",
                    color: "#71717a",
                  }}
                >
                  {domain.ssl_days_remaining} días restantes
                </span>
              )}
            </div>
            {domain.security_score !== null && (
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
                      width: `${Math.min(100, domain.security_score)}%`,
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
              Disponibilidad
            </span>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: domain.uptime_status === "up" ? "#3ecf8e" : domain.uptime_status ? "#ef4444" : "#71717a",
                }}
              >
                {domain.uptime_status === "up" ? "Online" :
                 domain.uptime_status === "down" ? "Caído" :
                 domain.uptime_status === "error" ? "Error" : "Sin datos"}
              </span>
              {domain.last_response_ms !== null && (
                <span
                  style={{
                    fontFamily: "var(--font-dm-mono, monospace)",
                    fontSize: "0.75rem",
                    color: "#71717a",
                  }}
                >
                  {domain.last_response_ms} ms
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
              Seguridad de Email
            </span>
            {secRow("SPF",   domain.spf_status)}
            {secRow("DKIM",  domain.dkim_status)}
            {secRow("DMARC", domain.dmarc_status, true)}
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
                Recomendaciones
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
          ) : domain.last_scanned_at ? (
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
                <path d="M3 8l3.5 3.5L13 4" stroke="#3ecf8e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p style={{ fontSize: "0.78rem", color: "#3ecf8e", margin: 0 }}>
                Sin recomendaciones críticas. Tu dominio está bien configurado.
              </p>
            </div>
          ) : null}

        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function DomainsPage() {
  const { techMode } = useTechMode();
  const { decrementCredits, refreshCredits } = useCredits();
  const [domains, setDomains]         = useState<Domain[]>([]);
  const [loading, setLoading]         = useState(true);
  const [adding, setAdding]           = useState(false);
  const [newDomain, setNewDomain]     = useState("");
  const [scanning, setScanning]       = useState<string | null>(null);
  const [selected, setSelected]       = useState<Domain | null>(null);
  const [showCredits, setShowCredits] = useState(false);

  const load = async () => {
    try {
      const res = await domainsApi.list();
      setDomains(Array.isArray(res.data) ? res.data : (res.data?.data ?? []));
    } catch {
      toast.error("Error al cargar dominios");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const domain = newDomain.trim().replace(/^https?:\/\//, "");
    if (!domain) return;
    setAdding(true);
    try {
      const res = await domainsApi.add(domain);
      setDomains((prev) => [...prev, res.data]);
      setNewDomain("");
      toast.success("Dominio añadido");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Error al añadir dominio";
      toast.error(msg);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: string, domain: string) => {
    if (!confirm(`¿Eliminar ${domain}?`)) return;
    try {
      await domainsApi.remove(id);
      setDomains((prev) => prev.filter((d) => d.id !== id));
      toast.success("Dominio eliminado");
    } catch {
      toast.error("Error al eliminar dominio");
    }
  };

  const handleScan = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setScanning(id);
    try {
      const res = await domainsApi.scan(id);
      const remaining = res.data?.credits_remaining;

      toast.info("Escaneando dominio...");

      // Wait for the background scan to complete (~12 s)
      await new Promise((resolve) => setTimeout(resolve, 12000));

      // Reload the full domain list
      const freshRes = await domainsApi.list();
      const freshDomains: Domain[] = Array.isArray(freshRes.data) ? freshRes.data : (freshRes.data?.data ?? []);
      setDomains(freshDomains);

      // If the detail panel is open for this domain, update it with fresh data
      if (selected?.id === id) {
        const updated = freshDomains.find((d) => d.id === id);
        if (updated) setSelected(updated);
      }

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
          toast.success(`${d.domain} está correctamente configurado y protegido`);
        } else {
          const issues: string[] = [];
          if (d.ssl_status && d.ssl_status !== "valid") issues.push("SSL");
          if (d.uptime_status && d.uptime_status !== "up") issues.push("Uptime");
          if (d.spf_status   && d.spf_status   !== "valid") issues.push("SPF");
          if (d.dkim_status  && d.dkim_status  !== "valid") issues.push("DKIM");
          if (d.dmarc_status && d.dmarc_status !== "valid") issues.push("DMARC");
          if (issues.length > 0) {
            toast.warning(`Revisar: ${issues.join(", ")}`);
          } else {
            toast.success("Scan completado");
          }
        }
      }

      if (remaining !== undefined) {
        toast.info(`${remaining} crédito${remaining !== 1 ? "s" : ""} restante${remaining !== 1 ? "s" : ""}`);
      }
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
        background: "#0b0b0b",
        padding: "0 0 40px 0",
        minHeight: "100vh",
        fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
        position: "relative",
        zIndex: 1,
      }}
    >
      {/* Modals */}
      {showCredits && <BuyCreditsModal onClose={() => setShowCredits(false)} />}
      {selected    && <DomainDetailPanel domain={selected} onClose={() => setSelected(null)} />}

      {/* Page Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", paddingBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f5f5f5", margin: 0 }}>
            {techMode ? "Domain Monitor" : "Tus webs"}
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#b3b4b5", marginTop: 4, marginBottom: 0 }}>
            {techMode
              ? "SSL, uptime & security score per domain"
              : "Comprueba que tus webs funcionan y están protegidas"}
          </p>
        </div>
        <button
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
            <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Comprar créditos
        </button>
      </div>

      {/* Add domain card */}
      <div
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
          {techMode ? "Add domain" : "Añadir web"}
        </span>
        <form onSubmit={handleAdd} style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder={techMode ? "ejemplo.com" : "La dirección de tu web, ej: miagencia.com"}
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
          color: "#71717a",
          marginBottom: 20,
          marginTop: 8,
        }}
      >
        Los escaneos manuales consumen 1 crédito por dominio
      </p>

      {/* Domain list */}
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
                <circle cx="12" cy="12" r="10" stroke="#3ecf8e" strokeWidth="1.4"/>
                <path d="M12 2C12 2 8 7 8 12s4 10 4 10M12 2c0 0 4 5 4 10s-4 10-4 10" stroke="#3ecf8e" strokeWidth="1.2"/>
                <path d="M2 12h20" stroke="#3ecf8e" strokeWidth="1.2"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: "0.95rem", fontWeight: 700, color: "#f5f5f5", margin: "0 0 6px" }}>
                Sin dominios
              </p>
              <p style={{ fontSize: "0.82rem", color: "#71717a", maxWidth: 300, margin: 0 }}>
                {techMode ? "Add your first domain to start monitoring." : "Añade tu web para empezar a vigilarla."}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            background: "#151515",
            border: "0.8px solid #1a1a1a",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          {domains.map((d, idx) => {
            const barColor = domainBarColor(d);
            const isLast = idx === domains.length - 1;
            return (
              <div
                key={d.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  borderBottom: isLast ? "none" : "0.8px solid #1a1a1a",
                  cursor: "pointer",
                  transition: "background 0.15s",
                  position: "relative",
                  overflow: "hidden",
                }}
                onClick={() => setSelected(d)}
                onMouseEnter={e => { e.currentTarget.style.background = "#1c1c1c"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                {/* Left color indicator */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 2,
                    backgroundColor: BAR_COLORS[barColor],
                  }}
                />

                {/* Left: domain name + last scan */}
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
                      ? `${techMode ? "Last scan" : "Último scan"}: ${relTime(d.last_scanned_at)}`
                      : (techMode ? "Never scanned" : "Sin revisar aún")}
                  </p>
                </div>

                {/* Right: status chips + score + actions */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexShrink: 0,
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                  }}
                >
                  <StatusChip status={d.uptime_status} labelMap={UPTIME_LABELS} />
                  <StatusChip status={d.ssl_status}    labelMap={SSL_LABELS}    />
                  {d.security_score !== null && <ScorePill score={d.security_score} />}

                  {/* Scan button */}
                  <button
                    onClick={(e) => handleScan(e, d.id)}
                    disabled={scanning === d.id}
                    title="Escanear (1 crédito)"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      background: "#3ecf8e",
                      color: "#000",
                      borderRadius: 8,
                      padding: "8px 16px",
                      fontSize: "13px",
                      fontWeight: 600,
                      border: "none",
                      cursor: scanning === d.id ? "not-allowed" : "pointer",
                      opacity: scanning === d.id ? 0.6 : 1,
                      transition: "opacity 0.15s",
                      fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                    }}
                  >
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      style={{ width: 12, height: 12 }}
                      className={scanning === d.id ? "animate-spin" : ""}
                    >
                      <path
                        d="M13.5 8A5.5 5.5 0 1 1 8 2.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <path d="M8 1v3l2-1.5L8 1Z" fill="currentColor"/>
                    </svg>
                    {techMode ? "Scan" : "Revisar"}
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemove(d.id, d.domain); }}
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
                    onMouseEnter={e2 => { e2.currentTarget.style.background = "rgba(239,68,68,0.18)"; }}
                    onMouseLeave={e2 => { e2.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
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
            );
          })}
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
