import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag,
  Wrench,
  FileText,
  CalendarClock,
  QrCode,
  AlertTriangle,
  ArrowRight,
  PhilippinePeso
} from 'lucide-react';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

export default function StaffDashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSummary() {
      try {
        const res = await api.get('/dashboard/summary');
        setSummary(res.data);
      } catch (err) {
        console.error('Failed to load staff dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSummary();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading Service Staff operations...</div>;
  }

  const kpis = summary?.kpis || {};
  const upcomingPm = summary?.upcoming_pm_equipment || [];
  const lowStock = summary?.low_stock_items || [];

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-[#0F172A] rounded-2xl p-6 text-white shadow-lg flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
            Service Staff Operations Console
          </span>
          <h1 className="text-2xl font-extrabold mt-1">
            Sales Inquiry Triage, Quoting & Conflict-Free Dispatch
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Confirm aircon stock, record offline payments, issue temporary/finalized quotations & revisions, and schedule technicians.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/staff/inquiries"
            className="px-3.5 py-2 rounded-xl bg-[#0284C7] hover:bg-sky-600 text-xs font-bold text-white flex items-center gap-1.5"
          >
            <ShoppingBag className="w-4 h-4" />
            Triage Inquiries
          </Link>
          <Link
            to="/staff/quotations"
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-xs font-bold text-white flex items-center gap-1.5"
          >
            <FileText className="w-4 h-4" />
            Quotation Builder
          </Link>
          <Link
            to="/staff/dispatch"
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1.5"
          >
            <CalendarClock className="w-4 h-4" />
            Schedule Dispatch
          </Link>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/staff/inquiries"
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-sky-400 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500">Pending Inquiries</span>
            <ShoppingBag className="w-5 h-5 text-[#0284C7]" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2">
            {kpis.pending_inquiries_count || 0}
          </div>
          <div className="text-xs text-sky-600 font-semibold mt-2 flex items-center gap-1">
            Confirm Stock & Handoff <ArrowRight className="w-3 h-3" />
          </div>
        </Link>

        <Link
          to="/staff/requests"
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-sky-400 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500">Active Service Tickets</span>
            <Wrench className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2">
            {kpis.active_requests_count || 0}
          </div>
          <div className="text-xs text-emerald-600 font-semibold mt-2 flex items-center gap-1">
            Manage Tickets & Payments <ArrowRight className="w-3 h-3" />
          </div>
        </Link>

        <Link
          to="/staff/quotations"
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-amber-400 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500">
              Pending / Revision Quotes
            </span>
            <FileText className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2">
            {kpis.pending_quotations_count || 0}
          </div>
          <div className="text-xs text-amber-600 font-semibold mt-2 flex items-center gap-1">
            Build or Revise Quotes <ArrowRight className="w-3 h-3" />
          </div>
        </Link>

        <Link
          to="/staff/dispatch"
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-sky-400 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500">Active Work Orders</span>
            <CalendarClock className="w-5 h-5 text-[#0284C7]" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2">
            {kpis.active_work_orders_count || 0}
          </div>
          <div className="text-xs text-sky-600 font-semibold mt-2 flex items-center gap-1">
            Dispatch Calendar <ArrowRight className="w-3 h-3" />
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Upcoming Preventive Maintenance Alerts */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-900">
              Upcoming Customer Preventive Maintenance (PM) Schedule
            </h2>
            <Link to="/staff/equipment" className="text-xs font-semibold text-[#0284C7] hover:underline">
              Manage Equipment →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                  <th className="py-2.5 px-4 font-bold">QR Token</th>
                  <th className="py-2.5 px-4 font-bold">Customer & Unit</th>
                  <th className="py-2.5 px-4 font-bold">Last Service</th>
                  <th className="py-2.5 px-4 font-bold">Next PM Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {upcomingPm.map((eq) => (
                  <tr key={eq.equipment_id}>
                    <td className="py-3 px-4 font-mono font-bold text-[#0284C7]">{eq.qr_token}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{eq.customer_name}</div>
                      <div className="text-slate-500">
                        {eq.brand} {eq.model} ({eq.capacity_hp})
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{eq.last_service_date || 'N/A'}</td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                      {eq.next_pm_date}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock Alert Widget */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <h2 className="font-bold text-sm text-slate-900">
                Warehouse Low-Stock Parts ({lowStock.length})
              </h2>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {lowStock.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                All spare parts are above reorder thresholds.
              </div>
            ) : (
              lowStock.map((item) => (
                <div key={item.item_id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-xs text-slate-900">{item.part_name}</div>
                    <div className="text-[11px] font-mono text-slate-500">
                      {item.sku_code} • Reorder Level: {item.reorder_level} {item.unit_of_measure}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                      Avail: {item.available_stock} {item.unit_of_measure}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
