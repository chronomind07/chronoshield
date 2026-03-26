/**
 * ChronoShield — Brand Logo Components
 *
 * LogoIcon  — Shield+clock icon only (64×64 viewBox)
 * LogoFull  — Icon + wordmark (260×44 viewBox)
 *
 * Both are pure inline SVG — safe for server & client components.
 * The full logo uses Plus Jakarta Sans font stack; the font is already
 * loaded globally by next/font so SVG text renders correctly when inline.
 */

// ── Icon only ─────────────────────────────────────────────────────────────────

export function LogoIcon({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      width={size}
      height={size}
      className={className}
      aria-label="ChronoShield icon"
    >
      {/* Shield */}
      <path
        d="M32 4L4 16v20c0 18 28 28 28 28s28-10 28-28V16L32 4z"
        stroke="#00e5bf"
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="#00e5bf"
        fillOpacity={0.06}
      />
      {/* Clock face */}
      <circle cx={32} cy={32} r={11} stroke="#00e5bf" strokeWidth="1.5" opacity={0.4} fill="none" />
      {/* Hour hand */}
      <line x1={32} y1={32} x2={32} y2={21} stroke="#00e5bf" strokeWidth="2" strokeLinecap="round" />
      {/* Minute hand */}
      <line x1={32} y1={32} x2={39} y2={32} stroke="#00e5bf" strokeWidth="1.5" strokeLinecap="round" />
      {/* Center dot */}
      <circle cx={32} cy={32} r={2} fill="#00e5bf" />
    </svg>
  );
}

// ── Full wordmark (icon + text) ───────────────────────────────────────────────

export function LogoFull({
  height = 36,
  className,
}: {
  height?: number;
  className?: string;
}) {
  // Maintain 260:44 aspect ratio
  const width = Math.round((260 / 44) * height);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 260 44"
      fill="none"
      width={width}
      height={height}
      className={className}
      aria-label="ChronoShield"
    >
      {/* Shield */}
      <path
        d="M20 3L3 10.5v13c0 12 17 18 17 18s17-6 17-18v-13L20 3z"
        stroke="#00e5bf"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="#00e5bf"
        fillOpacity={0.06}
      />
      {/* Clock face */}
      <circle cx={20} cy={21} r={7} stroke="#00e5bf" strokeWidth="1.2" opacity={0.4} fill="none" />
      {/* Hour hand */}
      <line x1={20} y1={21} x2={20} y2={14.5} stroke="#00e5bf" strokeWidth="1.5" strokeLinecap="round" />
      {/* Minute hand */}
      <line x1={20} y1={21} x2={24.5} y2={21} stroke="#00e5bf" strokeWidth="1.2" strokeLinecap="round" />
      {/* Center dot */}
      <circle cx={20} cy={21} r={1.3} fill="#00e5bf" />

      {/* "Chrono" — light */}
      <text
        x={48} y={22}
        style={{
          fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: "18px",
          fontWeight: 800,
          letterSpacing: "-0.03em",
        }}
        fill="#f0f0f5"
      >
        Chrono
      </text>

      {/* "Shield" — accent */}
      <text
        x={109} y={22}
        style={{
          fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: "18px",
          fontWeight: 800,
          letterSpacing: "-0.03em",
        }}
        fill="#00e5bf"
      >
        Shield
      </text>

      {/* Tagline */}
      <text
        x={48} y={36}
        style={{
          fontFamily: "'Geist Mono', 'SF Mono', 'Fira Mono', monospace",
          fontSize: "7.5px",
          letterSpacing: "0.16em",
          textTransform: "uppercase" as const,
        }}
        fill="#55556a"
      >
        Security platform
      </text>
    </svg>
  );
}
