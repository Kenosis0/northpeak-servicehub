import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth, getRoleHomePath } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Customer Pages
import CustomerDashboard from './pages/customer/CustomerDashboard';
import ProductCatalogInquiry from './pages/customer/ProductCatalogInquiry';
import MyServiceRequests from './pages/customer/MyServiceRequests';
import MyQuotations from './pages/customer/MyQuotations';
import MyEquipmentHistory from './pages/customer/MyEquipmentHistory';

// Service Staff Pages
import StaffDashboard from './pages/staff/StaffDashboard';
import ManageInquiries from './pages/staff/ManageInquiries';
import ManageServiceRequests from './pages/staff/ManageServiceRequests';
import QuotationBuilder from './pages/staff/QuotationBuilder';
import ScheduleDispatch from './pages/staff/ScheduleDispatch';
import CustomerEquipmentManager from './pages/staff/CustomerEquipmentManager';
import ProductCatalogManager from './pages/staff/ProductCatalogManager';

// Technician Pages
import TechDashboard from './pages/technician/TechDashboard';
import QRScannerLookup from './pages/technician/QRScannerLookup';
import WorkOrderExecution from './pages/technician/WorkOrderExecution';

// Inventory Staff Pages
import InventoryDashboard from './pages/inventory/InventoryDashboard';
import SparePartsCatalog from './pages/inventory/SparePartsCatalog';
import WorkOrderPartsConsole from './pages/inventory/WorkOrderPartsConsole';

// Administrator Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import UserRoleManagement from './pages/admin/UserRoleManagement';
import OperationalReports from './pages/admin/OperationalReports';
import AuditTrailViewer from './pages/admin/AuditTrailViewer';

function RootRedirect() {
  const { user, token } = useAuth();
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={getRoleHomePath(user.role)} replace />;
}

function ProtectedShell({ allowedRoles, children }) {
  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Customer Portal Routes */}
          <Route
            path="/customer"
            element={
              <ProtectedShell allowedRoles={['Customer']}>
                <CustomerDashboard />
              </ProtectedShell>
            }
          />
          <Route
            path="/customer/catalog"
            element={
              <ProtectedShell allowedRoles={['Customer']}>
                <ProductCatalogInquiry />
              </ProtectedShell>
            }
          />
          <Route
            path="/customer/requests"
            element={
              <ProtectedShell allowedRoles={['Customer']}>
                <MyServiceRequests />
              </ProtectedShell>
            }
          />
          <Route
            path="/customer/quotations"
            element={
              <ProtectedShell allowedRoles={['Customer']}>
                <MyQuotations />
              </ProtectedShell>
            }
          />
          <Route
            path="/customer/equipment"
            element={
              <ProtectedShell allowedRoles={['Customer']}>
                <MyEquipmentHistory />
              </ProtectedShell>
            }
          />

          {/* Service Staff Portal Routes */}
          <Route
            path="/staff"
            element={
              <ProtectedShell allowedRoles={['Service Staff', 'Administrator']}>
                <StaffDashboard />
              </ProtectedShell>
            }
          />
          <Route
            path="/staff/inquiries"
            element={
              <ProtectedShell allowedRoles={['Service Staff', 'Administrator']}>
                <ManageInquiries />
              </ProtectedShell>
            }
          />
          <Route
            path="/staff/requests"
            element={
              <ProtectedShell allowedRoles={['Service Staff', 'Administrator']}>
                <ManageServiceRequests />
              </ProtectedShell>
            }
          />
          <Route
            path="/staff/quotations"
            element={
              <ProtectedShell allowedRoles={['Service Staff', 'Administrator']}>
                <QuotationBuilder />
              </ProtectedShell>
            }
          />
          <Route
            path="/staff/dispatch"
            element={
              <ProtectedShell allowedRoles={['Service Staff', 'Administrator']}>
                <ScheduleDispatch />
              </ProtectedShell>
            }
          />
          <Route
            path="/staff/equipment"
            element={
              <ProtectedShell allowedRoles={['Service Staff', 'Administrator']}>
                <CustomerEquipmentManager />
              </ProtectedShell>
            }
          />
          <Route
            path="/staff/catalog"
            element={
              <ProtectedShell allowedRoles={['Service Staff', 'Administrator']}>
                <ProductCatalogManager />
              </ProtectedShell>
            }
          />

          {/* Technician Mobile Portal Routes */}
          <Route
            path="/technician"
            element={
              <ProtectedShell allowedRoles={['Technician', 'Service Staff', 'Administrator']}>
                <TechDashboard />
              </ProtectedShell>
            }
          />
          <Route
            path="/technician/scanner"
            element={
              <ProtectedShell allowedRoles={['Technician', 'Service Staff', 'Administrator']}>
                <QRScannerLookup />
              </ProtectedShell>
            }
          />
          <Route
            path="/technician/execution"
            element={
              <ProtectedShell allowedRoles={['Technician', 'Service Staff', 'Administrator']}>
                <WorkOrderExecution />
              </ProtectedShell>
            }
          />

          {/* Inventory Staff Portal Routes */}
          <Route
            path="/inventory"
            element={
              <ProtectedShell allowedRoles={['Inventory Staff', 'Administrator']}>
                <InventoryDashboard />
              </ProtectedShell>
            }
          />
          <Route
            path="/inventory/parts"
            element={
              <ProtectedShell allowedRoles={['Inventory Staff', 'Administrator']}>
                <SparePartsCatalog />
              </ProtectedShell>
            }
          />
          <Route
            path="/inventory/console"
            element={
              <ProtectedShell allowedRoles={['Inventory Staff', 'Administrator']}>
                <WorkOrderPartsConsole />
              </ProtectedShell>
            }
          />

          {/* Administrator Portal Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedShell allowedRoles={['Administrator']}>
                <AdminDashboard />
              </ProtectedShell>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedShell allowedRoles={['Administrator']}>
                <UserRoleManagement />
              </ProtectedShell>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <ProtectedShell allowedRoles={['Administrator', 'Service Staff', 'Inventory Staff']}>
                <OperationalReports />
              </ProtectedShell>
            }
          />
          <Route
            path="/admin/audit-logs"
            element={
              <ProtectedShell allowedRoles={['Administrator']}>
                <AuditTrailViewer />
              </ProtectedShell>
            }
          />

          {/* Fallback Redirect */}
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
