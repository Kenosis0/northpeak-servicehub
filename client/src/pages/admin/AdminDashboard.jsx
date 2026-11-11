import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Wrench,
  FileText,
  CalendarClock,
  AlertTriangle,
  Calendar,
  ShieldAlert,
  BarChart3,
  Users,
  ShoppingBag,
  ArrowRight
} from 'lucide-react';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAdminSummary() {
      try {
        const res = await api.get('/dashboard/summary');
        setSummary(res.data);
      } catch (err) {
        console.error('Failed to load admin summary:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAdminSummary();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading Executive Dashboard...</div>;
  }

  const kpis = summary?.kpis || {};
  const charts = summary?.charts || {};
  const lowStock = summary?.low_stock_items || [];
  const upcomingPm = summary?.upcoming_pm_equipment || [];
  const recentAudit = summary?.recent_audit_logs || [];

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="bg-gradient-to-r from-[#0F172A] via-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-lg flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
            Executive Administration & Security Governance
          </span>
          <h1 className="text-2xl font-extrabold mt-1">
            NorthPeak ServiceHub — System Command Center
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Full visibility across Aircon Sales Inquiries, Service Requests, Quotations & Revisions, Dispatch, Warehouse Inventory, and RBAC Audit Logs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/users"
            className="px-3.5 py-2 rounded-xl bg-[#0284C7] hover:bg-sky-600 text-xs font-bold text-white flex items-center gap-1.5"
          >
            <Users className="w-4 h-4" />
            5-Role RBAC Users
          </Link>
          <Link
            to="/admin/reports"
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1.5"
          >
            <BarChart3 className="w-4 h-4" />
            Export Reports
          </Link>
          <Link
            to="/admin/audit-logs"
            className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-bold text-white flex items-center gap-1.5"
          >
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            Audit Trail
          </Link>
        </div>
      </div>

      {/* 6 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold uppercase text-slate-500">Active Requests</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1.5">
            {kpis.active_requests_count || 0}
          </div>
          <div className="text-[11px] text-sky-600 font-semibold mt-1">4 Core Service Types</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold uppercase text-slate-500">Pending Quotes</div>
          <div className="text-2xl font-extrabold text-amber-600 mt-1.5">
            {kpis.pending_quotations_count || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Awaiting review / revision</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold uppercase text-slate-500">Active Work Orders</div>
          <div className="text-2xl font-extrabold text-[#0284C7] mt-1.5">
            {kpis.active_work_orders_count || 0}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-1">
            {kpis.completed_work_orders_count || 0} Completed
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-sm">
          <div className="text-[11px] font-bold uppercase text-rose-600">Low-Stock Parts</div>
          <div className="text-2xl font-extrabold text-rose-600 mt-1.5">
            {kpis.low_stock_parts_count || 0}
          </div>
          <div className="text-[11px] text-rose-700 font-semibold mt-1">Below Reorder Level</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm">
          <div className="text-[11px] font-bold uppercase text-emerald-700">Upcoming PM Alerts</div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-1.5">
            {kpis.upcoming_pm_count || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Due within 60 days</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold uppercase text-slate-500">Recorded Payments</div>
          <div className="text-xl font-extrabold text-slate-900 mt-1.5">
            ₱{Number(kpis.total_revenue_collected || 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">
            Staff-verified offline
          </div>
        </div>
      </div>

      {/* Charts & Breakdown Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="font-bold text-sm text-slate-900 mb-4">
            Service Requests Breakdown by Workflow Type
          </h2>
          <div className="space-y-3 text-xs">
            {(charts.requests_by_type || []).map((row) => (
              <div key={row.service_type} className="space-y-1">
                <div className="flex justify-between font-semibold text-slate-700">
                  <span>{row.service_type}</span>
                  <span className="font-mono font-bold text-[#0284C7]">{row.count} ticket(s)</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0284C7] rounded-full"
                    style={{ width: `${Math.min(100, row.count * 25)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="font-bold text-sm text-slate-900 mb-4">
            Low-Stock Alerts & Upcoming Preventive Maintenance
          </h2>
          <div className="space-y-2.5 text-xs">
            {lowStock.slice(0, 3).map((item) => (
              <div
                key={item.item_id}
                className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-rose-900">{item.part_name}</span>
                  <span className="ml-2 font-mono text-[11px] text-rose-700">({item.sku_code})</span>
                </div>
                <span className="font-mono font-extrabold text-rose-700">
                  Avail: {item.available_stock} / Reorder: {item.reorder_level}
                </span>
              </div>
            ))}

            {upcomingPm.slice(0, 3).map((eq) => (
              <div
                key={eq.equipment_id}
                className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between"
              >
                <div>
                  <span className="font-mono font-bold text-emerald-900">[{eq.qr_token}]</span>{' '}
                  <span className="font-semibold text-slate-800">
                    {eq.brand} {eq.model} ({eq.customer_name})
                  </span>
                </div>
                <span className="font-mono font-bold text-emerald-700">
                  PM Due: {eq.next_pm_date}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Immutable Audit Logs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#0284C7]" />
            <h2 className="font-bold text-sm text-slate-900">
              Latest Security & Transactional Audit Trail
            </h2>
          </div>
          <Link to="/admin/audit-logs" className="text-xs font-semibold text-[#0284C7] hover:underline">
            View Full Audit Trail →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th className="py-2.5 px-4 font-bold">Timestamp</th>
                <th className="py-2.5 px-4 font-bold">Actor & Role</th>
                <th className="py-2.5 px-4 font-bold">Action Event</th>
                <th className="py-2.5 px-4 font-bold">Entity</th>
                <th className="py-2.5 px-4 font-bold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentAudit.map((log) => (
                <tr key={log.log_id}>
                  <td className="py-3 px-4 font-mono text-slate-500">{log.created_at}</td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{log.user_name || 'System'}</div>
                    <div className="text-[11px] text-sky-700 font-semibold">{log.user_role}</div>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-800">{log.action}</td>
                  <td className="py-3 px-4 font-mono text-slate-600">
                    {log.entity_name} #{log.entity_id}
                  </td>
                  <td className="py-3 px-4 text-slate-600 max-w-md truncate">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
