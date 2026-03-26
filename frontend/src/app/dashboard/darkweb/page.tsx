"use client";

import { useEffect, useState, useCallback } from "react";
import { darkwebApi, creditsApi } from "@/lib/api";
import toast from "react-hot-toast";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Credits {
  credits_available: number;
  credits_used: number;
  reset_date: string;
  plan: string;
}

interface BreachRecord {
  id?: string;
  email?: string;
  domain?: string;
  username?: string;
  password?: string;
  hashedPassword?: string;
  ipAddress?: string;
  timestamp?: string;
  source?: string;
  breachName?: string;
}

interface EmailItem {
  id: string;
  email: string;
  last_scan_at: string | null;
  breach_count: number;
  status: "breached" | "clean" | "never_scanned";
  latest_breaches: BreachRecord[];
}

interface DomainItem {
  id: string;
  domain: string;
  last_scan_at: string | null;
  breach_count: number;
  status: "found" | "clean" | "never_scanned";
  latest_results: BreachRecord[];
}

interface ImpersonationItem {
  id: string;
  domain: string;
  last_scan_at: string | null;
  threats_count: number;
  status: "threatened" | "clean" | "never_scanned";
  latest_threats: BreachRecord[];
}

interface ScanAllBreakdown {
  emails: number;
  domains: number;
  impersonation: number;
}

