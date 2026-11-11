import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Wrench,
  QrCode,
  CheckCircle2,
  Clock,
  MapPin,
  ArrowRight,
  Navigation
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/StatusBadge';

export default function TechDashboard() {
  const { user } = useAuth();
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/work-orders');
      setWorkOrders(res.data.work_orders || []);
    } catch (err) {
      console.error('Failed to load technician jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleQuickStatus = async (woId, nextStatus) => {
    try {
      await api.patch(`/work-orders/${woId}/status`, { status: nextStatus });
      fetchJobs();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status.');
    }
  };

  const activeJobs = workOrders.filter((w) => w.status !== 'Completed' && w.status !== 'Cancelled');
  const completedJobs = workOrders.filter((w) => w.status === 'Completed');

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-[#0F172A] rounded-2xl p-6 text-white shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
            Field Technician Mobile Portal
          </span>
          <h1 className="text-2xl font-extrabold mt-1">
            Technician Dispatch Queue — {user?.full_name}
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Specialization: {user?.specialization || 'Split-Type, Commercial & Inverter HVAC'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/technician/scanner"
            className="px-4 py-2.5 rounded-xl bg-[#0284C7] hover:bg-sky-600 text-xs font-bold text-white flex items-center gap-1.5 shadow-sm"
          >
            <QrCode className="w-4 h-4" />
            Scan Equipment QR
          </Link>
          <Link
            to="/technician/execution"
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1.5 shadow-sm"
          >
            <Wrench className="w-4 h-4" />
            Complete Work Order
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500">
              Active Dispatch Queue
            </span>
            <Clock className="w-5 h-5 text-[#0284C7]" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2">{activeJobs.length}</div>
          <div className="text-xs text-slate-500 mt-1">Scheduled / En Route / In Progress</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500">
              Completed Work Orders
            </span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2">{completedJobs.length}</div>
          <div className="text-xs text-emerald-600 font-semibold mt-1">
            Auto-PM dates updated in ledger
          </div>
        </div>

        <Link
          to="/technician/scanner"
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-sky-400 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500">
              QR Equipment Scanner
            </span>
            <QrCode className="w-5 h-5 text-sky-600" />
          </div>
          <div className="text-lg font-extrabold text-slate-900 mt-2">
            Instant Unit History Lookup
          </div>
          <div className="text-xs text-sky-600 font-semibold mt-2 flex items-center gap-1">
            Launch Scanner <ArrowRight className="w-3 h-3" />
          </div>
        </Link>
      </div>

      {/* Active Dispatch Cards */}
      <div className="space-y-4">
        <h2 className="font-bold text-sm text-slate-900 uppercase tracking-wider">
          Active Assigned Work Orders ({activeJobs.length})
        </h2>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading work orders...</div>
        ) : activeJobs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-400">
            No active work orders currently in queue.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeJobs.map((wo) => (
              <div
                key={wo.work_order_id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-extrabold text-[#0284C7]">
                      {wo.work_order_no}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={wo.priority} />
                      <StatusBadge status={wo.status} />
                    </div>
                  </div>

                  <div className="mt-2">
                    <div className="text-sm font-extrabold text-slate-900">{wo.service_type}</div>
                    <div className="text-xs font-semibold text-slate-700 mt-0.5">
                      Client: {wo.customer_name} ({wo.customer_phone})
                    </div>
                  </div>

                  <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                    <div className="flex items-start gap-1.5 text-slate-700">
                      <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
                      <span>{wo.current_location}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600 font-mono">
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>
                        {wo.scheduled_start} → {wo.scheduled_end}
                      </span>
                    </div>
                    {wo.equipment_qr_token && (
                      <div className="font-mono text-xs font-bold text-slate-800 pt-1">
                        QR Unit: [{wo.equipment_qr_token}] {wo.equipment_brand} {wo.equipment_model}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                  <div className="flex gap-1.5">
                    {wo.status === 'Scheduled' && (
                      <button
                        onClick={() => handleQuickStatus(wo.work_order_id, 'En Route')}
                        className="px-3 py-1.5 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-800 text-xs font-bold flex items-center gap-1"
                      >
                        <Navigation className="w-3 h-3" />
                        Mark En Route
                      </button>
                    )}
                    {(wo.status === 'Scheduled' || wo.status === 'En Route') && (
                      <button
                        onClick={() => handleQuickStatus(wo.work_order_id, 'In Progress')}
                        className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-bold"
                      >
                        Start Work
                      </button>
                    )}
                  </div>

                  <Link
                    to={`/technician/execution?wo=${wo.work_order_id}`}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    Execute & Complete →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
