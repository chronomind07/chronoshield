"use client";

import { useEffect, useState } from "react";
import { dashboardApi, domainsApi } from "@/lib/api";
import { Shield, AlertTriangle, Globe, Mail, TrendingUp } from "lucide-react";
import toast from "react-hot-toast";

interface DashboardSummary {
  domains_monitored: number;
  emails_monitored: number;
  active_alerts: number;
  average_score: number;
  domains_with_ssl_issues: number;
  domains_down: number;
  breached_emails: number;
  recent_alerts: Alert[];
}

interface Alert {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  sent_at: string;
  read_at: string | null;
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "text-green-500" : score >= 60 ? "text-yellow-500" : "text-red-500";
  const grade =
    score >= 95 ? "A+" : score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";

  return (
    <div className="flex flex-col items-center">
      <span className={`text-5xl font-bold ${color}`}>{score}</span>
      <span className={`text-2xl font-semibold ${color}`}>{grade}</span>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color = "text-gray-900",
}: {
  icon: any;
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center gap-4">
      <div className="p-3 bg-blue-50 rounded-lg">
        <Icon className="w-6 h-6 text-blue-600" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </div>
    </div>
  );
}

function AlertItem({ alert, onRead }: { alert: Alert; onRead: (id: string) => void }) {
  const severityColors = {
    critical: "border-red-500 bg-red-50",
    warning: "border-yellow-500 bg-yellow-50",
    info: "border-blue-500 bg-blue-50",
  };
  const colors = severityColors[alert.severity as keyof typeof severityColors] || severityColors.info;

  return (
    <div
      className={`border-l-4 p-4 rounded-r-lg ${colors} ${!alert.read_at ? "opacity-100" : "opacity-60"}`}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="font-semibold text-sm text-gray-900">{alert.title}</p>
          <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
        </div>
        {!alert.read_at && (
          <button
            onClick={() => onRead(alert.id)}
            className="text-xs text-blue-600 hover:underline ml-4 shrink-0"
          >
            Marcar leído
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-2">
        {new Date(alert.sent_at).toLocaleString("es-ES")}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSummary = async () => {
    try {
      const res = await dashboardApi.summary();
      setSummary(res.data);
    } catch {
      toast.error("Error al cargar el dashboard");
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (alertId: string) => {
    await dashboardApi.markAlertRead(alertId);
    setSummary((prev) =>
      prev
        ? {
            ...prev,
            recent_alerts: prev.recent_alerts.map((a) =>
              a.id === alertId ? { ...a, read_at: new Date().toISOString() } : a
            ),
            active_alerts: Math.max(0, prev.active_alerts - 1),
          }
        : prev
    );
  };

  useEffect(() => {
    loadSummary();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!summary) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
      <Shield className="w-12 h-12 text-blue-300" />
      <h2 className="text-lg font-semibold text-gray-700">Empieza añadiendo tu primer dominio</h2>
      <p className="text-sm text-gray-500 max-w-sm">
        Monitoriza la seguridad de tus dominios y emails desde un solo lugar.
      </p>
      <a
        href="/dashboard/domains"
        className="mt-2 inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition"
      >
        Añadir dominio
      </a>
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Visión general de tu seguridad</p>
      </div>

      {/* Score + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 p-6 flex flex-col items-center justify-center gap-2">
          <Shield className="w-8 h-8 text-blue-600 mb-2" />
          <p className="text-sm font-medium text-gray-500">Security Score</p>
          <ScoreBadge score={summary.average_score} />
        </div>
        <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard icon={Globe} label="Dominios" value={summary.domains_monitored} />
          <StatCard icon={Mail} label="Emails" value={summary.emails_monitored} />
          <StatCard
            icon={AlertTriangle}
            label="Alertas activas"
            value={summary.active_alerts}
            color={summary.active_alerts > 0 ? "text-red-600" : "text-gray-900"}
          />
          <StatCard
            icon={TrendingUp}
            label="SSL issues"
            value={summary.domains_with_ssl_issues}
            color={summary.domains_with_ssl_issues > 0 ? "text-yellow-600" : "text-gray-900"}
          />
          <StatCard
            icon={Globe}
            label="Webs caídas"
            value={summary.domains_down}
            color={summary.domains_down > 0 ? "text-red-600" : "text-gray-900"}
          />
          <StatCard
            icon={Mail}
            label="Emails brechas"
            value={summary.breached_emails}
            color={summary.breached_emails > 0 ? "text-red-600" : "text-gray-900"}
          />
        </div>
      </div>

      {/* Recent Alerts */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Alertas recientes</h2>
        {summary.recent_alerts.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <Shield className="w-10 h-10 text-green-500 mx-auto mb-2" />
            <p className="text-green-700 font-medium">¡Todo en orden! No hay alertas activas.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {summary.recent_alerts.map((alert) => (
              <AlertItem key={alert.id} alert={alert} onRead={markRead} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
