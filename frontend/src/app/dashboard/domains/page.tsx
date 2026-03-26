"use client";

import { useEffect, useState } from "react";
import { domainsApi, alertsApi } from "@/lib/api";
import { useTechMode } from "@/lib/mode-context";
import BuyCreditsModal from "@/components/BuyCreditsModal";
import toast from "react-hot-toast";

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
  green:   "#00e5bf",
  yellow:  "#ffb020",
  red:     "#ff4d6a",
  neutral: "rgba(255,255,255,0.08)",
};

function domainBarColor(d: Domain): BarColor {
  if (!d.ssl_status && !d.uptime_status) return "neutral";
  if (d.uptime_status === "down" || d.uptime_status === "error") return "red";
  if (d.ssl_status === "expired" || d.ssl_status === "error") return "yellow";
  return "green";
}

function scoreColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#ffb020";
  return "#ff4d6a";
}

function ScorePill({ score }: { score: number }) {
  const color = scoreColor(score);
  return (
    <span
      style={{
        fontFamily: "var(--font-mono-family)",
        fontSize: "0.78rem",
        fontWeight: 700,
        padding: "3px 10px",
        borderRadius: 6,
        color,
        background: `${color}18`,
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
  const s: StatusDef = labelMap[status] ?? { label: status, color: "#55556a", bg: "rgba(255,255,255,0.05)" };
  return (
    <span
      style={{
        fontFamily: "var(--font-mono-family)",
        fontSize: "0.58rem",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        padding: "3px 8px",
        borderRadius: 6,
        color: s.color,
        background: s.bg,
      }}
    >
      {s.label}
    </span>
  );
}

const SSL_LABELS: Record<string, StatusDef> = {
  valid:   { label: "SSL OK",    color: "#22c55e", bg: "rgba(34,197,94,0.10)"   },
  expired: { label: "SSL Venc.", color: "#ffb020", bg: "rgba(255,176,32,0.10)"  },
  error:   { label: "SSL Error", color: "#ff4d6a", bg: "rgba(255,77,106,0.10)"  },
};

const UPTIME_LABELS: Record<string, StatusDef> = {
  up:    { label: "Online", color: "#22c55e", bg: "rgba(34,197,94,0.10)"  },
  down:  { label: "Caída",  color: "#ff4d6a", bg: "rgba(255,77,106,0.10)" },
  error: { label: "Error",  color: "#ffb020", bg: "rgba(255,176,32,0.10)" },
};

const STATUS_LABELS: Record<string, StatusDef> = {
  pass: { label: "Pass", color: "#22c55e", bg: "rgba(34,197,94,0.10)"   },
  fail: { label: "Fail", color: "#ff4d6a", bg: "rgba(255,77,106,0.10)"  },
  none: { label: "N/A",  color: "#55556a", bg: "rgba(255,255,255,0.05)" },
};

/** Derive actionable recommendations from scan data */
function getRecommendations(d: Domain): { icon: string; text: string }[] {
  const recs: { icon: string; text: string }[] = [];

  if (d.ssl_status === "expired") {
    recs.push({ icon: "🔴", text: "Tu certificado SSL ha caducado. Renuévalo urgentemente para evitar alertas de seguridad en los navegadores." });
  } else if (d.ssl_status === "error") {
    recs.push({ icon: "🟠", text: "Hay un problema con tu certificado SSL. Verifica la configuración de tu servidor." });
  } else if (d.ssl_days_remaining !== null && d.ssl_days_remaining < 30) {
    recs.push({ icon: "⚠️", text: `Tu certificado SSL caduca en ${d.ssl_days_remaining} días. Renuévalo pronto para evitar interrupciones.` });
  }

  if (d.uptime_status === "down") {
    recs.push({ icon: "🔴", text: "Tu servidor está caído. Contacta con tu proveedor de hosting o reinicia el servidor." });
  } else if (d.uptime_status === "error") {
    recs.push({ icon: "🟠", text: "No se puede acceder a tu servidor. Revisa el firewall o la configuración DNS." });
  }

  if (d.spf_status && d.spf_status !== "pass") {
    recs.push({ icon: "⚡", text: "Configura un registro SPF en tu DNS para evitar que otros envíen correos suplantando tu dominio." });
  }
  if (d.dkim_status && d.dkim_status !== "pass") {
    recs.push({ icon: "⚡", text: "Activa DKIM para firmar criptográficamente los correos salientes y mejorar la entregabilidad." });
  }
  if (d.dmarc_status && d.dmarc_status !== "pass") {
    recs.push({ icon: "⚡", text: "Añade un registro DMARC para definir qué hacer con correos que no pasen SPF/DKIM." });
  }

  return recs;
}

// ── Domain Detail Panel ────────────────────────────────────────────────────────
function DomainDetailPanel({ domain, onClose }: { domain: Domain; onClose: () => void }) {
  const recs = getRecommendations(domain);

  const secRow = (label: string, status: string | null) => {
    const s = STATUS_LABELS[status ?? "none"] ?? STATUS_LABELS["none"];
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 0",
          borderBottom: "1px solid rgba(255,255,255,0.03)",
        }}
      >
        <span style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.75rem", color: "#55556a" }}>{label}</span>
        <span
          style={{
            fontFamily: "var(--font-mono-family)",
            fontSize: "0.58rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            padding: "3px 8px",
            borderRadius: 6,
            color: s.color,
            background: s.bg,
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
          padding: 28,
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
            marginBottom: 20,
            paddingBottom: 18,
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
              Análisis
            </span>
            <h2
              style={{
                fontFamily: "var(--font-serif-family)",
                fontSize: "1.3rem",
                fontWeight: 400,
                letterSpacing: "-0.02em",
                color: "#f0f0f5",
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
                    fontFamily: "var(--font-mono-family)",
                    fontSize: "1.5rem",
                    fontWeight: 700,
                    color: scoreColor(domain.security_score),
                    lineHeight: 1,
                  }}
                >
                  {domain.security_score}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono-family)",
                    fontSize: "0.6rem",
                    color: "#55556a",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    marginTop: 2,
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
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: "70vh", overflowY: "auto" }}>

          {/* Last scan */}
          {domain.last_scanned_at && (
            <p style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.72rem", color: "#55556a" }}>
              Último escaneo: {new Date(domain.last_scanned_at).toLocaleString("es-ES")}
            </p>
          )}

          {/* SSL */}
          <div
            style={{
              borderRadius: 12,
              padding: "16px",
              background: "#0f0f16",
              border: "1px solid rgba(255,255,255,0.03)",
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
                marginBottom: 12,
              }}
            >
              Certificado SSL
            </span>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                style={{
                  fontSize: "0.88rem",
                  fontWeight: 500,
                  color: domain.ssl_status === "valid" ? "#22c55e" : domain.ssl_status ? "#ff4d6a" : "#55556a",
                }}
              >
                {domain.ssl_status === "valid" ? "Válido" :
                 domain.ssl_status === "expired" ? "Caducado" :
                 domain.ssl_status === "error" ? "Error" : "Sin datos"}
              </span>
              {domain.ssl_days_remaining !== null && (
                <span style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.75rem", color: "#55556a" }}>
                  {domain.ssl_days_remaining} días restantes
                </span>
              )}
            </div>
          </div>

          {/* Uptime */}
          <div
            style={{
              borderRadius: 12,
              padding: "16px",
              background: "#0f0f16",
              border: "1px solid rgba(255,255,255,0.03)",
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
                marginBottom: 12,
              }}
            >
              Disponibilidad
            </span>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                style={{
                  fontSize: "0.88rem",
                  fontWeight: 500,
                  color: domain.uptime_status === "up" ? "#22c55e" : domain.uptime_status ? "#ff4d6a" : "#55556a",
                }}
              >
                {domain.uptime_status === "up" ? "Online" :
                 domain.uptime_status === "down" ? "Caído" :
                 domain.uptime_status === "error" ? "Error" : "Sin datos"}
              </span>
              {domain.last_response_ms !== null && (
                <span style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.75rem", color: "#55556a" }}>
                  {domain.last_response_ms} ms
                </span>
              )}
            </div>
          </div>

          {/* Email Security */}
          <div
            style={{
              borderRadius: 12,
              padding: "16px",
              background: "#0f0f16",
              border: "1px solid rgba(255,255,255,0.03)",
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
                marginBottom: 8,
              }}
            >
              Seguridad de Email
            </span>
            {secRow("SPF",   domain.spf_status)}
            {secRow("DKIM",  domain.dkim_status)}
            {secRow("DMARC", domain.dmarc_status)}
          </div>

          {/* Recommendations */}
          {recs.length > 0 ? (
            <div
              style={{
                borderRadius: 12,
                padding: "16px",
                background: "#0f0f16",
                border: "1px solid rgba(255,255,255,0.03)",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono-family)",
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.18em",
                  color: "#ffb020",
                  fontWeight: 500,
                  display: "block",
                  marginBottom: 12,
                }}
              >
                Recomendaciones
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {recs.map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: 10 }}>
                    <span style={{ fontSize: "0.9rem", flexShrink: 0, marginTop: 1 }}>{r.icon}</span>
                    <p style={{ fontSize: "0.78rem", color: "#9999ad", lineHeight: 1.6 }}>{r.text}</p>
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
                padding: "14px 16px",
                background: "rgba(34,197,94,0.05)",
                border: "1px solid rgba(34,197,94,0.12)",
              }}
            >
              <span style={{ fontSize: "1.1rem" }}>✅</span>
              <p style={{ fontSize: "0.78rem", color: "#22c55e" }}>
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
  const [domains, setDomains]       = useState<Domain[]>([]);
  const [loading, setLoading]       = useState(true);
  const [adding, setAdding]         = useState(false);
  const [newDomain, setNewDomain]   = useState("");
  const [scanning, setScanning]     = useState<string | null>(null);
  const [selected, setSelected]     = useState<Domain | null>(null);
  const [showCredits, setShowCredits] = useState(false);

  const load = async () => {
    try {
      const res = await domainsApi.list();
      setDomains(res.data);
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
    e.stopPropagation(); // Don't open detail panel
    setScanning(id);
    try {
      const res = await domainsApi.scan(id);
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
      {selected    && <DomainDetailPanel domain={selected} onClose={() => setSelected(null)} />}

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
            {techMode ? "Domain Monitor" : "Tus webs"}
          </h1>
          <p style={{ color: "#55556a", fontSize: "0.82rem", marginTop: 4 }}>
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

      {/* Add domain */}
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
          {techMode ? "Add domain" : "Añadir web"}
        </span>
        <form onSubmit={handleAdd} style={{ display: "flex", gap: 10 }}>
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder={techMode ? "ejemplo.com" : "La dirección de tu web, ej: miagencia.com"}
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
            disabled={adding || !newDomain.trim()}
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
              cursor: adding || !newDomain.trim() ? "not-allowed" : "pointer",
              opacity: adding || !newDomain.trim() ? 0.45 : 1,
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
          Los escaneos manuales consumen 1 crédito por dominio
        </p>
      </div>

      {/* Domain list */}
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
      ) : domains.length === 0 ? (
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
              🌐
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
                Sin dominios
              </div>
              <div style={{ fontSize: "0.85rem", color: "#55556a", maxWidth: 320 }}>
                {techMode ? "Add your first domain to start monitoring." : "Añade tu web para empezar a vigilarla."}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {domains.map((d) => {
            const barColor = domainBarColor(d);
            return (
              <div
                key={d.id}
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
                onClick={() => setSelected(d)}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.03)";
                  e.currentTarget.style.transform = "";
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
                    backgroundColor: BAR_COLORS[barColor],
                  }}
                />

                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  {/* Left: domain name + last scan */}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p
                      style={{
                        fontFamily: "var(--font-mono-family)",
                        fontSize: "0.88rem",
                        fontWeight: 600,
                        color: "#f0f0f5",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {d.domain}
                    </p>
                    <p style={{ fontSize: "0.72rem", color: "#33334a", marginTop: 2 }}>
                      {d.last_scanned_at
                        ? `${techMode ? "Last scan" : "Revisado"}: ${new Date(d.last_scanned_at).toLocaleString("es-ES")}`
                        : (techMode ? "Never scanned" : "Sin revisar aún")}
                    </p>
                  </div>

                  {/* Right: status chips + score + actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
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
                        padding: "6px 12px",
                        borderRadius: 8,
                        background: "#0f0f16",
                        color: scanning === d.id ? "#00e5bf" : "#9999ad",
                        fontFamily: "var(--font-jakarta-family)",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        border: "1px solid rgba(255,255,255,0.06)",
                        cursor: scanning === d.id ? "not-allowed" : "pointer",
                        opacity: scanning === d.id ? 0.6 : 1,
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={e2 => { if (scanning !== d.id) { e2.currentTarget.style.color = "#00e5bf"; e2.currentTarget.style.borderColor = "rgba(0,229,191,0.2)"; } }}
                      onMouseLeave={e2 => { e2.currentTarget.style.color = "#9999ad"; e2.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
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
