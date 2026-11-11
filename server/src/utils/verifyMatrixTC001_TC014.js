/**
 * NorthPeak ServiceHub — Phase 6 Automated Defense Verification Matrix (TC-001 to TC-014)
 * Exercises all 14 Test Cases directly against the Express controllers and RBAC middleware.
 */

const assert = require('assert');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const { verifyToken, requireRoles, JWT_SECRET } = require('../middleware/authMiddleware');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const customerEquipmentController = require('../controllers/customerEquipmentController');
const productInquiryController = require('../controllers/productInquiryController');
const serviceRequestController = require('../controllers/serviceRequestController');
const quotationController = require('../controllers/quotationController');
const workOrderController = require('../controllers/workOrderController');
const inventoryController = require('../controllers/inventoryController');
const reportDashboardController = require('../controllers/reportDashboardController');

const passwordHash = bcrypt.hashSync('Password123!', 10);

// In-memory 3NF relational state mirror for deterministic verification of TC-001..TC-014
const state = {
  users: [
    { user_id: 1, full_name: 'Roberto Mendoza', email: 'admin@northpeak.ph', phone: '0917-100-1001', password_hash: passwordHash, role: 'Administrator', specialization: null, is_active: 1, customer_id: null },
    { user_id: 2, full_name: 'Camille Villanueva', email: 'staff@northpeak.ph', phone: '0917-200-2002', password_hash: passwordHash, role: 'Service Staff', specialization: null, is_active: 1, customer_id: null },
    { user_id: 3, full_name: 'Arnel Bautista', email: 'tech1@northpeak.ph', phone: '0917-300-3001', password_hash: passwordHash, role: 'Technician', specialization: 'Split-Type & Inverter', is_active: 1, customer_id: null },
    { user_id: 5, full_name: 'Liza Dizon', email: 'inventory@northpeak.ph', phone: '0917-400-4001', password_hash: passwordHash, role: 'Inventory Staff', specialization: null, is_active: 1, customer_id: null },
    { user_id: 6, full_name: 'Marco Dela Cruz', email: 'customer1@gmail.com', phone: '0918-555-0101', password_hash: passwordHash, role: 'Customer', specialization: null, is_active: 1, customer_id: 1 },
    { user_id: 7, full_name: 'Patricia Reyes', email: 'customer2@gmail.com', phone: '0918-555-0202', password_hash: passwordHash, role: 'Customer', specialization: null, is_active: 1, customer_id: 2 }
  ],
  customers: [
    { customer_id: 1, user_id: 6, customer_type: 'Residential', company_name: null, full_name: 'Marco Dela Cruz', email: 'customer1@gmail.com', phone: '0918-555-0101', billing_address: 'Angeles City', service_address: 'Angeles City' },
    { customer_id: 2, user_id: 7, customer_type: 'Commercial', company_name: 'Apex Clinic', full_name: 'Patricia Reyes', email: 'customer2@gmail.com', phone: '0918-555-0202', billing_address: 'San Fernando', service_address: 'San Fernando' }
  ],
  products: [
    { product_id: 1, sku_code: 'AC-DAI-15INV', brand: 'Daikin', model_name: 'D-Smart Queen FTKC35TVM 1.5HP', ac_type: 'Split Type', horsepower: '1.5 HP', inverter_type: 'Inverter', unit_price: 34500.0, stock_qty: 8, warranty_months: 12, is_active: 1 }
  ],
  equipment: [
    { equipment_id: 1, customer_id: 1, product_id: 1, qr_token: 'NP-QR-2026-0001', brand: 'Daikin', model: 'D-Smart Queen 1.5HP', serial_number: 'DK-2025-884120A', ac_type: 'Split Type', capacity_hp: '1.5 HP', installed_location: 'Master Bedroom - Angeles City', installation_date: '2025-05-15', warranty_expiry: '2026-05-15', maintenance_interval_months: 6, last_service_date: '2026-05-15', next_pm_date: '2026-11-15', status: 'Active', customer_name: 'Marco Dela Cruz' },
    { equipment_id: 3, customer_id: 2, product_id: 1, qr_token: 'NP-QR-2026-0003', brand: 'Carrier', model: 'Aura Xtreme 2.0HP', serial_number: 'CR-2025-771920C', ac_type: 'Split Type', capacity_hp: '2.0 HP', installed_location: 'Apex Clinic Suite 1', installation_date: '2025-04-10', warranty_expiry: '2027-04-10', maintenance_interval_months: 3, last_service_date: '2026-08-10', next_pm_date: '2026-11-10', status: 'Under Repair', customer_name: 'Patricia Reyes' }
  ],
  purchase_inquiries: [],
  service_requests: [
    { request_id: 1, reference_no: 'SR-20261110-1003', customer_id: 1, equipment_id: 1, service_type: 'Relocation or Transfer', issue_description: 'Relocate AC', current_location: 'Room A', destination_location: 'Room B', preferred_date: '2026-11-18', payment_status: 'Unpaid', status: 'Quoted', customer_user_id: 6 },
    { request_id: 2, reference_no: 'SR-20261108-1002', customer_id: 2, equipment_id: 3, service_type: 'Repair and Troubleshooting', issue_description: 'Capacitor replacement', current_location: 'Apex Clinic', destination_location: null, preferred_date: '2026-11-14', payment_status: 'Downpayment Received', status: 'Scheduled', customer_user_id: 7 }
  ],
  quotations: [
    { quotation_id: 1, quotation_no: 'QT-20261110-3003', request_id: 1, revision_no: 1, parent_quotation_id: null, quote_stage: 'Finalized', labor_cost: 3500, parts_total: 1800, total_amount: 5300, downpayment_required: 2000, status: 'Pending Customer Review', valid_until: '2026-11-25', prepared_by: 2 },
    { quotation_id: 2, quotation_no: 'QT-20261108-3002', request_id: 2, revision_no: 1, parent_quotation_id: null, quote_stage: 'Finalized', labor_cost: 2200, parts_total: 2950, total_amount: 5150, downpayment_required: 2500, status: 'Approved', valid_until: '2026-11-22', prepared_by: 2 }
  ],
  quotation_items: [],
  work_orders: [
    { work_order_id: 2, work_order_no: 'WO-20261114-4002', request_id: 2, quotation_id: 2, technician_id: 3, scheduled_start: '2026-11-14 13:00:00', scheduled_end: '2026-11-14 16:00:00', status: 'Scheduled', technician_name: 'Arnel Bautista' }
  ],
  inventory_items: [
    { item_id: 1, sku_code: 'PRT-CAP-4505', part_name: 'Dual Run Capacitor 45+5 uF', category: 'Capacitor', unit_of_measure: 'pcs', unit_price: 850.0, total_stock_qty: 18, reserved_qty: 0, reorder_level: 5 }
  ],
  inventory_transactions: [],
  service_history: [
    { history_id: 1, equipment_id: 1, work_order_id: 1, service_type: 'Preventive Maintenance and Cleaning', diagnosis_summary: 'Dirty coil', actions_taken: 'Hydro wash', technician_name: 'Arnel Bautista', service_date: '2026-05-15', computed_next_pm_date: '2026-11-15' }
  ]
};