interface DarkWebSummary {
  plan: string;
  credits: Credits;
  emails: EmailItem[];
  domains: DomainItem[];
  impersonation: ImpersonationItem[];
  impersonation_available: boolean;
  scan_all_cost: number;
  scan_all_breakdown: ScanAllBreakdown;
  last_scan_at: string | null;
  next_auto_scan: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function handleScanError(err: unknown, setShowPacks: (v: boolean) => void) {
  const e = err as { response?: { data?: { detail?: { code?: string; message?: string } | string } } };
  const detail = e?.response?.data?.detail;
  const msg = typeof detail === "object" ? detail?.message : (detail as string) || "Error al escanear";
  toast.error(msg as string);
  if (typeof detail === "object" && detail?.code === "NO_CREDITS") {
    setShowPacks(true);
  }
}

// ── Credit badge ───────────────────────────────────────────────────────────────
function CreditBadge({ credits }: { credits: Credits }) {
  const total = credits.credits_available + credits.credits_used;
  const pct = total > 0 ? credits.credits_available / total : 1;
  const color =
    credits.credits_available > 2 ? "#00e5bf" :
    credits.credits_available > 0 ? "#ffb020" : "#ff4d6a";

  return (
    <div style={{ background: "#0f0f16", border: "1px solid rgba(255,255,255,0.03)", borderRadius: 12, padding: "16px 20px" }}>
      <div style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.6rem", textTransform: "uppercase" as const, letterSpacing: "0.16em", color: "#33334a", marginBottom: 8 }}>Créditos</div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 8 }}>
            <span style={{ fontFamily: "var(--font-serif-family)", fontSize: "2rem", fontWeight: 400, color, lineHeight: 1 }}>
              {credits.credits_available}
            </span>
            <span style={{ fontSize: "0.75rem", color: "#55556a" }}>/ {total}</span>
          </div>
          <div style={{ height: 3, borderRadius: 3, overflow: "hidden", background: "rgba(255,255,255,0.05)" }}>
            <div
              style={{ height: "100%", borderRadius: 3, transition: "width 0.7s", width: `${pct * 100}%`, background: color }}
            />
          </div>
        </div>
        <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
          <div style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.6rem", textTransform: "uppercase" as const, letterSpacing: "0.14em", color: "#33334a" }}>Reset</div>
          <div style={{ fontSize: "0.75rem", color: "#9999ad", marginTop: 3 }}>{fmtDate(credits.reset_date)}</div>
        </div>
      </div>
    </div>
  );
}

// ── Status pill ────────────────────────────────────────────────────────────────
type ItemStatus = "breached" | "found" | "threatened" | "clean" | "never_scanned";

function StatusPill({ status }: { status: ItemStatus }) {
  const map: Record<ItemStatus, { label: string; color: string; bg: string; border: string }> = {
    breached:      { label: "FILTRADO",      color: "#ff4d6a", bg: "rgba(255,77,106,0.08)",  border: "rgba(255,77,106,0.15)" },
    found:         { label: "DETECTADO",     color: "#ff4d6a", bg: "rgba(255,77,106,0.08)",  border: "rgba(255,77,106,0.15)" },
    threatened:    { label: "AMENAZA",       color: "#ffb020", bg: "rgba(255,176,32,0.08)",  border: "rgba(255,176,32,0.15)" },
    clean:         { label: "LIMPIO",        color: "#00e5bf", bg: "rgba(0,229,191,0.08)",   border: "rgba(0,229,191,0.15)" },
    never_scanned: { label: "SIN ESCANEAR", color: "#55556a", bg: "rgba(85,85,106,0.08)",   border: "rgba(85,85,106,0.15)" },
  };
  const s = map[status];
  return (
    <span
      style={{
        fontFamily: "var(--font-mono-family)", fontSize: "0.6rem", textTransform: "uppercase" as const,
        letterSpacing: "0.1em", padding: "3px 8px", borderRadius: 20, flexShrink: 0,
        color: s.color, background: s.bg, border: `1px solid ${s.border}`,
      }}
    >
      {s.label}
    </span>
  );
}

// ── Scan button ────────────────────────────────────────────────────────────────
function ScanBtn({
  scanning, onClick, small,
}: {
  scanning: boolean;
  onClick: (e: React.MouseEvent) => void;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={scanning}
      style={{
        display: "flex", alignItems: "center", gap: 5, fontWeight: 600, borderRadius: 7, transition: "all 0.15s",
        flexShrink: 0, cursor: "pointer", opacity: scanning ? 0.5 : 1,
        fontSize: small ? "0.72rem" : "0.78rem",
        padding: small ? "5px 10px" : "7px 14px",
        background: "rgba(0,229,191,0.06)",
        border: "1px solid rgba(0,229,191,0.18)",
        color: "#00e5bf",
        fontFamily: "var(--font-jakarta-family)",
      }}
    >
      <span style={{ display: "inline-block", animation: scanning ? "spin 0.8s linear infinite" : "none" }}>⟳</span>
      {scanning ? "Escaneando" : "Escanear"}
    </button>
  );
}

// ── Breach detail row ──────────────────────────────────────────────────────────
function BreachDetail({ record }: { record: BreachRecord }) {
  const hasPassword = !!(record.password || record.hashedPassword);
  return (
    <div
      style={{ borderRadius: 8, padding: "10px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.04)" }}
    >
      {[
        { label: "Fuente",     val: record.breachName || record.source },
        { label: "Email",      val: record.email },
        { label: "Usuario",    val: record.username },
        { label: "Dominio",    val: record.domain },
        { label: "IP",         val: record.ipAddress },
        { label: "Contraseña", val: record.password ? "expuesta" : record.hashedPassword ? "hash expuesto" : null },
        { label: "Fecha",      val: record.timestamp ? fmtDate(record.timestamp) : null },
      ].filter((f) => f.val).map((f) => (
        <div key={f.label}>
          <div style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.6rem", textTransform: "uppercase" as const, letterSpacing: "0.1em", color: "#55556a" }}>{f.label}</div>
          <div
            style={{
              fontFamily: "var(--font-mono-family)", fontSize: "0.72rem", marginTop: 2, wordBreak: "break-all" as const,
              color: f.label === "Contraseña" && hasPassword ? "#ff4d6a" : "#f0f0f5",
            }}
          >
            {f.val}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Email row ──────────────────────────────────────────────────────────────────
function EmailRow({
  item, onScan, setShowPacks,
}: {
  item: EmailItem;
  onScan: (id: string) => void;
  setShowPacks: (v: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [scanning, setScanning] = useState(false);

  const handleScan = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setScanning(true);
    try {
      const res = await darkwebApi.scanEmail(item.id);
      toast.success(`Escaneo iniciado · ${res.data.credits_remaining} créditos restantes`);
      onScan(item.id);
    } catch (err) {
      handleScanError(err, setShowPacks);
    } finally {
      setScanning(false);
    }
  };

  const danger = item.status === "breached";

  return (
    <div
      style={{
        borderRadius: 10, overflow: "hidden",
        background: "#0a0a0f",
        border: `1px solid ${danger ? "rgba(255,77,106,0.15)" : "rgba(255,255,255,0.04)"}`,
        marginBottom: 8,
      }}
    >
      <button
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", textAlign: "left" as const, background: "none", border: "none", cursor: "pointer" }}
        onClick={() => setExpanded(!expanded)}
      >
        <div
          style={{
            width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0,
            background: danger ? "rgba(255,77,106,0.08)" : "rgba(0,229,191,0.06)",
          }}
        >
          {danger ? "⚠" : "✉"}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.82rem", color: "#f0f0f5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.email}</div>
          <div style={{ fontSize: "0.72rem", color: "#55556a", marginTop: 3 }}>
            {item.last_scan_at ? relTime(item.last_scan_at) : "Nunca escaneado"}
            {item.breach_count > 0 && (
              <span style={{ color: "#ff4d6a", marginLeft: 8 }}>{item.breach_count} filtración{item.breach_count !== 1 ? "es" : ""}</span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <StatusPill status={item.status} />
          <ScanBtn scanning={scanning} onClick={handleScan} small />
          <span style={{ color: "#55556a", fontSize: "0.72rem", marginLeft: 4 }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && item.latest_breaches.length > 0 && (
        <div
          style={{ padding: "8px 16px 16px", borderTop: "1px solid rgba(255,255,255,0.04)" }}
        >
          <div style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.6rem", textTransform: "uppercase" as const, letterSpacing: "0.12em", color: "#55556a", marginBottom: 8 }}>
            Filtraciones encontradas
          </div>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
            {item.latest_breaches.map((r, i) => (
              <BreachDetail key={r.id || i} record={r} />
            ))}
          </div>
        </div>
      )}

      {expanded && item.latest_breaches.length === 0 && item.status !== "never_scanned" && (
        <div
          style={{ padding: "12px 16px 16px", borderTop: "1px solid rgba(255,255,255,0.04)", textAlign: "center" as const }}
        >
          <span style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.78rem", color: "#00e5bf" }}>✓ Sin filtraciones detectadas</span>
        </div>
      )}

      {expanded && item.status === "never_scanned" && (
        <div
          style={{ padding: "12px 16px 16px", borderTop: "1px solid rgba(255,255,255,0.04)", textAlign: "center" as const }}
        >
          <span style={{ fontSize: "0.78rem", color: "#55556a" }}>Este email aún no ha sido escaneado</span>
        </div>
      )}
    </div>
  );
}

// ── Domain row ─────────────────────────────────────────────────────────────────
function DomainRow({
  item, onScan, setShowPacks, scanType,
}: {
  item: DomainItem | ImpersonationItem;
  onScan: (id: string) => void;
  setShowPacks: (v: boolean) => void;
  scanType: "domain" | "impersonation";
}) {
  const [expanded, setExpanded] = useState(false);
  const [scanning, setScanning] = useState(false);

  const isImpersonation = scanType === "impersonation";
  const domainItem = item as DomainItem;
  const impoItem = item as ImpersonationItem;

  const count = isImpersonation ? impoItem.threats_count : domainItem.breach_count;
  const status = item.status as ItemStatus;
  const results = isImpersonation ? impoItem.latest_threats : domainItem.latest_results;

  const handleScan = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setScanning(true);
    try {
      const res = isImpersonation
        ? await darkwebApi.scanImpersonation(item.id)
        : await darkwebApi.scanDomain(item.id);
      toast.success(`Escaneo iniciado · ${res.data.credits_remaining} créditos restantes`);
      onScan(item.id);
    } catch (err) {
      handleScanError(err, setShowPacks);
    } finally {
      setScanning(false);
    }
  };

  const danger = status === "found" || status === "threatened";

  return (
    <div
      style={{
        borderRadius: 10, overflow: "hidden",
        background: "#0a0a0f",
        border: `1px solid ${danger ? "rgba(255,77,106,0.15)" : "rgba(255,255,255,0.04)"}`,
        marginBottom: 8,
      }}
    >
      <button
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", textAlign: "left" as const, background: "none", border: "none", cursor: "pointer" }}
        onClick={() => setExpanded(!expanded)}
      >
        <div
          style={{
            width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0,
            background: danger ? "rgba(255,77,106,0.08)" : "rgba(0,229,191,0.06)",
          }}
        >
          {isImpersonation ? "🕸" : "◎"}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.82rem", color: "#f0f0f5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.domain}</div>
          <div style={{ fontSize: "0.72rem", color: "#55556a", marginTop: 3 }}>
            {item.last_scan_at ? relTime(item.last_scan_at) : "Nunca escaneado"}
            {count > 0 && (
              <span style={{ color: "#ff4d6a", marginLeft: 8 }}>
                {count} {isImpersonation ? `amenaza${count !== 1 ? "s" : ""}` : `hallazgo${count !== 1 ? "s" : ""}`}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <StatusPill status={status} />
          <ScanBtn scanning={scanning} onClick={handleScan} small />
          <span style={{ color: "#55556a", fontSize: "0.72rem", marginLeft: 4 }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && results.length > 0 && (
        <div
          style={{ padding: "8px 16px 16px", borderTop: "1px solid rgba(255,255,255,0.04)" }}
        >
          <div style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.6rem", textTransform: "uppercase" as const, letterSpacing: "0.12em", color: "#55556a", marginBottom: 8 }}>
            {isImpersonation ? "Dominios suplantadores detectados" : "Resultados en dark web"}
          </div>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
            {results.map((r, i) => (
              <BreachDetail key={(r as BreachRecord).id || i} record={r as BreachRecord} />
            ))}
          </div>
        </div>
      )}

      {expanded && results.length === 0 && status !== "never_scanned" && (
        <div
          style={{ padding: "12px 16px 16px", borderTop: "1px solid rgba(255,255,255,0.04)", textAlign: "center" as const }}
        >
          <span style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.78rem", color: "#00e5bf" }}>
            ✓ {isImpersonation ? "Sin suplantaciones detectadas" : "Sin hallazgos en dark web"}
          </span>
        </div>
      )}

      {expanded && status === "never_scanned" && (
        <div
          style={{ padding: "12px 16px 16px", borderTop: "1px solid rgba(255,255,255,0.04)", textAlign: "center" as const }}
        >
          <span style={{ fontSize: "0.78rem", color: "#55556a" }}>Este dominio aún no ha sido escaneado</span>
        </div>
      )}
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({
  title, icon, totalDanger, locked, children,
}: {
  title: string;
  icon: string;
  totalDanger: number;
  locked?: boolean;
  children: React.ReactNode;
}) {
  const borderColor = locked
    ? "rgba(255,255,255,0.04)"
    : totalDanger > 0
    ? "rgba(255,77,106,0.15)"
    : "rgba(255,255,255,0.04)";

  const accentColor = locked ? "#55556a" : totalDanger > 0 ? "#ff4d6a" : "#00e5bf";

  return (
    <div
      style={{ position: "relative", overflow: "hidden", borderRadius: 16, padding: 24, background: "#0f0f16", border: `1px solid ${borderColor}`, marginBottom: 16 }}
    >
      <div
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: accentColor, boxShadow: `0 0 10px ${accentColor}44` }}
      />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <h3 style={{ fontFamily: "var(--font-serif-family)", fontSize: "1rem", fontWeight: 400, color: "#f0f0f5", letterSpacing: "-0.01em" }}>{title}</h3>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {locked && (
            <span
              style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.6rem", textTransform: "uppercase" as const, letterSpacing: "0.1em", padding: "3px 8px", borderRadius: 20, color: "#ffb020", background: "rgba(255,176,32,0.06)", border: "1px solid rgba(255,176,32,0.15)" }}
            >
              Solo Business
            </span>
          )}
          {!locked && (
            <span
              style={{
                fontFamily: "var(--font-mono-family)", fontSize: "0.6rem", textTransform: "uppercase" as const, letterSpacing: "0.1em", padding: "3px 8px", borderRadius: 20,
                ...(totalDanger > 0
                  ? { background: "rgba(255,77,106,0.08)", color: "#ff4d6a", border: "1px solid rgba(255,77,106,0.15)" }
                  : { background: "rgba(0,229,191,0.08)", color: "#00e5bf", border: "1px solid rgba(0,229,191,0.15)" })
              }}
            >
              {totalDanger > 0 ? `${totalDanger} hallazgos` : "Sin amenazas"}
            </span>
          )}
        </div>
      </div>

      {locked ? (
        <div style={{ paddingTop: 24, paddingBottom: 24, display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 12, textAlign: "center" as const }}>
          <div
            style={{ width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, background: "rgba(255,255,255,0.03)" }}
          >
            🔒
          </div>
          <p style={{ fontSize: "0.82rem", color: "#55556a" }}>
            Disponible en el plan{" "}
            <span style={{ color: "#f0f0f5", fontWeight: 600 }}>Business</span>
          </p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

// ── Scan All confirm modal ──────────────────────────────────────────────────────
function ScanAllModal({
  cost, breakdown, credits, onConfirm, onClose, onBuyCredits,
}: {
  cost: number;
  breakdown: ScanAllBreakdown;
  credits: Credits;
  onConfirm: () => void;
  onClose: () => void;
  onBuyCredits: () => void;
}) {
  const canAfford = credits.credits_available >= cost;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(5,5,7,0.9)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: 380, borderRadius: 16, padding: 28, background: "#0f0f16", border: "1px solid rgba(255,255,255,0.06)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{ width: 48, height: 48, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 20, background: canAfford ? "rgba(0,229,191,0.06)" : "rgba(255,77,106,0.06)" }}
        >
          {canAfford ? "🔍" : "⚠️"}
        </div>

        <h2 style={{ fontFamily: "var(--font-serif-family)", fontSize: "1.1rem", fontWeight: 400, color: "#f0f0f5", marginBottom: 6 }}>
          {canAfford ? "Escaneo general" : "Créditos insuficientes"}
        </h2>

        {canAfford ? (
          <>
            <p style={{ fontSize: "0.8rem", color: "#55556a", marginBottom: 20, lineHeight: 1.6 }}>
              Este escaneo analizará todos tus activos y consumirá{" "}
              <span style={{ color: "#f0f0f5", fontWeight: 600 }}>{cost} créditos</span>.
            </p>

            <div
              style={{ borderRadius: 10, padding: "14px 16px", marginBottom: 20, background: "#0a0a0f", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              {[
                { label: "Emails", count: breakdown.emails, icon: "✉" },
                { label: "Dominios", count: breakdown.domains, icon: "◎" },
                { label: "Suplantación", count: breakdown.impersonation, icon: "🕸" },
              ].filter((r) => r.count > 0).map((row) => (
                <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", color: "#55556a" }}>
                    <span>{row.icon}</span>
                    <span>{row.label}</span>
                    <span style={{ color: "#f0f0f5" }}>× {row.count}</span>
                  </div>
                  <span style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.72rem", color: "#55556a" }}>{row.count} créd.</span>
                </div>
              ))}
              <div
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: 4 }}
              >
                <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#f0f0f5" }}>Total</span>
                <span style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.85rem", fontWeight: 700, color: "#00e5bf" }}>{cost} créditos</span>
              </div>
            </div>

            <p style={{ fontSize: "0.75rem", color: "#55556a", marginBottom: 20 }}>
              Te quedarán{" "}
              <span style={{ color: "#f0f0f5", fontWeight: 600 }}>
                {credits.credits_available - cost}
              </span>{" "}
              créditos.
            </p>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={onClose}
                style={{ flex: 1, padding: "10px 0", borderRadius: 8, fontSize: "0.82rem", fontWeight: 600, color: "#55556a", background: "#0a0a0f", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", fontFamily: "var(--font-jakarta-family)" }}
              >
                Cancelar
              </button>
              <button
                onClick={onConfirm}
                style={{ flex: 1, padding: "10px 0", borderRadius: 8, fontSize: "0.82rem", fontWeight: 600, color: "#000", background: "#00e5bf", border: "none", cursor: "pointer", fontFamily: "var(--font-jakarta-family)" }}
              >
                Confirmar
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: "0.8rem", color: "#55556a", marginBottom: 20, lineHeight: 1.6 }}>
              Necesitas{" "}
              <span style={{ color: "#f0f0f5", fontWeight: 600 }}>{cost} créditos</span> pero solo tienes{" "}
              <span style={{ color: "#ff4d6a", fontWeight: 600 }}>{credits.credits_available}</span>.
              Compra un pack para continuar.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={onClose}
                style={{ flex: 1, padding: "10px 0", borderRadius: 8, fontSize: "0.82rem", fontWeight: 600, color: "#55556a", background: "#0a0a0f", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", fontFamily: "var(--font-jakarta-family)" }}
              >
                Cancelar
              </button>
              <button
                onClick={onBuyCredits}
                style={{ flex: 1, padding: "10px 0", borderRadius: 8, fontSize: "0.82rem", fontWeight: 600, color: "#000", background: "#00e5bf", border: "none", cursor: "pointer", fontFamily: "var(--font-jakarta-family)" }}
              >
                Comprar créditos
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Credit pack modal ──────────────────────────────────────────────────────────
function CreditPackModal({
  credits, onClose, onBuy,
}: {
  credits: Credits;
  onClose: () => void;
  onBuy: (pack: "s" | "m" | "l") => void;
}) {
  const packs = [
    { key: "s" as const, label: "Pack S", credits: 5,  price: "9,99€",  per: "2,00€/créd." },
    { key: "m" as const, label: "Pack M", credits: 10, price: "18,99€", per: "1,90€/créd." },
    { key: "l" as const, label: "Pack L", credits: 20, price: "34,99€", per: "1,75€/créd.", popular: true },
  ];

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(5,5,7,0.9)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: 420, borderRadius: 16, padding: 28, background: "#0f0f16", border: "1px solid rgba(255,255,255,0.06)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontFamily: "var(--font-serif-family)", fontSize: "1.15rem", fontWeight: 400, color: "#f0f0f5", marginBottom: 4 }}>Comprar créditos</h2>
            <p style={{ fontSize: "0.78rem", color: "#55556a" }}>
              Tienes {credits.credits_available} crédito{credits.credits_available !== 1 ? "s" : ""} disponible{credits.credits_available !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={onClose} style={{ color: "#55556a", fontSize: 20, lineHeight: 1, background: "none", border: "none", cursor: "pointer", padding: 4 }}>×</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column" as const, gap: 10, marginBottom: 20 }}>
          {packs.map((pack) => (
            <button
              key={pack.key}
              onClick={() => onBuy(pack.key)}
              style={{
                display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 10, textAlign: "left" as const, cursor: "pointer", transition: "all 0.15s", fontFamily: "var(--font-jakarta-family)",
                background: pack.popular ? "rgba(0,229,191,0.04)" : "#0a0a0f",
                border: pack.popular ? "1px solid rgba(0,229,191,0.18)" : "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <div
                style={{
                  width: 38, height: 38, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.85rem", flexShrink: 0,
                  background: pack.popular ? "rgba(0,229,191,0.10)" : "rgba(255,255,255,0.04)",
                  color: pack.popular ? "#00e5bf" : "#55556a",
                  fontFamily: "var(--font-mono-family)",
                }}
              >
                {pack.credits}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "#f0f0f5" }}>{pack.label}</span>
                  {pack.popular && (
                    <span
                      style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.6rem", padding: "2px 7px", borderRadius: 4, background: "rgba(0,229,191,0.08)", color: "#00e5bf", border: "1px solid rgba(0,229,191,0.15)" }}
                    >
                      POPULAR
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#55556a" }}>{pack.credits} créditos · {pack.per}</div>
              </div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "#f0f0f5", flexShrink: 0 }}>{pack.price}</div>
            </button>
          ))}
        </div>

        <p style={{ fontSize: "0.72rem", color: "#33334a", textAlign: "center" as const }}>
          1 crédito = 1 escaneo (email, dominio o suplantación). Los créditos no caducan.
        </p>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function DarkWebPage() {
  const [summary, setSummary]       = useState<DarkWebSummary | null>(null);
  const [loading, setLoading]       = useState(true);
  const [scanningAll, setScanningAll] = useState(false);
  const [showScanAll, setShowScanAll] = useState(false);
  const [showPacks, setShowPacks]   = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await darkwebApi.summary();
      setSummary(res.data);
    } catch {
      toast.error("Error al cargar datos de Dark Web");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const confirmScanAll = async () => {
    setShowScanAll(false);
    setScanningAll(true);
    try {
      const res = await darkwebApi.scanAll();
      toast.success(
        `Escaneo general iniciado · ${res.data.credits_remaining} créditos restantes`,
      );
      setTimeout(() => load(), 4000);
    } catch (err) {
      handleScanError(err, setShowPacks);
    } finally {
      setScanningAll(false);
    }
  };

  const handleBuyPack = async (pack: "s" | "m" | "l") => {
    try {
      const res = await creditsApi.checkout(pack);
      window.location.href = res.data.url;
    } catch {
      toast.error("Error al iniciar la compra");
    }
  };

  // Reload after individual scan
  const onItemScanned = useCallback(() => {
    setTimeout(() => load(), 3000);
  }, [load]);

  if (loading) {
    return (
      <div style={{ padding: 40, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 256, background: "#050507" }}>
        <div style={{ width: 28, height: 28, border: "2px solid #00e5bf", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  if (!summary) return null;

  const totalEmailDanger = summary.emails.filter((e) => e.status === "breached").length;
  const totalDomainDanger = summary.domains.filter((d) => d.status === "found").length;
  const totalImpoDanger = summary.impersonation.filter((i) => i.status === "threatened").length;
  const overallDanger = totalEmailDanger + totalDomainDanger + totalImpoDanger;

  return (
    <div style={{ padding: "32px 36px 60px", background: "#050507", minHeight: "100vh", position: "relative", zIndex: 1, fontFamily: "var(--font-jakarta-family)" }}>
      {/* Modals */}
      {showScanAll && summary && (
        <ScanAllModal
          cost={summary.scan_all_cost}
          breakdown={summary.scan_all_breakdown}
          credits={summary.credits}
          onConfirm={confirmScanAll}
          onClose={() => setShowScanAll(false)}
          onBuyCredits={() => { setShowScanAll(false); setShowPacks(true); }}
        />
      )}
      {showPacks && (
        <CreditPackModal
          credits={summary.credits}
          onClose={() => setShowPacks(false)}
          onBuy={handleBuyPack}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif-family)", fontSize: "1.75rem", fontWeight: 400, letterSpacing: "-0.02em", color: "#f0f0f5" }}>Dark Web Monitoring</h1>
          <p style={{ color: "#55556a", fontSize: "0.82rem", marginTop: 4 }}>
            Vigilancia de filtraciones · emails · dominios · suplantación de empresa
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setShowPacks(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: "0.82rem", padding: "9px 16px", borderRadius: 8, border: "1px solid rgba(0,229,191,0.18)", background: "rgba(0,229,191,0.06)", color: "#00e5bf", cursor: "pointer", fontFamily: "var(--font-jakarta-family)" }}
          >
            💳 {summary.credits.credits_available} crédito{summary.credits.credits_available !== 1 ? "s" : ""}
          </button>
          <button
            onClick={() => setShowScanAll(true)}
            disabled={scanningAll}
            style={{
              display: "flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: "0.82rem", color: "#000",
              padding: "9px 20px", borderRadius: 8, border: "none", cursor: "pointer", transition: "all 0.15s",
              background: "#00e5bf", opacity: scanningAll ? 0.6 : 1, fontFamily: "var(--font-jakarta-family)",
            }}
          >
            {scanningAll ? "⟳ Escaneando…" : `⟳ Escaneo general (${summary.scan_all_cost} créd.)`}
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderRadius: 10, marginBottom: 20, background: "rgba(0,229,191,0.03)", border: "1px solid rgba(0,229,191,0.10)" }}
      >
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#00e5bf", flexShrink: 0 }} />
        <span style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.65rem", letterSpacing: "0.12em", color: "#00e5bf", textTransform: "uppercase" as const }}>MONITOREO ACTIVO</span>
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginLeft: "auto", fontSize: "0.75rem", color: "#55556a" }}>
          {summary.last_scan_at && (
            <span>
              Último escaneo: <span style={{ color: "#9999ad" }}>{relTime(summary.last_scan_at)}</span>
            </span>
          )}
          <span>
            Próximo auto: <span style={{ color: "#9999ad" }}>{summary.next_auto_scan}</span>
          </span>
          <span style={{ fontSize: "0.7rem", color: "#33334a" }}>Los escaneos automáticos no consumen créditos</span>
        </div>
      </div>

      {/* Alert banner */}
      {overallDanger > 0 && (
        <div
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 10, marginBottom: 20, background: "rgba(255,77,106,0.05)", border: "1px solid rgba(255,77,106,0.15)" }}
        >
          <span style={{ fontSize: 18 }}>🚨</span>
          <div>
            <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#ff4d6a" }}>Filtraciones detectadas</div>
            <div style={{ fontSize: "0.78rem", color: "#55556a", marginTop: 2 }}>
              {overallDanger} activo{overallDanger !== 1 ? "s" : ""} con datos expuestos en la dark web. Revisa los detalles y actúa.
            </div>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        <CreditBadge credits={summary.credits} />
        {[
          {
            label: "Emails afectados",
            value: totalEmailDanger,
            total: summary.emails.length,
            icon: "✉",
            danger: totalEmailDanger > 0,
          },
          {
            label: "Dominios expuestos",
            value: totalDomainDanger,
            total: summary.domains.length,
            icon: "◎",
            danger: totalDomainDanger > 0,
          },
          {
            label: "Dominios impostores",
            value: summary.impersonation_available ? totalImpoDanger : "—",
            total: summary.impersonation.length,
            icon: "🕸",
            danger: summary.impersonation_available && totalImpoDanger > 0,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{ position: "relative", overflow: "hidden", borderRadius: 12, padding: "16px 20px", background: "#0f0f16", border: "1px solid rgba(255,255,255,0.03)" }}
          >
            <div style={{ fontFamily: "var(--font-mono-family)", fontSize: "0.6rem", textTransform: "uppercase" as const, letterSpacing: "0.16em", color: "#33334a", marginBottom: 8 }}>{stat.label}</div>
            <div style={{ fontFamily: "var(--font-serif-family)", fontSize: "2rem", fontWeight: 400, color: !stat.danger ? "#00e5bf" : "#ff4d6a", lineHeight: 1 }}>
              {stat.value}
            </div>
            <div style={{ fontSize: "0.7rem", color: "#55556a", marginTop: 4 }}>de {stat.total}</div>
            <div
              style={{
                position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
                background: !stat.danger ? "#00e5bf" : "#ff4d6a",
                boxShadow: `0 0 8px ${!stat.danger ? "#00e5bf66" : "#ff4d6a66"}`,
              }}
            />
          </div>
        ))}
      </div>

      {/* Sections */}
      <div>
        <Section
          title="Filtraciones de emails"
          icon="✉"
          totalDanger={totalEmailDanger}
        >
          {summary.emails.length === 0 ? (
            <div style={{ padding: "24px 0", textAlign: "center" as const, fontSize: "0.82rem", color: "#55556a" }}>
              No tienes emails monitorizados. Añade emails desde el dashboard.
            </div>
          ) : (
            <div>
              {summary.emails.map((item) => (
                <EmailRow
                  key={item.id}
                  item={item}
                  onScan={onItemScanned}
                  setShowPacks={setShowPacks}
                />
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Dominios en dark web"
          icon="◎"
          totalDanger={totalDomainDanger}
        >
          {summary.domains.length === 0 ? (
            <div style={{ padding: "24px 0", textAlign: "center" as const, fontSize: "0.82rem", color: "#55556a" }}>
              No tienes dominios registrados. Añade un dominio desde el dashboard.
            </div>
          ) : (
            <div>
              {summary.domains.map((item) => (
                <DomainRow
                  key={item.id}
                  item={item}
                  onScan={onItemScanned}
                  setShowPacks={setShowPacks}
                  scanType="domain"
                />
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Company Impersonation (Typosquatting)"
          icon="🕸"
          totalDanger={totalImpoDanger}
          locked={!summary.impersonation_available}
        >
          {summary.impersonation.length === 0 ? (
            <div style={{ padding: "24px 0", textAlign: "center" as const, fontSize: "0.82rem", color: "#55556a" }}>
              No hay dominios configurados para monitorización de suplantación.
            </div>
          ) : (
            <div>
              {summary.impersonation.map((item) => (
                <DomainRow
                  key={item.id}
                  item={item}
                  onScan={onItemScanned}
                  setShowPacks={setShowPacks}
                  scanType="impersonation"
                />
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
