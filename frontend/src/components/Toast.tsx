"use client";

import { useEffect, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  subtitle?: string;
}

// ─── Global event emitter (no React context needed) ──────────────────────────

const subscribers: ((toasts: ToastItem[]) => void)[] = [];
let toasts: ToastItem[] = [];

function notify(item: Omit<ToastItem, "id">) {
  const newToast: ToastItem = { ...item, id: Math.random().toString(36).slice(2) };
  toasts = [...toasts, newToast];
  subscribers.forEach((s) => s(toasts));
  setTimeout(() => dismiss(newToast.id), 4000);
}

function dismiss(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  subscribers.forEach((s) => s(toasts));
}

export const toast = {
  success: (message: string, subtitle?: string) =>
    notify({ type: "success", message, subtitle }),
  error: (message: string, subtitle?: string) =>
    notify({ type: "error", message, subtitle }),
  warning: (message: string, subtitle?: string) =>
    notify({ type: "warning", message, subtitle }),
  info: (message: string, subtitle?: string) =>
    notify({ type: "info", message, subtitle }),
};

// ─── Style constants ─────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  ToastType,
  { iconBg: string; iconColor: string; icon: string; progressColor: string }
> = {
  success: {
    iconBg: "rgba(62,207,142,0.15)",
    iconColor: "#3ecf8e",
    icon: "✓",
    progressColor: "#3ecf8e",
  },
  error: {
    iconBg: "rgba(239,68,68,0.15)",
    iconColor: "#ef4444",
    icon: "✕",
    progressColor: "#ef4444",
  },
  warning: {
    iconBg: "rgba(245,158,11,0.15)",
    iconColor: "#f59e0b",
    icon: "⚠",
    progressColor: "#f59e0b",
  },
  info: {
    iconBg: "rgba(59,130,246,0.15)",
    iconColor: "#3b82f6",
    icon: "ℹ",
    progressColor: "#3b82f6",
  },
};

// ─── Single Toast component ───────────────────────────────────────────────────

interface ToastCardProps {
  item: ToastItem;
  onDismiss: (id: string) => void;
}

function ToastCard({ item, onDismiss }: ToastCardProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const cfg = TYPE_CONFIG[item.type];

  // Trigger slide-in on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  function handleDismiss() {
    setExiting(true);
    setTimeout(() => onDismiss(item.id), 200);
  }

  const cardStyle: React.CSSProperties = {
    position: "relative",
    background: "#161616",
    border: "1px solid #222222",
    borderRadius: "12px",
    padding: "12px 16px 0 16px",
    width: "320px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    transform: exiting
      ? "translateX(110%)"
      : visible
      ? "translateX(0)"
      : "translateX(110%)",
    opacity: exiting ? 0 : 1,
    transition: exiting
      ? "transform 200ms ease-in, opacity 200ms ease-in"
      : "transform 250ms ease-out",
  };

  const bodyStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    paddingBottom: "12px",
  };

  const iconStyle: React.CSSProperties = {
    width: "28px",
    height: "28px",
    minWidth: "28px",
    borderRadius: "50%",
    background: cfg.iconBg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: cfg.iconColor,
    fontWeight: "bold",
    fontSize: "13px",
  };

  const textAreaStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
  };

  const messageStyle: React.CSSProperties = {
    fontSize: "14px",
    fontWeight: 500,
    color: "#f5f5f5",
    lineHeight: "1.4",
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: "12px",
    color: "#71717a",
    marginTop: "2px",
    lineHeight: "1.4",
  };

  const closeStyle: React.CSSProperties = {
    background: "transparent",
    border: "none",
    color: "#71717a",
    fontSize: "16px",
    cursor: "pointer",
    lineHeight: 1,
    padding: "0 0 0 4px",
    flexShrink: 0,
    transition: "color 150ms",
  };

  const progressTrackStyle: React.CSSProperties = {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "2px",
    background: "rgba(255,255,255,0.06)",
    borderRadius: "0 0 12px 12px",
  };

  const progressBarStyle: React.CSSProperties = {
    height: "100%",
    width: "100%",
    borderRadius: "0 0 12px 12px",
    background: cfg.progressColor,
    animation: `progressShrink-${item.id} 4s linear forwards`,
  };

  return (
    <>
      <style>{`
        @keyframes progressShrink-${item.id} {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
      <div style={cardStyle} role="alert" aria-live="assertive">
        <div style={bodyStyle}>
          <div style={iconStyle} aria-hidden="true">
            {cfg.icon}
          </div>
          <div style={textAreaStyle}>
            <div style={messageStyle}>{item.message}</div>
            {item.subtitle && (
              <div style={subtitleStyle}>{item.subtitle}</div>
            )}
          </div>
          <button
            style={closeStyle}
            onClick={handleDismiss}
            aria-label="Cerrar notificación"
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.color = "#f5f5f5")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.color = "#71717a")
            }
          >
            ×
          </button>
        </div>
        <div style={progressTrackStyle} aria-hidden="true">
          <div style={progressBarStyle} />
        </div>
      </div>
    </>
  );
}

// ─── Toaster (renders the container) ─────────────────────────────────────────

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (updated: ToastItem[]) => setItems([...updated]);
    subscribers.push(handler);
    // Sync with any toasts that arrived before mount
    setItems([...toasts]);
    return () => {
      const idx = subscribers.indexOf(handler);
      if (idx !== -1) subscribers.splice(idx, 1);
    };
  }, []);

  if (items.length === 0) return null;

  const containerStyle: React.CSSProperties = {
    position: "fixed",
    top: "16px",
    right: "16px",
    zIndex: 9999,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    alignItems: "flex-end",
    pointerEvents: "none",
  };

  return (
    <>
      <style>{`
        @keyframes toastSlideIn {
          from { transform: translateX(110%); }
          to   { transform: translateX(0); }
        }
      `}</style>
      <div style={containerStyle} aria-label="Notificaciones">
        {items.map((item) => (
          <div key={item.id} style={{ pointerEvents: "auto" }}>
            <ToastCard item={item} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </>
  );
}
