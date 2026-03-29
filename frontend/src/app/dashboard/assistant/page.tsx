"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { mitigationApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/Toast";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function greetingText(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

function formatTime(date?: Date): string {
  if (!date) return "";
  return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

// ── AI Orb ────────────────────────────────────────────────────────────────────
function AIOrb({ speaking = false }: { speaking?: boolean }) {
  return (
    <div style={{ width: 160, height: 160, position: "relative", margin: "0 auto 24px" }}>
      <svg
        viewBox="0 0 160 160"
        width="160"
        height="160"
        style={{ overflow: "visible" }}
      >
        <defs>
          {/* Dark sphere gradient */}
          <radialGradient id="orbBg" cx="45%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#1a2820" />
            <stop offset="50%" stopColor="#0d1a12" />
            <stop offset="100%" stopColor="#050f09" />
          </radialGradient>
          {/* Clip to circle */}
          <clipPath id="orbClip">
            <circle cx="80" cy="80" r="72" />
          </clipPath>
          {/* Arc glow filter */}
          <filter id="arcGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer subtle ring */}
        <circle
          cx="80" cy="80" r="76"
          fill="none"
          stroke="rgba(62,207,142,0.08)"
          strokeWidth="1"
        />

        {/* Main sphere */}
        <circle cx="80" cy="80" r="72" fill="url(#orbBg)" />

        {/* Grid lines inside sphere (clipped) */}
        <g clipPath="url(#orbClip)">
          {[24, 36, 48, 60, 72, 84, 96, 108, 120, 132].map(y => (
            <line
              key={`h${y}`}
              x1="8" y1={y} x2="152" y2={y}
              stroke="rgba(62,207,142,0.12)"
              strokeWidth="0.5"
            />
          ))}
          {[24, 36, 48, 60, 72, 84, 96, 108, 120, 132].map(x => (
            <line
              key={`v${x}`}
              x1={x} y1="8" x2={x} y2="152"
              stroke="rgba(62,207,142,0.12)"
              strokeWidth="0.5"
            />
          ))}
          {/* Equator line (slightly brighter) */}
          <ellipse
            cx="80" cy="80" rx="72" ry="20"
            fill="none"
            stroke="rgba(62,207,142,0.18)"
            strokeWidth="0.75"
          />
          {/* Meridian */}
          <ellipse
            cx="80" cy="80" rx="20" ry="72"
            fill="none"
            stroke="rgba(62,207,142,0.12)"
            strokeWidth="0.5"
          />
        </g>

        {/* Primary rotating arc group */}
        <g
          style={{
            transformOrigin: "80px 80px",
            animation: `orbSpin ${speaking ? "2s" : "8s"} linear infinite`,
          }}
        >
          <circle
            cx="80" cy="80" r="72"
            fill="none"
            stroke="#3ecf8e"
            strokeWidth="2.5"
            strokeDasharray="105 405"
            strokeLinecap="round"
            filter="url(#arcGlow)"
          />
          {/* Bright glow dot at arc leading edge */}
          <circle cx="80" cy="8" r="3" fill="white" opacity="0.9" />
        </g>

        {/* Secondary dimmer arc (reverse) */}
        <g
          style={{
            transformOrigin: "80px 80px",
            animation: `orbSpin2 ${speaking ? "3s" : "12s"} linear infinite reverse`,
          }}
        >
          <circle
            cx="80" cy="80" r="72"
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
            strokeDasharray="60 392"
            strokeLinecap="round"
          />
        </g>

        {/* Sphere highlight */}
        <ellipse cx="65" cy="48" rx="16" ry="10" fill="rgba(255,255,255,0.04)" />
      </svg>
    </div>
  );
}

// ── Typing dots ───────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 2px",
      }}
    >
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "#3ecf8e",
            animation: `dotBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ── Chat bubble ───────────────────────────────────────────────────────────────
function Bubble({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === "user";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        marginBottom: 16,
        animation: "msgFadeIn 0.2s ease-out",
      }}
    >
      <div
        style={{
          maxWidth: isUser ? "70%" : "80%",
          padding: "10px 14px",
          borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          background: isUser ? "#3ecf8e" : "#151515",
          border: isUser ? "none" : "0.8px solid #1a1a1a",
          color: isUser ? "#000000" : "#f5f5f5",
          fontSize: 14,
          lineHeight: 1.6,
          fontWeight: isUser ? 500 : 400,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {msg.content}
      </div>
      {msg.timestamp && (
        <span
          style={{
            fontSize: 11,
            color: "#71717a",
            marginTop: 4,
            paddingLeft: isUser ? 0 : 2,
            paddingRight: isUser ? 2 : 0,
          }}
        >
          {formatTime(msg.timestamp)}
        </span>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const [usageLimit, setUsageLimit] = useState(1000);
  const [username, setUsername] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasMessages = messages.length > 0;

  // ── Load username ────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.email) {
        setUsername(data.session.user.email.split("@")[0]);
      }
    });
  }, []);

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // ── Textarea auto-resize ─────────────────────────────────────────────────
  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, []);

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || sending) return;

      const userMsg: ChatMsg = {
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, userMsg]);
      setInput("");
      setSending(true);

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      try {
        const history = messages.map(m => ({ role: m.role, content: m.content }));
        const res = await mitigationApi.chat({
          message: text.trim(),
          conversation_history: history,
        });

        const assistantMsg: ChatMsg = {
          role: "assistant",
          content: res.data.response,
          timestamp: new Date(),
        };

        setMessages(prev => [...prev, assistantMsg]);
        setUsageCount(res.data.usage_count ?? usageCount + 1);
        setUsageLimit(res.data.usage_limit ?? usageLimit);
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 429) {
          toast.error("Límite de uso alcanzado.");
        } else {
          toast.error("Error al conectar con el asistente.");
        }
      } finally {
        setSending(false);
      }
    },
    [sending, messages, usageCount, usageLimit]
  );

  // ── Keyboard handler ─────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // ── Analyze alerts ───────────────────────────────────────────────────────
  const analyzeAlerts = useCallback(async () => {
    if (sending) return;
    setSending(true);
    const userMsg: ChatMsg = { role: "user", content: "Analiza mis alertas activas", timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);

    try {
      const summaryRes = await mitigationApi.alertsSummary();
      const summary = summaryRes.data.summary as string;

      const res = await mitigationApi.chat({
        message: summary + "\n\nPor favor, analiza estas alertas y dime cuáles son las más urgentes y cómo resolverlas.",
        conversation_history: [],
      });

      const assistantMsg: ChatMsg = { role: "assistant", content: res.data.response, timestamp: new Date() };
      setMessages(prev => [...prev, assistantMsg]);
      setUsageCount(res.data.usage_count ?? usageCount + 1);
      setUsageLimit(res.data.usage_limit ?? usageLimit);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 429) {
        toast.error("Límite de uso alcanzado.");
      } else {
        toast.error("Error al analizar alertas.");
      }
    } finally {
      setSending(false);
    }
  }, [sending, usageCount, usageLimit]);

  // ── Suggestion chips ─────────────────────────────────────────────────────
  const suggestions = [
    "¿Cómo mejorar mi SPF/DKIM?",
    "Analiza mi puntuación SSL",
    "Qué significa una brecha Dark Web",
    "📊 Analizar mis alertas",
  ];

  const handleSuggestion = (text: string) => {
    if (text === "📊 Analizar mis alertas") {
      analyzeAlerts();
      return;
    }
    setInput(text);
    textareaRef.current?.focus();
  };

  // ── New chat ─────────────────────────────────────────────────────────────
  const handleNewChat = () => {
    setMessages([]);
    setInput("");
    setUsageCount(0);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const canSend = input.trim().length > 0 && !sending;

  return (
    <div
      style={{
        height: "calc(100vh - 64px)",
        background: "#0b0b0b",
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
        display: "flex",
        flexDirection: "column",
        padding: "0 24px",
        overflow: "hidden",
      }}
    >
      {/* ── Global keyframes ── */}
      <style>{`
        @keyframes orbSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes orbSpin2 {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes dotBounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1;   }
        }
        @keyframes msgFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        @keyframes spinLoader {
          to { transform: rotate(360deg); }
        }
        .chip-btn:hover {
          background: #1c1c1c !important;
          color: #f5f5f5 !important;
          border-color: rgba(62,207,142,0.25) !important;
        }
        .icon-btn:hover {
          background: rgba(255,255,255,0.06) !important;
          color: #f5f5f5 !important;
        }
        .chat-textarea:focus {
          outline: none;
        }
        .chat-textarea::placeholder {
          color: #71717a;
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
      `}</style>

      {/* ── Topbar ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          height: 48,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "0.8px solid #1a1a1a",
          flexShrink: 0,
        }}
      >
        {/* Left — model chip */}
        <div
          style={{
            background: "#151515",
            border: "0.8px solid #1a1a1a",
            borderRadius: 8,
            padding: "6px 12px",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            cursor: "default",
            userSelect: "none",
          }}
        >
          {/* Small AI icon */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#3ecf8e" strokeWidth="2" />
            <path d="M12 8v4l3 3" stroke="#3ecf8e" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: 13, color: "#f5f5f5", fontWeight: 500 }}>
            Claude Haiku
          </span>
          <span style={{ fontSize: 12, color: "#71717a" }}>▾</span>
        </div>

        {/* Right — action buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {/* History */}
          <button
            className="icon-btn"
            title="Historial"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 6,
              borderRadius: 6,
              color: "#71717a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </button>

          {/* New chat */}
          <button
            className="icon-btn"
            title="Nueva conversación"
            onClick={handleNewChat}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 6,
              borderRadius: 6,
              color: "#71717a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginLeft: 4,
              transition: "background 0.15s, color 0.15s",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Main content (flex-1, scrollable) ──────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        {/* Empty state — orb + greeting + chips */}
        {!hasMessages ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              paddingBottom: 24,
            }}
          >
            {/* Orb */}
            <AIOrb speaking={sending} />

            {/* Greeting */}
            <div style={{ textAlign: "center" }}>
              <h2
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 600,
                  color: "#f5f5f5",
                  margin: 0,
                  letterSpacing: "-0.01em",
                }}
              >
                {greetingText()}{username ? `, ${username}` : ""}
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: "#b3b4b5",
                  marginTop: 8,
                  marginBottom: 0,
                }}
              >
                ¿Cómo puedo ayudarte con la seguridad hoy?
              </p>
            </div>

            {/* Suggestion chips — 2×2 grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginTop: 24,
                width: "100%",
                maxWidth: 560,
              }}
            >
              {suggestions.map((chip, i) => (
                <button
                  key={i}
                  className="chip-btn"
                  onClick={() => handleSuggestion(chip)}
                  style={{
                    background: "#151515",
                    border: "0.8px solid #1a1a1a",
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: "#b3b4b5",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.15s, color 0.15s, border-color 0.15s",
                    lineHeight: 1.4,
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Chat messages list */
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "20px 0 8px",
              maxWidth: 680,
              width: "100%",
              alignSelf: "center",
            }}
          >
            {messages.map((msg, i) => (
              <Bubble key={i} msg={msg} />
            ))}

            {/* Typing indicator */}
            {sending && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  marginBottom: 16,
                  animation: "msgFadeIn 0.2s ease-out",
                }}
              >
                <div
                  style={{
                    background: "#151515",
                    border: "0.8px solid #1a1a1a",
                    borderRadius: "16px 16px 16px 4px",
                    padding: "10px 14px",
                  }}
                >
                  <TypingDots />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}

        {/* ── Input bar (always at bottom) ──────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            flexShrink: 0,
            paddingBottom: 4,
          }}
        >
          <div
            style={{
              background: "#151515",
              border: "0.8px solid #1a1a1a",
              borderRadius: 16,
              padding: "12px 16px",
              display: "flex",
              alignItems: "flex-end",
              gap: 8,
              margin: "16px 0 0 0",
              maxWidth: 680,
              width: "100%",
            }}
          >
            <textarea
              ref={textareaRef}
              className="chat-textarea"
              value={input}
              onChange={e => {
                setInput(e.target.value);
                autoResize();
              }}
              onKeyDown={handleKeyDown}
              onInput={autoResize}
              placeholder="Pregúntame sobre seguridad..."
              rows={1}
              disabled={sending}
              style={{
                flex: 1,
                resize: "none",
                background: "transparent",
                border: "none",
                color: "#f5f5f5",
                fontSize: 14,
                lineHeight: 1.5,
                fontFamily: "inherit",
                maxHeight: 120,
                outline: "none",
                overflowY: "auto",
              }}
            />

            {/* Send button */}
            <button
              onClick={() => sendMessage(input)}
              disabled={!canSend}
              style={{
                background: canSend ? "#3ecf8e" : "#262626",
                color: canSend ? "#000000" : "#71717a",
                border: "none",
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                cursor: canSend ? "pointer" : "not-allowed",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                transition: "background 0.15s, color 0.15s",
                height: 32,
                minWidth: 68,
              }}
            >
              {sending ? (
                <div
                  style={{
                    width: 13,
                    height: 13,
                    border: "2px solid currentColor",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spinLoader 0.7s linear infinite",
                  }}
                />
              ) : (
                <>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  Enviar
                </>
              )}
            </button>
          </div>

          {/* Usage counter + hint */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              maxWidth: 680,
              width: "100%",
              marginTop: 6,
              marginBottom: 24,
              padding: "0 2px",
            }}
          >
            <span style={{ fontSize: 11, color: "#71717a" }}>
              Shift+Enter para nueva línea
            </span>
            {usageCount > 0 && (
              <span style={{ fontSize: 11, color: "#71717a" }}>
                Tokens usados: {usageCount}/{usageLimit}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
