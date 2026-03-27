"use client";

import { useEffect, useRef, useState } from "react";
import { mitigationApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

// ── AI Orb (Aniq-UI replica with ChronoShield green) ─────────────────────────
function AIOrb({ speaking }: { speaking: boolean }) {
  return (
    <div style={{ position: "relative", width: 180, height: 180 }}>
      <svg
        width="180" height="180" viewBox="0 0 180 180"
        style={{ animation: `orbSpin ${speaking ? "3s" : "8s"} linear infinite` }}
      >
        <defs>
          <clipPath id="orb-clip">
            <circle cx="90" cy="90" r="84" />
          </clipPath>
          <radialGradient id="orb-bg" cx="38%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#0f2318" />
            <stop offset="60%" stopColor="#071209" />
            <stop offset="100%" stopColor="#030703" />
          </radialGradient>
          <radialGradient id="orb-inner-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(62,207,142,0.04)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>

        {/* Sphere body */}
        <circle cx="90" cy="90" r="84" fill="url(#orb-bg)" />
        <circle cx="90" cy="90" r="84" fill="url(#orb-inner-glow)" />

        {/* Grid lines (globe wireframe) */}
        <g clipPath="url(#orb-clip)" stroke="rgba(62,207,142,0.12)" strokeWidth="0.6" fill="none">
          {/* Latitude lines */}
          {[-54, -36, -18, 0, 18, 36, 54].map((offset, i) => (
            <line key={`lat-${i}`} x1="6" y1={90 + offset} x2="174" y2={90 + offset} />
          ))}
          {/* Longitude lines */}
          {[-54, -36, -18, 0, 18, 36, 54].map((offset, i) => (
            <line key={`lon-${i}`} x1={90 + offset} y1="6" x2={90 + offset} y2="174" />
          ))}
        </g>

        {/* Primary arc — bright accent */}
        <circle
          cx="90" cy="90" r="81"
          fill="none"
          stroke="#3ecf8e"
          strokeWidth="2.5"
          strokeDasharray="105 405"
          strokeDashoffset="0"
          strokeLinecap="round"
        />

        {/* Secondary arc — subtle white/silver */}
        <circle
          cx="90" cy="90" r="81"
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1.5"
          strokeDasharray="70 440"
          strokeDashoffset="-220"
          strokeLinecap="round"
        />

        {/* Outer ring */}
        <circle cx="90" cy="90" r="87" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <circle cx="90" cy="90" r="84" fill="none" stroke="rgba(62,207,142,0.08)" strokeWidth="0.5" />
      </svg>

      {/* Center glow when speaking */}
      {speaking && (
        <div style={{
          position: "absolute",
          inset: "30%",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(62,207,142,0.15), transparent)",
          animation: "orbGlow 1s ease-in-out infinite alternate",
        }} />
      )}
    </div>
  );
}

// ── Greeting ──────────────────────────────────────────────────────────────────
function greetingText() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

