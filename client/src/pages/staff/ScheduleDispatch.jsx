import React, { useState, useEffect } from 'react';
import {
  CalendarClock,
  AlertOctagon,
  CheckCircle2,
  UserCheck,
  Clock,
  Wrench,
  X
} from 'lucide-react';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

export default function ScheduleDispatch() {
  const [workOrders, setWorkOrders] = useState([]);
  const [requests, setRequests] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    request_id: '',
    technician_id: '3',
    scheduled_start: '2026-11-14T13:30',
    scheduled_end: '2026-11-14T15:30',
    technician_remarks: ''
  });

  const [conflictCheckResult, setConflictCheckResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const fetchDispatchData = async () => {
    try {
      setLoading(true);
      const [woRes, reqRes, techRes] = await Promise.all([
        api.get('/work-orders'),
        api.get('/requests'),
        api.get('/technicians')
      ]);
      const allWos = woRes.data.work_orders || [];
      const allReqs = reqRes.data.requests || [];
      const allTechs = techRes.data.technicians || [];

      setWorkOrders(allWos);
      setRequests(allReqs.filter((r) => r.status !== 'Cancelled' && r.status !== 'Completed'));
      setTechnicians(allTechs);

      if (!form.request_id && allReqs.length > 0) {
        const candidate =
          allReqs.find((r) => r.status === 'Approved' || r.status === 'Quoted') || allReqs[0];
        if (candidate) {
          setForm((prev) => ({ ...prev, request_id: String(candidate.request_id) }));
        }
      }
    } catch (err) {
      console.error('Failed to load dispatch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDispatchData();
  }, []);

  // Real-time Conflict Detection Probe (FR-008 / TC-009)
  useEffect(() => {
    async function probeConflict() {
      if (!form.technician_id || !form.scheduled_start || !form.scheduled_end) {
        setConflictCheckResult(null);
        return;
      }
      try {
        const res = await api.post('/work-orders/check-conflict', {
          technician_id: Number(form.technician_id),
          scheduled_start: form.scheduled_start,
          scheduled_end: form.scheduled_end
        });
        setConflictCheckResult(res.data);
      } catch {
        setConflictCheckResult(null);
      }
    }
    probeConflict();
  }, [form.technician_id, form.scheduled_start, form.scheduled_end]);

  const handleDispatchSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback({ type: '', message: '' });
    try {
      const res = await api.post('/work-orders', {
        request_id: Number(form.request_id),
        technician_id: Number(form.technician_id),
        scheduled_start: form.scheduled_start,
        scheduled_end: form.scheduled_end,
        technician_remarks: form.technician_remarks
      });
      setFeedback({
        type: 'success',
        message: res.data.message || 'Work order dispatched!'
      });
      fetchDispatchData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err.response?.data?.message ||
          'Schedule Conflict Detected (HTTP 409): Technician is already assigned during this window.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">
          Conflict-Aware Technician Dispatch & Work Order Scheduler
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Assigns technicians to service requests and blocks overlapping schedules where{' '}
          <code className="font-mono text-slate-700">new_start &lt; existing_end AND new_end &gt; existing_start</code>{' '}
          with HTTP 409 Conflict (FR-008 / TC-009).
        </p>
      </div>

      {feedback.message && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-rose-50 border-rose-300 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertOctagon className="w-4 h-4 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback({ type: '', message: '' })}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Scheduler Form */}
      <form
        onSubmit={handleDispatchSubmit}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 text-xs"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-[#0284C7]" />
            Assign Technician & Dispatch Work Order
          </h2>
          <button
            type="button"
            onClick={() =>
              setForm((prev) => ({
                ...prev,
                technician_id: '3',
                scheduled_start: '2026-11-14T13:30',
                scheduled_end: '2026-11-14T15:30'
              }))
            }
            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-[11px]"
          >
            Test TC-009 Overlap (Arnel @ 2026-11-14 13:30)
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block font-bold uppercase text-slate-600 mb-1">
              Service Request *
            </label>
            <select
              required
              value={form.request_id}
              onChange={(e) => setForm({ ...form, request_id: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white font-semibold"
            >
              <option value="">-- Select Request --</option>
              {requests.map((r) => (
                <option key={r.request_id} value={r.request_id}>
                  [{r.reference_no}] {r.customer_name} — {r.service_type} ({r.status})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold uppercase text-slate-600 mb-1">
              Assigned Technician *
            </label>
            <select
              required
              value={form.technician_id}
              onChange={(e) => setForm({ ...form, technician_id: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white font-semibold"
            >
              {technicians.map((t) => (
                <option key={t.user_id} value={t.user_id}>
                  {t.full_name} ({t.specialization || 'General HVAC'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold uppercase text-slate-600 mb-1">
              Scheduled Start *
            </label>
            <input
              type="datetime-local"
              required
              value={form.scheduled_start}
              onChange={(e) => setForm({ ...form, scheduled_start: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>

          <div>
            <label className="block font-bold uppercase text-slate-600 mb-1">
              Scheduled End *
            </label>
            <input
              type="datetime-local"
              required
              value={form.scheduled_end}
              onChange={(e) => setForm({ ...form, scheduled_end: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>
        </div>

        {/* Real-Time Conflict Warning Banner */}
        {conflictCheckResult?.has_conflict ? (
          <div className="p-4 rounded-xl bg-rose-50 border-2 border-rose-400 text-rose-900 flex items-start gap-3">
            <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-extrabold text-xs uppercase tracking-wider text-rose-700">
                Schedule Conflict Detected (HTTP 409 Guard Active)
              </div>
              <p className="mt-1">
                Selected technician is already booked on{' '}
                <strong className="font-mono">
                  {conflictCheckResult.conflicts[0].work_order_no}
                </strong>{' '}
                ({conflictCheckResult.conflicts[0].service_type} for{' '}
                {conflictCheckResult.conflicts[0].customer_name}) from{' '}
                <strong>{conflictCheckResult.conflicts[0].scheduled_start}</strong> to{' '}
                <strong>{conflictCheckResult.conflicts[0].scheduled_end}</strong>.
              </p>
            </div>
          </div>
        ) : (
          conflictCheckResult && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>No overlapping work orders found for this technician and time window.</span>
            </div>
          )
        )}

        <div className="flex items-center justify-between gap-4 pt-2">
          <input
            type="text"
            value={form.technician_remarks}
            onChange={(e) => setForm({ ...form, technician_remarks: e.target.value })}
            placeholder="Optional dispatch notes / gate instructions for technician..."
            className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300"
          />
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl bg-[#0284C7] hover:bg-sky-700 text-white font-bold shadow-sm shrink-0"
          >
            {submitting ? 'Dispatching...' : 'Dispatch Work Order'}
          </button>
        </div>
      </form>

      {/* Active & Historical Work Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="font-bold text-sm text-slate-900">
            Technician Dispatch Schedule & Work Order Queue
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th className="py-3.5 px-4 font-bold">Work Order No.</th>
                <th className="py-3.5 px-4 font-bold">Technician</th>
                <th className="py-3.5 px-4 font-bold">Scheduled Window</th>
                <th className="py-3.5 px-4 font-bold">Request & Customer</th>
                <th className="py-3.5 px-4 font-bold">Equipment QR</th>
                <th className="py-3.5 px-4 font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading dispatch schedule...
                  </td>
                </tr>
              ) : (
                workOrders.map((wo) => (
                  <tr key={wo.work_order_id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#0284C7]">
                      {wo.work_order_no}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-sky-600" />
                        {wo.technician_name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {wo.technician_specialization}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <div className="font-bold text-slate-900">Start: {wo.scheduled_start}</div>
                      <div className="text-slate-500">End: {wo.scheduled_end}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-slate-800">
                        {wo.request_reference_no} — {wo.service_type}
                      </div>
                      <div className="font-semibold text-slate-700">{wo.customer_name}</div>
                      <div className="text-slate-500 truncate max-w-xs">{wo.current_location}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      {wo.equipment_qr_token ? (
                        <div>
                          <span className="font-mono font-bold px-2 py-0.5 rounded bg-slate-100 border border-slate-300">
                            {wo.equipment_qr_token}
                          </span>
                          <div className="text-[11px] text-emerald-700 font-semibold mt-1">
                            Next PM: {wo.next_pm_date || 'N/A'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">New Installation</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={wo.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
