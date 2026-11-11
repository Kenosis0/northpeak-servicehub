import React, { useState, useEffect } from 'react';
import { QrCode, Plus, Search, CheckCircle2, AlertCircle, X } from 'lucide-react';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import QRModal from '../../components/QRModal';

export default function CustomerEquipmentManager() {
  const [equipment, setEquipment] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedQrUnit, setSelectedQrUnit] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const [form, setForm] = useState({
    customer_id: '',
    brand: 'Daikin',
    model: 'D-Smart Queen FTKC35TVM',
    serial_number: '',
    ac_type: 'Split Type',
    capacity_hp: '1.5 HP',
    installed_location: '',
    installation_date: new Date().toISOString().split('T')[0],
    warranty_expiry: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
    maintenance_interval_months: 6
  });

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [eqRes, custRes] = await Promise.all([
        api.get('/equipment', { params: { search: search || undefined } }),
        api.get('/customers')
      ]);
      setEquipment(eqRes.data.equipment || []);
      setCustomers(custRes.data.customers || []);
    } catch (err) {
      console.error('Failed to fetch customer equipment:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleRegisterUnit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback({ type: '', message: '' });
    try {
      const res = await api.post('/equipment', form);
      setFeedback({
        type: 'success',
        message: res.data.message || 'Equipment registered with QR Token!'
      });
      setShowRegisterModal(false);
      fetchAll();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to register equipment.'
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
            Customer AC Equipment Registry & QR Code Generator
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Register customer-owned aircon units, generate unique QR tags, and track automated Preventive Maintenance schedules (FR-004).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchAll()}
              placeholder="Search QR, serial, customer..."
              className="pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
            />
          </div>
          <button
            onClick={() => {
              setForm((prev) => ({
                ...prev,
                customer_id: customers[0]?.customer_id || '',
                serial_number: `SN-${Date.now().toString().slice(-6)}`
              }));
              setShowRegisterModal(true);
            }}
            className="px-4 py-2 rounded-xl bg-[#0284C7] hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Register AC Unit
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

      {/* Equipment Registry Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th className="py-3.5 px-4 font-bold">QR Token</th>
                <th className="py-3.5 px-4 font-bold">Customer Owner</th>
                <th className="py-3.5 px-4 font-bold">AC Unit & Serial</th>
                <th className="py-3.5 px-4 font-bold">Installed Location</th>
                <th className="py-3.5 px-4 font-bold">PM Schedule</th>
                <th className="py-3.5 px-4 font-bold">Status</th>
                <th className="py-3.5 px-4 font-bold text-right">QR Sticker</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading registered equipment...
                  </td>
                </tr>
              ) : (
                equipment.map((eq) => (
                  <tr key={eq.equipment_id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#0284C7]">
                      {eq.qr_token}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{eq.customer_name}</div>
                      {eq.customer_company && (
                        <div className="text-[11px] text-sky-700 font-semibold">
                          {eq.customer_company}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">
                        {eq.brand} {eq.model}
                      </div>
                      <div className="text-slate-500">
                        {eq.ac_type} • {eq.capacity_hp} • SN:{' '}
                        <span className="font-mono">{eq.serial_number}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs text-slate-700">
                      {eq.installed_location}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-emerald-700">
                        Next PM: {eq.next_pm_date || 'N/A'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Last: {eq.last_service_date || 'None'} ({eq.maintenance_interval_months}m interval)
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={eq.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedQrUnit(eq)}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs inline-flex items-center gap-1.5"
                      >
                        <QrCode className="w-3.5 h-3.5 text-sky-400" />
                        Print QR
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register New Unit Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="bg-[#0F172A] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">Register Customer AC Unit & Generate QR Tag</h3>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterUnit} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold uppercase text-slate-600 mb-1">
                  Customer Owner *
                </label>
                <select
                  required
                  value={form.customer_id}
                  onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
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
                  <label className="block font-bold uppercase text-slate-600 mb-1">Brand *</label>
                  <input
                    type="text"
                    required
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">Model *</label>
                  <input
                    type="text"
                    required
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Serial Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.serial_number}
                    onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
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
                  </select>
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Horsepower *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.capacity_hp}
                    onChange={(e) => setForm({ ...form, capacity_hp: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-600 mb-1">
                  Installed Room / Site Location *
                </label>
                <input
                  type="text"
                  required
                  value={form.installed_location}
                  onChange={(e) => setForm({ ...form, installed_location: e.target.value })}
                  placeholder="e.g. 2nd Floor Master Bedroom - Angeles City"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Install Date
                  </label>
                  <input
                    type="date"
                    value={form.installation_date}
                    onChange={(e) => setForm({ ...form, installation_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Warranty Expiry
                  </label>
                  <input
                    type="date"
                    value={form.warranty_expiry}
                    onChange={(e) => setForm({ ...form, warranty_expiry: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    PM Interval (Months)
                  </label>
                  <select
                    value={form.maintenance_interval_months}
                    onChange={(e) =>
                      setForm({ ...form, maintenance_interval_months: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                  >
                    <option value={3}>Every 3 Months (Commercial)</option>
                    <option value={6}>Every 6 Months (Residential)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-[#0284C7] hover:bg-sky-700 text-white font-bold shadow-sm"
                >
                  {submitting ? 'Registering...' : 'Register & Generate QR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedQrUnit && (
        <QRModal equipment={selectedQrUnit} onClose={() => setSelectedQrUnit(null)} />
      )}
    </div>
  );
}
