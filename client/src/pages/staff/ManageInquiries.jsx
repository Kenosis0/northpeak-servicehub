import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Wrench,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
  CreditCard
} from 'lucide-react';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

export default function ManageInquiries() {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [processForm, setProcessForm] = useState({
    inquiry_status: 'Stock Confirmed',
    payment_status: 'Downpayment Received',
    amount_paid: '',
    payment_type: 'Downpayment',
    payment_method: 'GCash / Maya Receipt',
    reference_receipt_no: '',
    staff_remarks: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const fetchInquiries = async () => {
    try {
      setLoading(true);
      const res = await api.get('/inquiries', {
        params: {
          inquiry_status: statusFilter || undefined,
          search: search || undefined
        }
      });
      setInquiries(res.data.inquiries || []);
    } catch (err) {
      console.error('Failed to fetch inquiries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
  }, [statusFilter]);

  const handleOpenProcessModal = (inq) => {
    setSelectedInquiry(inq);
    setProcessForm({
      inquiry_status: inq.inquiry_status === 'Pending Review' ? 'Stock Confirmed' : inq.inquiry_status,
      payment_status:
        inq.payment_status === 'Unpaid' ? 'Downpayment Received' : inq.payment_status,
      amount_paid: (Number(inq.total_amount) * 0.5).toFixed(2),
      payment_type: 'Downpayment',
      payment_method: 'GCash / Maya Receipt',
      reference_receipt_no: `OR-INQ-${Date.now().toString().slice(-6)}`,
      staff_remarks: inq.staff_remarks || 'Stock confirmed and offline payment verified.'
    });
  };

  const handleProcessSubmit = async (e) => {
    e.preventDefault();
    if (!selectedInquiry) return;
    setSubmitting(true);
    setFeedback({ type: '', message: '' });
    try {
      const res = await api.patch(`/inquiries/${selectedInquiry.inquiry_id}/process`, {
        ...processForm,
        amount_paid: processForm.amount_paid ? Number(processForm.amount_paid) : 0
      });
      setFeedback({
        type: 'success',
        message: res.data.message || 'Purchase inquiry processed successfully.'
      });
      setSelectedInquiry(null);
      fetchInquiries();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to process purchase inquiry.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">
            Aircon Purchase Inquiry Triage & Installation Handoff
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Confirm catalog stock, record offline downpayments/payments, and auto-generate linked Installation Service Requests (FR-005 / TC-005).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchInquiries()}
              placeholder="Search INQ ref, customer..."
              className="pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-semibold"
          >
            <option value="">All Statuses</option>
            <option value="Pending Review">Pending Review</option>
            <option value="Stock Confirmed">Stock Confirmed</option>
            <option value="Awaiting Payment">Awaiting Payment</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
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

      {/* Inquiries Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th className="py-3.5 px-4 font-bold">Inquiry Ref</th>
                <th className="py-3.5 px-4 font-bold">Customer</th>
                <th className="py-3.5 px-4 font-bold">Aircon Unit & Qty</th>
                <th className="py-3.5 px-4 font-bold">Total Amount</th>
                <th className="py-3.5 px-4 font-bold">Install Requested?</th>
                <th className="py-3.5 px-4 font-bold">Payment & Status</th>
                <th className="py-3.5 px-4 font-bold">Linked SR Handoff</th>
                <th className="py-3.5 px-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading inquiries...
                  </td>
                </tr>
              ) : inquiries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No purchase inquiries found.
                  </td>
                </tr>
              ) : (
                inquiries.map((inq) => (
                  <tr key={inq.inquiry_id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#0284C7]">
                      {inq.reference_no}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{inq.customer_name}</div>
                      {inq.customer_company && (
                        <div className="text-[11px] text-sky-700 font-medium">
                          {inq.customer_company}
                        </div>
                      )}
                      <div className="text-slate-500">{inq.customer_phone}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">
                        {inq.quantity}x {inq.brand} {inq.model_name}
                      </div>
                      <div className="text-slate-500">
                        {inq.horsepower} • {inq.ac_type} (Stock: {inq.current_catalog_stock})
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      ₱{Number(inq.total_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4">
                      {inq.request_installation ? (
                        <div>
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                            <Wrench className="w-3.5 h-3.5" /> Yes (With Install)
                          </span>
                          <div className="text-[11px] text-slate-500 max-w-xs truncate">
                            {inq.installation_address}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">Unit Only</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 space-y-1">
                      <div>
                        <StatusBadge status={inq.inquiry_status} />
                      </div>
                      <div>
                        <StatusBadge status={inq.payment_status} />
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {inq.linked_service_request_no ? (
                        <span className="font-mono font-bold px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 inline-block">
                          {inq.linked_service_request_no}
                        </span>
                      ) : inq.request_installation ? (
                        <span className="text-[11px] text-amber-700 font-semibold">
                          Auto-creates on confirm
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenProcessModal(inq)}
                        className="px-3 py-1.5 rounded-xl bg-[#0284C7] hover:bg-sky-700 text-white font-bold text-xs shadow-sm"
                      >
                        Process / Payment
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Process Inquiry & Auto-Installation Handoff Modal */}
      {selectedInquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="bg-[#0F172A] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-sm">
                  Process Inquiry {selectedInquiry.reference_no}
                </h3>
              </div>
              <button
                onClick={() => setSelectedInquiry(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProcessSubmit} className="p-6 space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900 text-sm">
                  {selectedInquiry.customer_name} — {selectedInquiry.quantity}x {selectedInquiry.brand}{' '}
                  {selectedInquiry.model_name}
                </div>
                <div className="text-slate-600">
                  Total Snapshot Amount:{' '}
                  <strong className="text-slate-900">
                    ₱{Number(selectedInquiry.total_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
                {Boolean(selectedInquiry.request_installation) && !selectedInquiry.linked_service_request_id && (
                  <div className="text-emerald-700 font-bold pt-1 flex items-center gap-1">
                    <Wrench className="w-3.5 h-3.5" />
                    Confirming this inquiry will automatically create a linked Installation Service Request (SR-...).
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Inquiry Status *
                  </label>
                  <select
                    value={processForm.inquiry_status}
                    onChange={(e) =>
                      setProcessForm({ ...processForm, inquiry_status: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                  >
                    <option value="Pending Review">Pending Review</option>
                    <option value="Stock Confirmed">Stock Confirmed</option>
                    <option value="Awaiting Payment">Awaiting Payment</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Offline Payment Status *
                  </label>
                  <select
                    value={processForm.payment_status}
                    onChange={(e) =>
                      setProcessForm({ ...processForm, payment_status: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                  >
                    <option value="Unpaid">Unpaid</option>
                    <option value="Downpayment Received">Downpayment Received</option>
                    <option value="Fully Paid">Fully Paid</option>
                  </select>
                </div>
              </div>

              {processForm.payment_status !== 'Unpaid' && (
                <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200 space-y-3">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-[#0284C7]" />
                    Offline Payment Verification Details
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Payment Method
                      </label>
                      <select
                        value={processForm.payment_method}
                        onChange={(e) =>
                          setProcessForm({ ...processForm, payment_method: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                      >
                        <option value="Cash">Cash</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="GCash / Maya Receipt">GCash / Maya Receipt</option>
                        <option value="Check">Check</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Amount Paid (PHP)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={processForm.amount_paid}
                        onChange={(e) =>
                          setProcessForm({ ...processForm, amount_paid: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Official Receipt / Reference No.
                    </label>
                    <input
                      type="text"
                      value={processForm.reference_receipt_no}
                      onChange={(e) =>
                        setProcessForm({ ...processForm, reference_receipt_no: e.target.value })
                      }
                      placeholder="e.g. GCASH-99281102 or OR-2026-0102"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold uppercase text-slate-600 mb-1">
                  Staff Remarks
                </label>
                <textarea
                  rows={2}
                  value={processForm.staff_remarks}
                  onChange={(e) =>
                    setProcessForm({ ...processForm, staff_remarks: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedInquiry(null)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-[#0284C7] hover:bg-sky-700 text-white font-bold shadow-sm"
                >
                  {submitting ? 'Processing...' : 'Confirm & Save Inquiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
