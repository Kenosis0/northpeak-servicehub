import React, { useState, useEffect } from 'react';
import { Boxes, Plus, Edit3, Search, CheckCircle2, AlertCircle, X } from 'lucide-react';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

export default function SparePartsCatalog() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const [form, setForm] = useState({
    sku_code: '',
    part_name: '',
    category: 'Capacitor',
    unit_of_measure: 'pcs',
    unit_price: '850',
    total_stock_qty: '15',
    reorder_level: '5'
  });

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await api.get('/inventory', {
        params: {
          search: search || undefined,
          low_stock_only: lowStockOnly ? 'true' : undefined
        }
      });
      setItems(res.data.items || []);
    } catch (err) {
      console.error('Failed to load spare parts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [lowStockOnly]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setForm({
      sku_code: `PRT-NP-${Date.now().toString().slice(-4)}`,
      part_name: '',
      category: 'Capacitor',
      unit_of_measure: 'pcs',
      unit_price: '850',
      total_stock_qty: '10',
      reorder_level: '5'
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setForm({
      sku_code: item.sku_code,
      part_name: item.part_name,
      category: item.category,
      unit_of_measure: item.unit_of_measure,
      unit_price: String(item.unit_price),
      total_stock_qty: String(item.total_stock_qty),
      reorder_level: String(item.reorder_level)
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback({ type: '', message: '' });
    try {
      if (editingItem) {
        const res = await api.put(`/inventory/${editingItem.item_id}`, form);
        setFeedback({ type: 'success', message: res.data.message || 'Spare part updated!' });
      } else {
        const res = await api.post('/inventory', form);
        setFeedback({ type: 'success', message: res.data.message || 'Spare part added!' });
      }
      setModalOpen(false);
      fetchItems();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to save spare part.'
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
            Spare Parts & Consumables Warehouse Catalog
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time calculation: <code className="font-mono">Available Stock = Total Stock − Reserved</code>. Items at or below reorder threshold trigger Low Stock badges.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchItems()}
              placeholder="Search SKU, part name..."
              className="pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
            />
          </div>

          <button
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${
              lowStockOnly
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {lowStockOnly ? 'Showing Low Stock Only' : 'Filter Low Stock'}
          </button>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-[#0284C7] hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Spare Part SKU
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

      {/* Warehouse Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th className="py-3.5 px-4 font-bold">SKU Code</th>
                <th className="py-3.5 px-4 font-bold">Part Name & Category</th>
                <th className="py-3.5 px-4 font-bold text-right">Unit Price</th>
                <th className="py-3.5 px-4 font-bold text-right">Total Stock</th>
                <th className="py-3.5 px-4 font-bold text-right">Reserved</th>
                <th className="py-3.5 px-4 font-bold text-right">Available Stock</th>
                <th className="py-3.5 px-4 font-bold text-right">Reorder Level</th>
                <th className="py-3.5 px-4 font-bold">Stock Status</th>
                <th className="py-3.5 px-4 font-bold text-right">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Loading spare parts warehouse...
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.item_id}
                    className={item.is_low_stock ? 'bg-rose-50/40' : 'hover:bg-slate-50/80'}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                      {item.sku_code}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{item.part_name}</div>
                      <div className="text-slate-500">
                        {item.category} ({item.unit_of_measure})
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold">
                      ₱{Number(item.unit_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      {item.total_stock_qty}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-700">
                      {item.reserved_qty}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-sm font-extrabold text-[#0284C7]">
                      {item.available_stock} {item.unit_of_measure}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                      {item.reorder_level}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={item.is_low_stock ? 'Low Stock' : 'Healthy'} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-[#0284C7] font-bold inline-flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Spare Part Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="bg-[#0F172A] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingItem ? `Edit Spare Part ${editingItem.sku_code}` : 'Add Spare Part SKU'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">SKU Code *</label>
                  <input
                    type="text"
                    required
                    value={form.sku_code}
                    onChange={(e) => setForm({ ...form, sku_code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">Category *</label>
                  <input
                    type="text"
                    required
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="Capacitor, Freon, Compressor..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-600 mb-1">Part Name *</label>
                <input
                  type="text"
                  required
                  value={form.part_name}
                  onChange={(e) => setForm({ ...form, part_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Unit of Measure *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.unit_of_measure}
                    onChange={(e) => setForm({ ...form, unit_of_measure: e.target.value })}
                    placeholder="pcs, lbs, ft, sets"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Unit Price (PHP) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.unit_price}
                    onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {!editingItem && (
                  <div>
                    <label className="block font-bold uppercase text-slate-600 mb-1">
                      Initial Stock Qty *
                    </label>
                    <input
                      type="number"
                      required
                      value={form.total_stock_qty}
                      onChange={(e) => setForm({ ...form, total_stock_qty: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                    />
                  </div>
                )}
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Reorder Alert Level *
                  </label>
                  <input
                    type="number"
                    required
                    value={form.reorder_level}
                    onChange={(e) => setForm({ ...form, reorder_level: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-[#0284C7] hover:bg-sky-700 text-white font-bold shadow-sm"
                >
                  {submitting ? 'Saving...' : 'Save Spare Part'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
