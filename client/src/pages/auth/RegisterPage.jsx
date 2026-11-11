import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Wind, UserPlus, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    customer_type: 'Residential',
    company_name: '',
    billing_address: '',
    service_address: ''
  });
  const [sameAddress, setSameAddress] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const updated = { ...prev, [name]: value };
      if (sameAddress && name === 'billing_address') {
        updated.service_address = value;
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        service_address: sameAddress ? form.billing_address : form.service_address
      };
      await register(payload);
      navigate('/customer');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please check your inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-white flex flex-col justify-center py-10 px-4 sm:px-6">
      <div className="max-w-xl w-full mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0284C7] flex items-center justify-center">
              <Wind className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-white">Customer Self-Registration</h1>
              <p className="text-xs text-sky-400">NorthPeak Aircon & Refrigeration System Trading</p>
            </div>
          </div>
          <Link
            to="/login"
            className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Login
          </Link>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                name="full_name"
                required
                value={form.full_name}
                onChange={handleChange}
                placeholder="Juan Dela Cruz"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                Account Type *
              </label>
              <select
                name="customer_type"
                value={form.customer_type}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
              >
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial / Corporate</option>
              </select>
            </div>
          </div>

          {form.customer_type === 'Commercial' && (
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                Company / Establishment Name
              </label>
              <input
                type="text"
                name="company_name"
                value={form.company_name}
                onChange={handleChange}
                placeholder="e.g. Apex Medical Clinic Corp."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                name="email"
                required
                value={form.email}
                onChange={handleChange}
                placeholder="client@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                Mobile / Contact Number *
              </label>
              <input
                type="text"
                name="phone"
                required
                value={form.phone}
                onChange={handleChange}
                placeholder="0917-555-0199"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
              Password *
            </label>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              value={form.password}
              onChange={handleChange}
              placeholder="Minimum 6 characters"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
              Billing Address *
            </label>
            <textarea
              name="billing_address"
              required
              rows={2}
              value={form.billing_address}
              onChange={handleChange}
              placeholder="House/Unit No., Street, Barangay, City, Province"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="sameAddress"
              type="checkbox"
              checked={sameAddress}
              onChange={(e) => setSameAddress(e.target.checked)}
              className="rounded border-slate-600 text-sky-500 focus:ring-sky-500"
            />
            <label htmlFor="sameAddress" className="text-xs text-slate-300">
              Installation / Service address is the same as billing address
            </label>
          </div>

          {!sameAddress && (
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                Default Service / Installation Address *
              </label>
              <textarea
                name="service_address"
                required={!sameAddress}
                rows={2}
                value={form.service_address}
                onChange={handleChange}
                placeholder="Site address where aircon units are installed"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 rounded-xl bg-[#0284C7] hover:bg-sky-600 disabled:opacity-50 text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            {submitting ? 'Creating Account...' : 'Register Customer Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
