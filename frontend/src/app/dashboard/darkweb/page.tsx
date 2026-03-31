"use client";

import { useEffect, useState, useCallback } from "react";
import { darkwebApi, creditsApi } from "@/lib/api";
import { toast } from "@/components/Toast";
import { useTranslation } from "@/contexts/LanguageContext";

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
function relTime(iso: string, lang = "es") {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return lang === "en" ? "now" : "ahora";
  if (m < 60) return lang === "en" ? `${m}m ago` : `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return lang === "en" ? `${h}h ago` : `hace ${h}h`;
  return lang === "en" ? `${Math.floor(h / 24)}d ago` : `hace ${Math.floor(h / 24)}d`;
}

function fmtDate(iso: string, lang = "es") {
  return new Date(iso).toLocaleDateString(lang === "en" ? "en-US" : "es-ES", {
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
  const { t } = useTranslation();
  const total = credits.credits_available + credits.credits_used;
  const pct = total > 0 ? credits.credits_available / total : 1;
  const color =
    credits.credits_available > 2 ? "#3ecf8e" :
    credits.credits_available > 0 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{
      background: "#151515",
      border: "0.8px solid #1a1a1a",
      borderRadius: 16,
      padding: "18px 20px",
    }}>
      <div style={{
        fontFamily: "var(--font-dm-mono)",
        fontSize: "0.62rem",
        textTransform: "uppercase" as const,
        letterSpacing: "0.12em",
        color: "#71717a",
        fontWeight: 600,
        marginBottom: 10,
      }}>
        {t("darkweb.creditsAvail")}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 8 }}>
            <span style={{
              fontFamily: "var(--font-dm-mono)",
              fontSize: "1.9rem",
              fontWeight: 700,
              color,
              lineHeight: 1,
            }}>
              {credits.credits_available}
            </span>
            <span style={{ fontSize: "0.75rem", color: "#71717a" }}>/ {total}</span>
          </div>
          <div style={{ height: 3, borderRadius: 3, overflow: "hidden", background: "#262626" }}>
            <div
              style={{ height: "100%", borderRadius: 3, transition: "width 0.7s", width: `${pct * 100}%`, background: color }}
            />
          </div>
        </div>
        <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
          <div style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.62rem", textTransform: "uppercase" as const, letterSpacing: "0.12em", color: "#71717a", fontWeight: 600 }}>Reset</div>
          <div style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.72rem", color: "#b3b4b5", marginTop: 4 }}>{fmtDate(credits.reset_date)}</div>
        </div>
      </div>
    </div>
  );
}

// ── Status pill ────────────────────────────────────────────────────────────────
type ItemStatus = "breached" | "found" | "threatened" | "clean" | "never_scanned";

function StatusPill({ status }: { status: ItemStatus }) {
  const { t } = useTranslation();
  const map: Record<ItemStatus, { label: string; color: string; bg: string; border: string }> = {
    breached:      { label: t("darkweb.status.breached"), color: "#ef4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.2)" },
    found:         { label: t("darkweb.status.found"),    color: "#ef4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.2)" },
    threatened:    { label: t("darkweb.status.threatened"),color:"#f59e0b", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.2)" },
    clean:         { label: t("darkweb.status.clean"),    color: "#3ecf8e", bg: "rgba(62,207,142,0.10)",  border: "rgba(62,207,142,0.2)" },
    never_scanned: { label: t("darkweb.status.never"),    color: "#71717a", bg: "rgba(113,113,122,0.10)", border: "rgba(113,113,122,0.15)" },
  };
  const s = map[status];
  return (
    <span style={{
      fontFamily: "var(--font-dm-mono)",
      fontSize: "11px",
      textTransform: "uppercase" as const,
      letterSpacing: "0.06em",
      padding: "2px 8px",
      borderRadius: 6,
      flexShrink: 0,
      color: s.color,
      background: s.bg,
      border: `0.8px solid ${s.border}`,
    }}>
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
  const { t } = useTranslation();
  return (
    <button
      className="cs-btn"
      onClick={onClick}
      disabled={scanning}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        fontWeight: 600,
        borderRadius: 8,
        transition: "all 0.15s",
        flexShrink: 0,
        cursor: scanning ? "not-allowed" : "pointer",
        opacity: scanning ? 0.5 : 1,
        fontSize: small ? "0.72rem" : "13px",
        padding: small ? "5px 10px" : "8px 16px",
        background: "#3ecf8e",
        border: "none",
        color: "#000",
        fontFamily: "var(--font-dm-sans)",
      }}
    >
      <span style={{ display: "inline-block", animation: scanning ? "spin 0.8s linear infinite" : "none" }}>⟳</span>
      {scanning ? t("darkweb.scanning") : t("darkweb.scanEmail")}
    </button>
  );
}

// ── Breach detail row ──────────────────────────────────────────────────────────
function BreachDetail({ record }: { record: BreachRecord }) {
  const { t, lang } = useTranslation();
  const hasPassword = !!(record.password || record.hashedPassword);
  const pwLabel = t("darkweb.field.password");
  return (
    <div style={{
      borderRadius: 12,
      padding: "10px 14px",
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "6px 16px",
      background: "#1c1c1c",
      border: "0.8px solid #1a1a1a",
    }}>
      {[
        { label: t("darkweb.field.source"),   val: record.breachName || record.source },
        { label: t("darkweb.field.email"),    val: record.email },
        { label: t("darkweb.field.username"), val: record.username },
        { label: t("darkweb.field.domain"),   val: record.domain },
        { label: t("darkweb.field.ip"),       val: record.ipAddress },
        { label: pwLabel, val: record.password ? t("darkweb.pw.exposed") : record.hashedPassword ? t("darkweb.pw.hash") : null },
        { label: t("darkweb.field.date"),     val: record.timestamp ? fmtDate(record.timestamp, lang) : null },
      ].filter((f) => f.val).map((f) => (
        <div key={f.label}>
          <div style={{
            fontFamily: "var(--font-dm-mono)",
            fontSize: "0.62rem",
            textTransform: "uppercase" as const,
            letterSpacing: "0.12em",
            color: "#71717a",
            fontWeight: 600,
          }}>{f.label}</div>
          <div style={{
            fontFamily: "var(--font-dm-mono)",
            fontSize: "0.72rem",
            marginTop: 2,
            wordBreak: "break-all" as const,
            color: f.label === pwLabel && hasPassword ? "#ef4444" : "#f5f5f5",
          }}>
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
  const { t, lang } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [scanning, setScanning] = useState(false);

  const handleScan = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setScanning(true);
    try {
      const res = await darkwebApi.scanEmail(item.id);
      toast.success(`${t("darkweb.scanStarted")} · ${res.data.credits_remaining} créditos`);
      onScan(item.id);
    } catch (err) {
      handleScanError(err, setShowPacks);
    } finally {
      setScanning(false);
    }
  };

  const danger = item.status === "breached";

  return (
    <div style={{
      borderRadius: 16,
      overflow: "hidden",
      background: "#151515",
      border: `0.8px solid ${danger ? "rgba(239,68,68,0.2)" : "#1a1a1a"}`,
      marginBottom: 8,
      transition: "border-color 0.15s",
    }}>
      <button
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 18px",
          textAlign: "left" as const,
          background: "none",
          border: "none",
          cursor: "pointer",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          flexShrink: 0,
          background: danger ? "rgba(239,68,68,0.10)" : "rgba(62,207,142,0.08)",
          color: danger ? "#ef4444" : "#3ecf8e",
        }}>
          {danger ? "⚠" : "✉"}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "var(--font-dm-mono)",
            fontSize: "0.82rem",
            color: "#f5f5f5",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>{item.email}</div>
          <div style={{ fontSize: "0.72rem", color: "#71717a", marginTop: 3 }}>
            {item.last_scan_at ? relTime(item.last_scan_at, lang) : t("darkweb.neverScanned2")}
            {item.breach_count > 0 && (
              <span style={{ color: "#ef4444", marginLeft: 8 }}>
                {item.breach_count} {t("darkweb.breaches").replace("{es}", item.breach_count !== 1 ? "es" : "")}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <StatusPill status={item.status} />
          <ScanBtn scanning={scanning} onClick={handleScan} small />
          <span style={{ color: "#71717a", fontSize: "0.65rem", marginLeft: 2 }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && item.latest_breaches.length > 0 && (
        <div style={{ padding: "8px 18px 16px", borderTop: "0.8px solid #1a1a1a" }}>
          <div style={{
            fontFamily: "var(--font-dm-mono)",
            fontSize: "0.62rem",
            textTransform: "uppercase" as const,
            letterSpacing: "0.12em",
            color: "#71717a",
            fontWeight: 600,
            marginBottom: 8,
          }}>
            {t("darkweb.breachesFound2")}
          </div>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
            {item.latest_breaches.map((r, i) => (
              <BreachDetail key={r.id || i} record={r} />
            ))}
          </div>
        </div>
      )}

      {expanded && item.latest_breaches.length === 0 && item.status !== "never_scanned" && (
        <div style={{ padding: "12px 18px 16px", borderTop: "0.8px solid #1a1a1a", textAlign: "center" as const }}>
          <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.78rem", color: "#3ecf8e" }}>
            {t("darkweb.noBreachesFound")}
          </span>
        </div>
      )}

      {expanded && item.status === "never_scanned" && (
        <div style={{ padding: "12px 18px 16px", borderTop: "0.8px solid #1a1a1a", textAlign: "center" as const }}>
          <span style={{ fontSize: "0.78rem", color: "#71717a" }}>{t("darkweb.notScannedYet")}</span>
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

  const { t, lang } = useTranslation();
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
      toast.success(`${t("darkweb.scanStarted")} · ${res.data.credits_remaining} créditos`);
      onScan(item.id);
    } catch (err) {
      handleScanError(err, setShowPacks);
    } finally {
      setScanning(false);
    }
  };

  const danger = status === "found" || status === "threatened";

  return (
    <div style={{
      borderRadius: 16,
      overflow: "hidden",
      background: "#151515",
      border: `0.8px solid ${danger ? "rgba(239,68,68,0.2)" : "#1a1a1a"}`,
      marginBottom: 8,
      transition: "border-color 0.15s",
    }}>
      <button
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 18px",
          textAlign: "left" as const,
          background: "none",
          border: "none",
          cursor: "pointer",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          flexShrink: 0,
          background: danger ? "rgba(239,68,68,0.10)" : "rgba(62,207,142,0.08)",
          color: danger ? "#ef4444" : "#3ecf8e",
        }}>
          {isImpersonation ? "⊙" : "◎"}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "var(--font-dm-mono)",
            fontSize: "0.82rem",
            color: "#f5f5f5",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>{item.domain}</div>
          <div style={{ fontSize: "0.72rem", color: "#71717a", marginTop: 3 }}>
            {item.last_scan_at ? relTime(item.last_scan_at, lang) : t("darkweb.neverScanned2")}
            {count > 0 && (
              <span style={{ color: "#ef4444", marginLeft: 8 }}>
                {count} {isImpersonation
                  ? t("darkweb.threats").replace("{s}", count !== 1 ? "s" : "")
                  : t("darkweb.findings").replace("{s}", count !== 1 ? "s" : "")}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <StatusPill status={status} />
          <ScanBtn scanning={scanning} onClick={handleScan} small />
          <span style={{ color: "#71717a", fontSize: "0.65rem", marginLeft: 2 }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && results.length > 0 && (
        <div style={{ padding: "8px 18px 16px", borderTop: "0.8px solid #1a1a1a" }}>
          <div style={{
            fontFamily: "var(--font-dm-mono)",
            fontSize: "0.62rem",
            textTransform: "uppercase" as const,
            letterSpacing: "0.12em",
            color: "#71717a",
            fontWeight: 600,
            marginBottom: 8,
          }}>
            {isImpersonation ? t("darkweb.impersonators") : t("darkweb.domainResults")}
          </div>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
            {results.map((r, i) => (
              <BreachDetail key={(r as BreachRecord).id || i} record={r as BreachRecord} />
            ))}
          </div>
        </div>
      )}

      {expanded && results.length === 0 && status !== "never_scanned" && (
        <div style={{ padding: "12px 18px 16px", borderTop: "0.8px solid #1a1a1a", textAlign: "center" as const }}>
          <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.78rem", color: "#3ecf8e" }}>
            ✓ {isImpersonation ? t("darkweb.noImpersonation") : t("darkweb.noBreaches")}
          </span>
        </div>
      )}

      {expanded && status === "never_scanned" && (
        <div style={{ padding: "12px 18px 16px", borderTop: "0.8px solid #1a1a1a", textAlign: "center" as const }}>
          <span style={{ fontSize: "0.78rem", color: "#71717a" }}>{t("darkweb.notScannedDomain")}</span>
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
  const { t } = useTranslation();
  const borderColor = locked
    ? "#1a1a1a"
    : totalDanger > 0
    ? "rgba(239,68,68,0.2)"
    : "#1a1a1a";

  return (
    <div style={{
      borderRadius: 16,
      background: "#151515",
      border: `0.8px solid ${borderColor}`,
      marginBottom: 12,
      overflow: "hidden",
    }}>
      {/* Section header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 20px",
        borderBottom: "0.8px solid #1a1a1a",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 30,
            height: 30,
            borderRadius: 7,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            background: "#262626",
            color: "#b3b4b5",
          }}>{icon}</span>
          <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#f5f5f5" }}>{title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {locked ? (
            <span style={{
              fontFamily: "var(--font-dm-mono)",
              fontSize: "11px",
              textTransform: "uppercase" as const,
              letterSpacing: "0.06em",
              padding: "2px 8px",
              borderRadius: 6,
              color: "#f59e0b",
              background: "rgba(245,158,11,0.08)",
              border: "0.8px solid rgba(245,158,11,0.2)",
            }}>
              {t("darkweb.businessOnly")}
            </span>
          ) : (
            <span style={{
              fontFamily: "var(--font-dm-mono)",
              fontSize: "11px",
              textTransform: "uppercase" as const,
              letterSpacing: "0.06em",
              padding: "2px 8px",
              borderRadius: 6,
              ...(totalDanger > 0
                ? { color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "0.8px solid rgba(239,68,68,0.2)" }
                : { color: "#3ecf8e", background: "rgba(62,207,142,0.10)", border: "0.8px solid rgba(62,207,142,0.2)" })
            }}>
              {totalDanger > 0
                ? `${totalDanger} ${t("darkweb.findings").replace("{s}", totalDanger !== 1 ? "s" : "")}`
                : t("darkweb.noThreats")}
            </span>
          )}
        </div>
      </div>

      {/* Section body */}
      <div style={{ padding: "16px 20px" }}>
        {locked ? (
          <div style={{
            padding: "28px 0",
            display: "flex",
            flexDirection: "column" as const,
            alignItems: "center",
            gap: 10,
            textAlign: "center" as const,
          }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              background: "#262626",
              color: "#71717a",
            }}>🔒</div>
            <p style={{ fontSize: "0.82rem", color: "#71717a" }}>
              {t("darkweb.availableBusiness")}
            </p>
          </div>
        ) : (
          children
        )}
      </div>
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
  const { t } = useTranslation();
  const canAfford = credits.credits_available >= cost;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          borderRadius: 16,
          padding: 28,
          background: "#151515",
          border: "0.8px solid #1a1a1a",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          marginBottom: 18,
          background: canAfford ? "rgba(62,207,142,0.08)" : "rgba(239,68,68,0.08)",
          color: canAfford ? "#3ecf8e" : "#ef4444",
        }}>
          {canAfford ? "⟳" : "⚠"}
        </div>

        <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#f5f5f5", marginBottom: 6 }}>
          {canAfford ? t("darkweb.scanGeneral") : t("darkweb.insufficientCredits")}
        </h2>

        {canAfford ? (
          <>
            <p style={{ fontSize: "0.8rem", color: "#71717a", marginBottom: 20, lineHeight: 1.6 }}>
              Este escaneo analizará todos tus activos y consumirá{" "}
              <span style={{ color: "#f5f5f5", fontWeight: 600 }}>{cost} créditos</span>.
            </p>

            <div style={{
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 18,
              background: "#1c1c1c",
              border: "0.8px solid #1a1a1a",
            }}>
              {[
                { label: "Emails",       count: breakdown.emails,       icon: "✉" },
                { label: "Dominios",     count: breakdown.domains,      icon: "◎" },
                { label: "Suplantación", count: breakdown.impersonation, icon: "⊙" },
              ].filter((r) => r.count > 0).map((row) => (
                <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", color: "#71717a" }}>
                    <span>{row.icon}</span>
                    <span>{row.label}</span>
                    <span style={{ color: "#f5f5f5" }}>× {row.count}</span>
                  </div>
                  <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.72rem", color: "#71717a" }}>{row.count} créd.</span>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: "0.8px solid #1a1a1a", marginTop: 4 }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#f5f5f5" }}>Total</span>
                <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.85rem", fontWeight: 700, color: "#3ecf8e" }}>{cost} créditos</span>
              </div>
            </div>

            <p style={{ fontSize: "0.75rem", color: "#71717a", marginBottom: 20 }}>
              Te quedarán{" "}
              <span style={{ color: "#f5f5f5", fontWeight: 600 }}>{credits.credits_available - cost}</span>{" "}
              créditos.
            </p>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1, padding: "9px 0", borderRadius: 8, fontSize: "13px", fontWeight: 600,
                  color: "#f5f5f5", background: "#151515", border: "0.8px solid #1a1a1a", cursor: "pointer",
                }}
              >
                {t("darkweb.cancel")}
              </button>
              <button
                onClick={onConfirm}
                style={{
                  flex: 1, padding: "9px 0", borderRadius: 8, fontSize: "13px", fontWeight: 600,
                  color: "#000", background: "#3ecf8e", border: "none", cursor: "pointer",
                }}
              >
                {t("darkweb.confirm")}
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: "0.8rem", color: "#71717a", marginBottom: 20, lineHeight: 1.6 }}>
              Necesitas <span style={{ color: "#f5f5f5", fontWeight: 600 }}>{cost} créditos</span> pero solo tienes{" "}
              <span style={{ color: "#ef4444", fontWeight: 600 }}>{credits.credits_available}</span>.
              Compra un pack para continuar.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1, padding: "9px 0", borderRadius: 8, fontSize: "13px", fontWeight: 600,
                  color: "#f5f5f5", background: "#151515", border: "0.8px solid #1a1a1a", cursor: "pointer",
                }}
              >
                {t("darkweb.cancel")}
              </button>
              <button
                onClick={onBuyCredits}
                style={{
                  flex: 1, padding: "9px 0", borderRadius: 8, fontSize: "13px", fontWeight: 600,
                  color: "#000", background: "#3ecf8e", border: "none", cursor: "pointer",
                }}
              >
                {t("darkweb.buyCredits")}
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
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          borderRadius: 16,
          padding: 28,
          background: "#151515",
          border: "0.8px solid #1a1a1a",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#f5f5f5", marginBottom: 4 }}>Comprar créditos</h2>
            <p style={{ fontSize: "0.78rem", color: "#71717a" }}>
              Tienes {credits.credits_available} crédito{credits.credits_available !== 1 ? "s" : ""} disponible{credits.credits_available !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ color: "#71717a", fontSize: 20, lineHeight: 1, background: "none", border: "none", cursor: "pointer", padding: 4 }}
          >×</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, marginBottom: 20 }}>
          {packs.map((pack) => (
            <button
              key={pack.key}
              onClick={() => onBuy(pack.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 16px",
                borderRadius: 12,
                textAlign: "left" as const,
                cursor: "pointer",
                transition: "all 0.15s",
                background: pack.popular ? "rgba(62,207,142,0.06)" : "#1c1c1c",
                border: pack.popular ? "0.8px solid rgba(62,207,142,0.2)" : "0.8px solid #1a1a1a",
              }}
            >
              <div style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "0.85rem",
                flexShrink: 0,
                background: pack.popular ? "rgba(62,207,142,0.12)" : "#262626",
                color: pack.popular ? "#3ecf8e" : "#71717a",
                fontFamily: "var(--font-dm-mono)",
              }}>
                {pack.credits}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "#f5f5f5" }}>{pack.label}</span>
                  {pack.popular && (
                    <span style={{
                      fontFamily: "var(--font-dm-mono)",
                      fontSize: "11px",
                      padding: "2px 7px",
                      borderRadius: 6,
                      background: "rgba(62,207,142,0.10)",
                      color: "#3ecf8e",
                      border: "0.8px solid rgba(62,207,142,0.2)",
                    }}>
                      POPULAR
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#71717a" }}>{pack.credits} créditos · {pack.per}</div>
              </div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "#f5f5f5", flexShrink: 0 }}>{pack.price}</div>
            </button>
          ))}
        </div>

        <p style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.68rem", color: "#71717a", textAlign: "center" as const }}>
          1 crédito = 1 escaneo (email, dominio o suplantación). Los créditos no caducan.
        </p>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function DarkWebPage() {
  const { t, lang } = useTranslation();
  const [summary, setSummary]         = useState<DarkWebSummary | null>(null);
  const [loading, setLoading]         = useState(true);
  const [scanningAll, setScanningAll] = useState(false);
  const [showScanAll, setShowScanAll] = useState(false);
  const [showPacks, setShowPacks]     = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await darkwebApi.summary();
      setSummary(res.data);
    } catch {
      toast.error(t("darkweb.errorLoad"));
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
      toast.success(`${t("darkweb.scanStarted")} · ${res.data.credits_remaining} créditos`);
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
      toast.error(t("darkweb.errorBuy") ?? "Error al iniciar la compra");
    }
  };

  const onItemScanned = useCallback(() => {
    setTimeout(() => load(), 3000);
  }, [load]);

  if (loading) {
    return (
      <div style={{
        padding: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 256,
        background: "#0b0b0b",
      }}>
        <div style={{
          width: 28,
          height: 28,
          border: "2px solid #3ecf8e",
          borderTopColor: "transparent",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
      </div>
    );
  }

  if (!summary) return null;

  const totalEmailDanger   = (summary.emails ?? []).filter((e) => e.status === "breached").length;
  const totalDomainDanger  = (summary.domains ?? []).filter((d) => d.status === "found").length;
  const totalImpoDanger    = (summary.impersonation ?? []).filter((i) => i.status === "threatened").length;
  const overallDanger      = totalEmailDanger + totalDomainDanger + totalImpoDanger;

  return (
    <div style={{
      padding: "28px 32px 60px",
      background: "#0b0b0b",
      minHeight: "100vh",
      fontFamily: "var(--font-dm-sans)",
    }}>
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

      {/* Page header */}
      <div className="cs-fadeup-1" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap" as const, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#f5f5f5", marginBottom: 4 }}>
            Dark Web Monitoring
          </h1>
          <p style={{ fontSize: "0.8rem", color: "#71717a" }}>
            Vigilancia de filtraciones · emails · dominios · suplantación de empresa
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <button
            onClick={() => setShowPacks(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 600,
              fontSize: "13px",
              padding: "8px 16px",
              borderRadius: 8,
              border: "0.8px solid #1a1a1a",
              background: "#151515",
              color: "#f5f5f5",
              cursor: "pointer",
              fontFamily: "var(--font-dm-mono)",
            }}
          >
            <span style={{ color: "#3ecf8e" }}>◆</span>{" "}
            {summary.credits.credits_available} crédito{summary.credits.credits_available !== 1 ? "s" : ""}
          </button>
          <button
            onClick={() => setShowScanAll(true)}
            disabled={scanningAll}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 600,
              fontSize: "13px",
              color: "#000",
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              cursor: scanningAll ? "not-allowed" : "pointer",
              transition: "opacity 0.15s",
              background: "#3ecf8e",
              opacity: scanningAll ? 0.6 : 1,
            }}
          >
            {scanningAll ? `⟳ ${t("darkweb.scanning")}…` : `⟳ ${t("darkweb.scanGeneral")} (${summary.scan_all_cost} créd.)`}
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        borderRadius: 16,
        marginBottom: 20,
        background: "#151515",
        border: "0.8px solid #1a1a1a",
      }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#3ecf8e", flexShrink: 0 }} />
        <span style={{
          fontFamily: "var(--font-dm-mono)",
          fontSize: "0.65rem",
          letterSpacing: "0.12em",
          color: "#3ecf8e",
          textTransform: "uppercase" as const,
        }}>{t("alerts.activeMonitoring")}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginLeft: "auto" }}>
          {summary.last_scan_at && (
            <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.68rem", color: "#71717a" }}>
              {t("darkweb.lastCheck")} <span style={{ color: "#b3b4b5" }}>{relTime(summary.last_scan_at, lang)}</span>
            </span>
          )}
          <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.68rem", color: "#71717a" }}>
            Auto: <span style={{ color: "#b3b4b5" }}>{summary.next_auto_scan}</span>
          </span>
          <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.62rem", color: "#71717a" }}>
            Los escaneos automáticos no consumen créditos
          </span>
        </div>
      </div>

      {/* Alert banner */}
      {overallDanger > 0 && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "14px 18px",
          borderRadius: 16,
          marginBottom: 20,
          background: "rgba(239,68,68,0.06)",
          border: "0.8px solid rgba(239,68,68,0.2)",
        }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(239,68,68,0.10)",
            color: "#ef4444",
            fontSize: 16,
            flexShrink: 0,
          }}>!</div>
          <div>
            <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#ef4444" }}>Filtraciones detectadas</div>
            <div style={{ fontSize: "0.78rem", color: "#71717a", marginTop: 2 }}>
              {overallDanger} activo{overallDanger !== 1 ? "s" : ""} con datos expuestos en la dark web. Revisa los detalles y actúa.
            </div>
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        <CreditBadge credits={summary.credits} />
        {[
          {
            label: "Emails afectados",
            value: totalEmailDanger,
            total: (summary.emails ?? []).length,
            danger: totalEmailDanger > 0,
          },
          {
            label: "Dominios expuestos",
            value: totalDomainDanger,
            total: (summary.domains ?? []).length,
            danger: totalDomainDanger > 0,
          },
          {
            label: "Dominios impostores",
            value: summary.impersonation_available ? totalImpoDanger : "—",
            total: (summary.impersonation ?? []).length,
            danger: summary.impersonation_available && totalImpoDanger > 0,
          },
        ].map((stat) => (
          <div key={stat.label} style={{
            borderRadius: 16,
            padding: "18px 20px",
            background: "#151515",
            border: `0.8px solid ${stat.danger ? "rgba(239,68,68,0.2)" : "#1a1a1a"}`,
          }}>
            <div style={{
              fontFamily: "var(--font-dm-mono)",
              fontSize: "0.62rem",
              textTransform: "uppercase" as const,
              letterSpacing: "0.12em",
              color: "#71717a",
              fontWeight: 600,
              marginBottom: 10,
            }}>{stat.label}</div>
            <div style={{
              fontFamily: "var(--font-dm-mono)",
              fontSize: "1.9rem",
              fontWeight: 700,
              color: stat.danger ? "#ef4444" : "#3ecf8e",
              lineHeight: 1,
            }}>
              {stat.value}
            </div>
            <div style={{ fontFamily: "var(--font-dm-mono)", fontSize: "0.68rem", color: "#71717a", marginTop: 6 }}>
              de {stat.total} monitorizados
            </div>
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
            <div style={{ padding: "24px 0", textAlign: "center" as const, fontSize: "0.82rem", color: "#71717a" }}>
              No tienes emails monitorizados. Añade emails desde el dashboard.
            </div>
          ) : (
            <div>
              {(summary.emails ?? []).map((item) => (
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
            <div style={{ padding: "24px 0", textAlign: "center" as const, fontSize: "0.82rem", color: "#71717a" }}>
              No tienes dominios registrados. Añade un dominio desde el dashboard.
            </div>
          ) : (
            <div>
              {(summary.domains ?? []).map((item) => (
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
          icon="⊙"
          totalDanger={totalImpoDanger}
          locked={!summary.impersonation_available}
        >
          {summary.impersonation.length === 0 ? (
            <div style={{ padding: "24px 0", textAlign: "center" as const, fontSize: "0.82rem", color: "#71717a" }}>
              No hay dominios configurados para monitorización de suplantación.
            </div>
          ) : (
            <div>
              {(summary.impersonation ?? []).map((item) => (
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

      {/* Footer */}
      <div style={{ background: "#151515", border: "0.8px solid #1a1a1a", borderRadius: 16, padding: "12px 24px", display: "flex", justifyContent: "space-between", marginTop: 16 }}>
        <span style={{ fontSize: "12px", color: "#71717a" }}>© 2026 • v1.0.0</span>
        <span style={{ fontSize: "12px", color: "#71717a" }}>by <span style={{ color: "#b3b4b5", fontWeight: 500 }}>ChronoShield</span></span>
      </div>
    </div>
  );
}
