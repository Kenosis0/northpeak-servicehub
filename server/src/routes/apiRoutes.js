const express = require('express');
const router = express.Router();

const { verifyToken, requireRoles } = require('../middleware/authMiddleware');
const { uploadEvidence } = require('../middleware/uploadMiddleware');

const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const customerEquipmentController = require('../controllers/customerEquipmentController');
const productInquiryController = require('../controllers/productInquiryController');
const serviceRequestController = require('../controllers/serviceRequestController');
const quotationController = require('../controllers/quotationController');
const workOrderController = require('../controllers/workOrderController');
const inventoryController = require('../controllers/inventoryController');
const reportDashboardController = require('../controllers/reportDashboardController');

// ----------------------------------------------------------------------------
// Health Check
// ----------------------------------------------------------------------------
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'NorthPeak ServiceHub REST API',
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// ----------------------------------------------------------------------------
// 1. Auth & In-App Notifications
// ----------------------------------------------------------------------------
router.post('/auth/login', authController.login);
router.post('/auth/register', authController.register);
router.get('/auth/me', verifyToken, authController.getMe);
router.get('/notifications', verifyToken, authController.getNotifications);
router.patch('/notifications/read-all', verifyToken, authController.markAllNotificationsRead);
router.patch('/notifications/:id/read', verifyToken, authController.markNotificationRead);

// ----------------------------------------------------------------------------
// 2. User & RBAC Management (Strict Administrator Isolation — TC-014)
// ----------------------------------------------------------------------------
router.get('/users', verifyToken, requireRoles('Administrator'), userController.getAllUsers);
router.post('/users', verifyToken, requireRoles('Administrator'), userController.createUser);
router.patch('/users/:id', verifyToken, requireRoles('Administrator'), userController.updateUser);
router.put('/users/:id', verifyToken, requireRoles('Administrator'), userController.updateUser);

// Active Technicians lookup for Dispatch Calendar
router.get(
  '/technicians',
  verifyToken,
  requireRoles('Service Staff', 'Technician', 'Administrator'),
  userController.getActiveTechnicians
);

// ----------------------------------------------------------------------------
// 3. Customers, Product Catalog & QR Equipment
// ----------------------------------------------------------------------------
router.get(
  '/customers',
  verifyToken,
  requireRoles('Customer', 'Service Staff', 'Technician', 'Administrator'),
  customerEquipmentController.getCustomers
);

// Public / All-role catalog browsing
router.get('/products', customerEquipmentController.getProducts);
router.post(
  '/products',
  verifyToken,
  requireRoles('Service Staff', 'Administrator'),
  customerEquipmentController.createProduct
);
router.put(
  '/products/:id',
  verifyToken,
  requireRoles('Service Staff', 'Administrator'),
  customerEquipmentController.updateProduct
);
router.patch(
  '/products/:id',
  verifyToken,
  requireRoles('Service Staff', 'Administrator'),
  customerEquipmentController.updateProduct
);

// Registered Equipment & QR Token Lookup (TC-004, TC-014)
router.get(
  '/equipment/qr/:token',
  verifyToken,
  requireRoles('Technician', 'Service Staff', 'Customer', 'Administrator'),
  customerEquipmentController.getEquipmentByQrToken
);
router.get(
  '/equipment',
  verifyToken,
  requireRoles('Customer', 'Service Staff', 'Technician', 'Inventory Staff', 'Administrator'),
  customerEquipmentController.getEquipmentList
);
router.post(
  '/equipment',
  verifyToken,
  requireRoles('Service Staff', 'Administrator'),
  customerEquipmentController.registerEquipment
);
router.put(
  '/equipment/:id',
  verifyToken,
  requireRoles('Service Staff', 'Administrator'),
  customerEquipmentController.updateEquipment
);
router.patch(
  '/equipment/:id',
  verifyToken,
  requireRoles('Service Staff', 'Administrator'),
  customerEquipmentController.updateEquipment
);

// ----------------------------------------------------------------------------
// 4. Aircon Purchase Inquiries & Optional Installation Handoff (FR-005, TC-005)
// ----------------------------------------------------------------------------
router.get(
  '/inquiries',
  verifyToken,
  requireRoles('Customer', 'Service Staff', 'Inventory Staff', 'Administrator'),
  productInquiryController.getInquiries
);
router.post(
  '/inquiries',
  verifyToken,
  requireRoles('Customer', 'Service Staff', 'Administrator'),
  productInquiryController.createInquiry
);
router.patch(
  '/inquiries/:id/process',
  verifyToken,
  requireRoles('Service Staff', 'Administrator'),
  productInquiryController.processInquiry
);

