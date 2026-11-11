import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Search,
  Wind,
  ShieldCheck,
  CheckCircle2,
  Wrench,
  X,
  AlertCircle
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/StatusBadge';

export default function ProductCatalogInquiry() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);

  const [acTypeFilter, setAcTypeFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Inquiry Modal State
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [requestInstallation, setRequestInstallation] = useState(true);
  const [installationAddress, setInstallationAddress] = useState(user?.service_address || '');
  const [preferredDate, setPreferredDate] = useState(() => {
    const d = new Date(Date.now() + 3 * 86400000);
    return d.toISOString().split('T')[0];
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, inqRes] = await Promise.all([
        api.get('/products', { params: { ac_type: acTypeFilter || undefined, search: searchTerm || undefined } }),
        api.get('/inquiries')
      ]);
      setProducts(prodRes.data.products || []);
      setInquiries(inqRes.data.inquiries || []);
    } catch (err) {
      console.error('Failed to load catalog or inquiries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [acTypeFilter]);

  const handleOpenInquiryModal = (product) => {
    setSelectedProduct(product);
    setQuantity(1);
    setRequestInstallation(true);
    setInstallationAddress(user?.service_address || '');
    setFeedback({ type: '', message: '' });
  };

  const handleSubmitInquiry = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setSubmitting(true);
    setFeedback({ type: '', message: '' });
    try {
      const res = await api.post('/inquiries', {
        product_id: selectedProduct.product_id,
        quantity: Number(quantity),
        request_installation: requestInstallation,
        installation_address: requestInstallation ? installationAddress : null,
        preferred_date: requestInstallation ? preferredDate : null
      });
      setFeedback({
        type: 'success',
        message: res.data.message || 'Purchase inquiry submitted!'
      });
      setSelectedProduct(null);
      fetchData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to submit inquiry.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">
            Brand-New Aircon Catalog & Purchase Inquiry
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Select a unit to inquire for purchase and optionally request professional NorthPeak installation handoff (FR-005).
          </p>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchData()}
              placeholder="Search brand, model..."
              className="pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-sky-500 bg-white"
            />
          </div>
          <select
            value={acTypeFilter}
            onChange={(e) => setAcTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-medium"
          >
            <option value="">All AC Types</option>
            <option value="Split Type">Split Type</option>
            <option value="Window Type">Window Type</option>
            <option value="Floor Mounted">Floor Mounted</option>
            <option value="Cassette Type">Cassette Type</option>
            <option value="Portable">Portable</option>
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

      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {products.map((prod) => (
          <div
            key={prod.product_id}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between p-5"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded bg-slate-100 text-slate-700">
                  {prod.sku_code}
                </span>
                <div className="flex items-center gap-1.5">
                  <StatusBadge status={prod.inverter_type} />
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-sky-50 text-[#0284C7] border border-sky-200">
                    {prod.horsepower}
                  </span>
                </div>
              </div>

              <div className="text-xs font-bold uppercase tracking-wider text-sky-600">
                {prod.brand} • {prod.ac_type}
              </div>
              <h3 className="text-base font-extrabold text-slate-900 mt-0.5">{prod.model_name}</h3>

              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {prod.specs_summary || 'High-efficiency commercial and residential cooling system.'}
              </p>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  {prod.warranty_months} Months Warranty
                </span>
                <span
                  className={`font-semibold ${
                    prod.stock_qty > 0 ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {prod.stock_qty > 0 ? `${prod.stock_qty} Units in Stock` : 'Out of Stock'}
                </span>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Unit Price</div>
                <div className="text-lg font-extrabold text-slate-900">
                  ₱{Number(prod.unit_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <button
                onClick={() => handleOpenInquiryModal(prod)}
                disabled={prod.stock_qty <= 0}
                className="px-4 py-2.5 rounded-xl bg-[#0284C7] hover:bg-sky-700 disabled:bg-slate-300 text-white text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                Inquire to Purchase
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Customer's Submitted Purchase Inquiries Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-sm text-slate-900">My Submitted Aircon Purchase Inquiries</h2>
            <p className="text-xs text-slate-500">
              When Service Staff confirms stock for an inquiry with Optional Installation, a linked Installation Service Request is auto-created.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th className="py-3 px-4 font-bold">Inquiry Ref</th>
                <th className="py-3 px-4 font-bold">Aircon Unit</th>
                <th className="py-3 px-4 font-bold">Qty & Total</th>
                <th className="py-3 px-4 font-bold">Optional Installation</th>
                <th className="py-3 px-4 font-bold">Payment Status</th>
                <th className="py-3 px-4 font-bold">Inquiry Status</th>
                <th className="py-3 px-4 font-bold">Linked Service Request</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inquiries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    You have not submitted any purchase inquiries yet.
                  </td>
                </tr>
              ) : (
                inquiries.map((inq) => (
                  <tr key={inq.inquiry_id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#0284C7]">
                      {inq.reference_no}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">
                        {inq.brand} {inq.model_name}
                      </div>
                      <div className="text-slate-500">
                        {inq.horsepower} • {inq.ac_type}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">
                        ₱{Number(inq.total_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-slate-500">
                        {inq.quantity} unit(s) @ ₱{Number(inq.unit_price_snapshot).toLocaleString()}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {inq.request_installation ? (
                        <div>
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                            <Wrench className="w-3 h-3" /> Yes (Installation Requested)
                          </span>
                          <div className="text-[11px] text-slate-500 truncate max-w-xs">
                            {inq.installation_address} ({inq.preferred_date})
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500">Unit Purchase Only</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={inq.payment_status} />
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={inq.inquiry_status} />
                    </td>
                    <td className="py-3.5 px-4">
                      {inq.linked_service_request_no ? (
                        <div className="inline-flex flex-col">
                          <span className="font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            {inq.linked_service_request_no}
                          </span>
                          <span className="text-[10px] text-slate-500 mt-0.5">
                            Status: {inq.linked_service_request_status}
                          </span>
                        </div>
                      ) : inq.request_installation ? (
                        <span className="text-slate-400 italic">Pending Staff Confirmation</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Purchase Inquiry Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="bg-[#0F172A] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wind className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-sm">Submit Aircon Purchase Inquiry</h3>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitInquiry} className="p-6 space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-sky-700">
                    {selectedProduct.brand} • {selectedProduct.horsepower} {selectedProduct.ac_type}
                  </div>
                  <div className="text-sm font-extrabold text-slate-900">
                    {selectedProduct.model_name}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Unit Price</div>
                  <div className="text-sm font-extrabold text-slate-900">
                    ₱{Number(selectedProduct.unit_price).toLocaleString()}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Quantity *
                </label>
                <input
                  type="number"
                  min={1}
                  max={selectedProduct.stock_qty || 10}
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              {/* Optional Installation Toggle (FR-005 / TC-005) */}
              <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="toggleInstall"
                    className="text-xs font-bold text-slate-900 flex items-center gap-2 cursor-pointer"
                  >
                    <Wrench className="w-4 h-4 text-[#0284C7]" />
                    Include Optional NorthPeak Installation Service
                  </label>
                  <input
                    id="toggleInstall"
                    type="checkbox"
                    checked={requestInstallation}
                    onChange={(e) => setRequestInstallation(e.target.checked)}
                    className="w-4 h-4 text-[#0284C7] rounded"
                  />
                </div>
                <p className="text-[11px] text-slate-600">
                  When enabled, confirming this purchase inquiry automatically generates a linked Installation Service Request for technician dispatch.
                </p>

                {requestInstallation && (
                  <div className="space-y-3 pt-2 border-t border-sky-200/80">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Installation Site Address *
                      </label>
                      <textarea
                        rows={2}
                        required={requestInstallation}
                        value={installationAddress}
                        onChange={(e) => setInstallationAddress(e.target.value)}
                        placeholder="Complete address where the new aircon unit will be installed"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Preferred Installation Date *
                      </label>
                      <input
                        type="date"
                        required={requestInstallation}
                        value={preferredDate}
                        onChange={(e) => setPreferredDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900 text-white flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  Estimated Unit Total ({quantity}x):
                </span>
                <span className="text-base font-extrabold text-sky-400">
                  ₱
                  {(Number(selectedProduct.unit_price) * Number(quantity)).toLocaleString('en-PH', {
                    minimumFractionDigits: 2
                  })}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-[#0284C7] hover:bg-sky-700 text-white text-xs font-bold shadow-sm"
                >
                  {submitting ? 'Submitting...' : 'Submit Purchase Inquiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
