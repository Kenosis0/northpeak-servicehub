import React, { useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle2,
  RotateCcw,
  XCircle,
  Lock,
  History,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

export default function MyQuotations() {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revisionModalQuote, setRevisionModalQuote] = useState(null);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [submittingId, setSubmittingId] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [showSuperseded, setShowSuperseded] = useState(false);

  const fetchQuotations = async () => {
    try {
      setLoading(true);
      const res = await api.get('/quotations');
      setQuotations(res.data.quotations || []);
    } catch (err) {
      console.error('Failed to fetch customer quotations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, []);

  const handleDecision = async (quotation, decision, notes = null) => {
    setFeedback({ type: '', message: '' });
    setSubmittingId(quotation.quotation_id);
    try {
      const res = await api.post(`/quotations/${quotation.quotation_id}/decision`, {
        decision,
        customer_decision_notes: notes
      });
      setFeedback({
        type: 'success',
        message: res.data.message || `Quotation decision (${decision}) recorded.`
      });
      setRevisionModalQuote(null);
      setRevisionNotes('');
      fetchQuotations();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to process quotation decision.'
      });
    } finally {
      setSubmittingId(null);
    }
  };

  const activeQuotations = quotations.filter((q) => q.status !== 'Superseded');
  const supersededQuotations = quotations.filter((q) => q.status === 'Superseded');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">
            My Service Quotations & Revision Decisions
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Review itemized labor & parts breakdowns. Once a downpayment is recorded, cancellation is locked and changes follow the Quotation Revision workflow (FR-007).
          </p>
        </div>

        {supersededQuotations.length > 0 && (
          <button
            onClick={() => setShowSuperseded(!showSuperseded)}
            className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 self-start"
          >
            <History className="w-4 h-4 text-slate-500" />
            {showSuperseded ? 'Hide' : 'Show'} Superseded Revisions ({supersededQuotations.length})
            {showSuperseded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {feedback.message && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-rose-50 border-rose-300 text-rose-800'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{feedback.message}</span>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400">Loading quotations...</div>
      ) : activeQuotations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-400">
          No quotations available for your account yet.
        </div>
      ) : (
        <div className="space-y-5">
          {activeQuotations.map((q) => {
            const isLocked = q.payment_status !== 'Unpaid';
            return (
              <div
                key={q.quotation_id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Card Header */}
                <div className="px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <FileText className="w-5 h-5 text-sky-400" />
                    <span className="font-mono font-extrabold text-base">{q.quotation_no}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-500/20 text-sky-300 border border-sky-400/40">
                      Rev {q.revision_no}
                    </span>
                    <StatusBadge status={q.quote_stage} />
                    <StatusBadge status={q.status} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-300">
                      Service Request: <strong className="font-mono text-white">{q.request_reference_no}</strong>
                    </span>
                    <StatusBadge status={q.payment_status} />
                  </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                    <div>
                      <strong>Service Type:</strong> {q.service_type} — {q.issue_description}
                    </div>
                    <div>
                      <strong>Valid Until:</strong> {q.valid_until}
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                          <th className="py-2.5 px-4 font-bold">Item Type</th>
                          <th className="py-2.5 px-4 font-bold">Description</th>
                          <th className="py-2.5 px-4 font-bold text-right">Qty</th>
                          <th className="py-2.5 px-4 font-bold text-right">Quoted Unit Price</th>
                          <th className="py-2.5 px-4 font-bold text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(q.items || []).map((item) => (
                          <tr key={item.quotation_item_id}>
                            <td className="py-2.5 px-4 font-semibold text-slate-700">
                              {item.item_type}
                            </td>
                            <td className="py-2.5 px-4 text-slate-900">{item.description}</td>
                            <td className="py-2.5 px-4 text-right font-mono">{item.quantity}</td>
                            <td className="py-2.5 px-4 text-right font-mono">
                              ₱{Number(item.quoted_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                              ₱{Number(item.subtotal).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Cost Summary & Downpayment Lock Notice */}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-2">
                    <div className="space-y-1">
                      {isLocked ? (
                        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                          <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>
                            Downpayment recorded ({q.payment_status}) — Cancellation is locked. You may request a quotation revision if scope changes.
                          </span>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">
                          Required Downpayment upon approval:{' '}
                          <strong className="text-slate-800">
                            ₱{Number(q.downpayment_required).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                      )}
                      {q.customer_decision_notes && (
                        <div className="text-xs text-slate-600 italic">
                          Decision Notes: "{q.customer_decision_notes}"
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-6 self-end">
                      <div className="text-right text-xs text-slate-500">
                        <div>Labor: ₱{Number(q.labor_cost).toLocaleString()}</div>
                        <div>Parts/Materials: ₱{Number(q.parts_total).toLocaleString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-bold text-slate-400">
                          Total Quoted Amount
                        </div>
                        <div className="text-xl font-extrabold text-slate-900">
                          ₱{Number(q.total_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons (TC-007 & TC-008) */}
                  {q.status !== 'Rejected/Cancelled' && q.request_status !== 'Completed' && (
                    <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2.5">
                      {q.status !== 'Approved' && (
                        <button
                          onClick={() => handleDecision(q, 'Approve')}
                          disabled={submittingId === q.quotation_id}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Approve Quotation
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setRevisionModalQuote(q);
                          setRevisionNotes('');
                        }}
                        disabled={submittingId === q.quotation_id}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Request Revision
                      </button>

                      <button
                        onClick={() => handleDecision(q, 'Cancel')}
                        disabled={isLocked || submittingId === q.quotation_id}
                        title={
                          isLocked
                            ? 'Downpayment recorded — Cancellation locked. You may request a quotation revision.'
                            : 'Cancel this quotation and service request'
                        }
                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                          isLocked
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                            : 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                        }`}
                      >
                        {isLocked ? <Lock className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        {isLocked ? 'Cancel Locked (Post-Downpayment)' : 'Cancel / Reject Request'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Superseded Revisions Section */}
      {showSuperseded && supersededQuotations.length > 0 && (
        <div className="bg-slate-100 rounded-2xl border border-slate-300 p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <History className="w-4 h-4" />
            Superseded Historical Quotation Revisions
          </h3>
          <div className="space-y-2">
            {supersededQuotations.map((sq) => (
              <div
                key={sq.quotation_id}
                className="bg-white rounded-xl p-4 border border-slate-200 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-mono font-bold text-slate-700">{sq.quotation_no}</span>
                  <span className="ml-2 px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold">
                    Rev {sq.revision_no}
                  </span>
                  <span className="ml-3 text-slate-500">
                    For Request: <strong>{sq.request_reference_no}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-700">
                    ₱{Number(sq.total_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                  <StatusBadge status={sq.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request Revision Modal */}
      {revisionModalQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-base text-slate-900">
              Request Revision for {revisionModalQuote.quotation_no} (Rev {revisionModalQuote.revision_no})
            </h3>
            <p className="text-xs text-slate-600">
              Specify the scope or pricing adjustments you would like Service Staff to revise in Revision #{Number(revisionModalQuote.revision_no) + 1}:
            </p>
            <textarea
              rows={3}
              required
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              placeholder="e.g., Please include copper tube extension or adjust capacitor quantity..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRevisionModalQuote(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handleDecision(
                    revisionModalQuote,
                    'Request Revision',
                    revisionNotes || 'Customer requested scope/price revision'
                  )
                }
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold"
              >
                Submit Revision Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
