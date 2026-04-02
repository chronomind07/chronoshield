"use client";

import { useEffect, useRef, useState } from "react";

interface ArcConfig {
  label: string;
  value: number; // 0–100
  radius: number;
  color: string;
  bgColor: string;
}

interface ScoreRingProps {
  score: number; // 0–100
  breachScore?: number;
  sslScore?: number;
  uptimeScore?: number;
  emailScore?: number;
  size?: number;
}

const STROKE_WIDTH = 8;
const CENTER = 100; // SVG viewBox center (200x200)

const defaultArcs: Omit<ArcConfig, "value">[] = [
  { label: "Brechas",  radius: 65, color: "#22d3ee", bgColor: "#1e1e2e" },
  { label: "SSL",      radius: 52, color: "#818cf8", bgColor: "#1e1e2e" },
  { label: "Uptime",   radius: 39, color: "#34d399", bgColor: "#1e1e2e" },
  { label: "Email",    radius: 26, color: "#60a5fa", bgColor: "#1e1e2e" },
];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

interface TooltipState {
  label: string;
  value: number;
  color: string;
  x: number;
  y: number;
}

export default function ScoreRing({
  score = 90,
  breachScore = 85,
  sslScore = 95,
  uptimeScore = 100,
  emailScore = 80,
  size = 200,
}: ScoreRingProps) {
  const [animated, setAnimated] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const values = [breachScore, sslScore, uptimeScore, emailScore];
  const arcs: ArcConfig[] = defaultArcs.map((a, i) => ({ ...a, value: values[i] }));

  const circumference = (r: number) => 2 * Math.PI * r;
  const dashOffset = (r: number, value: number) =>
    circumference(r) * (1 - (animated ? value / 100 : 0));

  const handleMouseEnter = (arc: ArcConfig, e: React.MouseEvent<SVGCircleElement>) => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const scale = rect.width / 200;
    setTooltip({
      label: arc.label,
      value: arc.value,
      color: arc.color,
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    });
  };

  const handleMouseLeave = () => setTooltip(null);

  return (
    <div style={{ position: "relative", width: size, height: size, display: "inline-block" }}>
      <svg
        ref={svgRef}
        viewBox="0 0 200 200"
        width={size}
        height={size}
        style={{ display: "block", background: "transparent" }}
        aria-label={`Security score: ${score}%`}
      >
        {arcs.map((arc) => {
          const circ = circumference(arc.radius);
          return (
            <g key={arc.label}>
              {/* Background track */}
              <circle
                cx={CENTER}
                cy={CENTER}
                r={arc.radius}
                fill="none"
                stroke={arc.bgColor}
                strokeWidth={STROKE_WIDTH}
              />
              {/* Animated value arc */}
              <circle
                cx={CENTER}
                cy={CENTER}
                r={arc.radius}
                fill="none"
                stroke={arc.color}
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={dashOffset(arc.radius, arc.value)}
                transform={`rotate(-90 ${CENTER} ${CENTER})`}
                style={{
                  transition: animated
                    ? "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)"
                    : "none",
                  filter: `drop-shadow(0 0 4px ${arc.color}80)`,
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => handleMouseEnter(arc, e)}
                onMouseLeave={handleMouseLeave}
              />
            </g>
          );
        })}

        {/* Center score */}
        <text
          x={CENTER}
          y={CENTER - 6}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#f1f5f9"
          fontSize="34"
          fontWeight="700"
          fontFamily="'Inter', system-ui, sans-serif"
          style={{ letterSpacing: "-1px" }}
        >
          {score}
        </text>
        <text
          x={CENTER + 22}
          y={CENTER - 16}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#94a3b8"
          fontSize="14"
          fontWeight="600"
          fontFamily="'Inter', system-ui, sans-serif"
        >
          %
        </text>
        <text
          x={CENTER}
          y={CENTER + 14}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#64748b"
          fontSize="10"
          fontFamily="'Inter', system-ui, sans-serif"
          letterSpacing="0.5"
        >
          SCORE
        </text>

        {/* Tooltip rendered in SVG */}
        {tooltip && (
          <g>
            <rect
              x={tooltip.x - 44}
              y={tooltip.y - 32}
              width={88}
              height={26}
              rx={6}
              fill="#0f172a"
              stroke={tooltip.color}
              strokeWidth={1}
              opacity={0.95}
            />
            <text
              x={tooltip.x}
              y={tooltip.y - 22}
              textAnchor="middle"
              fill={tooltip.color}
              fontSize="9"
              fontWeight="600"
              fontFamily="'Inter', system-ui, sans-serif"
            >
              {tooltip.label.toUpperCase()}
            </text>
            <text
              x={tooltip.x}
              y={tooltip.y - 11}
              textAnchor="middle"
              fill="#f1f5f9"
              fontSize="10"
              fontWeight="700"
              fontFamily="'Inter', system-ui, sans-serif"
            >
              {tooltip.value}%
            </text>
          </g>
        )}
      </svg>

      {/* Legend */}
      <div
        style={{
          position: "absolute",
          bottom: -28,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 10,
        }}
      >
        {arcs.map((arc) => (
          <div
            key={arc.label}
            style={{ display: "flex", alignItems: "center", gap: 3 }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: arc.color,
                boxShadow: `0 0 4px ${arc.color}`,
              }}
            />
            <span
              style={{
                fontSize: 9,
                color: "#64748b",
                fontFamily: "'Inter', system-ui, sans-serif",
                fontWeight: 500,
                letterSpacing: "0.3px",
              }}
            >
              {arc.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
