import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  RotateCcw,
  Lock,
  CheckCircle2,
  AlertCircle,
  X,
  History
} from 'lucide-react';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

export default function QuotationBuilder() {
  const [quotations, setQuotations] = useState([]);
  const [requests, setRequests] = useState([]);
  const [spareParts, setSpareParts] = useState([]);
  const [catalogUnits, setCatalogUnits] = useState([]);
  const [loading, setLoading] = useState(true);

  // Builder Mode: 'create' or 'revise'
  const [mode, setMode] = useState(null);
  const [targetQuoteForRevision, setTargetQuoteForRevision] = useState(null);

  const [requestId, setRequestId] = useState('');
  const [quoteStage, setQuoteStage] = useState('Finalized');
  const [downpaymentRequired, setDownpaymentRequired] = useState('');
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
  );
  const [items, setItems] = useState([
    { item_type: 'Labor/Service', description: 'Standard HVAC Diagnostic & Service Labor', quantity: 1, quoted_price: 1500 }
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [qRes, reqRes, invRes, prodRes] = await Promise.all([
        api.get('/quotations'),
        api.get('/requests'),
        api.get('/inventory'),
        api.get('/products')
      ]);
      setQuotations(qRes.data.quotations || []);
      setRequests(reqRes.data.requests || []);
      setSpareParts(invRes.data.items || []);
      setCatalogUnits(prodRes.data.products || []);
    } catch (err) {
      console.error('Failed to load quotation builder data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const computedTotal = items.reduce(
    (sum, item) => sum + Number(item.quantity || 1) * Number(item.quoted_price || 0),
    0
  );

  const handleOpenCreate = () => {
    setMode('create');
    setTargetQuoteForRevision(null);
    setRequestId(requests[0]?.request_id || '');
    setQuoteStage('Finalized');
    setItems([
      {
        item_type: 'Labor/Service',
        description: 'Standard HVAC Service & Technical Labor',
        quantity: 1,
        quoted_price: 1800
      }
    ]);
    setDownpaymentRequired('1000');
  };

  const handleOpenRevise = (quote) => {
    setMode('revise');
    setTargetQuoteForRevision(quote);
    setRequestId(quote.request_id);
    setQuoteStage('Finalized');
    setValidUntil(quote.valid_until || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]);
    setDownpaymentRequired(String(quote.downpayment_required || '1500'));
    setItems(
      (quote.items || []).map((i) => ({
        item_type: i.item_type,
        description: i.description,
        quantity: i.quantity,
        quoted_price: i.quoted_price
      }))
    );
  };

  const handleAddLineItem = () => {
    setItems([
      ...items,
      { item_type: 'Spare Part', description: '', quantity: 1, quoted_price: 0 }
    ]);
  };

  const handleQuickAddSparePart = (partId) => {
    const part = spareParts.find((p) => String(p.item_id) === String(partId));
    if (!part) return;
    setItems([
      ...items,
      {
        item_type: 'Spare Part',
        description: `${part.part_name} (${part.sku_code})`,
        quantity: 1,
        quoted_price: Number(part.unit_price)
      }
    ]);
  };

  const handleQuickAddAircon = (prodId) => {
    const prod = catalogUnits.find((p) => String(p.product_id) === String(prodId));
    if (!prod) return;
    setItems([
      ...items,
      {
        item_type: 'Aircon Unit',
        description: `${prod.brand} ${prod.model_name} (${prod.horsepower} ${prod.ac_type})`,
        quantity: 1,
        quoted_price: Number(prod.unit_price)
      }
    ]);
  };

  const handleItemChange = (idx, field, value) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveItem = (idx) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmitQuote = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback({ type: '', message: '' });

    try {
      if (mode === 'revise' && targetQuoteForRevision) {
        const res = await api.post(`/quotations/${targetQuoteForRevision.quotation_id}/revise`, {
          quote_stage: quoteStage,
          items,
          downpayment_required: Number(downpaymentRequired || computedTotal * 0.5),
          valid_until: validUntil
        });
        setFeedback({
          type: 'success',
          message: res.data.message || 'Quotation revision created!'
        });
      } else {
        const res = await api.post('/quotations', {
          request_id: Number(requestId),
          quote_stage: quoteStage,
          items,
          downpayment_required: Number(downpaymentRequired || computedTotal * 0.5),
          valid_until: validUntil
        });
        setFeedback({
          type: 'success',
          message: res.data.message || 'Quotation created!'
        });
      }
      setMode(null);
      setTargetQuoteForRevision(null);
      fetchAll();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to save quotation.'
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
          <h1 className="text-xl font-extrabold text-slate-900">
            Quotation Builder, Price Snapshots & Revision Manager
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create Temporary or Finalized quotes with immutable price snapshots, or issue Revision + 1 when post-downpayment scope changes (FR-007 / TC-008).
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 rounded-xl bg-[#0284C7] hover:bg-sky-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 self-start"
        >
          <Plus className="w-4 h-4" />
          Build New Quotation
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

      {/* Quotation Builder / Revision Form */}
      {mode && (
        <form
          onSubmit={handleSubmitQuote}
          className="bg-white rounded-2xl border-2 border-sky-400 shadow-lg p-6 space-y-5 text-xs"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-600">
                {mode === 'revise' ? 'Quotation Revision Loop (TC-008)' : 'New Quotation'}
              </span>
              <h2 className="text-base font-extrabold text-slate-900">
                {mode === 'revise'
                  ? `Issue Revision #${Number(targetQuoteForRevision?.revision_no) + 1} (Superseding ${targetQuoteForRevision?.quotation_no})`
                  : 'Create Service Quotation'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setMode(null)}
              className="text-slate-400 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block font-bold uppercase text-slate-600 mb-1">
                Linked Service Request *
              </label>
              <select
                required
                disabled={mode === 'revise'}
                value={requestId}
                onChange={(e) => setRequestId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold disabled:bg-slate-100"
              >
                <option value="">-- Select Service Request --</option>
                {requests.map((r) => (
                  <option key={r.request_id} value={r.request_id}>
                    [{r.reference_no}] {r.customer_name} — {r.service_type} ({r.payment_status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold uppercase text-slate-600 mb-1">
                Quotation Stage *
              </label>
              <select
                value={quoteStage}
                onChange={(e) => setQuoteStage(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
              >
                <option value="Temporary">Temporary (Initial Estimate)</option>
                <option value="Finalized">Finalized (Official Quote)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold uppercase text-slate-600 mb-1">Valid Until *</label>
              <input
                type="date"
                required
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>
          </div>

          {/* Quick Catalog / Spare Part Picker */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-3">
            <span className="font-bold text-slate-700">Quick-Add Snapshot Item:</span>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleQuickAddSparePart(e.target.value);
                  e.target.value = '';
                }
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
            >
              <option value="">+ Insert Spare Part from Warehouse...</option>
              {spareParts.map((sp) => (
                <option key={sp.item_id} value={sp.item_id}>
                  {sp.part_name} — ₱{Number(sp.unit_price).toLocaleString()} (Avail: {sp.available_stock})
                </option>
              ))}
            </select>

            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleQuickAddAircon(e.target.value);
                  e.target.value = '';
                }
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
            >
              <option value="">+ Insert Aircon Unit from Catalog...</option>
              {catalogUnits.map((cu) => (
                <option key={cu.product_id} value={cu.product_id}>
                  {cu.brand} {cu.model_name} ({cu.horsepower}) — ₱{Number(cu.unit_price).toLocaleString()}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleAddLineItem}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold"
            >
              + Custom Line Item
            </button>
          </div>

          {/* Line Items Editor */}
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-slate-50/70 p-2.5 rounded-xl border border-slate-200"
              >
                <div className="sm:col-span-3">
                  <select
                    value={item.item_type}
                    onChange={(e) => handleItemChange(idx, 'item_type', e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                  >
                    <option value="Labor/Service">Labor/Service</option>
                    <option value="Spare Part">Spare Part</option>
                    <option value="Aircon Unit">Aircon Unit</option>
                    <option value="Material/Fee">Material/Fee</option>
                  </select>
                </div>
                <div className="sm:col-span-5">
                  <input
                    type="text"
                    required
                    value={item.description}
                    onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                    placeholder="Item description"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div className="sm:col-span-1">
                  <input
                    type="number"
                    min={1}
                    required
                    value={item.quantity}
                    onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                    className="w-full px-2 py-2 rounded-lg border border-slate-300 bg-white text-center"
                  />
                </div>
                <div className="sm:col-span-2">
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={item.quoted_price}
                    onChange={(e) => handleItemChange(idx, 'quoted_price', e.target.value)}
                    placeholder="Unit Price"
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-right font-mono"
                  />
                </div>
                <div className="sm:col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-3 border-t border-slate-200">
            <div className="flex items-center gap-3">
              <label className="font-bold text-slate-700">Required Downpayment (PHP):</label>
              <input
                type="number"
                step="0.01"
                value={downpaymentRequired}
                onChange={(e) => setDownpaymentRequired(e.target.value)}
                className="w-36 px-3 py-1.5 rounded-lg border border-slate-300 font-mono"
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-slate-500">Computed Total:</span>{' '}
                <strong className="text-lg font-extrabold text-slate-900">
                  ₱{computedTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </strong>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-[#0284C7] hover:bg-sky-700 text-white font-bold shadow-sm"
              >
                {submitting
                  ? 'Saving...'
                  : mode === 'revise'
                  ? `Publish Revision #${Number(targetQuoteForRevision?.revision_no) + 1}`
                  : 'Publish Quotation'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Quotations List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th className="py-3.5 px-4 font-bold">Quotation No.</th>
                <th className="py-3.5 px-4 font-bold">Revision & Lineage</th>
                <th className="py-3.5 px-4 font-bold">Request & Customer</th>
                <th className="py-3.5 px-4 font-bold">Breakdown</th>
                <th className="py-3.5 px-4 font-bold">Payment Lock</th>
                <th className="py-3.5 px-4 font-bold">Quote Status</th>
                <th className="py-3.5 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading quotations...
                  </td>
                </tr>
              ) : quotations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No quotations created yet.
                  </td>
                </tr>
              ) : (
                quotations.map((q) => (
                  <tr
                    key={q.quotation_id}
                    className={
                      q.status === 'Superseded' ? 'bg-slate-50/70 opacity-75' : 'hover:bg-slate-50/80'
                    }
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-[#0284C7]">{q.quotation_no}</div>
                      <StatusBadge status={q.quote_stage} className="mt-1" />
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full font-bold bg-sky-100 text-sky-900 border border-sky-300">
                        Rev {q.revision_no}
                      </span>
                      {q.parent_quotation_no && (
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                          <History className="w-3 h-3" /> Parent: {q.parent_quotation_no}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-slate-800">
                        {q.request_reference_no}
                      </div>
                      <div className="font-semibold text-slate-900">{q.customer_name}</div>
                      <div className="text-slate-500">{q.service_type}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-sm text-slate-900">
                        ₱{Number(q.total_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Labor: ₱{Number(q.labor_cost).toLocaleString()} | Parts: ₱
                        {Number(q.parts_total).toLocaleString()}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={q.payment_status} />
                      {q.is_cancellation_locked && (
                        <div className="text-[10px] font-bold text-rose-700 flex items-center gap-1 mt-1">
                          <Lock className="w-3 h-3" /> Cancel Locked
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={q.status} />
                      {q.customer_decision_notes && (
                        <div className="text-[11px] text-slate-500 italic mt-1 max-w-xs truncate">
                          "{q.customer_decision_notes}"
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {q.status !== 'Superseded' && (
                        <button
                          onClick={() => handleOpenRevise(q)}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm inline-flex items-center gap-1"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          New Revision (Rev {Number(q.revision_no) + 1})
                        </button>
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
