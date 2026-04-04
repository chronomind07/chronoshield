"use client";

import { useState } from "react";
import { creditsApi } from "@/lib/api";
import toast from "react-hot-toast";

interface Pack {
  key: "s" | "m" | "l";
  credits: number;
  price: string;
  label: string;
  highlight?: boolean;
}

const PACKS: Pack[] = [
  { key: "s", credits: 5,  price: "6,99€",  label: "Pack S" },
  { key: "m", credits: 12, price: "10,99€", label: "Pack M" },
  { key: "l", credits: 30, price: "20,99€", label: "Pack L", highlight: true },
];

interface Props {
  onClose: () => void;
}

export default function BuyCreditsModal({ onClose }: Props) {
  const [buying, setBuying] = useState<string | null>(null);

  const handleBuy = async (pack: "s" | "m" | "l") => {
    setBuying(pack);
    try {
      const res = await creditsApi.checkout(pack);
      const url = res.data?.url;
      if (url) {
        window.location.href = url;
      } else {
        toast.error("Error al iniciar el pago");
      }
    } catch {
      toast.error("Error al procesar la compra");
    } finally {
      setBuying(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(8,12,16,0.85)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-7 relative"
        style={{ background: "#0D1218", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#5A6B7A] hover:text-[#E8EDF2] transition-colors"
        >
          <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Header */}
        <div className="mb-6">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-4"
            style={{ background: "rgba(0,194,255,0.08)", border: "1px solid rgba(0,194,255,0.15)" }}
          >
            ⚡
          </div>
          <h2 className="font-syne text-lg font-bold text-[#E8EDF2]">Sin créditos disponibles</h2>
          <p className="text-[13px] text-[#5A6B7A] mt-1">
            Los escaneos manuales consumen 1 crédito. Compra un pack para continuar.
          </p>
        </div>

        {/* Packs */}
        <div className="space-y-3">
          {PACKS.map((pack) => (
            <div
              key={pack.key}
              className="flex items-center justify-between rounded-xl px-4 py-3.5 transition-all"
              style={{
                background: pack.highlight ? "rgba(0,194,255,0.06)" : "#121A22",
                border: pack.highlight
                  ? "1px solid rgba(0,194,255,0.2)"
                  : "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-syne font-bold text-[14px] text-[#E8EDF2]">{pack.label}</span>
                  {pack.highlight && (
                    <span
                      className="font-mono text-[9px] uppercase tracking-[1px] px-1.5 py-0.5 rounded"
                      style={{ background: "rgba(0,194,255,0.15)", color: "#00C2FF" }}
                    >
                      Popular
                    </span>
                  )}
                </div>
                <span className="font-mono text-[12px] text-[#5A6B7A]">
                  {pack.credits} créditos
                  {pack.key === "m" && <span className="ml-1 text-[#3ecf8e]">+2 extra</span>}
                  {pack.key === "l" && <span className="ml-1 text-[#3ecf8e]">+5 extra</span>}
                </span>
              </div>
              <button
                onClick={() => handleBuy(pack.key)}
                disabled={!!buying}
                className="font-semibold text-[13px] px-4 py-2 rounded-lg disabled:opacity-50 transition-all"
                style={
                  pack.highlight
                    ? { background: "linear-gradient(135deg, #0077FF, #00C2FF)", color: "#080C10" }
                    : { background: "rgba(255,255,255,0.06)", color: "#E8EDF2" }
                }
              >
                {buying === pack.key ? "..." : pack.price}
              </button>
            </div>
          ))}
        </div>

        <p className="font-mono text-[10px] text-[#5A6B7A] text-center mt-5">
          Pago seguro con Stripe · Sin suscripción
        </p>
      </div>
    </div>
  );
}
