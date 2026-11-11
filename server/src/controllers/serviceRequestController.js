const pool = require('../config/db');
const { generateServiceRequestRef } = require('../utils/refGenerator');
const { formatDateYMD } = require('../utils/pmCalculator');
const { logAction } = require('../utils/auditLogger');
const { createNotification, notifyRoles } = require('../utils/notifyHelper');

const VALID_SERVICE_TYPES = [
  'Installation',
  'Repair and Troubleshooting',
  'Preventive Maintenance and Cleaning',
  'Relocation or Transfer'
];

/**
 * GET /api/requests
 * Lists service requests (Tenant-isolated for Customer; full list with filters for Staff/Tech/Admin)
 */
const getServiceRequests = async (req, res) => {
  try {
    const { status, service_type, payment_status, search } = req.query;
    const conditions = [];
    const params = [];

    // Tenant Isolation Rule: Customers only see their own service requests
    if (req.user.role === 'Customer') {
      conditions.push('sr.customer_id = ?');
      params.push(req.user.customer_id || -1);
    }

    if (status) {
      conditions.push('sr.status = ?');
      params.push(status);
    }

    if (service_type) {
      conditions.push('sr.service_type = ?');
      params.push(service_type);
    }

    if (payment_status) {
      conditions.push('sr.payment_status = ?');
      params.push(payment_status);
    }

    if (search) {
      conditions.push(
        '(sr.reference_no LIKE ? OR c.full_name LIKE ? OR c.company_name LIKE ? OR sr.issue_description LIKE ? OR e.qr_token LIKE ?)'
      );
      const like = `%${search.trim()}%`;
      params.push(like, like, like, like, like);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT sr.*,
              c.full_name AS customer_name,
              c.company_name AS customer_company,
              c.phone AS customer_phone,
              c.email AS customer_email,
              c.customer_type,
              e.qr_token AS equipment_qr_token,
              e.brand AS equipment_brand,
              e.model AS equipment_model,
              e.serial_number AS equipment_serial,
              e.capacity_hp AS equipment_hp,
              (SELECT q.quotation_id FROM quotations q WHERE q.request_id = sr.request_id AND q.status != 'Superseded' ORDER BY q.revision_no DESC, q.quotation_id DESC LIMIT 1) AS active_quotation_id,
              (SELECT q.quotation_no FROM quotations q WHERE q.request_id = sr.request_id AND q.status != 'Superseded' ORDER BY q.revision_no DESC, q.quotation_id DESC LIMIT 1) AS active_quotation_no,
              (SELECT q.revision_no FROM quotations q WHERE q.request_id = sr.request_id AND q.status != 'Superseded' ORDER BY q.revision_no DESC, q.quotation_id DESC LIMIT 1) AS active_quotation_revision,
              (SELECT q.total_amount FROM quotations q WHERE q.request_id = sr.request_id AND q.status != 'Superseded' ORDER BY q.revision_no DESC, q.quotation_id DESC LIMIT 1) AS active_quotation_total,
              (SELECT q.status FROM quotations q WHERE q.request_id = sr.request_id AND q.status != 'Superseded' ORDER BY q.revision_no DESC, q.quotation_id DESC LIMIT 1) AS active_quotation_status,
              (SELECT wo.work_order_no FROM work_orders wo WHERE wo.request_id = sr.request_id ORDER BY wo.work_order_id DESC LIMIT 1) AS latest_work_order_no,
              (SELECT wo.status FROM work_orders wo WHERE wo.request_id = sr.request_id ORDER BY wo.work_order_id DESC LIMIT 1) AS latest_work_order_status
       FROM service_requests sr
       JOIN customers c ON sr.customer_id = c.customer_id
       LEFT JOIN equipment e ON sr.equipment_id = e.equipment_id
       ${whereClause}
       ORDER BY sr.created_at DESC`,
      params
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      requests: rows
    });
  } catch (error) {
    console.error('[serviceRequestController.getServiceRequests Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve service requests.',
      error: error.message
    });
  }
};

/**
 * GET /api/requests/:id
 * Returns full details of a single service request with tenant isolation check (TC-014)
 */
const getServiceRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT sr.*,
              c.full_name AS customer_name,
              c.company_name AS customer_company,
              c.phone AS customer_phone,
              c.email AS customer_email,
              e.qr_token AS equipment_qr_token,
              e.brand AS equipment_brand,
              e.model AS equipment_model,
              e.serial_number AS equipment_serial
       FROM service_requests sr
       JOIN customers c ON sr.customer_id = c.customer_id
       LEFT JOIN equipment e ON sr.equipment_id = e.equipment_id
       WHERE sr.request_id = ?
       LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service request not found.'
      });
    }

    const requestRecord = rows[0];

    // Multi-Tenant Security Isolation (TC-014)
    if (req.user.role === 'Customer' && Number(requestRecord.customer_id) !== Number(req.user.customer_id)) {
      await logAction(
        pool,
        req.user,
        'UNAUTHORIZED_REQUEST_ACCESS_BLOCKED',
        'service_requests',
        requestRecord.reference_no,
        `Customer ${req.user.customer_id} attempted to access Service Request ${requestRecord.reference_no} belonging to Customer ${requestRecord.customer_id}`
      );
      return res.status(403).json({
        success: false,
        message: "Forbidden: You are not authorized to view another customer's service request."
      });
    }

    const [payments] = await pool.query(
      `SELECT p.*, u.full_name AS recorded_by_name
       FROM payments p
       LEFT JOIN users u ON p.recorded_by = u.user_id
       WHERE p.request_id = ?
       ORDER BY p.recorded_at DESC`,
      [id]
    );

    return res.status(200).json({
      success: true,
      request: {
        ...requestRecord,
        payments
      }
    });
  } catch (error) {
    console.error('[serviceRequestController.getServiceRequestById Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve service request details.',
      error: error.message
    });
  }
};

/**
 * POST /api/requests (Customer, Service Staff, Administrator)
 * Creates a multi-type service request.
 * Enforces mandatory destination_location when service_type === 'Relocation or Transfer' (FR-006 / TC-006).
 */
const createServiceRequest = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const {
      customer_id: bodyCustomerId,
      equipment_id = null,
      service_type,
      issue_description,
      current_location,
      destination_location = null,
      preferred_date,
      preferred_time_slot = 'Morning (8AM-12PM)',
      priority = 'Normal',
      requires_quotation = true
    } = req.body;

    const customerId =
      req.user.role === 'Customer' ? req.user.customer_id : bodyCustomerId || req.user.customer_id;

    if (!customerId || !service_type || !issue_description || !current_location) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Customer, service type, issue description, and current location are required.'
      });
    }

    if (!VALID_SERVICE_TYPES.includes(service_type)) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: `Invalid service type '${service_type}'. Must be one of: ${VALID_SERVICE_TYPES.join(', ')}.`
      });
    }

    // FR-006 & TC-006: Relocation or Transfer strictly requires destination_location
    if (
      service_type === 'Relocation or Transfer' &&
      (!destination_location || String(destination_location).trim().length === 0)
    ) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: "Destination location is strictly required when service type is 'Relocation or Transfer'."
      });
    }

    // Verify equipment belongs to customer if Customer role
    if (equipment_id && req.user.role === 'Customer') {
      const [eqRows] = await connection.query(
        'SELECT customer_id FROM equipment WHERE equipment_id = ? LIMIT 1',
        [equipment_id]
      );
      if (eqRows.length === 0 || Number(eqRows[0].customer_id) !== Number(customerId)) {
        connection.release();
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Selected equipment does not belong to your account.'
        });
      }
    }

    await connection.beginTransaction();

    const referenceNo = generateServiceRequestRef();
    const resolvedDate = preferred_date || formatDateYMD(new Date(Date.now() + 2 * 86400000));

    const [result] = await connection.query(
      `INSERT INTO service_requests
       (reference_no, customer_id, equipment_id, service_type, issue_description,
        current_location, destination_location, preferred_date, preferred_time_slot,
        priority, requires_quotation, payment_status, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Unpaid', 'Submitted')`,
      [
        referenceNo,
        Number(customerId),
        equipment_id ? Number(equipment_id) : null,
        service_type,
        issue_description.trim(),
        current_location.trim(),
        service_type === 'Relocation or Transfer' ? destination_location.trim() : destination_location || null,
        resolvedDate,
        preferred_time_slot,
        priority,
        Boolean(requires_quotation)
      ]
    );

    const requestId = result.insertId;

    await logAction(
      connection,
      req.user,
      'SERVICE_REQUEST_CREATED',
      'service_requests',
      referenceNo,
      `Submitted ${service_type} request (${referenceNo})`
    );

    await notifyRoles(
      connection,
      ['Service Staff', 'Administrator'],
      `New Service Request (${referenceNo})`,
      `New ${service_type} request submitted for ${resolvedDate} (${preferred_time_slot}).`
    );

    await connection.commit();
    connection.release();

    const [createdRows] = await pool.query(
      `SELECT sr.*, c.full_name AS customer_name
       FROM service_requests sr
       JOIN customers c ON sr.customer_id = c.customer_id
       WHERE sr.request_id = ?`,
      [requestId]
    );

    return res.status(201).json({
      success: true,
      message: `Service request ${referenceNo} submitted successfully.`,
      request: createdRows[0]
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('[serviceRequestController.createServiceRequest Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create service request.',
      error: error.message
    });
  }
};

/**
 * PATCH /api/requests/:id/status (Service Staff, Administrator)
 * Updates service request operational status or priority (respecting the post-downpayment cancellation lock)
 */
const updateServiceRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority, requires_quotation } = req.body;

    const [rows] = await pool.query('SELECT * FROM service_requests WHERE request_id = ? LIMIT 1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service request not found.'
      });
    }

    const requestRecord = rows[0];

    // Enforce Post-Downpayment Lock on Cancellation
    if (status === 'Cancelled' && requestRecord.payment_status !== 'Unpaid') {
      return res.status(400).json({
        success: false,
        message:
          'Cancellation is locked because a downpayment has already been recorded. Please use Quotation Revision.'
      });
    }

    const nextStatus = status || requestRecord.status;
    const nextPriority = priority || requestRecord.priority;
    const nextRequiresQuote =
      requires_quotation !== undefined ? Boolean(requires_quotation) : Boolean(requestRecord.requires_quotation);

    await pool.query(
      `UPDATE service_requests
       SET status = ?, priority = ?, requires_quotation = ?
       WHERE request_id = ?`,
      [nextStatus, nextPriority, nextRequiresQuote, id]
    );

    await logAction(
      pool,
      req.user,
      'SERVICE_REQUEST_STATUS_UPDATED',
      'service_requests',
      requestRecord.reference_no,
      { status: nextStatus, priority: nextPriority }
    );

    const [updated] = await pool.query('SELECT * FROM service_requests WHERE request_id = ?', [id]);

    return res.status(200).json({
      success: true,
      message: 'Service request updated successfully.',
      request: updated[0]
    });
  } catch (error) {
    console.error('[serviceRequestController.updateServiceRequestStatus Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update service request.',
      error: error.message
    });
  }
};

