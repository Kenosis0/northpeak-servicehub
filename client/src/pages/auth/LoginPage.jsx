import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Wind,
  Lock,
  Mail,
  AlertCircle,
  Zap,
  User,
  Headset,
  Wrench,
  Boxes,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { useAuth, getRoleHomePath } from '../../context/AuthContext';

const DEMO_ROLES = [
  {
    role: 'Customer',
    name: 'Marco Dela Cruz (Customer A)',
    email: 'customer1@gmail.com',
    password: 'Password123!',
    desc: 'Browse aircon catalog, submit inquiries & service requests, approve/revise quotes, view QR history',
    icon: User,
    badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40'
  },
  {
    role: 'Service Staff',
    name: 'Camille Villanueva',
    email: 'staff@northpeak.ph',
    password: 'Password123!',
    desc: 'Triage inquiries, record offline payments, build/revise quotes, dispatch technicians with conflict check',
    icon: Headset,
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
  },
  {
    role: 'Technician',
    name: 'Arnel Bautista',
    email: 'tech1@northpeak.ph',
    password: 'Password123!',
    desc: 'Scan QR equipment tags, log field diagnosis & evidence photos, complete work orders & auto-PM dates',
    icon: Wrench,
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
  },
  {
    role: 'Inventory Staff',
    name: 'Liza Dizon',
    email: 'inventory@northpeak.ph',
    password: 'Password123!',
    desc: 'Manage spare parts warehouse, low-stock alerts, and Work-Order-linked Reserve/Issue/Return/Adjust',
    icon: Boxes,
    badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40'
  },
  {
    role: 'Administrator',
    name: 'Roberto Mendoza',
    email: 'admin@northpeak.ph',
    password: 'Password123!',
    desc: 'Executive KPIs, 5-role user & RBAC management, operational reports export, immutable audit trail',
    icon: ShieldCheck,
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40'
  }
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('admin@northpeak.ph');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const loggedUser = await login(email, password);
      navigate(getRoleHomePath(loggedUser.role));
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Authentication failed. Please check your credentials or verify the backend server is running.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleOneClickDemoLogin = async (demoAccount) => {
    setEmail(demoAccount.email);
    setPassword(demoAccount.password);
    setError('');
    setSubmitting(true);
    try {
      const loggedUser = await login(demoAccount.email, demoAccount.password);
      navigate(getRoleHomePath(loggedUser.role));
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Demo login failed. Ensure MySQL and the Express server (port 5000) are running and seeded.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-white flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Sign-In Form */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[#0284C7] flex items-center justify-center shadow-lg shadow-sky-900/50">
              <Wind className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white">
                NorthPeak ServiceHub
              </h1>
              <p className="text-xs text-sky-400 font-medium">
                Aircon Sales, Service, Inventory & Maintenance System
              </p>
            </div>
          </div>

          <h2 className="text-lg font-bold text-white mb-1">Sign in to your account</h2>
          <p className="text-xs text-slate-400 mb-6">
            Enter your credentials or use the 1-Click Role Switcher on the right.
          </p>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@northpeak.ph"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white text-sm focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white text-sm focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl bg-[#0284C7] hover:bg-sky-600 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-sky-900/40 transition-all flex items-center justify-center gap-2"
            >
              {submitting ? 'Authenticating...' : 'Sign In to Portal'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              New residential or commercial client?{' '}
              <Link
                to="/register"
                className="text-sky-400 hover:text-sky-300 font-semibold underline underline-offset-4"
              >
                Create a Customer Account
              </Link>
            </p>
          </div>
        </div>

        {/* Right Column: 1-Click Quick Demo Role Switcher Banner */}
        <div className="lg:col-span-7 bg-slate-900/60 border border-sky-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-sky-500/20 text-sky-400">
                <Zap className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-extrabold text-white">
                  1-Click Defense Demo Role Switcher
                </h3>
                <p className="text-xs text-slate-400">
                  Click any of the 5 RBAC roles below to sign in immediately (Password:{' '}
                  <code className="text-sky-300 font-mono">Password123!</code>)
                </p>
              </div>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              5 Strictly Enforced Roles
            </span>
          </div>

          <div className="space-y-3">
            {DEMO_ROLES.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.role}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleOneClickDemoLogin(item)}
                  className="w-full text-left p-4 rounded-xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/80 hover:border-sky-500/60 transition-all group flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 rounded-xl bg-slate-900 text-sky-400 group-hover:bg-[#0284C7] group-hover:text-white transition-colors mt-0.5">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${item.badgeClass}`}
                        >
                          {item.role}
                        </span>
                        <span className="text-sm font-bold text-white">{item.name}</span>
                        <span className="text-xs font-mono text-slate-400">({item.email})</span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-sky-400 group-hover:translate-x-0.5 transition-transform self-center">
                    Login →
                  </span>
                </button>
              );
            })}
          </div>

          {/* Secondary Tenant Isolation Test Button (Customer B) */}
          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between flex-wrap gap-3 text-xs text-slate-400">
            <span>
              Testing Multi-Tenant Isolation (<strong className="text-slate-200">TC-014</strong>)?
            </span>
            <button
              type="button"
              disabled={submitting}
              onClick={() =>
                handleOneClickDemoLogin({
                  email: 'customer2@gmail.com',
                  password: 'Password123!'
                })
              }
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 font-semibold transition-colors"
            >
              Login as Customer B (Patricia Reyes — Apex Clinic) →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
