"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { billingApi } from "@/lib/api";

interface PlanContextValue {
  plan: string;
  status: string;
  loading: boolean;
  refresh: () => void;
}

const PlanContext = createContext<PlanContextValue>({
  plan: "starter",
  status: "active",
  loading: true,
  refresh: () => {},
});

export function PlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState("starter");
  const [status, setStatus] = useState("active");
  const [loading, setLoading] = useState(true);

  const fetchPlan = async () => {
    try {
      const res = await billingApi.subscription();
      setPlan(res.data?.plan ?? "starter");
      setStatus(res.data?.status ?? "active");
    } catch {
      // keep defaults
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPlan(); }, []);

  return (
    <PlanContext.Provider value={{ plan, status, loading, refresh: fetchPlan }}>
      {children}
    </PlanContext.Provider>
  );
}

export const usePlan = () => useContext(PlanContext);
