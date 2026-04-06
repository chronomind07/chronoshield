"use client";

import { useEffect, useState } from "react";

// ── ChronoShield icon (shield + lightning bolt) ───────────────────────────────

function ShieldIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {/* Shield shape */}
      <path
        d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V6L12 2z"
        fill="rgba(62,207,142,0.15)"
        stroke="#3ecf8e"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* Lightning bolt */}
      <path
        d="M13 8l-3 5h3l-1 3 4-6h-3l1-2z"
        fill="#3ecf8e"
        stroke="none"
      />
    </svg>
  );
}

// ── WelcomeToast ──────────────────────────────────────────────────────────────

interface WelcomeToastProps {
  onDone: () => void;
}

const DURATION = 3000;

export default function WelcomeToast({ onDone }: WelcomeToastProps) {
  const [phase, setPhase] = useState<"entering" | "visible" | "leaving">("entering");

  // Enter → visible → leaving → unmount
  useEffect(() => {
    // Double rAF ensures CSS transition triggers after first paint
    const r1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase("visible"));
    });
    const leaveTimer = setTimeout(() => setPhase("leaving"), DURATION);
    const doneTimer  = setTimeout(() => onDone(), DURATION + 320);
    return () => {
      cancelAnimationFrame(r1);
      clearTimeout(leaveTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  function close() {
    setPhase("leaving");
    setTimeout(onDone, 320);
  }

  // Translate logic
  const tx =
    phase === "visible" ? "translateX(0)" : "translateX(calc(100% + 24px))";

  return (
    <>
      <style>{`
        @keyframes csWelcomeIn {
          0%   { transform: translateX(calc(100% + 24px)); opacity: 0; }
          55%  { transform: translateX(-7px);              opacity: 1; }
          75%  { transform: translateX(3px); }
          100% { transform: translateX(0); }
        }
        @keyframes csWelcomeOut {
          from { transform: translateX(0);                opacity: 1; }
          to   { transform: translateX(calc(100% + 24px)); opacity: 0; }
        }
        @keyframes csWelcomeProgress {
          from { width: 100%; }
          to   { width: 0%; }
        }
        @keyframes csShieldGlow {
          0%,100% { filter: drop-shadow(0 0 4px rgba(62,207,142,0.5)); }
          50%      { filter: drop-shadow(0 0 10px rgba(62,207,142,0.85)); }
        }
        .cs-welcome-card {
          animation: csWelcomeIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .cs-welcome-card.cs-welcome-leaving {
          animation: csWelcomeOut 0.3s ease-in both;
        }
        .cs-welcome-shield {
          animation: csShieldGlow 2.4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .cs-welcome-card, .cs-welcome-card.cs-welcome-leaving { animation: none !important; }
          .cs-welcome-shield { animation: none !important; }
        }
      `}</style>

      {/* Fixed container — sits on top-right */}
      <div
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 10000,
          pointerEvents: "none",
        }}
      >
        <div
          role="status"
          aria-live="polite"
          className={`cs-welcome-card${phase === "leaving" ? " cs-welcome-leaving" : ""}`}
          style={{
            pointerEvents: "auto",
            position: "relative",
            width: 320,
            background: "#151515",
            border: "1px solid rgba(62,207,142,0.22)",
            borderLeft: "3px solid #3ecf8e",
            borderRadius: 12,
            boxShadow: "0 8px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(62,207,142,0.06)",
            overflow: "hidden",
          }}
        >
          {/* Body */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: "14px 14px 14px 16px",
            }}
          >
            {/* Icon */}
            <div
              className="cs-welcome-shield"
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "rgba(62,207,142,0.08)",
                border: "1px solid rgba(62,207,142,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <ShieldIcon />
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#f5f5f5",
                  lineHeight: 1.35,
                  letterSpacing: "-0.01em",
                }}
              >
                Bienvenido a ChronoShield
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#71717a",
                  marginTop: 3,
                  lineHeight: 1.4,
                }}
              >
                Tu seguridad digital está activa
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={close}
              aria-label="Cerrar"
              style={{
                background: "transparent",
                border: "none",
                color: "#4a4a4a",
                fontSize: 18,
                lineHeight: 1,
                cursor: "pointer",
                padding: "0 0 0 4px",
                flexShrink: 0,
                transition: "color 150ms",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#f5f5f5")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#4a4a4a")}
            >
              ×
            </button>
          </div>

          {/* Progress bar — shrinks over DURATION ms */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              bottom: 0,
              left: 3,           // align with left border start
              right: 0,
              height: 2,
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <div
              style={{
                height: "100%",
                background: "#3ecf8e",
                animation: `csWelcomeProgress ${DURATION}ms linear forwards`,
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
