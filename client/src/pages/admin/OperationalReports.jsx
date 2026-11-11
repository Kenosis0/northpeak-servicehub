import React, { useState, useEffect } from 'react';
import { BarChart3, Download, Printer, Filter } from 'lucide-react';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

const REPORT_CATEGORIES = [
  { id: 'inquiries', label: 'Aircon Purchase Inquiries' },
  { id: 'requests', label: 'Service Requests (4 Types)' },
  { id: 'quotations', label: 'Quotations & Revisions' },
  { id: 'work_orders', label: 'Technician Work Orders' },
  { id: 'inventory', label: 'Spare Parts Inventory' },
  { id: 'payments', label: 'Offline Payments Ledger' }
];

export default function OperationalReports() {
  const [category, setCategory] = useState('requests');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reports', {
        params: {
          category,
          start_date: startDate || undefined,
          end_date: endDate || undefined
        }
      });
      setReportData(res.data);
    } catch (err) {
      console.error('Failed to generate report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [category]);

  const records = reportData?.records || [];
  const summary = reportData?.summary || {};

  const handleExportCsv = () => {
    if (!records || records.length === 0) return;
    const headers = Object.keys(records[0]);
    const csvRows = [
      headers.join(','),
      ...records.map((row) =>
        headers
          .map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`)
          .join(',')
      )
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NorthPeak_Report_${category}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">
            Operational Report Generator & CSV / Print Exporter
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Filter operational datasets across Inquiries, Requests, Quotations, Work Orders, Inventory, and Payments (FR-010 / TC-013).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={records.length === 0}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-wrap items-end gap-4 text-xs no-print">
        <div className="flex-1 min-w-[200px]">
          <label className="block font-bold uppercase text-slate-600 mb-1">
            Report Module / Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-900"
          >
            {REPORT_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-bold uppercase text-slate-600 mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300"
          />
        </div>

        <div>
          <label className="block font-bold uppercase text-slate-600 mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300"
          />
        </div>

        <button
          onClick={fetchReport}
          className="px-5 py-2.5 rounded-xl bg-[#0284C7] hover:bg-sky-700 text-white font-bold flex items-center gap-1.5"
        >
          <Filter className="w-4 h-4" />
          Apply Date Filter
        </button>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Object.entries(summary).map(([key, val]) => (
          <div
            key={key}
            className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"
          >
            <div className="text-[11px] font-bold uppercase text-slate-500">
              {key.replace(/_/g, ' ')}
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">
              {key.includes('value') || key.includes('valuation') || key.includes('collected')
                ? `₱${Number(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                : val}
            </div>
          </div>
        ))}
      </div>

      {/* Dynamic Report Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#0284C7]" />
            <h2 className="font-bold text-sm text-slate-900 uppercase">
              {REPORT_CATEGORIES.find((c) => c.id === category)?.label} ({records.length} Records)
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Generating report...</div>
          ) : records.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No records found for the selected filter criteria.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                  {Object.keys(records[0])
                    .slice(0, 8)
                    .map((col) => (
                      <th key={col} className="py-3 px-4 font-bold">
                        {col.replace(/_/g, ' ')}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    {Object.keys(records[0])
                      .slice(0, 8)
                      .map((col) => {
                        const val = row[col];
                        const isStatusCol = col.includes('status') || col === 'quote_stage';
                        return (
                          <td key={col} className="py-3 px-4 text-slate-800">
                            {isStatusCol && typeof val === 'string' ? (
                              <StatusBadge status={val} />
                            ) : (
                              String(val ?? '—')
                            )}
                          </td>
                        );
                      })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