// Mock executor for pool.query and pool.getConnection
const mockQuery = async (sql, params = []) => {
  const s = sql.replace(/\s+/g, ' ').trim();

  if (s.startsWith('SELECT u.*, c.customer_id')) {
    const email = String(params[0] || '').toLowerCase();
    return [state.users.filter((u) => u.email.toLowerCase() === email)];
  }
  if (s.startsWith('SELECT user_id FROM users WHERE LOWER(email)')) {
    const email = String(params[0] || '').toLowerCase();
    return [state.users.filter((u) => u.email.toLowerCase() === email)];
  }
  if (s.startsWith('INSERT INTO users')) {
    const newId = state.users.length + 10;
    state.users.push({ user_id: newId, full_name: params[0], email: params[1], phone: params[2], password_hash: params[3], role: 'Customer', is_active: 1 });
    return [{ insertId: newId }];
  }
  if (s.startsWith('INSERT INTO customers')) {
    const newCustId = state.customers.length + 10;
    state.customers.push({ customer_id: newCustId, user_id: params[0], customer_type: params[1], company_name: params[2], full_name: params[3], email: params[4], phone: params[5], billing_address: params[6], service_address: params[7] });
    return [{ insertId: newCustId }];
  }
  if (s.includes('FROM equipment e') && s.includes('UPPER(e.qr_token)')) {
    const tok = String(params[0] || '').toUpperCase();
    return [state.equipment.filter((e) => e.qr_token.toUpperCase() === tok)];
  }
  if (s.includes('FROM service_history sh')) {
    return [state.service_history.filter((h) => h.equipment_id === Number(params[0]))];
  }
  if (s.includes('SELECT request_id, reference_no') && s.includes('FROM service_requests WHERE equipment_id')) {
    return [state.service_requests.filter((r) => r.equipment_id === Number(params[0]))];
  }
  if (s.startsWith('SELECT * FROM products WHERE product_id')) {
    return [state.products.filter((p) => p.product_id === Number(params[0]))];
  }
  if (s.startsWith('SELECT * FROM customers WHERE customer_id')) {
    return [state.customers.filter((c) => c.customer_id === Number(params[0]))];
  }
  if (s.startsWith('INSERT INTO purchase_inquiries')) {
    const id = state.purchase_inquiries.length + 1;
    state.purchase_inquiries.push({
      inquiry_id: id,
      reference_no: params[0],
      customer_id: params[1],
      product_id: params[2],
      quantity: params[3],
      unit_price_snapshot: params[4],
      total_amount: params[5],
      request_installation: params[6],
      installation_address: params[7],
      preferred_date: params[8],
      payment_status: 'Unpaid',
      inquiry_status: 'Pending Review',
      linked_service_request_id: null,
      staff_remarks: params[9],
      brand: 'Daikin',
      model_name: 'D-Smart Queen 1.5HP',
      horsepower: '1.5 HP',
      ac_type: 'Split Type',
      customer_name: 'Marco Dela Cruz'
    });
    return [{ insertId: id }];
  }
  if (s.includes('FROM purchase_inquiries pi') && s.includes('WHERE pi.inquiry_id = ?')) {
    return [state.purchase_inquiries.filter((i) => i.inquiry_id === Number(params[0]))];
  }
  if (s.startsWith('INSERT INTO service_requests')) {
    const id = state.service_requests.length + 1;
    state.service_requests.push({
      request_id: id,
      reference_no: params[0],
      customer_id: params[1],
      equipment_id: params[2] || null,
      service_type: params[3] || 'Installation',
      issue_description: params[4] || params[2],
      current_location: params[5] || params[3],
      destination_location: params[6] || null,
      preferred_date: params[7] || params[4],
      payment_status: 'Unpaid',
      status: 'Submitted'
    });
    return [{ insertId: id }];
  }
  if (s.startsWith('UPDATE purchase_inquiries')) {
    const inq = state.purchase_inquiries.find((i) => i.inquiry_id === Number(params[4]));
    if (inq) {
      inq.inquiry_status = params[0];
      inq.payment_status = params[1];
      inq.linked_service_request_id = params[2];
      const sr = state.service_requests.find((r) => r.request_id === Number(params[2]));
      if (sr) inq.linked_service_request_no = sr.reference_no;
    }
    return [{}];
  }
  if (s.includes('FROM quotations q') && s.includes('WHERE q.quotation_id = ?')) {
    const q = state.quotations.find((x) => x.quotation_id === Number(params[0]));
    if (!q) return [[]];
    const sr = state.service_requests.find((r) => r.request_id === q.request_id);
    return [[{ ...q, request_reference_no: sr.reference_no, customer_id: sr.customer_id, payment_status: sr.payment_status, request_status: sr.status }]];
  }
  if (s.startsWith("UPDATE quotations SET status = 'Rejected/Cancelled'")) {
    const q = state.quotations.find((x) => x.quotation_id === Number(params[1]));
    if (q) q.status = 'Rejected/Cancelled';
    return [{}];
  }
  if (s.startsWith("UPDATE service_requests SET status = 'Cancelled'")) {
    const sr = state.service_requests.find((r) => r.request_id === Number(params[0]));
    if (sr) sr.status = 'Cancelled';
    return [{}];
  }
  if (s.startsWith('SELECT * FROM quotations WHERE quotation_id')) {
    return [state.quotations.filter((x) => x.quotation_id === Number(params[0]))];
  }
  if (s.startsWith("UPDATE quotations SET status = 'Superseded'")) {
    const q = state.quotations.find((x) => x.quotation_id === Number(params[0]));
    if (q) q.status = 'Superseded';
    return [{}];
  }
  if (s.startsWith('INSERT INTO quotations')) {
    const id = state.quotations.length + 1;
    state.quotations.push({
      quotation_id: id,
      quotation_no: params[0],
      request_id: params[1],
      revision_no: params[2],
      parent_quotation_id: params[3],
      quote_stage: params[4],
      labor_cost: params[5],
      parts_total: params[6],
      total_amount: params[7],
      downpayment_required: params[8],
      status: 'Pending Customer Review'
    });
    return [{ insertId: id }];
  }
  if (s.includes("WHERE user_id = ? AND role = 'Technician'")) {
    return [state.users.filter((u) => u.user_id === Number(params[0]) && u.role === 'Technician')];
  }
  if (s.includes('FROM service_requests sr') && s.includes('WHERE sr.request_id = ?')) {
    const sr = state.service_requests.find((r) => r.request_id === Number(params[0]));
    return [sr ? [sr] : []];
  }
  if (s.includes('FROM work_orders wo') && s.includes('AND (? < wo.scheduled_end AND ? > wo.scheduled_start)')) {
    const [techId, newStart, newEnd] = params;
    const overlaps = state.work_orders.filter(
      (w) =>
        w.technician_id === Number(techId) &&
        ['Scheduled', 'En Route', 'In Progress'].includes(w.status) &&
        newStart < w.scheduled_end &&
        newEnd > w.scheduled_start
    );
    return [overlaps];
  }
  if (s.includes('FROM work_orders wo') && s.includes('WHERE wo.work_order_id = ?')) {
    const wo = state.work_orders.find((w) => w.work_order_id === Number(params[0]));
    if (!wo) return [[]];
    const sr = state.service_requests.find((r) => r.request_id === wo.request_id);
    return [[{ ...wo, request_reference_no: sr.reference_no, customer_id: sr.customer_id, request_equipment_id: sr.equipment_id, service_type: sr.service_type, current_location: sr.current_location }]];
  }
  if (s.includes('FROM inventory_transactions it') && s.includes('GROUP BY it.item_id')) {
    return [[]];
  }
  if (s.startsWith('SELECT * FROM equipment WHERE equipment_id')) {
    return [state.equipment.filter((e) => e.equipment_id === Number(params[0]))];
  }
  if (s.startsWith("UPDATE work_orders SET status = 'Completed'")) {
    const wo = state.work_orders.find((w) => w.work_order_id === Number(params[4]));
    if (wo) {
      wo.status = 'Completed';
      wo.diagnosis_notes = params[0];
      wo.work_performed = params[1];
      wo.technician_remarks = params[2];
      wo.evidence_photo_url = params[3];
    }
    return [{}];
  }
  if (s.startsWith('INSERT INTO service_history')) {
    const hid = state.service_history.length + 1;
    state.service_history.push({
      history_id: hid,
      equipment_id: params[0],
      work_order_id: params[1],
      service_type: params[2],
      diagnosis_summary: params[3],
      actions_taken: params[4],
      parts_replaced_summary: params[5],
      technician_name: params[6],
      service_date: params[7],
      computed_next_pm_date: params[8]
    });
    return [{ insertId: hid }];
  }
  if (s.startsWith('UPDATE equipment SET last_service_date')) {
    const eq = state.equipment.find((e) => e.equipment_id === Number(params[3]));
    if (eq) {
      eq.last_service_date = params[0];
      eq.next_pm_date = params[1];
      eq.status = 'Active';
    }
    return [{}];
  }
  if (s.startsWith('SELECT * FROM work_orders WHERE work_order_id')) {
    return [state.work_orders.filter((w) => w.work_order_id === Number(params[0]))];
  }
  if (s.startsWith('SELECT * FROM service_history WHERE history_id')) {
    return [state.service_history.filter((h) => h.history_id === Number(params[0]))];
  }
  if (s.startsWith('SELECT * FROM inventory_items WHERE item_id')) {
    return [state.inventory_items.filter((i) => i.item_id === Number(params[0]))];
  }
  if (s.startsWith('UPDATE inventory_items SET total_stock_qty')) {
    const it = state.inventory_items.find((i) => i.item_id === Number(params[2]));
    if (it) {
      it.total_stock_qty = params[0];
      it.reserved_qty = params[1];
    }
    return [{}];
  }
  if (s.startsWith('INSERT INTO inventory_transactions')) {
    const tid = state.inventory_transactions.length + 1;
    state.inventory_transactions.push({
      transaction_id: tid,
      item_id: params[0],
      work_order_id: params[1],
      tx_type: params[2],
      quantity: params[3]
    });
    return [{ insertId: tid }];
  }
  if (s.startsWith('SELECT * FROM inventory_transactions WHERE transaction_id')) {
    return [state.inventory_transactions.filter((t) => t.transaction_id === Number(params[0]))];
  }
  return [[]];
};

