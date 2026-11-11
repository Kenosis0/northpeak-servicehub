import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Search,
  CreditCard,
  Plus,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRightLeft
} from 'lucide-react';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

export default function ManageServiceRequests() {
  const [requests, setRequests] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');

  // Payment Modal State
  const [paymentModalReq, setPaymentModalReq] = useState(null);
  const [payForm, setPayForm] = useState({
    payment_status: 'Downpayment Received',
    payment_type: 'Downpayment',
    payment_method: 'GCash / Maya Receipt',
    amount_paid: '1500.00',
    reference_receipt_no: ''
  });

  // Walk-in Request Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newReqForm, setNewReqForm] = useState({
    customer_id: '',
    service_type: 'Repair and Troubleshooting',
    issue_description: '',
    current_location: '',
    destination_location: '',
    preferred_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
    preferred_time_slot: 'Morning (8AM-12PM)',
    priority: 'Normal'
  });

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const [reqRes, custRes] = await Promise.all([
        api.get('/requests', {
          params: {
            status: statusFilter || undefined,
            service_type: typeFilter || undefined,
            search: search || undefined
          }
        }),
        api.get('/customers')
      ]);
      setRequests(reqRes.data.requests || []);
      setCustomers(custRes.data.customers || []);
    } catch (err) {
      console.error('Failed to load service requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [statusFilter, typeFilter]);

  const handleOpenPaymentModal = (sr) => {
    setPaymentModalReq(sr);
    const defaultAmt = sr.active_quotation_total
      ? (Number(sr.active_quotation_total) * 0.5).toFixed(2)
      : '1500.00';
    setPayForm({
      payment_status:
        sr.payment_status === 'Unpaid' ? 'Downpayment Received' : 'Fully Paid',
      payment_type:
        sr.payment_status === 'Unpaid' ? 'Downpayment' : 'Balance Settlement',
      payment_method: 'GCash / Maya Receipt',
      amount_paid: defaultAmt,
      reference_receipt_no: `OR-SR-${Date.now().toString().slice(-6)}`
    });
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!paymentModalReq) return;
    setSubmitting(true);
    setFeedback({ type: '', message: '' });
    try {
      const res = await api.patch(`/requests/${paymentModalReq.request_id}/payment`, {
        ...payForm,
        amount_paid: Number(payForm.amount_paid)
      });
      setFeedback({
        type: 'success',
        message: res.data.message || 'Offline payment recorded successfully.'
      });
      setPaymentModalReq(null);
      fetchRequests();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to record payment.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (sr, newStatus) => {
    setFeedback({ type: '', message: '' });
    try {
      const res = await api.patch(`/requests/${sr.request_id}/status`, {
        status: newStatus
      });
      setFeedback({
        type: 'success',
        message: res.data.message || `Status updated to ${newStatus}.`
      });
      fetchRequests();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to update status.'
      });
    }
  };

  const handleCreateWalkIn = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback({ type: '', message: '' });
    try {
      const res = await api.post('/requests', newReqForm);
      setFeedback({
        type: 'success',
        message: res.data.message || 'Service request created!'
      });
      setShowCreateModal(false);
      fetchRequests();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to create service request.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">
            Manage Multi-Type Service Requests & Offline Payments
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Triage Installation, Repair, PM/Cleaning, and Relocation tickets. Recording a downpayment locks quotation cancellation (TC-008).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchRequests()}
              placeholder="Search SR ref, customer..."
              className="pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-semibold"
          >
            <option value="">All Service Types</option>
            <option value="Installation">Installation</option>
            <option value="Repair and Troubleshooting">Repair and Troubleshooting</option>
            <option value="Preventive Maintenance and Cleaning">Preventive Maintenance and Cleaning</option>
            <option value="Relocation or Transfer">Relocation or Transfer</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-semibold"
          >
            <option value="">All Statuses</option>
            <option value="Submitted">Submitted</option>
            <option value="Under Review">Under Review</option>
            <option value="Quoted">Quoted</option>
            <option value="Approved">Approved</option>
            <option value="Scheduled">Scheduled</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-2 rounded-xl bg-[#0284C7] hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Walk-In Request
          </button>
        </div>
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

      {/* Requests Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th className="py-3.5 px-4 font-bold">Ref No.</th>
                <th className="py-3.5 px-4 font-bold">Customer</th>
                <th className="py-3.5 px-4 font-bold">Service Type & Scope</th>
                <th className="py-3.5 px-4 font-bold">Location(s)</th>
                <th className="py-3.5 px-4 font-bold">Active Quote</th>
                <th className="py-3.5 px-4 font-bold">Payment Status</th>
                <th className="py-3.5 px-4 font-bold">Ticket Status</th>
                <th className="py-3.5 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading service requests...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No service requests match the current filters.
                  </td>
                </tr>
              ) : (
                requests.map((sr) => (
                  <tr key={sr.request_id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-[#0284C7]">{sr.reference_no}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{sr.preferred_date}</div>
                      <StatusBadge status={sr.priority} className="mt-1" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{sr.customer_name}</div>
                      {sr.customer_company && (
                        <div className="text-[11px] text-sky-700 font-semibold">
                          {sr.customer_company}
                        </div>
                      )}
                      <div className="text-slate-500">{sr.customer_phone}</div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="font-bold text-slate-900">{sr.service_type}</div>
                      {sr.equipment_qr_token && (
                        <div className="font-mono text-[11px] text-slate-500">
                          [{sr.equipment_qr_token}] {sr.equipment_brand} {sr.equipment_model}
                        </div>
                      )}
                      <div className="text-slate-600 mt-1 line-clamp-2">{sr.issue_description}</div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="text-slate-800">{sr.current_location}</div>
                      {sr.destination_location && (
                        <div className="mt-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-900 font-medium">
                          → {sr.destination_location}
                        </div>
                      )}
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
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Unquoted</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={sr.payment_status} />
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        value={sr.status}
                        onChange={(e) => handleStatusChange(sr, e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                      >
                        <option value="Submitted">Submitted</option>
                        <option value="Under Review">Under Review</option>
                        <option value="Quoted">Quoted</option>
                        <option value="Approved">Approved</option>
                        <option value="Scheduled">Scheduled</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenPaymentModal(sr)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm inline-flex items-center gap-1"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        Record Payment
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Offline Payment Modal */}
      {paymentModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="bg-[#0F172A] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">
                  Record Offline Payment ({paymentModalReq.reference_no})
                </h3>
              </div>
              <button
                onClick={() => setPaymentModalReq(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-slate-900">{paymentModalReq.customer_name}</div>
                <div className="text-slate-600 mt-0.5">
                  {paymentModalReq.service_type} • Current Payment Status:{' '}
                  <strong>{paymentModalReq.payment_status}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Updated Payment Status *
                  </label>
                  <select
                    value={payForm.payment_status}
                    onChange={(e) => setPayForm({ ...payForm, payment_status: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                  >
                    <option value="Downpayment Received">Downpayment Received</option>
                    <option value="Fully Paid">Fully Paid</option>
                    <option value="Unpaid">Unpaid</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Payment Type *
                  </label>
                  <select
                    value={payForm.payment_type}
                    onChange={(e) => setPayForm({ ...payForm, payment_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                  >
                    <option value="Downpayment">Downpayment</option>
                    <option value="Full Payment">Full Payment</option>
                    <option value="Balance Settlement">Balance Settlement</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Payment Method *
                  </label>
                  <select
                    value={payForm.payment_method}
                    onChange={(e) => setPayForm({ ...payForm, payment_method: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="GCash / Maya Receipt">GCash / Maya Receipt</option>
                    <option value="Check">Check</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Amount Paid (PHP) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={payForm.amount_paid}
                    onChange={(e) => setPayForm({ ...payForm, amount_paid: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-600 mb-1">
                  Receipt / Reference Number *
                </label>
                <input
                  type="text"
                  required
                  value={payForm.reference_receipt_no}
                  onChange={(e) => setPayForm({ ...payForm, reference_receipt_no: e.target.value })}
                  placeholder="OR-NP-2026-XXXX or GCash Ref"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalReq(null)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-sm"
                >
                  {submitting ? 'Saving...' : 'Save Payment Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Walk-In Request Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="bg-[#0F172A] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">Log Walk-In / Phone Service Request</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWalkIn} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold uppercase text-slate-600 mb-1">Customer *</label>
                <select
                  required
                  value={newReqForm.customer_id}
                  onChange={(e) => {
                    const cust = customers.find((c) => String(c.customer_id) === e.target.value);
                    setNewReqForm({
                      ...newReqForm,
                      customer_id: e.target.value,
                      current_location: cust?.service_address || newReqForm.current_location
                    });
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="">-- Select Customer --</option>
                  {customers.map((c) => (
                    <option key={c.customer_id} value={c.customer_id}>
                      {c.full_name} {c.company_name ? `(${c.company_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Service Type *
                  </label>
                  <select
                    value={newReqForm.service_type}
                    onChange={(e) =>
                      setNewReqForm({ ...newReqForm, service_type: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                  >
                    <option value="Installation">Installation</option>
                    <option value="Repair and Troubleshooting">Repair and Troubleshooting</option>
                    <option value="Preventive Maintenance and Cleaning">Preventive Maintenance and Cleaning</option>
                    <option value="Relocation or Transfer">Relocation or Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">Priority *</label>
                  <select
                    value={newReqForm.priority}
                    onChange={(e) => setNewReqForm({ ...newReqForm, priority: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="Low">Low</option>
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-600 mb-1">
                  Current Location *
                </label>
                <input
                  type="text"
                  required
                  value={newReqForm.current_location}
                  onChange={(e) =>
                    setNewReqForm({ ...newReqForm, current_location: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              {newReqForm.service_type === 'Relocation or Transfer' && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-300">
                  <label className="block font-bold uppercase text-amber-900 mb-1 flex items-center gap-1">
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    Destination Location (Mandatory for Relocation) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newReqForm.destination_location}
                    onChange={(e) =>
                      setNewReqForm({ ...newReqForm, destination_location: e.target.value })
                    }
                    placeholder="Target transfer address / room"
                    className="w-full px-3 py-2 rounded-xl border border-amber-400 bg-white"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold uppercase text-slate-600 mb-1">
                  Issue / Scope Description *
                </label>
                <textarea
                  rows={2}
                  required
                  value={newReqForm.issue_description}
                  onChange={(e) =>
                    setNewReqForm({ ...newReqForm, issue_description: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-[#0284C7] hover:bg-sky-700 text-white font-bold"
                >
                  {submitting ? 'Creating...' : 'Create Service Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
