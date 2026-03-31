"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { mitigationApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/Toast";
import { useTranslation } from "@/contexts/LanguageContext";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function greetingText(lang = "es"): string {
  const h = new Date().getHours();
  if (lang === "en") {
    if (h < 12) return "Good morning";
    if (h < 20) return "Good afternoon";
    return "Good evening";
  }
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

function formatTime(date?: Date, lang = "es"): string {
  if (!date) return "";
  return date.toLocaleTimeString(lang === "en" ? "en-US" : "es-ES", { hour: "2-digit", minute: "2-digit" });
}

// ── AI Orb (CSS-only 3D sphere) ───────────────────────────────────────────────
function AIOrb({ speaking = false }: { speaking?: boolean }) {
  return (
    <div style={{ width: 160, height: 160, position: "relative", margin: "0 auto 24px" }}>
      <style>{`
        @keyframes orbFloat {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-10px); }
        }
        @keyframes orbGlow {
          0%,100% { box-shadow: 0 0 30px rgba(62,207,142,.18), 0 0 60px rgba(62,207,142,.08); }
          50%      { box-shadow: 0 0 50px rgba(62,207,142,.35), 0 0 100px rgba(62,207,142,.15); }
        }
        @keyframes orbRingA {
          from { transform: rotateX(70deg) rotate(0deg); }
          to   { transform: rotateX(70deg) rotate(360deg); }
        }
        @keyframes orbRingB {
          from { transform: rotateX(20deg) rotateY(30deg) rotate(0deg); }
          to   { transform: rotateX(20deg) rotateY(30deg) rotate(360deg); }
        }
        @keyframes orbPulse {
          0%,100% { opacity: .5; transform: scale(.96); }
          50%      { opacity: 1;  transform: scale(1.04); }
        }
        @media (prefers-reduced-motion: reduce) {
          .orb-float,.orb-ring-a,.orb-ring-b { animation: none !important; }
        }
      `}</style>
      {/* Float wrapper */}
      <div
        className="orb-float"
        style={{
          width: 160, height: 160, position: "relative",
          animation: `orbFloat 4s ease-in-out infinite`,
        }}
      >
        {/* Sphere body */}
        <div style={{
          position: "absolute", inset: 16, borderRadius: "50%",
          background: "radial-gradient(circle at 35% 30%, #1e3a2e 0%, #0d1a12 45%, #040d08 100%)",
          animation: speaking ? `orbGlow 1.2s ease-in-out infinite, orbPulse 1.2s ease-in-out infinite` : `orbGlow 3s ease-in-out infinite`,
          boxShadow: "0 0 40px rgba(62,207,142,.18)",
        }}>
          {/* Inner highlight */}
          <div style={{
            position: "absolute", top: "18%", left: "22%",
            width: "34%", height: "22%", borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.07) 0%, transparent 100%)",
          }} />
        </div>

        {/* Orbital ring A */}
        <div
          className="orb-ring-a"
          style={{
            position: "absolute", inset: 4, borderRadius: "50%",
            border: "1.5px solid transparent",
            background: "transparent",
            backgroundImage: `conic-gradient(from 0deg, rgba(62,207,142,0) 0%, rgba(62,207,142,0.7) 35%, rgba(62,207,142,0) 70%)`,
            WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 1.5px), white calc(100% - 1.5px))",
            mask: "radial-gradient(farthest-side, transparent calc(100% - 1.5px), white calc(100% - 1.5px))",
            transform: "rotateX(70deg)",
            animation: `orbRingA ${speaking ? "1.6s" : "6s"} linear infinite`,
          }}
        />

        {/* Orbital ring B */}
        <div
          className="orb-ring-b"
          style={{
            position: "absolute", inset: 10, borderRadius: "50%",
            backgroundImage: `conic-gradient(from 120deg, rgba(0,229,191,0) 0%, rgba(0,229,191,0.5) 30%, rgba(0,229,191,0) 60%)`,
            WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 1.5px), white calc(100% - 1.5px))",
            mask: "radial-gradient(farthest-side, transparent calc(100% - 1.5px), white calc(100% - 1.5px))",
            transform: "rotateX(20deg) rotateY(30deg)",
            animation: `orbRingB ${speaking ? "2.2s" : "9s"} linear infinite`,
          }}
        />

        {/* Center pulse dot */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          width: 6, height: 6, marginTop: -3, marginLeft: -3,
          borderRadius: "50%", background: "#3ecf8e",
          boxShadow: "0 0 8px rgba(62,207,142,0.8)",
          animation: speaking ? "orbPulse 0.8s ease-in-out infinite" : "orbPulse 2.5s ease-in-out infinite",
        }} />
      </div>
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
  const { lang } = useTranslation();
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
          {formatTime(msg.timestamp, lang)}
        </span>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AssistantPage() {
  const { t, lang } = useTranslation();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const [usageLimit, setUsageLimit] = useState(1000);
  const [username, setUsername] = useState<string | null>(null);
  const [showHistory, setShowHistory]         = useState(false);
  const [sessions, setSessions]               = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory]   = useState(false);
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

  // ── Load sessions ────────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await mitigationApi.listSessions();
      setSessions(res.data || []);
    } catch {
      toast.error(t("assistant.errorHistory"));
    } finally {
      setLoadingHistory(false);
    }
  }, [t]);

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

        // Auto-save session
        try {
          const allMsgs = [...messages, userMsg, assistantMsg];
          const title = userMsg.content.slice(0, 40) || "Chat";
          const sessionRes = await mitigationApi.saveSession({
            session_id: currentSessionId ?? undefined,
            title,
            messages: allMsgs.map(m => ({
              role: m.role,
              content: m.content,
              timestamp: m.timestamp?.toISOString(),
            })),
          });
          setCurrentSessionId(sessionRes.data.id);
        } catch {
          // Non-critical — don't show error
        }
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 429) {
          toast.error(t("assistant.usageLimit"));
        } else {
          toast.error(t("assistant.errorConnect"));
        }
      } finally {
        setSending(false);
      }
    },
    [sending, messages, usageCount, usageLimit, t, currentSessionId]
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
    const userMsg: ChatMsg = { role: "user", content: t("assistant.analyzeActive"), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);

    try {
      const summaryRes = await mitigationApi.alertsSummary();
      const summary = summaryRes.data.summary as string;

      const res = await mitigationApi.chat({
        message: summary + "\n\n" + t("assistant.analyzePlease"),
        conversation_history: [],
      });

      const assistantMsg: ChatMsg = { role: "assistant", content: res.data.response, timestamp: new Date() };
      setMessages(prev => [...prev, assistantMsg]);
      setUsageCount(res.data.usage_count ?? usageCount + 1);
      setUsageLimit(res.data.usage_limit ?? usageLimit);

      // Auto-save session
      try {
        const allMsgs = [userMsg, assistantMsg];
        const title = userMsg.content.slice(0, 40) || "Chat";
        const sessionRes = await mitigationApi.saveSession({
          session_id: currentSessionId ?? undefined,
          title,
          messages: allMsgs.map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp?.toISOString(),
          })),
        });
        setCurrentSessionId(sessionRes.data.id);
      } catch {
        // Non-critical — don't show error
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 429) {
        toast.error(t("assistant.usageLimit"));
      } else {
        toast.error(t("assistant.errorAlerts"));
      }
    } finally {
      setSending(false);
    }
  }, [sending, usageCount, usageLimit, t, currentSessionId]);

  // ── Suggestion chips ─────────────────────────────────────────────────────
  const ANALYZE_KEY = "__ANALYZE__";
  const suggestions = [
    { label: t("assistant.suggestions.spf"),  action: null },
    { label: t("assistant.suggestions.ssl"),  action: null },
    { label: t("assistant.suggestions.dark"), action: null },
    { label: t("assistant.analyzeAlerts"),    action: ANALYZE_KEY },
  ];

  const handleSuggestion = (label: string, action: string | null) => {
    if (action === ANALYZE_KEY) {
      analyzeAlerts();
      return;
    }
    setInput(label);
    textareaRef.current?.focus();
  };

  // ── New chat ─────────────────────────────────────────────────────────────
  const handleNewChat = () => {
    setMessages([]);
    setInput("");
    setUsageCount(0);
    setCurrentSessionId(null);
    setShowHistory(false);
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
            ChronoAI
          </span>
          <span style={{ fontSize: 12, color: "#71717a" }}>▾</span>
        </div>

        {/* Right — action buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {/* History */}
          <button
            className="icon-btn"
            title={t("assistant.history")}
            onClick={() => {
              if (!showHistory) loadSessions();
              setShowHistory(v => !v);
            }}
            style={{
              background: showHistory ? "rgba(62,207,142,0.08)" : "transparent",
              border: "none",
              cursor: "pointer",
              padding: 6,
              borderRadius: 6,
              color: showHistory ? "#3ecf8e" : "#71717a",
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
            title={t("assistant.newChat")}
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

      {/* ── History panel ── */}
      {showHistory && (
        <div style={{
          borderBottom: "0.8px solid #1a1a1a",
          background: "#0d0d0d",
          padding: "12px 16px",
          flexShrink: 0,
          maxHeight: 200,
          overflowY: "auto",
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            {t("assistant.chatHistory")}
          </div>
          {loadingHistory ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#71717a", fontSize: 12 }}>
              <div style={{ width: 10, height: 10, border: "1.5px solid #71717a", borderTopColor: "transparent", borderRadius: "50%", animation: "spinLoader 0.7s linear infinite" }} />
              {t("common.loading")}
            </div>
          ) : sessions.length === 0 ? (
            <p style={{ fontSize: 12, color: "#55556a", margin: 0 }}>{t("assistant.noHistory")}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {sessions.map(session => (
                <div key={session.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8, background: session.id === currentSessionId ? "rgba(62,207,142,0.06)" : "transparent", border: `0.8px solid ${session.id === currentSessionId ? "rgba(62,207,142,0.15)" : "#1a1a1a"}`, cursor: "pointer", transition: "background 0.15s" }}
                  onClick={async () => {
                    try {
                      const res = await mitigationApi.getSession(session.id);
                      const loaded = (res.data.messages || []).map((m: { role: "user"|"assistant"; content: string; timestamp?: string }) => ({
                        role: m.role as "user" | "assistant",
                        content: m.content,
                        timestamp: m.timestamp ? new Date(m.timestamp) : undefined,
                      }));
                      setMessages(loaded);
                      setCurrentSessionId(session.id);
                      setShowHistory(false);
                    } catch {
                      toast.error(t("assistant.errorHistory"));
                    }
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span style={{ flex: 1, fontSize: 12, color: "#b3b4b5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {session.title}
                  </span>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await mitigationApi.deleteSession(session.id);
                        setSessions(prev => prev.filter(s => s.id !== session.id));
                        if (session.id === currentSessionId) { setMessages([]); setCurrentSessionId(null); }
                      } catch {
                        toast.error(t("assistant.errorHistory"));
                      }
                    }}
                    style={{ background: "none", border: "none", color: "#55556a", cursor: "pointer", padding: "2px 4px", borderRadius: 4, fontSize: 10, flexShrink: 0, transition: "color 0.15s" }}
                    title={t("assistant.deleteChat")}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
                {greetingText(lang)}{username ? `, ${username}` : ""}
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: "#b3b4b5",
                  marginTop: 8,
                  marginBottom: 0,
                }}
              >
                {t("assistant.howHelp")}
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
                  onClick={() => handleSuggestion(chip.label, chip.action)}
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
                  {chip.label}
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
              placeholder={t("assistant.placeholder")}
              rows={1}
              disabled={sending}
              style={{
                flex: 1,
                resize: "none",
                background: "transparent",
                border: "none",
                color: "#f5f5f5",
                fontSize: 14,
                lineHeight: "22px",
                fontFamily: "inherit",
                maxHeight: 120,
                outline: "none",
                overflowY: "auto",
                padding: "5px 0",
                verticalAlign: "middle",
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
                  {t("assistant.send")}
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
              {t("assistant.shiftEnter")}
            </span>
            {usageCount > 0 && (
              <span style={{ fontSize: 11, color: "#71717a" }}>
                {t("assistant.tokensUsed")} {usageCount}/{usageLimit}
              </span>
            )}
          </div>

          {/* Disclaimer */}
          <p style={{ fontSize: 11, color: "#55556a", textAlign: "center", margin: "0 0 8px", maxWidth: 680, width: "100%" }}>
            {t("assistant.disclaimer")}
          </p>
        </div>
      </div>
    </div>
  );
}
