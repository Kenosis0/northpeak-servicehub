import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Plus,
  MapPin,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/StatusBadge';

const SERVICE_TYPES = [
  'Installation',
  'Repair and Troubleshooting',
  'Preventive Maintenance and Cleaning',
  'Relocation or Transfer'
];

export default function MyServiceRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [equipmentList, setEquipmentList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    service_type: 'Preventive Maintenance and Cleaning',
    equipment_id: '',
    issue_description: '',
    current_location: user?.service_address || '',
    destination_location: '',
    preferred_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
    preferred_time_slot: 'Morning (8AM-12PM)',
    priority: 'Normal'
  });

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [reqRes, eqRes] = await Promise.all([
        api.get('/requests'),
        api.get('/equipment')
      ]);
      setRequests(reqRes.data.requests || []);
      setEquipmentList(eqRes.data.equipment || []);
    } catch (err) {
      console.error('Failed to load customer service requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });

    // Client-side validation for Relocation or Transfer (TC-006)
    if (
      form.service_type === 'Relocation or Transfer' &&
      (!form.destination_location || !form.destination_location.trim())
    ) {
      setFeedback({
        type: 'error',
        message: "Destination Location is strictly required when selecting 'Relocation or Transfer'."
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/requests', {
        ...form,
        equipment_id: form.equipment_id ? Number(form.equipment_id) : null,
        destination_location:
          form.service_type === 'Relocation or Transfer' ? form.destination_location : null
      });
      setFeedback({
        type: 'success',
        message: res.data.message || 'Service request submitted!'
      });
      setShowForm(false);
      setForm({
        service_type: 'Preventive Maintenance and Cleaning',
        equipment_id: '',
        issue_description: '',
        current_location: user?.service_address || '',
        destination_location: '',
        preferred_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
        preferred_time_slot: 'Morning (8AM-12PM)',
        priority: 'Normal'
      });
      fetchData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to submit service request.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">My Aircon Service Requests</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Book Installation, Repair & Troubleshooting, Preventive Maintenance & Cleaning, or Unit Relocation/Transfer (FR-006).
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2.5 rounded-xl bg-[#0284C7] hover:bg-sky-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 self-start"
        >
          <Plus className="w-4 h-4" />
          {showForm ? 'Hide Booking Form' : 'New Service Request'}
        </button>
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

      {/* Multi-Type Service Request Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-sky-200 shadow-md p-6 space-y-4"
        >
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[#0284C7]" />
              Submit New Service Request
            </h2>
            <span className="text-[11px] text-slate-500">All fields marked * are required</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                Service Type *
              </label>
              <select
                value={form.service_type}
                onChange={(e) => setForm({ ...form, service_type: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
              >
                {SERVICE_TYPES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                Registered AC Unit (Optional for Installation)
              </label>
              <select
                value={form.equipment_id}
                onChange={(e) => setForm({ ...form, equipment_id: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white"
              >
                <option value="">-- Select Registered Unit (or Unlisted) --</option>
                {equipmentList.map((eq) => (
                  <option key={eq.equipment_id} value={eq.equipment_id}>
                    [{eq.qr_token}] {eq.brand} {eq.model} ({eq.installed_location})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                Urgency / Priority *
              </label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white"
              >
                <option value="Low">Low</option>
                <option value="Normal">Normal</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-sky-600" />
                Current Unit / Service Location *
              </label>
              <input
                type="text"
                required
                value={form.current_location}
                onChange={(e) => setForm({ ...form, current_location: e.target.value })}
                placeholder="Complete current address / room location of AC unit"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            {/* Dynamic Destination Location for Relocation or Transfer (TC-006) */}
            {form.service_type === 'Relocation or Transfer' ? (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-300">
                <label className="block text-xs font-bold uppercase text-amber-900 mb-1 flex items-center gap-1">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600" />
                  Destination Location (Mandatory for Relocation/Transfer) *
                </label>
                <input
                  type="text"
                  required
                  value={form.destination_location}
                  onChange={(e) => setForm({ ...form, destination_location: e.target.value })}
                  placeholder="New target address or room where AC unit will be transferred"
                  className="w-full px-3.5 py-2 rounded-xl border border-amber-400 text-xs bg-white"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Preferred Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.preferred_date}
                    onChange={(e) => setForm({ ...form, preferred_date: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Time Slot *
                  </label>
                  <select
                    value={form.preferred_time_slot}
                    onChange={(e) => setForm({ ...form, preferred_time_slot: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs bg-white"
                  >
                    <option value="Morning (8AM-12PM)">Morning (8AM-12PM)</option>
                    <option value="Afternoon (1PM-5PM)">Afternoon (1PM-5PM)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {form.service_type === 'Relocation or Transfer' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Preferred Relocation Date *
                </label>
                <input
                  type="date"
                  required
                  value={form.preferred_date}
                  onChange={(e) => setForm({ ...form, preferred_date: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Preferred Time Slot *
                </label>
                <select
                  value={form.preferred_time_slot}
                  onChange={(e) => setForm({ ...form, preferred_time_slot: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white"
                >
                  <option value="Morning (8AM-12PM)">Morning (8AM-12PM)</option>
                  <option value="Afternoon (1PM-5PM)">Afternoon (1PM-5PM)</option>
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
              Issue Description / Scope Instructions *
            </label>
            <textarea
              rows={3}
              required
              value={form.issue_description}
              onChange={(e) => setForm({ ...form, issue_description: e.target.value })}
              placeholder="Describe the aircon issue, symptoms, cleaning requirements, or relocation details..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-[#0284C7] hover:bg-sky-700 text-white text-xs font-bold shadow-sm"
            >
              {submitting ? 'Submitting...' : 'Submit Service Request'}
            </button>
          </div>
        </form>
      )}

      {/* Service Requests Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th className="py-3.5 px-4 font-bold">Ref No.</th>
                <th className="py-3.5 px-4 font-bold">Service Type & Unit</th>
                <th className="py-3.5 px-4 font-bold">Location(s)</th>
                <th className="py-3.5 px-4 font-bold">Preferred Schedule</th>
                <th className="py-3.5 px-4 font-bold">Quotation</th>
                <th className="py-3.5 px-4 font-bold">Payment</th>
                <th className="py-3.5 px-4 font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No service requests found. Click "New Service Request" above to book one.
                  </td>
                </tr>
              ) : (
                requests.map((sr) => (
                  <tr key={sr.request_id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-[#0284C7]">{sr.reference_no}</div>
                      <div className="mt-1">
                        <StatusBadge status={sr.priority} />
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{sr.service_type}</div>
                      {sr.equipment_qr_token && (
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          [{sr.equipment_qr_token}] {sr.equipment_brand} {sr.equipment_model}
                        </div>
                      )}
                      <div className="text-slate-600 mt-1 max-w-xs">{sr.issue_description}</div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="text-slate-800">
                        <span className="font-semibold text-slate-500">Current:</span>{' '}
                        {sr.current_location}
                      </div>
                      {sr.destination_location && (
                        <div className="text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">
                          <span className="font-bold">Transfer To:</span> {sr.destination_location}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{sr.preferred_date}</div>
                      <div className="text-slate-500">{sr.preferred_time_slot}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      {sr.active_quotation_no ? (
                        <div>
                          <div className="font-mono font-bold text-slate-900">
                            {sr.active_quotation_no} (Rev {sr.active_quotation_revision})
                          </div>
                          <div className="font-bold text-emerald-700">
                            ₱{Number(sr.active_quotation_total).toLocaleString()}
                          </div>
                          <StatusBadge status={sr.active_quotation_status} className="mt-0.5" />
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Pending Quote</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={sr.payment_status} />
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={sr.status} />
                      {sr.latest_work_order_no && (
                        <div className="text-[10px] font-mono text-slate-500 mt-1">
                          WO: {sr.latest_work_order_no}
                        </div>
                      )}
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
