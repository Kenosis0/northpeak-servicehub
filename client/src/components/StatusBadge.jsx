import React from 'react';

const STATUS_STYLES = {
  // Emerald (#10B981) — Approved, Completed, Paid, Active
  Approved: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  Completed: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'Fully Paid': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'Stock Confirmed': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  Active: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  Healthy: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  Inverter: 'bg-emerald-50 text-emerald-700 border-emerald-200',

  // Amber (#F59E0B) — Pending, Review, Downpayment, Temporary, Revision
  Submitted: 'bg-amber-100 text-amber-800 border-amber-300',
  'Pending Review': 'bg-amber-100 text-amber-800 border-amber-300',
  'Under Review': 'bg-amber-100 text-amber-800 border-amber-300',
  'Pending Customer Review': 'bg-amber-100 text-amber-800 border-amber-300',
  'Revision Requested': 'bg-amber-100 text-amber-800 border-amber-300',
  'Awaiting Payment': 'bg-amber-100 text-amber-800 border-amber-300',
  'Downpayment Received': 'bg-amber-100 text-amber-800 border-amber-300',
  Temporary: 'bg-amber-50 text-amber-700 border-amber-300',
  'Under Repair': 'bg-amber-100 text-amber-800 border-amber-300',
  Reservation: 'bg-amber-100 text-amber-800 border-amber-300',
  High: 'bg-amber-100 text-amber-800 border-amber-300',

  // Arctic Blue (#0284C7) — Quoted, Scheduled, In Progress, Finalized
  Quoted: 'bg-sky-100 text-sky-800 border-sky-300',
  Scheduled: 'bg-sky-100 text-sky-800 border-sky-300',
  'En Route': 'bg-sky-100 text-sky-800 border-sky-300',
  'In Progress': 'bg-sky-100 text-sky-800 border-sky-300',
  Finalized: 'bg-sky-100 text-sky-800 border-sky-300',
  Issue: 'bg-sky-100 text-sky-800 border-sky-300',
  Normal: 'bg-sky-50 text-sky-700 border-sky-200',

  // Rose (#EF4444) — Cancelled, Unpaid, Conflict, Urgent, Low Stock
  Cancelled: 'bg-rose-100 text-rose-800 border-rose-300',
  'Rejected/Cancelled': 'bg-rose-100 text-rose-800 border-rose-300',
  Unpaid: 'bg-rose-100 text-rose-800 border-rose-300',
  Urgent: 'bg-rose-100 text-rose-800 border-rose-300',
  'Low Stock': 'bg-rose-100 text-rose-800 border-rose-300',
  Decommissioned: 'bg-rose-100 text-rose-800 border-rose-300',
  Locked: 'bg-rose-100 text-rose-800 border-rose-300',

  // Slate — Superseded, Return, Adjustment, Low
  Superseded: 'bg-slate-200 text-slate-600 border-slate-300 line-through',
  Return: 'bg-purple-100 text-purple-800 border-purple-300',
  Adjustment: 'bg-slate-200 text-slate-700 border-slate-300',
  Low: 'bg-slate-100 text-slate-600 border-slate-200'
};

export default function StatusBadge({ status, className = '' }) {
  if (!status) return null;
  const style = STATUS_STYLES[status] || 'bg-slate-100 text-slate-700 border-slate-300';
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style} ${className}`}
    >
      {status}
    </span>
  );
}