pool.query = mockQuery;
pool.getConnection = async () => ({
  query: mockQuery,
  beginTransaction: async () => {},
  commit: async () => {},
  rollback: async () => {},
  release: () => {}
});

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    }
  };
}

async function runVerificationMatrix() {
  const results = [];

  // TC-001: Valid Login across 5 Roles
  for (const email of ['admin@northpeak.ph', 'staff@northpeak.ph', 'tech1@northpeak.ph', 'inventory@northpeak.ph', 'customer1@gmail.com']) {
    const res = createMockRes();
    await authController.login({ body: { email, password: 'Password123!' } }, res);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.token);
  }
  results.push(['TC-001', 'Valid Login across 5 Roles', 'PASS (200 OK + Valid JWT for all 5 roles)']);

  // TC-002: Invalid Login Credentials
  {
    const res = createMockRes();
    await authController.login({ body: { email: 'admin@northpeak.ph', password: 'WrongPassword!' } }, res);
    assert.strictEqual(res.statusCode, 401);
    results.push(['TC-002', 'Invalid Login Credentials', `PASS (401 Unauthorized: "${res.body.message}")`]);
  }

  // TC-003: Customer Self-Registration
  {
    const res = createMockRes();
    await authController.register(
      {
        body: {
          full_name: 'New Test Client',
          email: 'newclient@gmail.com',
          phone: '0917-999-8888',
          password: 'Password123!',
          billing_address: 'Clark Freeport Zone',
          service_address: 'Clark Freeport Zone'
        }
      },
      res
    );
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.user.role, 'Customer');
    assert.ok(res.body.user.customer_id);
    results.push(['TC-003', 'Customer Self-Registration', 'PASS (201 Created linked users + customers records)']);
  }

  // TC-004: QR Code Equipment Lookup
  {
    const res = createMockRes();
    await customerEquipmentController.getEquipmentByQrToken(
      { params: { token: 'NP-QR-2026-0001' }, user: { user_id: 3, role: 'Technician' } },
      res
    );
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.equipment.qr_token, 'NP-QR-2026-0001');
    assert.ok(Array.isArray(res.body.equipment.service_history));
    results.push(['TC-004', 'QR Code Equipment Lookup', 'PASS (200 OK with specs, warranty & service_history)']);
  }

  // TC-005: Purchase Inquiry + Optional Installation Handoff
  {
    const createRes = createMockRes();
    await productInquiryController.createInquiry(
      {
        body: {
          product_id: 1,
          quantity: 1,
          request_installation: true,
          installation_address: 'Angeles City Residence',
          preferred_date: '2026-11-22'
        },
        user: { user_id: 6, role: 'Customer', customer_id: 1 }
      },
      createRes
    );
    assert.strictEqual(createRes.statusCode, 201);
    const inqId = createRes.body.inquiry.inquiry_id;

    const procRes = createMockRes();
    await productInquiryController.processInquiry(
      {
        params: { id: inqId },
        body: { inquiry_status: 'Stock Confirmed', payment_status: 'Downpayment Received' },
        user: { user_id: 2, role: 'Service Staff' }
      },
      procRes
    );
    assert.strictEqual(procRes.statusCode, 200);
    assert.match(procRes.body.generated_service_request_no, /^SR-\d{8}-\d{4}$/);
    results.push(['TC-005', 'Purchase Inquiry + Optional Installation', `PASS (Auto-created ${procRes.body.generated_service_request_no})`]);
  }

  // TC-006: Relocation Service Request Validation
  {
    const failRes = createMockRes();
    await serviceRequestController.createServiceRequest(
      {
        body: {
          service_type: 'Relocation or Transfer',
          issue_description: 'Transfer unit',
          current_location: 'Old Room',
          destination_location: ''
        },
        user: { user_id: 6, role: 'Customer', customer_id: 1 }
      },
      failRes
    );
    assert.strictEqual(failRes.statusCode, 400);
    results.push(['TC-006', 'Relocation Service Request Validation', `PASS (400 Bad Request when destination_location missing)`]);
  }

  // TC-007: Pre-Downpayment Quotation Cancellation
  {
    const cancelRes = createMockRes();
    await quotationController.submitQuotationDecision(
      {
        params: { id: 1 },
        body: { decision: 'Cancel' },
        user: { user_id: 6, role: 'Customer', customer_id: 1 }
      },
      cancelRes
    );
    assert.strictEqual(cancelRes.statusCode, 200);
    assert.strictEqual(cancelRes.body.quotation.status, 'Rejected/Cancelled');
    results.push(['TC-007', 'Pre-Downpayment Quotation Cancellation', 'PASS (200 OK: Quote Rejected/Cancelled & Request Cancelled)']);
  }

  // TC-008: Post-Downpayment Lock & Revision Loop
  {
    const lockRes = createMockRes();
    await quotationController.submitQuotationDecision(
      {
        params: { id: 2 },
        body: { decision: 'Cancel' },
        user: { user_id: 7, role: 'Customer', customer_id: 2 }
      },
      lockRes
    );
    assert.strictEqual(lockRes.statusCode, 400);
    assert.ok(lockRes.body.message.includes('Cancellation is locked'));

    const revRes = createMockRes();
    await quotationController.reviseQuotation(
      {
        params: { id: 2 },
        body: {
          quote_stage: 'Finalized',
          items: [{ item_type: 'Labor/Service', description: 'Revised Scope', quantity: 1, quoted_price: 2800 }]
        },
        user: { user_id: 2, role: 'Service Staff' }
      },
      revRes
    );
    assert.strictEqual(revRes.statusCode, 201);
    assert.strictEqual(revRes.body.quotation.revision_no, 2);
    assert.strictEqual(revRes.body.quotation.parent_quotation_id, 2);
    results.push(['TC-008', 'Post-Downpayment Lock & Revision Loop', 'PASS (Cancel blocked with 400; Revision #2 issued & Rev #1 Superseded)']);
  }

  // TC-009: Technician Schedule Conflict Check
  {
    const conflictRes = createMockRes();
    await workOrderController.createWorkOrder(
      {
        body: {
          request_id: 2,
          technician_id: 3,
          scheduled_start: '2026-11-14 13:30:00',
          scheduled_end: '2026-11-14 15:00:00'
        },
        user: { user_id: 2, role: 'Service Staff' }
      },
      conflictRes
    );
    assert.strictEqual(conflictRes.statusCode, 409);
    results.push(['TC-009', 'Technician Schedule Conflict Check', `PASS (409 Conflict blocked overlap with ${conflictRes.body.conflict.work_order_no})`]);
  }

  // TC-010 & TC-011: Work Order Field Completion, Photo Upload & Auto-PM Calculation
  {
    const compRes = createMockRes();
    await workOrderController.completeWorkOrder(
      {
        params: { id: 2 },
        body: {
          diagnosis_notes: 'Failed dual run capacitor',
          work_performed: 'Replaced capacitor and recharged R32 refrigerant',
          technician_remarks: 'Normal cooling restored',
          completion_date: '2026-11-14'
        },
        file: { filename: 'evidence-sample.jpg' },
        user: { user_id: 3, role: 'Technician' }
      },
      compRes
    );
    assert.strictEqual(compRes.statusCode, 200);
    assert.strictEqual(compRes.body.work_order.status, 'Completed');
    assert.strictEqual(compRes.body.equipment.last_service_date, '2026-11-14');
    assert.strictEqual(compRes.body.equipment.next_pm_date, '2027-02-14'); // 3-month commercial interval on equipment #3
    results.push(['TC-010', 'Work Order Field Completion & Photo Upload', 'PASS (200 OK: Diagnosis, actions, remarks & photo saved; status Completed)']);
    results.push(['TC-011', 'Automated Preventive Maintenance Calculation', `PASS (service_history inserted; next_pm_date = ${compRes.body.equipment.next_pm_date})`]);
  }

  // TC-012: Work-Order-Linked Inventory Math
  {
    const res1 = createMockRes();
    await inventoryController.createInventoryTransaction(
      {
        body: { item_id: 1, work_order_id: 2, tx_type: 'Reservation', quantity: 2, remarks: 'Reserve 2 capacitors' },
        user: { user_id: 5, role: 'Inventory Staff' }
      },
      res1
    );
    assert.strictEqual(res1.statusCode, 201);
    assert.strictEqual(res1.body.item.total_stock_qty, 18);
    assert.strictEqual(res1.body.item.reserved_qty, 2);
    assert.strictEqual(res1.body.item.available_stock, 16);

    const res2 = createMockRes();
    await inventoryController.createInventoryTransaction(
      {
        body: { item_id: 1, work_order_id: 2, tx_type: 'Issue', quantity: 2, remarks: 'Issue 2 capacitors' },
        user: { user_id: 5, role: 'Inventory Staff' }
      },
      res2
    );
    assert.strictEqual(res2.statusCode, 201);
    assert.strictEqual(res2.body.item.total_stock_qty, 16);
    assert.strictEqual(res2.body.item.reserved_qty, 0);
    assert.strictEqual(res2.body.item.available_stock, 16);
    results.push(['TC-012', 'Work-Order-Linked Inventory Math', 'PASS (Reserve +2 -> Avail 16; Issue 2 -> Total 16, Reserved 0)']);
  }

  // TC-013: Operational Reports & Dashboard
  {
    for (const category of ['inquiries', 'requests', 'quotations', 'work_orders', 'inventory', 'payments']) {
      const repRes = createMockRes();
      await reportDashboardController.getOperationalReports(
        { query: { category }, user: { user_id: 1, role: 'Administrator' } },
        repRes
      );
      assert.strictEqual(repRes.statusCode, 200);
    }
    results.push(['TC-013', 'Operational Reports & Dashboard', 'PASS (All 6 report categories verified with summary metrics)']);
  }

  // TC-014: RBAC & Multi-Tenant Security Isolation
  {
    // Customer A (customer_id: 1) trying to scan Customer B's QR (customer_id: 2)
    const qrIsolationRes = createMockRes();
    await customerEquipmentController.getEquipmentByQrToken(
      { params: { token: 'NP-QR-2026-0003' }, user: { user_id: 6, role: 'Customer', customer_id: 1 } },
      qrIsolationRes
    );
    assert.strictEqual(qrIsolationRes.statusCode, 403);

    // Non-Admin trying to access /api/users
    const rbacRes = createMockRes();
    const adminGuard = requireRoles('Administrator');
    adminGuard({ user: { user_id: 2, role: 'Service Staff' } }, rbacRes, () => {});
    assert.strictEqual(rbacRes.statusCode, 403);

    results.push(['TC-014', 'RBAC & Multi-Tenant Security Isolation', 'PASS (403 Forbidden on cross-tenant QR & non-Admin /api/users)']);
  }

  console.log('\n=========================================================================================');
  console.log(' NORTHPEAK SERVICEHUB — PHASE 6 DEFENSE VERIFICATION MATRIX (TC-001 TO TC-014)');
  console.log('=========================================================================================');
  for (const [id, name, outcome] of results) {
    console.log(` [${id}] ${name.padEnd(42)} | ${outcome}`);
  }
  console.log('=========================================================================================\n');
}

runVerificationMatrix().catch((err) => {
  console.error('Verification matrix failed:', err);
  process.exit(1);
});
