const pool = require('../config/db');
const { generateInquiryRef, generateServiceRequestRef } = require('../utils/refGenerator');
const { formatDateYMD } = require('../utils/pmCalculator');
const { logAction } = require('../utils/auditLogger');
const { createNotification, notifyRoles } = require('../utils/notifyHelper');

/**
 * GET /api/inquiries
 * Lists aircon purchase inquiries (Tenant-isolated for Customer; full list for Staff/Admin)
 */
const getInquiries = async (req, res) => {
  try {
    const { inquiry_status, payment_status, search } = req.query;
    const conditions = [];
    const params = [];

    if (req.user.role === 'Customer') {
      conditions.push('pi.customer_id = ?');
      params.push(req.user.customer_id || -1);
    }

    if (inquiry_status) {
      conditions.push('pi.inquiry_status = ?');
      params.push(inquiry_status);
    }

    if (payment_status) {
      conditions.push('pi.payment_status = ?');
      params.push(payment_status);
    }

    if (search) {
      conditions.push(
        '(pi.reference_no LIKE ? OR c.full_name LIKE ? OR c.company_name LIKE ? OR p.brand LIKE ? OR p.model_name LIKE ?)'
      );
      const like = `%${search.trim()}%`;
      params.push(like, like, like, like, like);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT pi.*,
              c.full_name AS customer_name,
              c.company_name AS customer_company,
              c.phone AS customer_phone,
              c.email AS customer_email,
              c.service_address AS customer_service_address,
              p.sku_code,
              p.brand,
              p.model_name,
              p.ac_type,
              p.horsepower,
              p.inverter_type,
              p.stock_qty AS current_catalog_stock,
              sr.reference_no AS linked_service_request_no,
              sr.status AS linked_service_request_status
       FROM purchase_inquiries pi
       JOIN customers c ON pi.customer_id = c.customer_id
       JOIN products p ON pi.product_id = p.product_id
       LEFT JOIN service_requests sr ON pi.linked_service_request_id = sr.request_id
       ${whereClause}
       ORDER BY pi.created_at DESC`,
      params
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      inquiries: rows
    });
  } catch (error) {
    console.error('[productInquiryController.getInquiries Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve purchase inquiries.',
      error: error.message
    });
  }
};

/**
 * POST /api/inquiries (Customer, Service Staff, Administrator)
 * Submits an aircon purchase inquiry with price snapshot and optional installation request
 */
const createInquiry = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const {
      customer_id: bodyCustomerId,
      product_id,
      quantity = 1,
      request_installation = false,
      installation_address = null,
      preferred_date = null,
      staff_remarks = null
    } = req.body;

    const customerId =
      req.user.role === 'Customer' ? req.user.customer_id : bodyCustomerId || req.user.customer_id;

    if (!customerId || !product_id) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Customer and aircon product selection are required.'
      });
    }

    const qty = Math.max(1, parseInt(quantity, 10) || 1);

    const [prodRows] = await connection.query(
      'SELECT * FROM products WHERE product_id = ? LIMIT 1',
      [product_id]
    );
    if (prodRows.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Selected aircon product not found.'
      });
    }

    const product = prodRows[0];

    const [custRows] = await connection.query(
      'SELECT * FROM customers WHERE customer_id = ? LIMIT 1',
      [customerId]
    );
    if (custRows.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Customer profile not found.'
      });
    }

    const customer = custRows[0];
    const wantsInstallation = Boolean(request_installation);
    const resolvedInstallAddress = wantsInstallation
      ? (installation_address && String(installation_address).trim()) || customer.service_address
      : null;

    if (wantsInstallation && !resolvedInstallAddress) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Installation address is required when requesting installation.'
      });
    }

    await connection.beginTransaction();

    const referenceNo = generateInquiryRef();
    const unitPriceSnapshot = Number(product.unit_price);
    const totalAmount = Number((unitPriceSnapshot * qty).toFixed(2));
    const resolvedPreferredDate = preferred_date || formatDateYMD(new Date(Date.now() + 3 * 86400000));

    const [result] = await connection.query(
      `INSERT INTO purchase_inquiries
       (reference_no, customer_id, product_id, quantity, unit_price_snapshot, total_amount,
        request_installation, installation_address, preferred_date, payment_status,
        inquiry_status, staff_remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Unpaid', 'Pending Review', ?)`,
      [
        referenceNo,
        customerId,
        product.product_id,
        qty,
        unitPriceSnapshot,
        totalAmount,
        wantsInstallation,
        resolvedInstallAddress,
        resolvedPreferredDate,
        staff_remarks
      ]
    );

    const inquiryId = result.insertId;

    await logAction(
      connection,
      req.user,
      'PURCHASE_INQUIRY_SUBMITTED',
      'purchase_inquiries',
      referenceNo,
      `Submitted inquiry for ${qty}x ${product.brand} ${product.model_name} (Install requested: ${wantsInstallation})`
    );

    await notifyRoles(
      connection,
      ['Service Staff', 'Administrator'],
      `New Aircon Purchase Inquiry (${referenceNo})`,
      `${customer.full_name} inquired for ${qty}x ${product.brand} ${product.model_name} (Total: PHP ${totalAmount.toLocaleString()}).`
    );

    await connection.commit();
    connection.release();

    const [createdRows] = await pool.query(
      `SELECT pi.*, p.brand, p.model_name, p.ac_type, p.horsepower
       FROM purchase_inquiries pi
       JOIN products p ON pi.product_id = p.product_id
       WHERE pi.inquiry_id = ?`,
      [inquiryId]
    );

    return res.status(201).json({
      success: true,
      message: `Purchase inquiry ${referenceNo} submitted successfully.`,
      inquiry: createdRows[0]
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('[productInquiryController.createInquiry Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit purchase inquiry.',
      error: error.message
    });
  }
};

/**
 * PATCH /api/inquiries/:id/process (Service Staff, Administrator)
 * Updates inquiry status, records offline payment status, and if request_installation === true
 * and no linked service request exists yet, automatically creates a linked Installation Service Request (FR-005 / TC-005).
 */
const processInquiry = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const {
      inquiry_status,
      payment_status,
      staff_remarks,
      amount_paid,
      payment_type = 'Downpayment',
      payment_method = 'Cash',
      reference_receipt_no = null
    } = req.body;

    const [inqRows] = await connection.query(
      `SELECT pi.*,
              c.user_id AS customer_user_id,
              c.full_name AS customer_name,
              c.service_address AS customer_service_address,
              p.brand,
              p.model_name,
              p.horsepower,
              p.ac_type
       FROM purchase_inquiries pi
       JOIN customers c ON pi.customer_id = c.customer_id
       JOIN products p ON pi.product_id = p.product_id
       WHERE pi.inquiry_id = ?
       LIMIT 1`,
      [id]
    );

    if (inqRows.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Purchase inquiry not found.'
      });
    }

    const inquiry = inqRows[0];

    await connection.beginTransaction();

    const nextInquiryStatus = inquiry_status || inquiry.inquiry_status;
    const nextPaymentStatus = payment_status || inquiry.payment_status;
    const nextRemarks = staff_remarks !== undefined ? staff_remarks : inquiry.staff_remarks;

    let linkedServiceRequestId = inquiry.linked_service_request_id;
    let generatedServiceRequestNo = null;

    // FR-005 / TC-005: Auto-create linked Installation Service Request when request_installation is true
    // and inquiry is confirmed / processed (anything other than Cancelled) and no linked SR exists yet
    const shouldCreateInstallRequest =
      Boolean(inquiry.request_installation) &&
      !linkedServiceRequestId &&
      nextInquiryStatus !== 'Cancelled' &&
      (nextInquiryStatus === 'Stock Confirmed' ||
        nextInquiryStatus === 'Awaiting Payment' ||
        nextInquiryStatus === 'Completed' ||
        nextPaymentStatus !== 'Unpaid');

    if (shouldCreateInstallRequest) {
      generatedServiceRequestNo = generateServiceRequestRef();
      const installLocation =
        inquiry.installation_address || inquiry.customer_service_address || 'Customer Service Address';
      const preferredDate =
        inquiry.preferred_date || formatDateYMD(new Date(Date.now() + 3 * 86400000));
      const issueDesc = `Installation of ${inquiry.quantity}x brand-new ${inquiry.brand} ${inquiry.model_name} (${inquiry.horsepower} ${inquiry.ac_type}) from Purchase Inquiry ${inquiry.reference_no}.`;

      const [srResult] = await connection.query(
        `INSERT INTO service_requests
         (reference_no, customer_id, equipment_id, service_type, issue_description,
          current_location, destination_location, preferred_date, preferred_time_slot,
          priority, requires_quotation, payment_status, status)
         VALUES (?, ?, NULL, 'Installation', ?, ?, NULL, ?, 'Morning (8AM-12PM)', 'Normal', TRUE, ?, 'Under Review')`,
        [
          generatedServiceRequestNo,
          inquiry.customer_id,
          issueDesc,
          installLocation,
          preferredDate,
          nextPaymentStatus
        ]
      );

      linkedServiceRequestId = srResult.insertId;

      await logAction(
        connection,
        req.user,
        'AUTO_INSTALLATION_REQUEST_CREATED',
        'service_requests',
        generatedServiceRequestNo,
        `Auto-generated Installation Service Request ${generatedServiceRequestNo} from Purchase Inquiry ${inquiry.reference_no}`
      );
    } else if (linkedServiceRequestId && payment_status) {
      // Keep linked installation service request payment_status synchronized if updated here
      await connection.query(
        `UPDATE service_requests SET payment_status = ? WHERE request_id = ?`,
        [nextPaymentStatus, linkedServiceRequestId]
      );
    }

    // Deduct catalog stock when transitioning from Pending Review to Stock Confirmed / Completed
    if (
      inquiry.inquiry_status === 'Pending Review' &&
      (nextInquiryStatus === 'Stock Confirmed' || nextInquiryStatus === 'Completed')
    ) {
      await connection.query(
        `UPDATE products SET stock_qty = GREATEST(0, stock_qty - ?) WHERE product_id = ?`,
        [inquiry.quantity, inquiry.product_id]
      );
    }

    // Record offline payment ledger entry if payment details or status transitions are provided
    if (
      (amount_paid && Number(amount_paid) > 0) ||
      (payment_status && payment_status !== inquiry.payment_status && payment_status !== 'Unpaid')
    ) {
      const recordedAmount =
        amount_paid && Number(amount_paid) > 0
          ? Number(amount_paid)
          : nextPaymentStatus === 'Fully Paid'
          ? Number(inquiry.total_amount)
          : Number((Number(inquiry.total_amount) * 0.5).toFixed(2));

      const resolvedPayType =
        nextPaymentStatus === 'Fully Paid' ? 'Full Payment' : payment_type || 'Downpayment';

      await connection.query(
        `INSERT INTO payments
         (inquiry_id, request_id, amount_paid, payment_type, payment_method, reference_receipt_no, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          inquiry.inquiry_id,
          linkedServiceRequestId || null,
          recordedAmount,
          resolvedPayType,
          payment_method || 'Cash',
          reference_receipt_no || `INQ-PAY-${Date.now()}`,
          req.user.user_id
        ]
      );
    }

    await connection.query(
      `UPDATE purchase_inquiries
       SET inquiry_status = ?, payment_status = ?, linked_service_request_id = ?, staff_remarks = ?
       WHERE inquiry_id = ?`,
      [nextInquiryStatus, nextPaymentStatus, linkedServiceRequestId, nextRemarks, inquiry.inquiry_id]
    );

    await logAction(
      connection,
      req.user,
      'PURCHASE_INQUIRY_PROCESSED',
      'purchase_inquiries',
      inquiry.reference_no,
      {
        inquiry_status: nextInquiryStatus,
        payment_status: nextPaymentStatus,
        linked_service_request_id: linkedServiceRequestId,
        linked_service_request_no: generatedServiceRequestNo
      }
    );

    if (inquiry.customer_user_id) {
      const handoffNote = generatedServiceRequestNo
        ? ` Linked Installation Request ${generatedServiceRequestNo} has been automatically created.`
        : '';
      await createNotification(
        connection,
        inquiry.customer_user_id,
        `Purchase Inquiry Update (${inquiry.reference_no})`,
        `Your inquiry status is now '${nextInquiryStatus}' (Payment: ${nextPaymentStatus}).${handoffNote}`
      );
    }

    await connection.commit();
    connection.release();

    const [updatedRows] = await pool.query(
      `SELECT pi.*,
              c.full_name AS customer_name,
              p.brand,
              p.model_name,
              sr.reference_no AS linked_service_request_no,
              sr.status AS linked_service_request_status
       FROM purchase_inquiries pi
       JOIN customers c ON pi.customer_id = c.customer_id
       JOIN products p ON pi.product_id = p.product_id
       LEFT JOIN service_requests sr ON pi.linked_service_request_id = sr.request_id
       WHERE pi.inquiry_id = ?`,
      [inquiry.inquiry_id]
    );

    return res.status(200).json({
      success: true,
      message: generatedServiceRequestNo
        ? `Inquiry processed and linked Installation Service Request (${generatedServiceRequestNo}) created automatically.`
        : 'Purchase inquiry updated successfully.',
      generated_service_request_no: generatedServiceRequestNo,
      inquiry: updatedRows[0]
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('[productInquiryController.processInquiry Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process purchase inquiry.',
      error: error.message
    });
  }
};

module.exports = {
  getInquiries,
  createInquiry,
  processInquiry
};
