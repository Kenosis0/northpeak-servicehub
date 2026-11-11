import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit3, CheckCircle2, AlertCircle, X } from 'lucide-react';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

export default function ProductCatalogManager() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const [form, setForm] = useState({
    sku_code: '',
    brand: 'Daikin',
    model_name: '',
    ac_type: 'Split Type',
    horsepower: '1.5 HP',
    inverter_type: 'Inverter',
    unit_price: '34500',
    stock_qty: '5',
    warranty_months: '12',
    specs_summary: '',
    is_active: true
  });

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/products', { params: { active_only: 'false' } });
      setProducts(res.data.products || []);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setForm({
      sku_code: `AC-NP-${Date.now().toString().slice(-4)}`,
      brand: 'Daikin',
      model_name: '',
      ac_type: 'Split Type',
      horsepower: '1.5 HP',
      inverter_type: 'Inverter',
      unit_price: '35000',
      stock_qty: '5',
      warranty_months: '12',
      specs_summary: '',
      is_active: true
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (prod) => {
    setEditingProduct(prod);
    setForm({
      sku_code: prod.sku_code,
      brand: prod.brand,
      model_name: prod.model_name,
      ac_type: prod.ac_type,
      horsepower: prod.horsepower,
      inverter_type: prod.inverter_type,
      unit_price: String(prod.unit_price),
      stock_qty: String(prod.stock_qty),
      warranty_months: String(prod.warranty_months),
      specs_summary: prod.specs_summary || '',
      is_active: Boolean(prod.is_active)
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback({ type: '', message: '' });
    try {
      if (editingProduct) {
        const res = await api.put(`/products/${editingProduct.product_id}`, form);
        setFeedback({ type: 'success', message: res.data.message || 'Product updated!' });
      } else {
        const res = await api.post('/products', form);
        setFeedback({ type: 'success', message: res.data.message || 'Product added!' });
      }
      setModalOpen(false);
      fetchProducts();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to save product.'
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
            Brand-New Aircon Product Catalog Manager
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage retail aircon models, unit prices, and showroom stock. Updating catalog prices never alters historical quotation snapshots.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 rounded-xl bg-[#0284C7] hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 self-start shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Aircon Model
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

      {/* Catalog Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th className="py-3.5 px-4 font-bold">SKU Code</th>
                <th className="py-3.5 px-4 font-bold">Brand & Model</th>
                <th className="py-3.5 px-4 font-bold">AC Type & HP</th>
                <th className="py-3.5 px-4 font-bold">Unit Price</th>
                <th className="py-3.5 px-4 font-bold">Showroom Stock</th>
                <th className="py-3.5 px-4 font-bold">Warranty</th>
                <th className="py-3.5 px-4 font-bold text-right">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading product catalog...
                  </td>
                </tr>
              ) : (
                products.map((prod) => (
                  <tr key={prod.product_id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                      {prod.sku_code}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">
                        {prod.brand} — {prod.model_name}
                      </div>
                      <div className="text-slate-500 max-w-md truncate">{prod.specs_summary}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">
                        {prod.ac_type} • {prod.horsepower}
                      </div>
                      <StatusBadge status={prod.inverter_type} className="mt-1" />
                    </td>
                    <td className="py-3.5 px-4 font-mono font-extrabold text-slate-900">
                      ₱{Number(prod.unit_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 font-bold">
                      <span className={prod.stock_qty > 0 ? 'text-emerald-700' : 'text-rose-600'}>
                        {prod.stock_qty} units
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {prod.warranty_months} Months
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenEdit(prod)}
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="bg-[#0F172A] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingProduct ? `Edit Product ${editingProduct.sku_code}` : 'Add Aircon Model'}
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
                  <label className="block font-bold uppercase text-slate-600 mb-1">Brand *</label>
                  <input
                    type="text"
                    required
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-600 mb-1">
                  Model Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.model_name}
                  onChange={(e) => setForm({ ...form, model_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">AC Type *</label>
                  <select
                    value={form.ac_type}
                    onChange={(e) => setForm({ ...form, ac_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="Split Type">Split Type</option>
                    <option value="Window Type">Window Type</option>
                    <option value="Floor Mounted">Floor Mounted</option>
                    <option value="Cassette Type">Cassette Type</option>
                    <option value="Portable">Portable</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Horsepower *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.horsepower}
                    onChange={(e) => setForm({ ...form, horsepower: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Technology *
                  </label>
                  <select
                    value={form.inverter_type}
                    onChange={(e) => setForm({ ...form, inverter_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="Inverter">Inverter</option>
                    <option value="Non-Inverter">Non-Inverter</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
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
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Stock Qty *
                  </label>
                  <input
                    type="number"
                    required
                    value={form.stock_qty}
                    onChange={(e) => setForm({ ...form, stock_qty: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Warranty (Mos) *
                  </label>
                  <input
                    type="number"
                    required
                    value={form.warranty_months}
                    onChange={(e) => setForm({ ...form, warranty_months: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-600 mb-1">
                  Specifications Summary
                </label>
                <textarea
                  rows={2}
                  value={form.specs_summary}
                  onChange={(e) => setForm({ ...form, specs_summary: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
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
                  {submitting ? 'Saving...' : 'Save Catalog Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
