import axios from "axios";
import { supabase } from "@/lib/supabase";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1",
});

// Auto-attach Supabase JWT to every request
api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Domain endpoints
export const domainsApi = {
  list: () => api.get("/domains"),
  add: (domain: string) => api.post("/domains", { domain }),
  remove: (id: string) => api.delete(`/domains/${id}`),
  scan: (id: string) => api.post(`/domains/${id}/scan`),
};

// Email endpoints
export const emailsApi = {
  list: () => api.get("/emails"),
  add: (email: string) => api.post("/emails", { email }),
  remove: (id: string) => api.delete(`/emails/${id}`),
};

// Dashboard endpoints
export const dashboardApi = {
  summary: () => api.get("/dashboard/summary"),
  scores: () => api.get("/dashboard/scores"),
  alerts: (unreadOnly?: boolean) =>
    api.get("/dashboard/alerts", { params: { unread_only: unreadOnly } }),
  markAlertRead: (id: string) => api.patch(`/dashboard/alerts/${id}/read`),
};

// AI endpoints
export const aiApi = {
  analyze: (domainId?: string, contextType = "full_report") =>
    api.post("/ai/analyze", { domain_id: domainId, context_type: contextType }),
};

// Billing endpoints
export const billingApi = {
  subscription: () => api.get("/billing/subscription"),
  checkout: (plan: "starter" | "business") =>
    api.post(`/billing/checkout/${plan}`),
  portal: () => api.post("/billing/portal"),
};

// Alerts endpoints
export const alertsApi = {
  list: (params?: { unread_only?: boolean; severity?: string }) =>
    api.get("/alerts", { params }),
  unreadCount: () => api.get("/alerts/unread-count"),
  markRead: (id: string) => api.patch(`/alerts/${id}/read`),
  markAllRead: () => api.patch("/alerts/read-all"),
};

// History endpoints
export const historyApi = {
  list: (params?: { dateFilter?: string; eventType?: string; page?: number; per_page?: number }) =>
    api.get("/history", {
      params: {
        date_filter: params?.dateFilter,
        event_type: params?.eventType,
        page: params?.page,
        per_page: params?.per_page,
      },
    }),
};

// Dark Web endpoints
export const darkwebApi = {
  summary: ()                               => api.get("/darkweb/summary"),
  scanEmail: (emailId: string)              => api.post(`/darkweb/scan/email/${emailId}`),
  scanDomain: (domainId: string)            => api.post(`/darkweb/scan/domain/${domainId}`),
  scanImpersonation: (domainId: string)     => api.post(`/darkweb/scan/impersonation/${domainId}`),
  scanAll: ()                               => api.post("/darkweb/scan/all"),
  results: (scanType?: string)              => api.get("/darkweb/results", { params: { scan_type: scanType } }),
};

// Credits endpoints
export const creditsApi = {
  get: ()                              => api.get("/credits"),
  checkout: (pack: "s" | "m" | "l")   => api.post(`/credits/checkout/${pack}`),
};

export { supabase };
export default api;