/**
 * PATCH /api/requests/:id/payment (Service Staff, Administrator)
 * Records staff-verified offline payment in payments table and updates service_requests.payment_status
 */
const recordServiceRequestPayment = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const {
      payment_status,
      amount_paid,
      payment_type = 'Downpayment',
      payment_method = 'Cash',
      reference_receipt_no = null
    } = req.body;

    const [rows] = await connection.query(
      `SELECT sr.*, c.user_id AS customer_user_id
       FROM service_requests sr
       JOIN customers c ON sr.customer_id = c.customer_id
       WHERE sr.request_id = ?
       LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Service request not found.'
      });
    }

    const requestRecord = rows[0];

    const validPaymentStatuses = ['Unpaid', 'Downpayment Received', 'Fully Paid'];
    const targetPaymentStatus =
      payment_status && validPaymentStatuses.includes(payment_status)
        ? payment_status
        : payment_type === 'Full Payment' || payment_type === 'Balance Settlement'
        ? 'Fully Paid'
        : 'Downpayment Received';

    await connection.beginTransaction();

    await connection.query(
      `UPDATE service_requests SET payment_status = ? WHERE request_id = ?`,
      [targetPaymentStatus, id]
    );

    const numericAmount = Number(amount_paid) > 0 ? Number(amount_paid) : 0;
    let paymentId = null;

    if (numericAmount > 0 || targetPaymentStatus !== 'Unpaid') {
      const [payResult] = await connection.query(
        `INSERT INTO payments
         (inquiry_id, request_id, amount_paid, payment_type, payment_method, reference_receipt_no, recorded_by)
         VALUES (NULL, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          numericAmount > 0 ? numericAmount : 1000.0,
          payment_type,
          payment_method,
          reference_receipt_no || `OR-${Date.now()}`,
          req.user.user_id
        ]
      );
      paymentId = payResult.insertId;
    }

    await logAction(
      connection,
      req.user,
      'PAYMENT_RECORDED',
      'service_requests',
      requestRecord.reference_no,
      {
        payment_id: paymentId,
        payment_status: targetPaymentStatus,
        amount_paid: numericAmount,
        payment_type,
        payment_method,
        reference_receipt_no
      }
    );

    if (requestRecord.customer_user_id) {
      await createNotification(
        connection,
        requestRecord.customer_user_id,
        `Payment Recorded (${requestRecord.reference_no})`,
        `Your payment status for ${requestRecord.reference_no} has been updated to '${targetPaymentStatus}' (${payment_method}).`
      );
    }

    await connection.commit();
    connection.release();

    const [updated] = await pool.query('SELECT * FROM service_requests WHERE request_id = ?', [id]);

    return res.status(200).json({
      success: true,
      message: `Payment recorded. Service request payment status is now '${targetPaymentStatus}'.`,
      request: updated[0]
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('[serviceRequestController.recordServiceRequestPayment Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to record service request payment.',
      error: error.message
    });
  }
};

module.exports = {
  getServiceRequests,
  getServiceRequestById,
  createServiceRequest,
  updateServiceRequestStatus,
  recordServiceRequestPayment
};
