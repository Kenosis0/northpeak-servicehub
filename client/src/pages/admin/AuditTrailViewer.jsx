import React, { useState, useEffect } from 'react';
import { ShieldAlert, Search, RefreshCw } from 'lucide-react';
import api from '../../services/api';

export default function AuditTrailViewer() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [search, setSearch] = useState('');

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/audit-logs', {
        params: {
          user_role: roleFilter || undefined,
          entity_name: entityFilter || undefined,
          search: search || undefined
        }
      });
      setLogs(res.data.audit_logs || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [roleFilter, entityFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">
            Immutable Security & Transactional Audit Trail Viewer
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Chronological append-only ledger of logins, RBAC changes, downpayment lock blocks, quotation revisions, conflict checks, and inventory movements.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchAuditLogs()}
              placeholder="Search action, entity ID, details..."
              className="pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-semibold"
          >
            <option value="">All Roles</option>
            <option value="Administrator">Administrator</option>
            <option value="Service Staff">Service Staff</option>
            <option value="Technician">Technician</option>
            <option value="Inventory Staff">Inventory Staff</option>
            <option value="Customer">Customer</option>
          </select>

          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-semibold"
          >
            <option value="">All Entities</option>
            <option value="users">users</option>
            <option value="purchase_inquiries">purchase_inquiries</option>
            <option value="service_requests">service_requests</option>
            <option value="quotations">quotations</option>
            <option value="work_orders">work_orders</option>
            <option value="inventory_transactions">inventory_transactions</option>
            <option value="equipment">equipment</option>
          </select>

          <button
            onClick={fetchAuditLogs}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white"
            title="Refresh Audit Trail"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Audit Trail Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th className="py-3.5 px-4 font-bold">Log ID</th>
                <th className="py-3.5 px-4 font-bold">Timestamp</th>
                <th className="py-3.5 px-4 font-bold">User & Role</th>
                <th className="py-3.5 px-4 font-bold">Action Code</th>
                <th className="py-3.5 px-4 font-bold">Entity & Ref ID</th>
                <th className="py-3.5 px-4 font-bold">Immutable Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading audit logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No audit log entries match the current filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.log_id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono font-bold text-slate-500">
                      #{log.log_id}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                      {log.created_at}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{log.user_name || 'System / Anonymous'}</div>
                      <div className="text-[11px] font-semibold text-[#0284C7]">
                        {log.user_role || 'Unauthenticated'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <span className="font-semibold text-slate-700">{log.entity_name}</span>
                      {log.entity_id && (
                        <span className="ml-1.5 text-[#0284C7] font-bold">({log.entity_id})</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px] max-w-md break-words">
                      {log.details}
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
