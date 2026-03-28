"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { creditsApi } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreditsContextValue {
  credits: number | null;
  refreshCredits: () => Promise<void>;
  decrementCredits: (by?: number) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const CreditsContext = createContext<CreditsContextValue>({
  credits: null,
  refreshCredits: async () => {},
  decrementCredits: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CreditsProvider({ children }: { children: ReactNode }) {
  const [credits, setCredits] = useState<number | null>(null);

  const refreshCredits = useCallback(async () => {
    try {
      // GET /credits returns the credits row:
      // { credits_available: number, credits_used: number, plan: string,
      //   reset_date: string, packs: {...} }
      const res = await creditsApi.get();
      const available = res.data?.credits_available;
      setCredits(typeof available === "number" ? available : null);
    } catch {
      // Silent — keep last known value
    }
  }, []);

  const decrementCredits = useCallback((by = 1) => {
    setCredits((prev) =>
      prev !== null ? Math.max(0, prev - by) : prev
    );
  }, []);

  useEffect(() => {
    refreshCredits();
    // Refresh every 5 minutes to stay in sync with server
    const interval = setInterval(refreshCredits, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refreshCredits]);

  return (
    <CreditsContext.Provider value={{ credits, refreshCredits, decrementCredits }}>
      {children}
    </CreditsContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCredits(): CreditsContextValue {
  return useContext(CreditsContext);
}
