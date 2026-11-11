import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag,
  Wrench,
  FileText,
  QrCode,
  Calendar,
  ArrowRight,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/StatusBadge';
import QRModal from '../../components/QRModal';

export default function CustomerDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedQrUnit, setSelectedQrUnit] = useState(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const res = await api.get('/dashboard/summary');
        setSummary(res.data);
      } catch (err) {
        console.error('Failed to load customer dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-sm text-slate-500">Loading your customer portal...</div>;
  }

  const kpis = summary?.kpis || {};
  const upcomingPm = summary?.upcoming_pm_equipment || [];
  const recentRequests = summary?.recent_requests || [];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#0F172A] to-slate-800 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
            Customer Self-Service Portal
          </span>
          <h1 className="text-2xl font-extrabold mt-1">Welcome back, {user?.full_name}</h1>
          <p className="text-xs text-slate-300 mt-1">
            Browse brand-new inverter aircons, schedule installation/cleaning/repair/relocation, and track your QR-tagged equipment maintenance.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link
            to="/customer/catalog"
            className="px-4 py-2.5 rounded-xl bg-[#0284C7] hover:bg-sky-600 text-xs font-bold text-white shadow-sm flex items-center gap-1.5"
          >
            <ShoppingBag className="w-4 h-4" />
            Inquire Aircon Unit
          </Link>
          <Link
            to="/customer/requests"
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-sm flex items-center gap-1.5"
          >
            <Wrench className="w-4 h-4" />
            Book Service Request
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/customer/catalog"
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-sky-400 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Purchase Inquiries
            </span>
            <ShoppingBag className="w-5 h-5 text-[#0284C7]" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2">
            {kpis.my_inquiries_count || 0}
          </div>
          <div className="text-xs text-sky-600 font-semibold mt-2 flex items-center gap-1">
            View Inquiries <ArrowRight className="w-3 h-3" />
          </div>
        </Link>

        <Link
          to="/customer/requests"
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-sky-400 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Active Service Tickets
            </span>
            <Wrench className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2">
            {kpis.my_active_requests_count || 0}
          </div>
          <div className="text-xs text-emerald-600 font-semibold mt-2 flex items-center gap-1">
            Track Requests <ArrowRight className="w-3 h-3" />
          </div>
        </Link>

        <Link
          to="/customer/quotations"
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-amber-400 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Quotes Awaiting Review
            </span>
            <FileText className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2">
            {kpis.my_pending_quotes_count || 0}
          </div>
          <div className="text-xs text-amber-600 font-semibold mt-2 flex items-center gap-1">
            Review & Approve <ArrowRight className="w-3 h-3" />
          </div>
        </Link>

        <Link
          to="/customer/equipment"
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-sky-400 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Registered AC Units
            </span>
            <QrCode className="w-5 h-5 text-sky-600" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2">
            {kpis.my_equipment_count || 0}
          </div>
          <div className="text-xs text-sky-600 font-semibold mt-2 flex items-center gap-1">
            QR Codes & PM Schedule <ArrowRight className="w-3 h-3" />
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Registered AC Units & Preventive Maintenance Due Dates */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <h2 className="font-bold text-sm text-slate-900">
                My AC Units & Next Preventive Maintenance (PM)
              </h2>
            </div>
            <Link to="/customer/equipment" className="text-xs font-semibold text-[#0284C7] hover:underline">
              Full History →
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {upcomingPm.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No registered AC units linked to your profile yet.
              </div>
            ) : (
              upcomingPm.map((eq) => (
                <div key={eq.equipment_id} className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300">
                        {eq.qr_token}
                      </span>
                      <span className="font-bold text-sm text-slate-900">
                        {eq.brand} {eq.model}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{eq.installed_location}</div>
                    <div className="text-xs text-slate-600 mt-1 flex items-center gap-3">
                      <span>Last Service: {eq.last_service_date || 'N/A'}</span>
                      <span className="font-bold text-emerald-700">
                        Next PM Due: {eq.next_pm_date || 'Pending'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedQrUnit(eq)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-[#0284C7] border border-slate-200 text-xs font-semibold flex items-center gap-1.5 shrink-0"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    QR Sticker
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Service Requests */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-900">Recent Service Requests</h2>
            <Link to="/customer/requests" className="text-xs font-semibold text-[#0284C7] hover:underline">
              View All →
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {recentRequests.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No service requests submitted yet.
              </div>
            ) : (
              recentRequests.map((req) => (
                <div key={req.request_id} className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#0284C7]">
                        {req.reference_no}
                      </span>
                      <span className="font-semibold text-sm text-slate-900">
                        {req.service_type}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Preferred Date: {req.preferred_date}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={req.status} />
                    <StatusBadge status={req.payment_status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {selectedQrUnit && (
        <QRModal equipment={selectedQrUnit} onClose={() => setSelectedQrUnit(null)} />
      )}
    </div>
  );
}
