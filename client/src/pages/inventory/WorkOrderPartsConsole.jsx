import React, { useState, useEffect } from 'react';
import {
  Package,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  X,
  History
} from 'lucide-react';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

export default function WorkOrderPartsConsole() {
  const [items, setItems] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    item_id: '1',
    work_order_id: '2',
    tx_type: 'Reservation',
    quantity: 2,
    remarks: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const fetchConsoleData = async () => {
    try {
      setLoading(true);
      const [invRes, woRes, txRes] = await Promise.all([
        api.get('/inventory'),
        api.get('/work-orders'),
        api.get('/inventory/transactions')
      ]);
      setItems(invRes.data.items || []);
      setWorkOrders(woRes.data.work_orders || []);
      setTransactions(txRes.data.transactions || []);
    } catch (err) {
      console.error('Failed to load work order parts console:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConsoleData();
  }, []);

  const selectedItem = items.find((i) => String(i.item_id) === String(form.item_id));

  // Real-time Stock Math Preview (FR-009 / TC-012)
  const computePreview = () => {
    if (!selectedItem) return null;
    const curTotal = Number(selectedItem.total_stock_qty);
    const curReserved = Number(selectedItem.reserved_qty);
    const curAvail = curTotal - curReserved;
    const qty = parseInt(form.quantity, 10) || 0;

    let nextTotal = curTotal;
    let nextReserved = curReserved;

    if (form.tx_type === 'Reservation') {
      nextReserved = curReserved + Math.max(0, qty);
    } else if (form.tx_type === 'Issue') {
      const release = Math.min(Math.max(0, qty), curReserved);
      nextTotal = curTotal - Math.max(0, qty);
      nextReserved = Math.max(0, curReserved - release);
    } else if (form.tx_type === 'Return') {
      if (curReserved >= Math.max(0, qty)) {
        nextReserved = curReserved - Math.max(0, qty);
      } else {
        nextTotal = curTotal + Math.max(0, qty);
      }
    } else if (form.tx_type === 'Adjustment') {
      nextTotal = curTotal + qty;
    }

    return {
      curTotal,
      curReserved,
      curAvail,
      nextTotal,
      nextReserved,
      nextAvail: nextTotal - nextReserved
    };
  };

  const preview = computePreview();

  const handleSubmitTx = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback({ type: '', message: '' });

    try {
      const res = await api.post('/inventory/transactions', {
        item_id: Number(form.item_id),
        work_order_id: form.work_order_id ? Number(form.work_order_id) : null,
        tx_type: form.tx_type,
        quantity: Number(form.quantity),
        remarks: form.remarks
      });
      setFeedback({
        type: 'success',
        message: res.data.message || `Inventory ${form.tx_type} completed!`
      });
      setForm((prev) => ({ ...prev, remarks: '' }));
      fetchConsoleData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Inventory transaction failed.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">
          Work-Order-Linked Inventory Transactions Console
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Execute <code className="font-mono">Reservation</code> (increments reserved_qty),{' '}
          <code className="font-mono">Issue</code> (decrements total_stock_qty & reserved_qty),{' '}
          <code className="font-mono">Return</code>, and <code className="font-mono">Adjustment</code> (FR-009 / TC-012).
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

      {/* Transaction Execution Form + Live Stock Math Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleSubmitTx}
          className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 text-xs"
        >
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-[#0284C7]" />
              Execute Stock Transaction
            </h2>
            <span className="text-[11px] text-slate-400">ACID Row-Locked Transaction</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold uppercase text-slate-600 mb-1">
                Transaction Type *
              </label>
              <select
                value={form.tx_type}
                onChange={(e) => setForm({ ...form, tx_type: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-900"
              >
                <option value="Reservation">Reservation (+Reserved, −Available)</option>
                <option value="Issue">Issue (−Total Stock, −Reserved)</option>
                <option value="Return">Return (Release Reservation / Restore Stock)</option>
                <option value="Adjustment">Adjustment (Direct Total Stock Delta)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold uppercase text-slate-600 mb-1">
                Linked Work Order {form.tx_type !== 'Adjustment' ? '(Recommended)' : '(Optional)'}
              </label>
              <select
                value={form.work_order_id}
                onChange={(e) => setForm({ ...form, work_order_id: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white"
              >
                <option value="">-- No Linked Work Order --</option>
                {workOrders.map((wo) => (
                  <option key={wo.work_order_id} value={wo.work_order_id}>
                    [{wo.work_order_no}] {wo.service_type} — {wo.customer_name} ({wo.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block font-bold uppercase text-slate-600 mb-1">
                Spare Part SKU *
              </label>
              <select
                required
                value={form.item_id}
                onChange={(e) => setForm({ ...form, item_id: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white font-semibold"
              >
                {items.map((item) => (
                  <option key={item.item_id} value={item.item_id}>
                    [{item.sku_code}] {item.part_name} (Total: {item.total_stock_qty} | Res: {item.reserved_qty} | Avail: {item.available_stock})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold uppercase text-slate-600 mb-1">
                Quantity {form.tx_type === 'Adjustment' ? '(+/-)' : '*'}
              </label>
              <input
                type="number"
                required
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold uppercase text-slate-600 mb-1">
              Transaction Remarks {form.tx_type === 'Adjustment' ? '(Mandatory for Adjustment) *' : ''}
            </label>
            <input
              type="text"
              required={form.tx_type === 'Adjustment'}
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              placeholder={
                form.tx_type === 'Adjustment'
                  ? 'Mandatory audit reason for stock adjustment (e.g. Supplier delivery / physical count)...'
                  : 'Optional notes (e.g. Reserved 2 capacitors for compressor troubleshooting)...'
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-[#0284C7] hover:bg-sky-700 text-white font-bold shadow-sm"
            >
              {submitting ? 'Executing...' : `Commit ${form.tx_type} Transaction`}
            </button>
          </div>
        </form>

        {/* Live Stock Math Verification Card */}
        <div className="lg:col-span-5 bg-[#0F172A] text-white rounded-2xl p-6 flex flex-col justify-between shadow-lg">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
              Live Warehouse Math Verification (TC-012)
            </span>
            <h3 className="text-base font-extrabold mt-1">
              {selectedItem ? selectedItem.part_name : 'Select a Spare Part'}
            </h3>
            <p className="text-xs font-mono text-slate-400">
              {selectedItem?.sku_code} • Formula: Available = Total − Reserved
            </p>

            {preview && (
              <div className="mt-5 space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-between">
                  <span className="text-slate-300 font-semibold">Total Physical Stock:</span>
                  <div className="font-mono font-bold text-sm flex items-center gap-2">
                    <span>{preview.curTotal}</span>
                    <ArrowRight className="w-4 h-4 text-sky-400" />
                    <span className="text-white">{preview.nextTotal}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-between">
                  <span className="text-amber-300 font-semibold">Reserved Stock (WO):</span>
                  <div className="font-mono font-bold text-sm flex items-center gap-2">
                    <span>{preview.curReserved}</span>
                    <ArrowRight className="w-4 h-4 text-amber-400" />
                    <span className="text-amber-300">{preview.nextReserved}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-sky-950/90 border border-sky-500/40 flex items-center justify-between">
                  <span className="text-sky-300 font-bold">Available Stock:</span>
                  <div className="font-mono font-extrabold text-base flex items-center gap-2">
                    <span>{preview.curAvail}</span>
                    <ArrowRight className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">{preview.nextAvail}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-400 mt-4 pt-3 border-t border-slate-800">
            Every stock movement is recorded in <code className="text-slate-200">inventory_transactions</code> and{' '}
            <code className="text-slate-200">audit_logs</code>.
          </div>
        </div>
      </div>

      {/* Transaction Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
          <History className="w-4 h-4 text-[#0284C7]" />
          <h2 className="font-bold text-sm text-slate-900">
            Complete Work-Order Inventory Transaction Ledger ({transactions.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th className="py-3 px-4 font-bold">Tx ID</th>
                <th className="py-3 px-4 font-bold">Type</th>
                <th className="py-3 px-4 font-bold">Spare Part SKU</th>
                <th className="py-3 px-4 font-bold text-right">Qty</th>
                <th className="py-3 px-4 font-bold">Linked Work Order</th>
                <th className="py-3 px-4 font-bold">Remarks</th>
                <th className="py-3 px-4 font-bold">Performed By</th>
                <th className="py-3 px-4 font-bold">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading transactions...
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.transaction_id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono font-bold text-slate-500">
                      #{tx.transaction_id}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={tx.tx_type} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{tx.part_name}</div>
                      <div className="font-mono text-[11px] text-slate-500">{tx.sku_code}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-900">
                      {tx.quantity} {tx.unit_of_measure}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-[#0284C7]">
                      {tx.work_order_no || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs">{tx.remarks}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {tx.performed_by_name}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">{tx.created_at}</td>
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
