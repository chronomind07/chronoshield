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
const SEV_CONFIG: Record<string, { color: string; bg: string; border: string; dot: string; leftBorder: string }> = {
  critical: {
    color: "#ef4444",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.15)",
    dot: "#ef4444",
    leftBorder: "#ef4444",
  },
  high: {
    color: "#ef4444",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.15)",
    dot: "#ef4444",
    leftBorder: "#ef4444",
  },
  medium: {
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.15)",
    dot: "#f59e0b",
    leftBorder: "#f59e0b",
  },
  low: {
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.08)",
    border: "rgba(59,130,246,0.15)",
    dot: "#3b82f6",
    leftBorder: "#3b82f6",
  },
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

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
    doSend(text, messages);
  };

  const limitReached = usageCount >= usageLimit && usageLimit > 0;

  return (
    <div
      style={{
        marginTop: 12,
        borderRadius: 16,
        background: "#151515",
        border: "0.8px solid #1a1a1a",
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
          borderBottom: "0.8px solid #1a1a1a",
          background: "rgba(62,207,142,0.04)",
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: "rgba(62,207,142,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.75rem",
          }}
        >
          ✦
        </div>
        <span
          style={{
            fontFamily: "var(--font-dm-mono)",
            fontSize: "0.6rem",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            fontWeight: 600,
            color: "#3ecf8e",
          }}
        >
          Asistente de mitigación
        </span>
        <span
          style={{
            padding: "1px 6px",
            borderRadius: 4,
            background: "rgba(62,207,142,0.12)",
            fontFamily: "var(--font-dm-mono)",
            fontSize: "0.52rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "#3ecf8e",
            textTransform: "uppercase",
          }}
        >
          IA
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontFamily: "var(--font-dm-mono)",
            fontSize: "0.6rem",
            color: limitReached ? "#ef4444" : "#71717a",
          }}
        >
          {usageCount}/{usageLimit} consultas
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
                ...(msg.role === "user"
                  ? {
                      background: "#3ecf8e",
                      color: "#000",
                    }
                  : {
                      background: "#1c1c1c",
                      color: "#f5f5f5",
                      border: "0.8px solid #1a1a1a",
                    }),
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
                background: "#1c1c1c",
                border: "0.8px solid #1a1a1a",
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
                    background: "#3ecf8e",
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
            borderTop: "0.8px solid #1a1a1a",
            fontSize: "0.75rem",
            color: "#ef4444",
            textAlign: "center",
            fontFamily: "var(--font-dm-sans)",
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
            borderTop: "0.8px solid #1a1a1a",
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu respuesta o pregunta…"
            disabled={sending}
            style={{
              flex: 1,
              background: "#1c1c1c",
              border: "0.8px solid #1a1a1a",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: "13px",
              color: "#f5f5f5",
              outline: "none",
              fontFamily: "var(--font-dm-sans)",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(62,207,142,0.4)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#1a1a1a")}
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              background: "#3ecf8e",
              border: "none",
              color: "#000",
              fontSize: "13px",
              fontWeight: 600,
              cursor: sending || !input.trim() ? "not-allowed" : "pointer",
              opacity: sending || !input.trim() ? 0.4 : 1,
              fontFamily: "var(--font-dm-sans)",
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
        background: "#151515",
        border: "0.8px solid #1a1a1a",
        borderRadius: 16,
        marginBottom: 8,
        overflow: "hidden",
        borderLeft: `3px solid ${alert.is_unread ? sev.leftBorder : "#1a1a1a"}`,
        transition: "border-color 0.2s",
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
        <div style={{ flexShrink: 0, marginTop: 5 }}>
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: alert.is_unread ? sev.dot : "#3f3f46",
            }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {/* Severity badge */}
              <span
                style={{
                  fontFamily: "var(--font-dm-mono)",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  padding: "2px 8px",
                  borderRadius: 6,
                  fontWeight: 600,
                  flexShrink: 0,
                  color: sev.color,
                  background: sev.bg,
                  border: `0.8px solid ${sev.border}`,
                }}
              >
                {alert.severity_label}
              </span>
              {/* Type badge */}
              <span
                style={{
                  fontFamily: "var(--font-dm-mono)",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  padding: "2px 8px",
                  borderRadius: 6,
                  fontWeight: 600,
                  flexShrink: 0,
                  color: "#71717a",
                  background: "rgba(255,255,255,0.04)",
                  border: "0.8px solid #1a1a1a",
                }}
              >
                {alert.alert_type.replace(/_/g, " ")}
              </span>
              {/* Title */}
              <span
                style={{
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  color: alert.is_unread ? "#f5f5f5" : "#71717a",
                  lineHeight: 1.3,
                }}
              >
                {alert.title}
              </span>
            </div>
            {/* Right side: timestamp + chevron */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <span
                style={{
                  fontFamily: "var(--font-dm-mono)",
                  fontSize: "0.65rem",
                  color: "#71717a",
                  whiteSpace: "nowrap",
                }}
              >
                {relTime(alert.sent_at)}
              </span>
              {alert.is_unread && (
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#3ecf8e",
                    flexShrink: 0,
                  }}
                />
              )}
              <span style={{ color: "#71717a", fontSize: "0.65rem" }}>{expanded ? "▲" : "▼"}</span>
            </div>
          </div>

          {/* Message preview */}
          <p
            style={{
              fontSize: "0.78rem",
              color: "#b3b4b5",
              marginTop: 6,
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
        <div style={{ padding: "0 20px 20px", borderTop: "0.8px solid #1a1a1a" }}>
          {/* Human impact */}
          <div
            style={{
              marginTop: 16,
              borderRadius: 10,
              padding: "14px 16px",
              background: `rgba(${sev.color === "#ef4444" ? "239,68,68" : sev.color === "#f59e0b" ? "245,158,11" : "59,130,246"},0.06)`,
              border: `0.8px solid rgba(${sev.color === "#ef4444" ? "239,68,68" : sev.color === "#f59e0b" ? "245,158,11" : "59,130,246"},0.15)`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span
                style={{
                  fontFamily: "var(--font-dm-mono)",
                  fontSize: "0.62rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  fontWeight: 600,
                  color: sev.color,
                }}
              >
                Impacto en tu negocio
              </span>
            </div>
            <p style={{ fontSize: "0.78rem", lineHeight: 1.6, color: "#b3b4b5", margin: 0 }}>{alert.human_impact}</p>
          </div>

          {/* Fix steps */}
          <div
            style={{
              marginTop: 10,
              borderRadius: 10,
              padding: "14px 16px",
              background: "rgba(62,207,142,0.04)",
              border: "0.8px solid rgba(62,207,142,0.15)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span
                style={{
                  fontFamily: "var(--font-dm-mono)",
                  fontSize: "0.62rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  fontWeight: 600,
                  color: "#3ecf8e",
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
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--font-dm-mono)",
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      flexShrink: 0,
                      marginTop: 1,
                      background: "rgba(62,207,142,0.12)",
                      color: "#3ecf8e",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ fontSize: "0.78rem", color: "#b3b4b5", lineHeight: 1.6 }}>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* AI Mitigation toggle */}
          <div style={{ marginTop: 12 }}>
            <button
              onClick={() => setShowChat(!showChat)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                borderRadius: 8,
                fontSize: "13px",
                fontWeight: 600,
                background: showChat ? "rgba(62,207,142,0.12)" : "#151515",
                border: `0.8px solid ${showChat ? "rgba(62,207,142,0.25)" : "#1a1a1a"}`,
                color: showChat ? "#3ecf8e" : "#b3b4b5",
                cursor: "pointer",
                fontFamily: "var(--font-dm-sans)",
                transition: "all 0.2s",
              }}
            >
              ✦ Asistente de mitigación
              <span
                style={{
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: "rgba(62,207,142,0.12)",
                  fontFamily: "var(--font-dm-mono)",
                  fontSize: "0.52rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "#3ecf8e",
                  textTransform: "uppercase",
                }}
              >
                IA
              </span>
            </button>
          </div>

          {/* Inline chat panel */}
          {showChat && <MitigationChat alertId={alert.id} />}

          {/* Footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 16,
              paddingTop: 14,
              borderTop: "0.8px solid #1a1a1a",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-dm-mono)",
                fontSize: "0.65rem",
                color: "#71717a",
              }}
            >
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
                  fontSize: "13px",
                  fontWeight: 600,
                  padding: "8px 16px",
                  borderRadius: 8,
                  transition: "all 0.2s",
                  opacity: marking ? 0.5 : 1,
                  cursor: marking ? "not-allowed" : "pointer",
                  background: "#151515",
                  color: "#f5f5f5",
                  border: "0.8px solid #1a1a1a",
                  fontFamily: "var(--font-dm-sans)",
                }}
              >
                <span>{marking ? "…" : "✓"}</span>
                Marcar como leída
              </button>
            ) : (
              <span
                style={{
                  fontSize: "0.65rem",
                  color: "#71717a",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontFamily: "var(--font-dm-mono)",
                }}
              >
                <span style={{ color: "#3ecf8e" }}>✓</span> Leída{" "}
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
      {/* Group header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            flexShrink: 0,
            background: color,
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-dm-mono)",
            fontSize: "0.62rem",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            fontWeight: 600,
            color: "#71717a",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: "var(--font-dm-mono)",
            fontSize: "0.6rem",
            padding: "1px 7px",
            borderRadius: 6,
            color,
            background: `${color}18`,
            border: `0.8px solid ${color}30`,
          }}
        >
          {alerts.length}
        </span>
        <div style={{ flex: 1, height: 1, background: "#1a1a1a" }} />
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        padding: "80px 0",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: "rgba(62,207,142,0.06)",
          border: "0.8px solid rgba(62,207,142,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.4rem",
        }}
      >
        ✦
      </div>
      <div>
        <div
          style={{
            fontSize: "1rem",
            fontWeight: 700,
            color: "#f5f5f5",
            marginBottom: 6,
          }}
        >
          Todo está en orden
        </div>
        <div style={{ fontSize: "0.82rem", color: "#71717a", maxWidth: 280, lineHeight: 1.6 }}>
          No tienes alertas activas. Tus sistemas están monitorizados y te avisaremos si se detecta
          cualquier problema.
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 14px",
          borderRadius: 20,
          background: "rgba(62,207,142,0.06)",
          border: "0.8px solid rgba(62,207,142,0.15)",
        }}
      >
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3ecf8e" }} />
        <span
          style={{
            fontFamily: "var(--font-dm-mono)",
            fontSize: "0.62rem",
            color: "#3ecf8e",
            letterSpacing: "0.08em",
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
    { key: "unread",   label: "Sin leer",  count: counts.unread },
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
        background: "#1c1c1c",
        border: "0.8px solid #1a1a1a",
        borderRadius: 8,
        marginBottom: 24,
        width: "fit-content",
        flexWrap: "wrap",
      }}
    >
      {filters.map((f) => {
        const active = activeFilter === f.key;
        return (
          <button
            key={f.key}
            onClick={() => onChange(f.key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              borderRadius: 6,
              fontSize: "13px",
              fontWeight: 600,
              transition: "all 0.15s",
              cursor: "pointer",
              border: active ? "0.8px solid #1a1a1a" : "0.8px solid transparent",
              fontFamily: "var(--font-dm-sans)",
              background: active ? "#151515" : "transparent",
              color: active ? "#f5f5f5" : "#71717a",
            }}
          >
            {f.label}
            {f.count > 0 && (
              <span
                style={{
                  fontFamily: "var(--font-dm-mono)",
                  fontSize: "0.6rem",
                  padding: "1px 5px",
                  borderRadius: 4,
                  background: active ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
                  color: active ? "#f5f5f5" : "#71717a",
                }}
              >
                {f.count}
              </span>
            )}
          </button>
        );
      })}
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
        alerts: (prev.alerts ?? []).map((a) =>
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
          alerts: (prev.alerts ?? []).map((a) => ({
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

  // ── Loading state ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          padding: "28px 32px 60px",
          background: "#0b0b0b",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            border: "2px solid #3ecf8e",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
      </div>
    );
  }

  if (!data) return null;

  const allAlerts = Array.isArray(data.alerts) ? data.alerts : [];
  const filteredAlerts = allAlerts.filter((a) => {
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
    all:      data.total ?? allAlerts.length,
    unread:   data.unread_count ?? 0,
    critical: allAlerts.filter((a) => a.severity === "critical" || a.severity === "high").length,
    medium:   allAlerts.filter((a) => a.severity === "medium").length,
    low:      allAlerts.filter((a) => a.severity === "low").length,
  };

  return (
    <div
      style={{
        padding: "28px 32px 60px",
        background: "#0b0b0b",
        minHeight: "100vh",
        fontFamily: "var(--font-dm-sans)",
      }}
    >
      {/* Page header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 28,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.4rem",
              fontWeight: 700,
              color: "#f5f5f5",
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            Alertas de seguridad
          </h1>
          <p
            style={{
              color: "#71717a",
              fontSize: "0.8rem",
              marginTop: 5,
              margin: "5px 0 0",
              fontFamily: "var(--font-dm-mono)",
            }}
          >
            {data.unread_count > 0
              ? `${data.unread_count} sin leer · ${data.total} total`
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
              fontSize: "13px",
              fontWeight: 600,
              padding: "8px 16px",
              borderRadius: 8,
              transition: "opacity 0.2s",
              opacity: markingAll ? 0.5 : 1,
              cursor: markingAll ? "not-allowed" : "pointer",
              background: "#151515",
              color: "#f5f5f5",
              border: "0.8px solid #1a1a1a",
              fontFamily: "var(--font-dm-sans)",
            }}
          >
            <span>{markingAll ? "⟳" : "✓"}</span> Marcar todas como leídas
          </button>
        )}
      </div>

      {/* Filter bar */}
      {data.total > 0 && (
        <FilterBar activeFilter={filter} onChange={setFilter} counts={counts} />
      )}

      {/* Alert groups or empty */}
      {filteredAlerts.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <AlertGroup label="Críticas" color="#ef4444" alerts={criticals} onMarkRead={handleMarkRead} />
          <AlertGroup label="Medias"   color="#f59e0b" alerts={mediums}   onMarkRead={handleMarkRead} />
          <AlertGroup label="Bajas"    color="#3b82f6" alerts={lows}      onMarkRead={handleMarkRead} />
        </div>
      )}

      {/* Footer */}
      <div style={{ background: "#151515", border: "0.8px solid #1a1a1a", borderRadius: 16, padding: "12px 24px", display: "flex", justifyContent: "space-between", marginTop: 40 }}>
        <span style={{ fontSize: "12px", color: "#71717a" }}>© 2026 • v1.0.0</span>
        <span style={{ fontSize: "12px", color: "#71717a" }}>by <span style={{ color: "#b3b4b5", fontWeight: 500 }}>ChronoShield</span></span>
      </div>
    </div>
  );
}
