import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Wrench,
  CheckCircle2,
  AlertCircle,
  Camera,
  Calendar,
  Boxes,
  X
} from 'lucide-react';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

export default function WorkOrderExecution() {
  const [searchParams] = useSearchParams();
  const initialWoId = searchParams.get('wo');

  const [workOrders, setWorkOrders] = useState([]);
  const [selectedWoId, setSelectedWoId] = useState(initialWoId || '');
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    diagnosis_notes: '',
    work_performed: '',
    technician_remarks: '',
    parts_replaced_summary: ''
  });
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [completionResult, setCompletionResult] = useState(null);

  const fetchWorkOrders = async () => {
    try {
      setLoading(true);
      const res = await api.get('/work-orders');
      const list = res.data.work_orders || [];
      setWorkOrders(list);

      if (!selectedWoId && list.length > 0) {
        const active = list.find((w) => w.status !== 'Completed' && w.status !== 'Cancelled');
        setSelectedWoId(String(active ? active.work_order_id : list[0].work_order_id));
      }
    } catch (err) {
      console.error('Failed to load work orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  const selectedWo = workOrders.find((w) => String(w.work_order_id) === String(selectedWoId));

  const handleCompleteSubmit = async (e) => {
    e.preventDefault();
    if (!selectedWo) return;

    setSubmitting(true);
    setFeedback({ type: '', message: '' });
    setCompletionResult(null);

    try {
      const formData = new FormData();
      formData.append('diagnosis_notes', form.diagnosis_notes);
      formData.append('work_performed', form.work_performed);
      formData.append('technician_remarks', form.technician_remarks);
      if (form.parts_replaced_summary) {
        formData.append('parts_replaced_summary', form.parts_replaced_summary);
      }
      if (evidenceFile) {
        formData.append('evidence_photo', evidenceFile);
      }

      const res = await api.patch(`/work-orders/${selectedWo.work_order_id}/complete`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setFeedback({
        type: 'success',
        message: res.data.message || 'Work order completed and next PM date calculated!'
      });
      setCompletionResult(res.data);
      fetchWorkOrders();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to complete work order.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">
          Work Order Field Execution & Auto-PM Date Calculation
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Log field diagnosis, actions taken, technician remarks, and diagnostic evidence photo. Completing a work order atomically records service history, consumes reserved parts, and computes the next Preventive Maintenance date (FR-008 / TC-010 / TC-011).
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
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback({ type: '', message: '' })}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Auto-PM Calculation Result Banner */}
      {completionResult && (
        <div className="p-5 rounded-2xl bg-emerald-950 text-white border border-emerald-500/50 shadow-lg space-y-2 text-xs">
          <div className="flex items-center gap-2 font-extrabold text-sm text-emerald-400">
            <Calendar className="w-5 h-5" />
            ACID Transaction Completed: Service History & Preventive Maintenance Updated!
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-slate-400 uppercase font-bold text-[10px]">Equipment QR Tag</div>
              <div className="font-mono font-bold text-sm text-sky-300 mt-0.5">
                {completionResult.equipment?.qr_token}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-slate-400 uppercase font-bold text-[10px]">Last Service Date</div>
              <div className="font-mono font-bold text-sm text-white mt-0.5">
                {completionResult.equipment?.last_service_date}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-emerald-900/60 border border-emerald-500/40">
              <div className="text-emerald-300 uppercase font-bold text-[10px]">
                Computed Next PM Due Date (+{completionResult.equipment?.maintenance_interval_months} Mos)
              </div>
              <div className="font-mono font-extrabold text-base text-emerald-300 mt-0.5">
                {completionResult.equipment?.next_pm_date}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Work Order Selector */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <label className="block text-xs font-bold uppercase text-slate-600 mb-2">
          Select Work Order to Execute / Inspect
        </label>
        <select
          value={selectedWoId}
          onChange={(e) => {
            setSelectedWoId(e.target.value);
            setCompletionResult(null);
          }}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
        >
          {workOrders.map((wo) => (
            <option key={wo.work_order_id} value={wo.work_order_id}>
              [{wo.work_order_no}] {wo.status} — {wo.service_type} for {wo.customer_name} (Scheduled: {wo.scheduled_start})
            </option>
          ))}
        </select>
      </div>

      {selectedWo && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Work Order & Linked Parts Summary */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="font-mono font-extrabold text-base text-[#0284C7]">
                  {selectedWo.work_order_no}
                </span>
                <StatusBadge status={selectedWo.status} />
              </div>

              <div>
                <div className="text-slate-400 uppercase font-bold text-[10px]">Service Request</div>
                <div className="font-bold text-slate-900">
                  {selectedWo.request_reference_no} — {selectedWo.service_type}
                </div>
                <div className="text-slate-600 mt-1">{selectedWo.issue_description}</div>
              </div>

              <div>
                <div className="text-slate-400 uppercase font-bold text-[10px]">Customer & Site</div>
                <div className="font-bold text-slate-900">{selectedWo.customer_name}</div>
                <div className="text-slate-600">{selectedWo.current_location}</div>
              </div>

              {selectedWo.equipment_qr_token && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-mono font-bold text-sky-700">
                    {selectedWo.equipment_qr_token}
                  </div>
                  <div className="font-bold text-slate-900">
                    {selectedWo.equipment_brand} {selectedWo.equipment_model} ({selectedWo.equipment_hp})
                  </div>
                  <div className="text-slate-500 mt-0.5">
                    PM Interval: Every {selectedWo.maintenance_interval_months || 6} Months
                  </div>
                </div>
              )}

              {/* Linked Warehouse Parts */}
              <div className="pt-2 border-t border-slate-100">
                <div className="font-bold text-slate-700 flex items-center gap-1.5 mb-2">
                  <Boxes className="w-4 h-4 text-sky-600" />
                  Linked Warehouse Parts ({selectedWo.inventory_transactions?.length || 0})
                </div>
                {(!selectedWo.inventory_transactions ||
                  selectedWo.inventory_transactions.length === 0) ? (
                  <div className="text-slate-400 italic">
                    No spare parts reserved or issued for this work order.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {selectedWo.inventory_transactions.map((tx) => (
                      <div
                        key={tx.transaction_id}
                        className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-slate-800">{tx.part_name}</span>
                          <div className="text-[10px] font-mono text-slate-500">{tx.sku_code}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold">
                            {tx.quantity} {tx.unit_of_measure}
                          </span>
                          <StatusBadge status={tx.tx_type} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Execution & Completion Form */}
          <div className="lg:col-span-7">
            {selectedWo.status === 'Completed' ? (
              <div className="bg-white rounded-2xl border border-emerald-300 shadow-sm p-6 space-y-4 text-xs">
                <div className="flex items-center gap-2 text-emerald-700 font-extrabold text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  Work Order Completed on {selectedWo.completed_at}
                </div>
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="font-bold text-slate-500 uppercase text-[10px]">
                      Field Diagnosis Notes
                    </div>
                    <div className="text-slate-900 mt-1">{selectedWo.diagnosis_notes}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="font-bold text-slate-500 uppercase text-[10px]">
                      Work Performed / Actions Taken
                    </div>
                    <div className="text-slate-900 mt-1">{selectedWo.work_performed}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="font-bold text-slate-500 uppercase text-[10px]">
                      Technician Remarks
                    </div>
                    <div className="text-slate-900 mt-1">{selectedWo.technician_remarks}</div>
                  </div>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleCompleteSubmit}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 text-xs"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-emerald-600" />
                    Field Completion & Auto-PM Calculation Form
                  </h2>
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        diagnosis_notes:
                          'Confirmed failed 45+5 uF dual run capacitor and low R32 suction pressure (65 PSI).',
                        work_performed:
                          'Replaced dual run capacitor, leak-tested flare joints, recharged 3 lbs R32 refrigerant to 125 PSI operating pressure, and cleaned condenser coil.',
                        technician_remarks:
                          'Compressor amp draw stabilized at 5.8A; supply air temperature at 11°C. Unit operating normally.',
                        parts_replaced_summary: ''
                      })
                    }
                    className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-[#0284C7] border border-sky-200 font-semibold text-[11px]"
                  >
                    Auto-Fill Sample Field Report
                  </button>
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Diagnostic Findings / Root Cause Notes *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={form.diagnosis_notes}
                    onChange={(e) => setForm({ ...form, diagnosis_notes: e.target.value })}
                    placeholder="Enter technical diagnostic measurements (amp draw, pressures, fault codes, coil condition)..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Work Performed / Actions Taken *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={form.work_performed}
                    onChange={(e) => setForm({ ...form, work_performed: e.target.value })}
                    placeholder="Detail the exact repair, cleaning, installation, or relocation procedures performed..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Technician Final Remarks & Recommendations *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={form.technician_remarks}
                    onChange={(e) => setForm({ ...form, technician_remarks: e.target.value })}
                    placeholder="Post-service performance verification and maintenance recommendations..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-sky-600" />
                    Diagnostic / Completion Evidence Photo (JPG/PNG ≤ 5MB)
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-xs"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {submitting
                      ? 'Completing & Updating PM Schedule...'
                      : 'Complete Work Order & Auto-Compute Next PM'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
