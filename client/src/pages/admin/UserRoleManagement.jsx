import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Edit3,
  Power,
  Search,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

const ALLOWED_ROLES = [
  'Customer',
  'Service Staff',
  'Technician',
  'Inventory Staff',
  'Administrator'
];

export default function UserRoleManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: 'Password123!',
    role: 'Service Staff',
    specialization: '',
    is_active: true
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users', {
        params: {
          role: roleFilter || undefined,
          search: search || undefined
        }
      });
      setUsers(res.data.users || []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter]);

  const handleOpenCreate = () => {
    setEditingUser(null);
    setForm({
      full_name: '',
      email: '',
      phone: '0917-555-0100',
      password: 'Password123!',
      role: 'Service Staff',
      specialization: '',
      is_active: true
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (u) => {
    setEditingUser(u);
    setForm({
      full_name: u.full_name,
      email: u.email,
      phone: u.phone,
      password: '',
      role: u.role,
      specialization: u.specialization || '',
      is_active: Boolean(u.is_active)
    });
    setModalOpen(true);
  };

  const handleToggleActive = async (u) => {
    setFeedback({ type: '', message: '' });
    try {
      const res = await api.patch(`/users/${u.user_id}`, {
        is_active: !Boolean(u.is_active)
      });
      setFeedback({
        type: 'success',
        message: res.data.message || 'Account active status updated.'
      });
      fetchUsers();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to toggle user status.'
      });
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback({ type: '', message: '' });

    try {
      if (editingUser) {
        const res = await api.patch(`/users/${editingUser.user_id}`, form);
        setFeedback({ type: 'success', message: res.data.message || 'User updated!' });
      } else {
        const res = await api.post('/users', form);
        setFeedback({ type: 'success', message: res.data.message || 'User created!' });
      }
      setModalOpen(false);
      fetchUsers();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to save user.'
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
            User Accounts & 5-Role RBAC Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Strictly enforces the 5 authorized roles: Customer, Service Staff, Technician, Inventory Staff, and Administrator (FR-003 / TC-014).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
              placeholder="Search name, email..."
              className="pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-semibold"
          >
            <option value="">All 5 Roles</option>
            {ALLOWED_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 rounded-xl bg-[#0284C7] hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            Create User Account
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

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th className="py-3.5 px-4 font-bold">ID</th>
                <th className="py-3.5 px-4 font-bold">Full Name & Email</th>
                <th className="py-3.5 px-4 font-bold">Phone</th>
                <th className="py-3.5 px-4 font-bold">RBAC Role</th>
                <th className="py-3.5 px-4 font-bold">Specialization / Profile</th>
                <th className="py-3.5 px-4 font-bold">Account Status</th>
                <th className="py-3.5 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading user accounts...
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.user_id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-500">
                      #{u.user_id}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{u.full_name}</div>
                      <div className="font-mono text-slate-500">{u.email}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">{u.phone}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-full font-bold bg-sky-50 text-[#0284C7] border border-sky-200">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {u.specialization || (u.company_name ? `Client: ${u.company_name}` : '—')}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={u.is_active ? 'Active' : 'Decommissioned'} />
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1.5">
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-[#0284C7] font-bold inline-flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(u)}
                        className={`px-2.5 py-1.5 rounded-lg font-bold inline-flex items-center gap-1 ${
                          u.is_active
                            ? 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit User Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="bg-[#0F172A] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingUser ? `Edit User ${editingUser.email}` : 'Create New User Account'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold uppercase text-slate-600 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">Phone *</label>
                  <input
                    type="text"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    System Role (5 RBAC) *
                  </label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                  >
                    {ALLOWED_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {form.role === 'Technician' && (
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Technician Specialization
                  </label>
                  <input
                    type="text"
                    value={form.specialization}
                    onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                    placeholder="e.g. Split-Type & Inverter Diagnostics"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold uppercase text-slate-600 mb-1">
                  {editingUser ? 'Reset Password (leave blank to keep current)' : 'Initial Password *'}
                </label>
                <input
                  type="text"
                  required={!editingUser}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
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
                  {submitting ? 'Saving...' : 'Save User Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
