"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { billingApi } from "@/lib/api";

interface PlanContextValue {
  plan: string;
  status: string;
  loading: boolean;
  isFree: boolean;
  refresh: () => void;
}

const PlanContext = createContext<PlanContextValue>({
  plan: "free",
  status: "trialing",
  loading: true,
  isFree: false,   // Don't assume free while loading — avoids banner flicker
  refresh: () => {},
});

export function PlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState("free");
  const [status, setStatus] = useState("trialing");
  const [loading, setLoading] = useState(true);

  const fetchPlan = async () => {
    try {
      const res = await billingApi.subscription();
      setPlan(res.data?.plan ?? "free");
      setStatus(res.data?.status ?? "trialing");
    } catch {
      // default to free
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPlan(); }, []);

  // Only mark as free AFTER the plan has been fetched — avoids showing the
  // upgrade banner briefly on every reload for paying users.
  const isFree = !loading && (plan === "free" || plan === "trial" || status === "trialing");

  return (
    <PlanContext.Provider value={{ plan, status, loading, isFree, refresh: fetchPlan }}>
      {children}
    </PlanContext.Provider>
  );
}

export const usePlan = () => useContext(PlanContext);