// ----------------------------------------------------------------------------
// 5. Multi-Type Service Requests & Staff-Recorded Payments (FR-006, TC-006)
// ----------------------------------------------------------------------------
router.get(
  '/requests',
  verifyToken,
  requireRoles('Customer', 'Service Staff', 'Technician', 'Inventory Staff', 'Administrator'),
  serviceRequestController.getServiceRequests
);
router.get(
  '/requests/:id',
  verifyToken,
  requireRoles('Customer', 'Service Staff', 'Technician', 'Inventory Staff', 'Administrator'),
  serviceRequestController.getServiceRequestById
);
router.post(
  '/requests',
  verifyToken,
  requireRoles('Customer', 'Service Staff', 'Administrator'),
  serviceRequestController.createServiceRequest
);
router.patch(
  '/requests/:id/status',
  verifyToken,
  requireRoles('Service Staff', 'Administrator'),
  serviceRequestController.updateServiceRequestStatus
);
router.patch(
  '/requests/:id/payment',
  verifyToken,
  requireRoles('Service Staff', 'Administrator'),
  serviceRequestController.recordServiceRequestPayment
);

// ----------------------------------------------------------------------------
// 6. Quotations, Downpayment Lock & Revision Increments (FR-007, TC-007, TC-008)
// ----------------------------------------------------------------------------
router.get(
  '/quotations',
  verifyToken,
  requireRoles('Customer', 'Service Staff', 'Technician', 'Administrator'),
  quotationController.getQuotations
);
router.post(
  '/quotations',
  verifyToken,
  requireRoles('Service Staff', 'Administrator'),
  quotationController.createQuotation
);
router.post(
  '/quotations/:id/decision',
  verifyToken,
  requireRoles('Customer', 'Service Staff', 'Administrator'),
  quotationController.submitQuotationDecision
);
router.patch(
  '/quotations/:id/decision',
  verifyToken,
  requireRoles('Customer', 'Service Staff', 'Administrator'),
  quotationController.submitQuotationDecision
);
router.post(
  '/quotations/:id/revise',
  verifyToken,
  requireRoles('Service Staff', 'Administrator'),
  quotationController.reviseQuotation
);

// ----------------------------------------------------------------------------
// 7. Conflict-Checked Scheduling, Work Orders & Auto-PM (FR-008, TC-009, TC-010, TC-011)
// ----------------------------------------------------------------------------
router.get(
  '/work-orders',
  verifyToken,
  requireRoles('Customer', 'Service Staff', 'Technician', 'Inventory Staff', 'Administrator'),
  workOrderController.getWorkOrders
);
router.post(
  '/work-orders/check-conflict',
  verifyToken,
  requireRoles('Service Staff', 'Administrator'),
  workOrderController.checkScheduleConflict
);
router.post(
  '/work-orders',
  verifyToken,
  requireRoles('Service Staff', 'Administrator'),
  workOrderController.createWorkOrder
);
router.patch(
  '/work-orders/:id/status',
  verifyToken,
  requireRoles('Technician', 'Service Staff', 'Administrator'),
  workOrderController.updateWorkOrderStatus
);
router.patch(
  '/work-orders/:id/complete',
  verifyToken,
  requireRoles('Technician', 'Service Staff', 'Administrator'),
  uploadEvidence.single('evidence_photo'),
  workOrderController.completeWorkOrder
);
router.post(
  '/work-orders/:id/complete',
  verifyToken,
  requireRoles('Technician', 'Service Staff', 'Administrator'),
  uploadEvidence.single('evidence_photo'),
  workOrderController.completeWorkOrder
);

// ----------------------------------------------------------------------------
// 8. Work-Order-Linked Inventory Transactions (FR-009, TC-012)
// ----------------------------------------------------------------------------
router.get(
  '/inventory',
  verifyToken,
  requireRoles('Inventory Staff', 'Service Staff', 'Technician', 'Administrator'),
  inventoryController.getInventoryItems
);
router.post(
  '/inventory',
  verifyToken,
  requireRoles('Inventory Staff', 'Administrator'),
  inventoryController.createInventoryItem
);
router.put(
  '/inventory/:id',
  verifyToken,
  requireRoles('Inventory Staff', 'Administrator'),
  inventoryController.updateInventoryItem
);
router.patch(
  '/inventory/:id',
  verifyToken,
  requireRoles('Inventory Staff', 'Administrator'),
  inventoryController.updateInventoryItem
);
router.get(
  '/inventory/transactions',
  verifyToken,
  requireRoles('Inventory Staff', 'Service Staff', 'Technician', 'Administrator'),
  inventoryController.getInventoryTransactions
);
router.post(
  '/inventory/transactions',
  verifyToken,
  requireRoles('Inventory Staff', 'Technician', 'Administrator'),
  inventoryController.createInventoryTransaction
);

// ----------------------------------------------------------------------------
// 9. Dashboards, Operational Reports & Immutable Audit Trail (FR-010, FR-011, TC-013)
// ----------------------------------------------------------------------------
router.get('/dashboard/summary', verifyToken, reportDashboardController.getDashboardSummary);
router.get(
  '/reports',
  verifyToken,
  requireRoles('Administrator', 'Service Staff', 'Inventory Staff'),
  reportDashboardController.getOperationalReports
);
router.get(
  '/audit-logs',
  verifyToken,
  requireRoles('Administrator'),
  reportDashboardController.getAuditLogs
);

module.exports = router;
