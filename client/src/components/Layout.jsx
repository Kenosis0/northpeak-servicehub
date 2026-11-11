import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Wind,
  LayoutDashboard,
  ShoppingBag,
  Wrench,
  FileText,
  QrCode,
  CalendarClock,
  Package,
  Boxes,
  Users,
  BarChart3,
  ShieldAlert,
  Bell,
  LogOut,
  Menu,
  X,
  CheckCheck,
  UserCheck
} from 'lucide-react';
import { useAuth, getRoleHomePath } from '../context/AuthContext';
import api from '../services/api';

const NAV_CONFIG = {
  Customer: [
    { to: '/customer', label: 'My Dashboard', icon: LayoutDashboard, end: true },
    { to: '/customer/catalog', label: 'Aircon Catalog & Inquiry', icon: ShoppingBag },
    { to: '/customer/requests', label: 'My Service Requests', icon: Wrench },
    { to: '/customer/quotations', label: 'My Quotations', icon: FileText },
    { to: '/customer/equipment', label: 'My AC Units & QR History', icon: QrCode }
  ],
  'Service Staff': [
    { to: '/staff', label: 'Staff Dashboard', icon: LayoutDashboard, end: true },
    { to: '/staff/inquiries', label: 'Purchase Inquiries', icon: ShoppingBag },
    { to: '/staff/requests', label: 'Service Requests & Pay', icon: Wrench },
    { to: '/staff/quotations', label: 'Quotation Builder', icon: FileText },
    { to: '/staff/dispatch', label: 'Conflict-Free Dispatch', icon: CalendarClock },
    { to: '/staff/equipment', label: 'Customer AC & QR Units', icon: QrCode },
    { to: '/staff/catalog', label: 'Aircon Product Catalog', icon: Package }
  ],
  Technician: [
    { to: '/technician', label: 'Tech Dispatch Queue', icon: LayoutDashboard, end: true },
    { to: '/technician/scanner', label: 'QR Code Unit Lookup', icon: QrCode },
    { to: '/technician/execution', label: 'Work Order Execution', icon: Wrench }
  ],
  'Inventory Staff': [
    { to: '/inventory', label: 'Warehouse Overview', icon: LayoutDashboard, end: true },
    { to: '/inventory/parts', label: 'Spare Parts Catalog', icon: Boxes },
    { to: '/inventory/console', label: 'Work Order Parts Console', icon: Package }
  ],
  Administrator: [
    { to: '/admin', label: 'Executive KPI Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/users', label: 'User & 5-Role RBAC', icon: Users },
    { to: '/admin/reports', label: 'Operational Reports', icon: BarChart3 },
    { to: '/admin/audit-logs', label: 'Immutable Audit Trail', icon: ShieldAlert },
    { to: '/staff/inquiries', label: 'Sales Inquiries Console', icon: ShoppingBag },
    { to: '/staff/requests', label: 'Service Requests', icon: Wrench },
    { to: '/staff/quotations', label: 'Quotations & Revisions', icon: FileText },
    { to: '/staff/dispatch', label: 'Technician Dispatch', icon: CalendarClock },
    { to: '/inventory/parts', label: 'Warehouse Inventory', icon: Boxes }
  ]
};

const QUICK_SWITCH_ACCOUNTS = [
  { role: 'Customer', email: 'customer1@gmail.com', label: 'Customer (Marco)' },
  { role: 'Service Staff', email: 'staff@northpeak.ph', label: 'Service Staff (Camille)' },
  { role: 'Technician', email: 'tech1@northpeak.ph', label: 'Technician (Arnel)' },
  { role: 'Inventory Staff', email: 'inventory@northpeak.ph', label: 'Inventory Staff (Liza)' },
  { role: 'Administrator', email: 'admin@northpeak.ph', label: 'Administrator (Roberto)' }
];

export default function Layout({ children }) {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [switchingRole, setSwitchingRole] = useState(false);

  const navItems = NAV_CONFIG[user?.role] || [];

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unread_count || 0);
    } catch {
      // Ignore background notification errors
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user?.user_id]);

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // Ignore
    }
  };

  const handleQuickRoleSwitch = async (acct) => {
    try {
      setSwitchingRole(true);
      const loggedUser = await login(acct.email, 'Password123!');
      navigate(getRoleHomePath(loggedUser.role));
    } catch (err) {
      alert(err.response?.data?.message || 'Quick role switch failed.');
    } finally {
      setSwitchingRole(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/60 lg:hidden no-print"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar (#0F172A Deep Navy) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0F172A] text-slate-200 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 no-print ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="px-5 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0284C7] flex items-center justify-center text-white shadow-lg shadow-sky-900/40">
              <Wind className="w-6 h-6" />
            </div>
            <div>
              <div className="font-extrabold text-white tracking-tight text-base leading-none">
                NorthPeak
              </div>
              <div className="text-[11px] text-sky-400 font-semibold tracking-wider uppercase mt-1">
                ServiceHub HVAC
              </div>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active User Card */}
        <div className="px-5 py-4 bg-slate-900/80 border-b border-slate-800">
          <div className="text-xs font-bold uppercase tracking-wider text-sky-400">
            {user?.role} Portal
          </div>
          <div className="text-sm font-semibold text-white truncate mt-0.5">
            {user?.full_name}
          </div>
          <div className="text-xs text-slate-400 truncate">{user?.email}</div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#0284C7] text-white shadow-md shadow-sky-950/50'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Quick Defense Role Switcher in Sidebar Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/50">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1.5 flex items-center gap-1">
            <UserCheck className="w-3 h-3 text-sky-400" />
            1-Click Demo Role Switch
          </div>
          <div className="grid grid-cols-1 gap-1 mb-3">
            {QUICK_SWITCH_ACCOUNTS.map((acct) => (
              <button
                key={acct.role}
                disabled={switchingRole || user?.email === acct.email}
                onClick={() => handleQuickRoleSwitch(acct)}
                className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                  user?.email === acct.email
                    ? 'bg-sky-950/90 text-sky-300 border border-sky-700/60 cursor-default'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="truncate">{acct.role}</span>
                {user?.email === acct.email && (
                  <span className="text-[10px] bg-sky-500/20 text-sky-300 px-1.5 py-0.2 rounded">
                    Active
                  </span>
                )}
              </button>
            ))}
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-600/20 text-rose-300 hover:bg-rose-600 hover:text-white border border-rose-500/30 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-20 no-print">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:inline">
                NorthPeak Aircon & Refrigeration System Trading
              </span>
              <div className="text-sm font-bold text-slate-800 sm:hidden">
                NorthPeak ServiceHub
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden md:inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-[#0284C7] border border-sky-200">
              Role: {user?.role}
            </span>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                onClick={() => {
                  setNotifOpen(!notifOpen);
                  if (!notifOpen) fetchNotifications();
                }}
                className="relative p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50">
                  <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
                    <span className="font-bold text-xs uppercase tracking-wider">
                      System Alerts ({unreadCount} Unread)
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.notification_id}
                          className={`p-3.5 text-xs ${
                            n.is_read ? 'bg-white text-slate-600' : 'bg-sky-50/60 text-slate-900'
                          }`}
                        >
                          <div className="font-bold text-slate-800 mb-0.5">{n.title}</div>
                          <div className="text-slate-600 leading-relaxed">{n.message}</div>
                          <div className="text-[10px] text-slate-400 mt-1">{n.created_at}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
