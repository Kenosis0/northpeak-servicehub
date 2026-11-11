import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Boxes,
  AlertTriangle,
  Package,
  ArrowRight,
  History,
  CheckCircle2
} from 'lucide-react';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

export default function InventoryDashboard() {
  const [items, setItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadWarehouse() {
      try {
        const [invRes, txRes] = await Promise.all([
          api.get('/inventory'),
          api.get('/inventory/transactions')
        ]);
        setItems(invRes.data.items || []);
        setTransactions((txRes.data.transactions || []).slice(0, 8));
      } catch (err) {
        console.error('Failed to load inventory dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadWarehouse();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading warehouse overview...</div>;
  }

  const lowStockItems = items.filter((i) => i.is_low_stock);
  const totalReserved = items.reduce((s, i) => s + Number(i.reserved_qty || 0), 0);
  const totalValuation = items.reduce(
    (s, i) => s + Number(i.total_stock_qty || 0) * Number(i.unit_price || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-[#0F172A] rounded-2xl p-6 text-white shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
            Spare Parts & Consumables Warehouse
          </span>
          <h1 className="text-2xl font-extrabold mt-1">
            Inventory Staff Control Center
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Formula: Available Stock = Total Stock − Reserved Qty. Execute Work-Order-linked Reservations, Issues, Returns, and Adjustments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/inventory/parts"
            className="px-4 py-2.5 rounded-xl bg-[#0284C7] hover:bg-sky-600 text-xs font-bold text-white flex items-center gap-1.5"
          >
            <Boxes className="w-4 h-4" />
            Spare Parts Catalog
          </Link>
          <Link
            to="/inventory/console"
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1.5"
          >
            <Package className="w-4 h-4" />
            Work Order Parts Console
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500">Active Part SKUs</span>
            <Boxes className="w-5 h-5 text-[#0284C7]" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2">{items.length}</div>
          <div className="text-xs text-slate-500 mt-1">Capacitors, Freon, Compressors, Tubing</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-rose-600">Low-Stock Alerts</span>
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          </div>
          <div className="text-3xl font-extrabold text-rose-600 mt-2">{lowStockItems.length}</div>
          <div className="text-xs text-rose-700 font-semibold mt-1">
            Available Stock ≤ Reorder Level
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500">
              Reserved for Work Orders
            </span>
            <Package className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2">{totalReserved}</div>
          <div className="text-xs text-amber-700 font-semibold mt-1">
            Allocated to scheduled technicians
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500">
              Total Warehouse Valuation
            </span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">
            ₱{totalValuation.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-1">Based on physical stock on hand</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Low Stock Alert Table */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-rose-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <h2 className="font-bold text-sm text-rose-950">
                Critical Low-Stock Items Requiring Replenishment
              </h2>
            </div>
            <Link
              to="/inventory/console"
              className="text-xs font-bold text-rose-700 hover:underline"
            >
              Restock / Adjust →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                  <th className="py-2.5 px-4 font-bold">SKU & Part</th>
                  <th className="py-2.5 px-4 font-bold text-right">Total</th>
                  <th className="py-2.5 px-4 font-bold text-right">Reserved</th>
                  <th className="py-2.5 px-4 font-bold text-right">Available</th>
                  <th className="py-2.5 px-4 font-bold text-right">Reorder</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lowStockItems.map((item) => (
                  <tr key={item.item_id} className="bg-rose-50/30">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{item.part_name}</div>
                      <div className="font-mono text-[11px] text-slate-500">{item.sku_code}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">{item.total_stock_qty}</td>
                    <td className="py-3 px-4 text-right font-mono">{item.reserved_qty}</td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-rose-600">
                      {item.available_stock} {item.unit_of_measure}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      {item.reorder_level}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Stock Movements */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#0284C7]" />
              <h2 className="font-bold text-sm text-slate-900">Recent Stock Movement Ledger</h2>
            </div>
            <Link
              to="/inventory/console"
              className="text-xs font-semibold text-[#0284C7] hover:underline"
            >
              Open Console →
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {transactions.map((tx) => (
              <div
                key={tx.transaction_id}
                className="p-3.5 flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={tx.tx_type} />
                    <span className="font-bold text-slate-900">
                      {tx.quantity} {tx.unit_of_measure} — {tx.part_name}
                    </span>
                  </div>
                  <div className="text-slate-500 mt-1">
                    {tx.work_order_no ? `Linked WO: ${tx.work_order_no} • ` : ''}
                    {tx.remarks}
                  </div>
                </div>
                <div className="text-right text-[11px] text-slate-400 shrink-0">
                  <div>{tx.performed_by_name}</div>
                  <div>{tx.created_at}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
