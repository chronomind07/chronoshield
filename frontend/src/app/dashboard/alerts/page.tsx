"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { alertsApi, mitigationApi } from "@/lib/api";
import toast from "react-hot-toast";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Alert {
  id: string;
  alert_type: string;
  severity: string;
  severity_label: string;
  title: string;
  message: string;
  human_impact: string;
  fix_steps: string[];
  sent_at: string;
  read_at: string | null;
  domain_id: string | null;
  is_unread: boolean;
}

interface AlertsData {
  total: number;
  unread_count: number;
  alerts: Alert[];
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

// ── Severity config ────────────────────────────────────────────────────────────
const SEV_CONFIG: Record<string, { color: string; bg: string; border: string; dot: string; glow: string }> = {
  critical: { color: "#ff4d6a", bg: "rgba(255,77,106,0.05)", border: "rgba(255,77,106,0.14)", dot: "#ff4d6a", glow: "rgba(255,77,106,0.3)" },
  high:     { color: "#ff4d6a", bg: "rgba(255,77,106,0.05)", border: "rgba(255,77,106,0.14)", dot: "#ff4d6a", glow: "rgba(255,77,106,0.3)" },
  medium:   { color: "#ffb020", bg: "rgba(255,176,32,0.05)",  border: "rgba(255,176,32,0.14)",  dot: "#ffb020", glow: "rgba(255,176,32,0.3)" },
  low:      { color: "#22d3ee", bg: "rgba(34,211,238,0.04)", border: "rgba(34,211,238,0.12)", dot: "#22d3ee", glow: "rgba(34,211,238,0.3)" },
};

// ── Mitigation chat ────────────────────────────────────────────────────────────
function MitigationChat({ alertId }: { alertId: string }) {
  const [messages, setMessages]       = useState<ChatMsg[]>([]);
  const [input, setInput]             = useState("");
  const [sending, setSending]         = useState(false);
  const [usageCount, setUsageCount]   = useState(0);
  const [usageLimit, setUsageLimit]   = useState(3);
  const [initialized, setInitialized] = useState(false);
  const bottomRef                     = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // Fire initial message automatically
  useEffect(() => {
    if (initialized) return;
    setInitialized(true);
    doSend("Analiza esta alerta y dime cómo puedo solucionarlo", []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doSend(text: string, history: ChatMsg[]) {
    const userMsg: ChatMsg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    try {
      const res = await mitigationApi.chat({
        alert_id: alertId,
        message: text,
        conversation_history: history,
      });
      const assistantMsg: ChatMsg = { role: "assistant", content: res.data.response };
      setMessages((prev) => [...prev, assistantMsg]);
      setUsageCount(res.data.usage_count);
      setUsageLimit(res.data.usage_limit);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Error al contactar el asistente";
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${detail}` }]);
    } finally {
      setSending(false);
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    // Pass current messages (without the new user msg) as history
    doSend(text, messages);
  };

  const limitReached = usageCount >= usageLimit && usageLimit > 0;

  return (
    <div
      style={{
        marginTop: 12,
        borderRadius: 10,
        background: "#0c0c14",
        border: "1px solid rgba(0,229,191,0.14)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          background: "rgba(0,229,191,0.04)",
        }}
      >
        <span style={{ fontSize: "0.85rem" }}>🤖</span>
        <span
          style={{
            fontFamily: "var(--font-mono-family)",
            fontSize: "0.6rem",
            textTransform: "uppercase",
            letterSpacing: "1.5px",
            fontWeight: 700,
            color: "#00e5bf",
          }}
        >
          Asistente de mitigación
        </span>
        <span
          style={{
            padding: "1px 6px",
            borderRadius: 4,
            background: "rgba(0,229,191,0.15)",
            fontFamily: "var(--font-mono-family)",
            fontSize: "0.52rem",
            fontWeight: 700,
            letterSpacing: "1px",
            color: "#00e5bf",
          }}
        >
          IA
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontFamily: "var(--font-mono-family)",
            fontSize: "0.6rem",
            color: limitReached ? "#ff4d6a" : "#55556a",
          }}
        >
          {usageCount}/{usageLimit} consultas este mes
        </span>
      </div>

      {/* Messages */}
      <div
        style={{
          maxHeight: 320,
          overflowY: "auto",
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "84%",
                padding: "9px 14px",
                borderRadius:
                  msg.role === "user"
                    ? "12px 12px 4px 12px"
                    : "12px 12px 12px 4px",
                fontSize: "0.78rem",
                lineHeight: 1.65,
                whiteSpace: "pre-wrap",
                color: "#f0f0f5",
                background:
                  msg.role === "user"
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(0,229,191,0.06)",
                border:
                  msg.role === "user"
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "1px solid rgba(0,229,191,0.15)",
                fontFamily: "var(--font-jakarta-family)",
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {sending && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "12px 12px 12px 4px",
                background: "rgba(0,229,191,0.06)",
                border: "1px solid rgba(0,229,191,0.15)",
                display: "flex",
                gap: 5,
                alignItems: "center",
              }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "#00e5bf",
                    animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input or limit message */}
      {limitReached ? (
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid rgba(255,255,255,0.04)",
            fontSize: "0.75rem",
            color: "#ff4d6a",
            textAlign: "center",
            fontFamily: "var(--font-jakarta-family)",
          }}
        >
          {usageLimit <= 3
            ? "Has alcanzado el límite mensual. Actualiza a Business para más consultas."
            : "Has alcanzado el límite mensual."}
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            gap: 8,
            padding: "10px 12px",
            borderTop: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu respuesta o pregunta…"
            disabled={sending}
            style={{
              flex: 1,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              padding: "7px 12px",
              fontSize: "0.78rem",
              color: "#f0f0f5",
              outline: "none",
              fontFamily: "var(--font-jakarta-family)",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(0,229,191,0.35)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            style={{
              padding: "7px 16px",
              borderRadius: 8,
              background: "rgba(0,229,191,0.12)",
              border: "1px solid rgba(0,229,191,0.3)",
              color: "#00e5bf",
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: sending || !input.trim() ? "not-allowed" : "pointer",
              opacity: sending || !input.trim() ? 0.45 : 1,
              fontFamily: "var(--font-jakarta-family)",
              transition: "opacity 0.2s",
            }}
          >
            Enviar
          </button>
        </form>
      )}
    </div>
  );
}

// ── Alert card ─────────────────────────────────────────────────────────────────
function AlertCard({ alert, onMarkRead }: { alert: Alert; onMarkRead: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [marking, setMarking]   = useState(false);
  const [showChat, setShowChat] = useState(false);
  const sev = SEV_CONFIG[alert.severity] ?? SEV_CONFIG.low;

  const handleMarkRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!alert.is_unread || marking) return;
    setMarking(true);
    try {
      await alertsApi.markRead(alert.id);
      onMarkRead(alert.id);
    } catch {
      toast.error("No se pudo marcar como leída");
    } finally {
      setMarking(false);
    }
  };

  return (
    <div
      style={{
        background: alert.is_unread ? sev.bg : "#0f0f16",
        border: `1px solid ${alert.is_unread ? sev.border : "rgba(255,255,255,0.03)"}`,
        borderRadius: 12,
        marginBottom: 8,
        overflow: "hidden",
        transition: "border-color 0.2s",
        animation: "dashFadeIn 0.4s ease both",
      }}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
          padding: "16px 20px",
          textAlign: "left",
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
      >
        {/* Severity dot */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0, marginTop: 3 }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: sev.dot,
              boxShadow: alert.is_unread ? `0 0 6px ${sev.glow}` : "none",
            }}
          />
          {alert.is_unread && (
            <div style={{ width: 1, flexGrow: 1, minHeight: 16, background: `${sev.dot}22` }} />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span
                style={{
                  fontFamily: "var(--font-mono-family)",
                  fontSize: "0.6rem",
                  textTransform: "uppercase",
                  letterSpacing: "1.5px",
                  padding: "2px 8px",
                  borderRadius: 20,
                  fontWeight: 700,
                  flexShrink: 0,
                  color: sev.color,
                  background: `${sev.color}18`,
                }}
              >
                {alert.severity_label}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-serif-family)",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  color: alert.is_unread ? "#f0f0f5" : "#9999ad",
                  lineHeight: 1.3,
                }}
              >
                {alert.title}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <span style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.65rem", color: "#33334a", whiteSpace: "nowrap" }}>
                {relTime(alert.sent_at)}
              </span>
              <span style={{ color: "#33334a", fontSize: "0.7rem" }}>{expanded ? "▲" : "▼"}</span>
            </div>
          </div>

          <p
            style={{
              fontSize: "0.78rem",
              color: "#9999ad",
              marginTop: 5,
              lineHeight: 1.55,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {alert.message}
          </p>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: "0 20px 20px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          {/* Human impact */}
          <div
            style={{
              marginTop: 16,
              borderRadius: 10,
              padding: 16,
              background: `${sev.color}0d`,
              border: `1px solid ${sev.color}22`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: "0.9rem" }}>⚠️</span>
              <span
                style={{
                  fontFamily: "var(--font-mono-family)",
                  fontSize: "0.6rem",
                  textTransform: "uppercase",
                  letterSpacing: "1.5px",
                  fontWeight: 700,
                  color: sev.color,
                }}
              >
                Impacto en tu negocio
              </span>
            </div>
            <p style={{ fontSize: "0.78rem", lineHeight: 1.6, color: "#9999ad" }}>{alert.human_impact}</p>
          </div>

          {/* Fix steps */}
          <div
            style={{
              marginTop: 10,
              borderRadius: 10,
              padding: 16,
              background: "rgba(0,229,191,0.04)",
              border: "1px solid rgba(0,229,191,0.12)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: "0.9rem" }}>🔧</span>
              <span
                style={{
                  fontFamily: "var(--font-mono-family)",
                  fontSize: "0.6rem",
                  textTransform: "uppercase",
                  letterSpacing: "1.5px",
                  fontWeight: 700,
                  color: "#00e5bf",
                }}
              >
                Cómo solucionarlo
              </span>
            </div>
            <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {alert.fix_steps.map((step, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--font-mono-family)",
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      flexShrink: 0,
                      marginTop: 1,
                      background: "rgba(0,229,191,0.15)",
                      color: "#00e5bf",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ fontSize: "0.78rem", color: "#9999ad", lineHeight: 1.6 }}>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* AI Mitigation button */}
          <div style={{ marginTop: 10 }}>
            <button
              onClick={() => setShowChat(!showChat)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                borderRadius: 9,
                fontSize: "0.8rem",
                fontWeight: 600,
                background: showChat ? "rgba(0,229,191,0.12)" : "rgba(0,229,191,0.06)",
                border: `1px solid rgba(0,229,191,${showChat ? "0.28" : "0.15"})`,
                color: "#00e5bf",
                cursor: "pointer",
                fontFamily: "var(--font-jakarta-family)",
                transition: "all 0.2s",
              }}
            >
              🤖 Asistente de mitigación
              <span
                style={{
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: "rgba(0,229,191,0.15)",
                  fontFamily: "var(--font-mono-family)",
                  fontSize: "0.52rem",
                  fontWeight: 700,
                  letterSpacing: "1px",
                  color: "#00e5bf",
                }}
              >
                IA
              </span>
            </button>
          </div>

          {/* Inline chat panel */}
          {showChat && <MitigationChat alertId={alert.id} />}

          {/* Footer */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
            <span style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.65rem", color: "#33334a" }}>
              {fmtDate(alert.sent_at)}
            </span>
            {alert.is_unread ? (
              <button
                onClick={handleMarkRead}
                disabled={marking}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  padding: "6px 12px",
                  borderRadius: 8,
                  transition: "all 0.2s",
                  opacity: marking ? 0.5 : 1,
                  cursor: marking ? "not-allowed" : "pointer",
                  background: "rgba(255,255,255,0.04)",
                  color: "#9999ad",
                  border: "1px solid rgba(255,255,255,0.06)",
                  fontFamily: "var(--font-jakarta-family)",
                }}
              >
                <span>{marking ? "…" : "✓"}</span>
                Marcar como leída
              </button>
            ) : (
              <span style={{ fontSize: "0.65rem", color: "#33334a", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ color: "#00e5bf" }}>✓</span> Leída{" "}
                {alert.read_at ? relTime(alert.read_at) : ""}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section group ──────────────────────────────────────────────────────────────
function AlertGroup({
  label, color, alerts, onMarkRead,
}: {
  label: string;
  color: string;
  alerts: Alert[];
  onMarkRead: (id: string) => void;
}) {
  if (alerts.length === 0) return null;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: color }} />
        <span
          style={{
            fontFamily: "var(--font-mono-family)",
            fontSize: "0.65rem",
            textTransform: "uppercase",
            letterSpacing: "2px",
            color,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono-family)",
            fontSize: "0.6rem",
            padding: "1px 6px",
            borderRadius: 10,
            color,
            background: `${color}18`,
          }}
        >
          {alerts.length}
        </span>
        <div style={{ flex: 1, height: 1, background: `${color}20` }} />
      </div>
      <div>
        {alerts.map((a) => (
          <AlertCard key={a.id} alert={a} onMarkRead={onMarkRead} />
        ))}
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "80px 0", textAlign: "center" }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: "rgba(0,229,191,0.06)",
          border: "1px solid rgba(0,229,191,0.10)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
        }}
      >
        🛡
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
          Todo está en orden
        </div>
        <div style={{ fontSize: "0.85rem", color: "#55556a", maxWidth: 280, lineHeight: 1.6 }}>
          No tienes alertas activas. Tus sistemas de seguridad están monitorizados
          y te avisaremos si se detecta cualquier problema.
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 16px",
          borderRadius: 20,
          background: "rgba(0,229,191,0.06)",
          border: "1px solid rgba(0,229,191,0.12)",
        }}
      >
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00e5bf" }} />
        <span
          style={{
            fontFamily: "var(--font-mono-family)",
            fontSize: "0.62rem",
            color: "#00e5bf",
            letterSpacing: "1px",
            textTransform: "uppercase",
          }}
        >
          Monitoreo activo
        </span>
      </div>
    </div>
  );
}

// ── Filter bar ─────────────────────────────────────────────────────────────────
function FilterBar({
  activeFilter,
  onChange,
  counts,
}: {
  activeFilter: string;
  onChange: (f: string) => void;
  counts: { all: number; critical: number; medium: number; low: number; unread: number };
}) {
  const filters = [
    { key: "all",      label: "Todas",     count: counts.all },
    { key: "unread",   label: "No leídas", count: counts.unread },
    { key: "critical", label: "Críticas",  count: counts.critical },
    { key: "medium",   label: "Medias",    count: counts.medium },
    { key: "low",      label: "Bajas",     count: counts.low },
  ];

  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        padding: 4,
        background: "#0f0f16",
        border: "1px solid rgba(255,255,255,0.03)",
        borderRadius: 10,
        marginBottom: 20,
        width: "fit-content",
        flexWrap: "wrap",
      }}
    >
      {filters.map((f) => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 14px",
            borderRadius: 7,
            fontSize: "0.8rem",
            fontWeight: 600,
            transition: "all 0.2s",
            cursor: "pointer",
            border: "none",
            fontFamily: "var(--font-jakarta-family)",
            background: activeFilter === f.key ? "#1a1a26" : "transparent",
            color: activeFilter === f.key ? "#f0f0f5" : "#55556a",
          }}
        >
          {f.label}
          {f.count > 0 && (
            <span
              style={{
                fontFamily: "var(--font-mono-family)",
                fontSize: "0.6rem",
                padding: "1px 5px",
                borderRadius: 4,
                background: activeFilter === f.key ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
              }}
            >
              {f.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AlertsPage() {
  const [data, setData]             = useState<AlertsData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState("all");
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await alertsApi.list();
      setData(res.data);
    } catch {
      toast.error("Error al cargar las alertas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleMarkRead = useCallback((id: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        unread_count: Math.max(0, prev.unread_count - 1),
        alerts: prev.alerts.map((a) =>
          a.id === id ? { ...a, is_unread: false, read_at: new Date().toISOString() } : a
        ),
      };
    });
  }, []);

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await alertsApi.markAllRead();
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          unread_count: 0,
          alerts: prev.alerts.map((a) => ({
            ...a,
            is_unread: false,
            read_at: a.read_at ?? new Date().toISOString(),
          })),
        };
      });
      toast.success("Todas las alertas marcadas como leídas");
    } catch {
      toast.error("Error al marcar alertas");
    } finally {
      setMarkingAll(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", display: "flex", alignItems: "center", justifyContent: "center", height: 256, background: "#050507" }}>
        <div
          style={{
            width: 32,
            height: 32,
            border: "2px solid #00e5bf",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
      </div>
    );
  }

  if (!data) return null;

  const filteredAlerts = data.alerts.filter((a) => {
    if (filter === "unread")   return a.is_unread;
    if (filter === "critical") return a.severity === "critical" || a.severity === "high";
    if (filter === "medium")   return a.severity === "medium";
    if (filter === "low")      return a.severity === "low";
    return true;
  });

  const criticals = filteredAlerts.filter((a) => a.severity === "critical" || a.severity === "high");
  const mediums   = filteredAlerts.filter((a) => a.severity === "medium");
  const lows      = filteredAlerts.filter((a) => a.severity === "low");

  const counts = {
    all:      data.total,
    unread:   data.unread_count,
    critical: data.alerts.filter((a) => a.severity === "critical" || a.severity === "high").length,
    medium:   data.alerts.filter((a) => a.severity === "medium").length,
    low:      data.alerts.filter((a) => a.severity === "low").length,
  };

  return (
    <div
      style={{
        padding: "32px 36px 60px",
        background: "#050507",
        minHeight: "100vh",
        position: "relative",
        zIndex: 1,
        fontFamily: "var(--font-jakarta-family)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1
            style={{
              fontFamily: "var(--font-serif-family)",
              fontSize: "1.75rem",
              fontWeight: 400,
              letterSpacing: "-0.02em",
              color: "#f0f0f5",
              margin: 0,
            }}
          >
            Alertas de seguridad
          </h1>
          <p style={{ color: "#55556a", fontSize: "0.82rem", marginTop: 4, margin: "4px 0 0" }}>
            {data.unread_count > 0
              ? `${data.unread_count} alerta${data.unread_count !== 1 ? "s" : ""} sin leer · ${data.total} total`
              : `${data.total} alerta${data.total !== 1 ? "s" : ""} · todo al día`}
          </p>
        </div>
        {data.unread_count > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: "0.8rem",
              fontWeight: 600,
              padding: "8px 16px",
              borderRadius: 9,
              transition: "all 0.2s",
              opacity: markingAll ? 0.5 : 1,
              cursor: markingAll ? "not-allowed" : "pointer",
              background: "rgba(255,255,255,0.04)",
              color: "#9999ad",
              border: "1px solid rgba(255,255,255,0.06)",
              fontFamily: "var(--font-jakarta-family)",
            }}
          >
            {markingAll ? "⟳" : "✓"} Marcar todas como leídas
          </button>
        )}
      </div>

      {/* Filters */}
      {data.total > 0 && (
        <FilterBar activeFilter={filter} onChange={setFilter} counts={counts} />
      )}

      {/* Alert groups or empty */}
      {filteredAlerts.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <AlertGroup label="Críticas" color="#ff4d6a" alerts={criticals} onMarkRead={handleMarkRead} />
          <AlertGroup label="Medias"   color="#ffb020" alerts={mediums}   onMarkRead={handleMarkRead} />
          <AlertGroup label="Bajas"    color="#22d3ee" alerts={lows}      onMarkRead={handleMarkRead} />
        </div>
      )}
    </div>
  );
}
