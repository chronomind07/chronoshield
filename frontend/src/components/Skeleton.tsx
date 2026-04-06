"use client";

// ── Primitive ──────────────────────────────────────────────────────────────────

export function SkeletonBlock({
  w = "100%",
  h = 16,
  radius = 6,
  style,
}: {
  w?: string | number;
  h?: string | number;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="cs-skeleton"
      style={{
        width: w,
        height: h,
        borderRadius: radius,
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

// ── Overview skeleton ──────────────────────────────────────────────────────────
// Matches: score ring + 4 KPI cards + alerts list

export function OverviewSkeleton() {
  return (
    <div style={{ padding: "0 0 60px", fontFamily: "var(--font-dm-sans)" }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 28, paddingTop: 4 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <SkeletonBlock w={180} h={22} radius={6} />
          <SkeletonBlock w={120} h={14} radius={4} />
        </div>
        <SkeletonBlock w={100} h={32} radius={8} />
      </div>

      {/* Score + KPI row */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        {/* Score ring placeholder */}
        <div style={{ background: "#151515", border: "0.8px solid #1a1a1a", borderRadius: 16, padding: "24px 28px", display: "flex", alignItems: "center", gap: 24, minWidth: 280, flex: 1 }}>
          <div className="cs-skeleton" style={{ width: 120, height: 120, borderRadius: "50%", flexShrink: 0 }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
            {[80, 60, 70, 55].map((w, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <SkeletonBlock w={`${w}%`} h={8} radius={4} />
              </div>
            ))}
          </div>
        </div>

        {/* KPI cards */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", flex: 2, minWidth: 260 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="cs-kpi-card" style={{ background: "#151515", border: "0.8px solid #1a1a1a", borderRadius: 14, padding: "18px 20px", flex: 1, minWidth: 110, display: "flex", flexDirection: "column", gap: 10 }}>
              <SkeletonBlock w="60%" h={12} radius={4} />
              <SkeletonBlock w="40%" h={28} radius={6} />
              <SkeletonBlock w="75%" h={10} radius={4} />
            </div>
          ))}
        </div>
      </div>

      {/* Alerts list */}
      <div style={{ background: "#151515", border: "0.8px solid #1a1a1a", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "0.8px solid #1a1a1a", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <SkeletonBlock w={140} h={16} radius={4} />
          <SkeletonBlock w={60} h={24} radius={6} />
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ padding: "14px 20px", borderBottom: "0.8px solid #111", display: "flex", alignItems: "flex-start", gap: 12 }}>
            <SkeletonBlock w={8} h={8} radius={4} style={{ marginTop: 4 }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
              <SkeletonBlock w="65%" h={13} radius={4} />
              <SkeletonBlock w="40%" h={11} radius={4} />
            </div>
            <SkeletonBlock w={64} h={22} radius={6} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Domains skeleton ───────────────────────────────────────────────────────────
// Matches: header + add-domain card + domain list

export function DomainsSkeleton() {
  return (
    <div style={{ padding: "0 0 40px", fontFamily: "var(--font-dm-sans)" }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", paddingBottom: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <SkeletonBlock w={200} h={24} radius={6} />
          <SkeletonBlock w={280} h={14} radius={4} />
        </div>
        <SkeletonBlock w={120} h={34} radius={8} />
      </div>

      {/* Add domain card */}
      <div style={{ background: "#151515", border: "0.8px solid #1a1a1a", borderRadius: 16, padding: 16, marginBottom: 10 }}>
        <SkeletonBlock w={100} h={11} radius={3} style={{ marginBottom: 14 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <SkeletonBlock w="100%" h={38} radius={8} />
          <SkeletonBlock w={90} h={38} radius={8} />
        </div>
      </div>

      <SkeletonBlock w={260} h={11} radius={3} style={{ marginBottom: 20, marginTop: 8 }} />

      {/* Domain cards */}
      {[1, 2].map(i => (
        <div key={i} style={{ background: "#151515", border: "0.8px solid #1a1a1a", borderRadius: 16, padding: "16px 20px", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <SkeletonBlock w={10} h={10} radius={5} />
              <SkeletonBlock w={160} h={16} radius={4} />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <SkeletonBlock w={60} h={26} radius={6} />
              <SkeletonBlock w={60} h={26} radius={6} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[1, 2, 3, 4, 5].map(j => (
              <SkeletonBlock key={j} w={70} h={22} radius={6} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Generic page skeleton ──────────────────────────────────────────────────────
// Used for: alerts, emails, darkweb, history, reports, uptime, assistant

export function GenericPageSkeleton({ rows = 5, statCards = 3 }: { rows?: number; statCards?: number }) {
  return (
    <div style={{ padding: "0 0 60px", fontFamily: "var(--font-dm-sans)" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <SkeletonBlock w={200} h={22} radius={6} style={{ marginBottom: 8 }} />
        <SkeletonBlock w={320} h={13} radius={4} />
      </div>

      {/* Stat cards row */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        {Array.from({ length: statCards }).map((_, i) => (
          <div key={i} style={{ background: "#151515", border: "0.8px solid #1a1a1a", borderRadius: 12, padding: "16px 20px", flex: 1, minWidth: 120, display: "flex", flexDirection: "column", gap: 10 }}>
            <SkeletonBlock w="55%" h={11} radius={3} />
            <SkeletonBlock w="45%" h={28} radius={5} />
          </div>
        ))}
      </div>

      {/* Content block */}
      <div style={{ background: "#151515", border: "0.8px solid #1a1a1a", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "0.8px solid #1a1a1a", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <SkeletonBlock w={160} h={15} radius={4} />
          <SkeletonBlock w={80} h={28} radius={6} />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ padding: "13px 20px", borderBottom: "0.8px solid #111", display: "flex", alignItems: "center", gap: 14 }}>
            <SkeletonBlock w={10} h={10} radius={5} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <SkeletonBlock w={`${55 + (i % 3) * 10}%`} h={13} radius={4} />
              <SkeletonBlock w={`${30 + (i % 4) * 8}%`} h={11} radius={3} />
            </div>
            <SkeletonBlock w={72} h={24} radius={6} />
          </div>
        ))}
      </div>
    </div>
  );
}