// ── Message bubble ────────────────────────────────────────────────────────────
function Bubble({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 12 }}>
      {!isUser && (
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(62,207,142,0.12)", border: "1px solid rgba(62,207,142,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 10, flexShrink: 0, marginTop: 2 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
          </svg>
        </div>
      )}
      <div style={{
        maxWidth: "72%",
        padding: "10px 14px",
        borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
        background: isUser ? "#3ecf8e" : "#1c1c1c",
        border: isUser ? "none" : "1px solid rgba(255,255,255,0.06)",
        color: isUser ? "#000" : "#f0f0f0",
        fontSize: "0.85rem",
        lineHeight: 1.55,
        fontWeight: isUser ? 500 : 400,
        whiteSpace: "pre-wrap",
      }}>
        {msg.content}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const [usageLimit, setUsageLimit] = useState(10);
  const [username, setUsername] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.email) {
        setUsername(data.session.user.email.split("@")[0]);
      }
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || sending) return;
    const userMsg: ChatMsg = { role: "user", content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setSending(true);
    setHasStarted(true);
    try {
      const res = await mitigationApi.chat({
        alert_id: undefined as unknown as string,
        message: text.trim(),
        conversation_history: messages,
      });
      const assistantMsg: ChatMsg = { role: "assistant", content: res.data.response };
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
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const suggestions = [
    "¿Cómo configuro correctamente DMARC?",
    "¿Qué significa un score de seguridad bajo?",
    "Explícame qué es SPF y por qué es importante",
    "¿Cómo puedo mejorar la seguridad de mi dominio?",
  ];

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>
      <style>{`
        @keyframes orbSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes orbGlow { from { opacity: 0.5; } to { opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

        .assistant-grid-bg {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
        }
        .msg-input:focus { outline: none; border-color: rgba(62,207,142,0.3) !important; }
        .msg-input::placeholder { color: #52525b; }
        .suggestion-btn:hover { background: rgba(62,207,142,0.08) !important; border-color: rgba(62,207,142,0.2) !important; color: #f0f0f0 !important; }
      `}</style>

      {/* Background grid */}
      <div className="assistant-grid-bg" />

      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>

        {/* Center area — orb + greeting (shown when no messages) */}
        {!hasStarted ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", gap: 0 }}>
            {/* Orb */}
            <AIOrb speaking={false} />

            {/* Greeting */}
            <div style={{ marginTop: 24, textAlign: "center" }}>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#f0f0f0", letterSpacing: "-0.01em", margin: 0 }}>
                {greetingText()}{username ? `, ${username}` : ""}.
              </h2>
              <p style={{ fontSize: "0.85rem", color: "#52525b", marginTop: 8, maxWidth: 400 }}>
                Soy tu asistente de seguridad. Puedo analizar alertas, explicar vulnerabilidades y guiarte en la solución de problemas.
              </p>
            </div>

            {/* Suggestions */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 24, justifyContent: "center", maxWidth: 640 }}>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  className="suggestion-btn"
                  onClick={() => { setInput(s); inputRef.current?.focus(); }}
                  style={{
                    padding: "8px 14px",
                    background: "#1c1c1c",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8,
                    color: "#a1a1aa",
                    fontSize: "0.78rem",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Chat messages */
          <div style={{ flex: 1, padding: "24px 32px", maxWidth: 800, width: "100%", margin: "0 auto" }}>
            {messages.map((msg, i) => <Bubble key={i} msg={msg} />)}
            {sending && (
              <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(62,207,142,0.12)", border: "1px solid rgba(62,207,142,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 10, flexShrink: 0, marginTop: 2 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                </div>
                <div style={{ padding: "10px 14px", background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px 14px 14px 4px", display: "flex", alignItems: "center", gap: 5 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#3ecf8e", animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Input area */}
        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(10,10,10,0.95)",
          backdropFilter: "blur(12px)",
          padding: "16px 24px",
          position: "sticky",
          bottom: 0,
        }}>
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, background: "#161616", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "10px 14px" }}>
              <textarea
                ref={inputRef}
                className="msg-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pregunta sobre seguridad, alertas, configuración DNS..."
                rows={1}
                disabled={sending}
                style={{
                  flex: 1, resize: "none", background: "none", border: "none",
                  color: "#f0f0f0", fontSize: "0.875rem", lineHeight: 1.5,
                  fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                  maxHeight: 120, outline: "none", overflowY: "auto",
                }}
                onInput={e => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = "auto";
                  t.style.height = Math.min(t.scrollHeight, 120) + "px";
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || sending}
                style={{
                  width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  background: input.trim() && !sending ? "#3ecf8e" : "rgba(255,255,255,0.04)",
                  border: "none", borderRadius: 8, cursor: input.trim() && !sending ? "pointer" : "not-allowed",
                  transition: "all 0.15s", color: input.trim() && !sending ? "#000" : "#3a3a3a",
                }}
              >
                {sending ? (
                  <div style={{ width: 14, height: 14, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                )}
              </button>
            </div>

            {/* Usage indicator */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
              <p style={{ fontSize: "0.68rem", color: "#3a3a3a" }}>Shift+Enter para nueva línea</p>
              {usageCount > 0 && (
                <p style={{ fontSize: "0.68rem", color: "#3a3a3a", fontFamily: "var(--font-dm-mono)" }}>
                  {usageCount}/{usageLimit} consultas
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
