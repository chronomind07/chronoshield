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
  isFree: true,
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

  const isFree = plan === "free" || plan === "trial" || status === "trialing";

  return (
    <PlanContext.Provider value={{ plan, status, loading, isFree, refresh: fetchPlan }}>
      {children}
    </PlanContext.Provider>
  );
}

export const usePlan = () => useContext(PlanContext);
