const pool = require('../config/db');
const { generateQuotationRef } = require('../utils/refGenerator');
const { formatDateYMD } = require('../utils/pmCalculator');
const { logAction } = require('../utils/auditLogger');
const { createNotification, notifyRoles } = require('../utils/notifyHelper');

/**
 * Helper to compute labor_cost, parts_total, and total_amount from items array
 * while snapshotting quoted_price and subtotal.
 */
function calculateQuoteTotals(items = [], explicitLaborCost = null, explicitPartsTotal = null) {
  let computedLabor = 0;
  let computedParts = 0;

  const normalizedItems = items.map((item) => {
    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
    const price = Number(item.quoted_price !== undefined ? item.quoted_price : item.unit_price || 0);
    const subtotal = Number((qty * price).toFixed(2));
    const itemType = ['Labor/Service', 'Spare Part', 'Aircon Unit', 'Material/Fee'].includes(item.item_type)
      ? item.item_type
      : 'Labor/Service';

    if (itemType === 'Labor/Service') {
      computedLabor += subtotal;
    } else {
      computedParts += subtotal;
    }

    return {
      item_type: itemType,
      description: String(item.description || 'Service Item').trim(),
      quantity: qty,
      quoted_price: Number(price.toFixed(2)),
      subtotal
    };
  });

  const finalLabor =
    explicitLaborCost !== null && explicitLaborCost !== undefined && normalizedItems.length === 0
      ? Number(explicitLaborCost)
      : Number(computedLabor.toFixed(2));

  const finalParts =
    explicitPartsTotal !== null && explicitPartsTotal !== undefined && normalizedItems.length === 0
      ? Number(explicitPartsTotal)
      : Number(computedParts.toFixed(2));

  const totalAmount = Number((finalLabor + finalParts).toFixed(2));

  return {
    normalizedItems,
    labor_cost: finalLabor,
    parts_total: finalParts,
    total_amount: totalAmount
  };
}

/**
 * GET /api/quotations
 * Lists quotations with line items and revision metadata (Tenant-isolated for Customer)
 */
const getQuotations = async (req, res) => {
  try {
    const { request_id, status, quote_stage, include_superseded, search } = req.query;
    const conditions = [];
    const params = [];

    if (req.user.role === 'Customer') {
      conditions.push('sr.customer_id = ?');
      params.push(req.user.customer_id || -1);
    }

    if (request_id) {
      conditions.push('q.request_id = ?');
      params.push(request_id);
    }

    if (status) {
      conditions.push('q.status = ?');
      params.push(status);
    } else if (include_superseded === 'false') {
      conditions.push("q.status != 'Superseded'");
    }

    if (quote_stage) {
      conditions.push('q.quote_stage = ?');
      params.push(quote_stage);
    }

    if (search) {
      conditions.push(
        '(q.quotation_no LIKE ? OR sr.reference_no LIKE ? OR c.full_name LIKE ? OR c.company_name LIKE ?)'
      );
      const like = `%${search.trim()}%`;
      params.push(like, like, like, like);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT q.*,
              sr.reference_no AS request_reference_no,
              sr.service_type,
              sr.issue_description,
              sr.payment_status,
              sr.status AS request_status,
              sr.customer_id,
              c.full_name AS customer_name,
              c.company_name AS customer_company,
              c.phone AS customer_phone,
              u.full_name AS prepared_by_name,
              pq.quotation_no AS parent_quotation_no
       FROM quotations q
       JOIN service_requests sr ON q.request_id = sr.request_id
       JOIN customers c ON sr.customer_id = c.customer_id
       LEFT JOIN users u ON q.prepared_by = u.user_id
       LEFT JOIN quotations pq ON q.parent_quotation_id = pq.quotation_id
       ${whereClause}
       ORDER BY q.created_at DESC, q.revision_no DESC`,
      params
    );

    const quotationIds = rows.map((r) => r.quotation_id);
    const itemsByQuotation = {};

    if (quotationIds.length > 0) {
      const placeholders = quotationIds.map(() => '?').join(', ');
      const [itemRows] = await pool.query(
        `SELECT * FROM quotation_items
         WHERE quotation_id IN (${placeholders})
         ORDER BY quotation_item_id ASC`,
        quotationIds
      );
      for (const item of itemRows) {
        if (!itemsByQuotation[item.quotation_id]) {
          itemsByQuotation[item.quotation_id] = [];
        }
        itemsByQuotation[item.quotation_id].push(item);
      }
    }

    const quotations = rows.map((q) => ({
      ...q,
      is_cancellation_locked: q.payment_status !== 'Unpaid',
      items: itemsByQuotation[q.quotation_id] || []
    }));

    return res.status(200).json({
      success: true,
      count: quotations.length,
      quotations
    });
  } catch (error) {
    console.error('[quotationController.getQuotations Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve quotations.',
      error: error.message
    });
  }
};

/**
 * POST /api/quotations (Service Staff, Administrator)
 * Creates a Temporary or Finalized quotation with immutable price snapshots in quotation_items
 */
const createQuotation = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const {
      request_id,
      quote_stage = 'Finalized',
      items = [],
      labor_cost,
      parts_total,
      downpayment_required,
      valid_until
    } = req.body;

    if (!request_id) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Service request ID (request_id) is required.'
      });
    }

    const [srRows] = await connection.query(
      `SELECT sr.*, c.user_id AS customer_user_id
       FROM service_requests sr
       JOIN customers c ON sr.customer_id = c.customer_id
       WHERE sr.request_id = ?
       LIMIT 1`,
      [request_id]
    );

    if (srRows.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Linked service request not found.'
      });
    }

    const serviceRequest = srRows[0];

    const {
      normalizedItems,
      labor_cost: finalLaborCost,
      parts_total: finalPartsTotal,
      total_amount: finalTotalAmount
    } = calculateQuoteTotals(items, labor_cost, parts_total);

    if (finalTotalAmount <= 0 && normalizedItems.length === 0) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Quotation must include at least one line item or positive labor/parts cost.'
      });
    }

    await connection.beginTransaction();

    // Check if an earlier active quotation exists for this request_id
    const [existingQuotes] = await connection.query(
      `SELECT * FROM quotations
       WHERE request_id = ? AND status != 'Superseded'
       ORDER BY revision_no DESC, quotation_id DESC
       LIMIT 1`,
      [request_id]
    );

    let revisionNo = 1;
    let parentQuotationId = null;

    if (existingQuotes.length > 0) {
      const prev = existingQuotes[0];
      revisionNo = Number(prev.revision_no) + 1;
      parentQuotationId = prev.quotation_id;
      await connection.query(
        `UPDATE quotations SET status = 'Superseded' WHERE quotation_id = ?`,
        [prev.quotation_id]
      );
    }

    const quotationNo = generateQuotationRef();
    const resolvedValidUntil = valid_until || formatDateYMD(new Date(Date.now() + 14 * 86400000));
    const resolvedDownpayment =
      downpayment_required !== undefined
        ? Number(downpayment_required)
        : Number((finalTotalAmount * 0.5).toFixed(2));

    const validStage = ['Temporary', 'Finalized'].includes(quote_stage) ? quote_stage : 'Finalized';

    const [quoteResult] = await connection.query(
      `INSERT INTO quotations
       (quotation_no, request_id, revision_no, parent_quotation_id, quote_stage,
        labor_cost, parts_total, total_amount, downpayment_required,
        status, valid_until, prepared_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending Customer Review', ?, ?)`,
      [
        quotationNo,
        Number(request_id),
        revisionNo,
        parentQuotationId,
        validStage,
        finalLaborCost,
        finalPartsTotal,
        finalTotalAmount,
        resolvedDownpayment,
        resolvedValidUntil,
        req.user.user_id
      ]
    );

    const quotationId = quoteResult.insertId;

    for (const item of normalizedItems) {
      await connection.query(
        `INSERT INTO quotation_items
         (quotation_id, item_type, description, quantity, quoted_price, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          quotationId,
          item.item_type,
          item.description,
          item.quantity,
          item.quoted_price,
          item.subtotal
        ]
      );
    }

    // Update service_requests.status = 'Quoted'
    await connection.query(
      `UPDATE service_requests SET status = 'Quoted' WHERE request_id = ?`,
      [request_id]
    );

    await logAction(
      connection,
      req.user,
      'QUOTATION_CREATED',
      'quotations',
      quotationNo,
      `Created ${validStage} Quotation ${quotationNo} (Rev ${revisionNo}, Total: PHP ${finalTotalAmount}) for ${serviceRequest.reference_no}`
    );

    if (serviceRequest.customer_user_id) {
      await createNotification(
        connection,
        serviceRequest.customer_user_id,
        `Quotation Ready (${quotationNo} - Rev ${revisionNo})`,
        `A ${validStage.toLowerCase()} quotation totaling PHP ${finalTotalAmount.toLocaleString()} for ${serviceRequest.reference_no} is ready for your review.`
      );
    }

    await connection.commit();
    connection.release();

    const [createdQuote] = await pool.query('SELECT * FROM quotations WHERE quotation_id = ?', [quotationId]);
    const [createdItems] = await pool.query('SELECT * FROM quotation_items WHERE quotation_id = ?', [quotationId]);

    return res.status(201).json({
      success: true,
      message: `Quotation ${quotationNo} (Rev ${revisionNo}) created successfully.`,
      quotation: {
        ...createdQuote[0],
        items: createdItems
      }
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('[quotationController.createQuotation Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create quotation.',
      error: error.message
    });
  }
};

/**
 * POST /api/quotations/:id/decision (Customer, Service Staff, Administrator)
 * Enforces the exact Pre-Downpayment vs Post-Downpayment Lock Rules (FR-007, TC-007, TC-008):
 * - decision === 'Approve': Marks quotation 'Approved' and service request 'Approved'.
 * - decision === 'Cancel' (or 'Reject' / 'Cancel/Reject'):
 *   - If payment_status === 'Unpaid': sets quotation to 'Rejected/Cancelled' and service request to 'Cancelled'. (TC-007)
 *   - If payment_status !== 'Unpaid' ('Downpayment Received' or 'Fully Paid'):
 *     STRICTLY REJECTS WITH HTTP 400:
 *     "Cancellation is locked because a downpayment has already been recorded. Please use Quotation Revision." (TC-008)
 * - decision === 'Request Revision': Marks quotation status as 'Revision Requested' with customer_decision_notes.
 */
const submitQuotationDecision = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { decision, customer_decision_notes = null, notes = null } = req.body;
    const decisionNotes = customer_decision_notes || notes || null;

    if (!decision) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: "Decision is required ('Approve', 'Request Revision', or 'Cancel')."
      });
    }

    const [rows] = await connection.query(
      `SELECT q.*,
              sr.reference_no AS request_reference_no,
              sr.customer_id,
              sr.payment_status,
              sr.status AS request_status
       FROM quotations q
       JOIN service_requests sr ON q.request_id = sr.request_id
       WHERE q.quotation_id = ?
       LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Quotation not found.'
      });
    }

    const quote = rows[0];

    // Enforce Tenant Isolation for Customer role
    if (req.user.role === 'Customer' && Number(quote.customer_id) !== Number(req.user.customer_id)) {
      connection.release();
      return res.status(403).json({
        success: false,
        message: "Forbidden: You cannot submit a decision on another customer's quotation."
      });
    }

    if (quote.status === 'Superseded') {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'This quotation revision has already been superseded by a newer revision.'
      });
    }

    const normalizedDecision = String(decision).trim();

    // Handle Cancel / Reject
    if (['Cancel', 'Reject', 'Cancel/Reject', 'Rejected/Cancelled'].includes(normalizedDecision)) {
      // TC-008: Post-Downpayment Lock check
      if (quote.payment_status !== 'Unpaid') {
        await logAction(
          connection,
          req.user,
          'QUOTATION_CANCEL_BLOCKED_DOWNPAYMENT_LOCK',
          'quotations',
          quote.quotation_no,
          `Blocked cancellation attempt on ${quote.quotation_no} because payment_status is '${quote.payment_status}'`
        );
        connection.release();
        return res.status(400).json({
          success: false,
          message:
            'Cancellation is locked because a downpayment has already been recorded. Please use Quotation Revision.'
        });
      }

      // TC-007: Pre-Downpayment Cancellation allowed when Unpaid
      await connection.beginTransaction();

      await connection.query(
        `UPDATE quotations
         SET status = 'Rejected/Cancelled', customer_decision_notes = ?, decided_at = CURRENT_TIMESTAMP
         WHERE quotation_id = ?`,
        [decisionNotes, id]
      );

      await connection.query(
        `UPDATE service_requests SET status = 'Cancelled' WHERE request_id = ?`,
        [quote.request_id]
      );

      await logAction(
        connection,
        req.user,
        'QUOTATION_CANCELLED_PRE_DOWNPAYMENT',
        'quotations',
        quote.quotation_no,
        `Quotation ${quote.quotation_no} and Service Request ${quote.request_reference_no} cancelled (payment_status: Unpaid)`
      );

      await notifyRoles(
        connection,
        ['Service Staff', 'Administrator'],
        `Quotation Cancelled (${quote.quotation_no})`,
        `Quotation ${quote.quotation_no} and Service Request ${quote.request_reference_no} were cancelled prior to downpayment.`
      );

      await connection.commit();
      connection.release();

      const [updated] = await pool.query('SELECT * FROM quotations WHERE quotation_id = ?', [id]);
      return res.status(200).json({
        success: true,
        message: 'Quotation rejected and linked service request cancelled.',
        quotation: updated[0]
      });
    }

    // Handle Approve
    if (['Approve', 'Approved'].includes(normalizedDecision)) {
      await connection.beginTransaction();

      await connection.query(
        `UPDATE quotations
         SET status = 'Approved', customer_decision_notes = ?, decided_at = CURRENT_TIMESTAMP
         WHERE quotation_id = ?`,
        [decisionNotes, id]
      );

      await connection.query(
        `UPDATE service_requests
         SET status = CASE WHEN status IN ('Scheduled', 'In Progress', 'Completed') THEN status ELSE 'Approved' END
         WHERE request_id = ?`,
        [quote.request_id]
      );

      await logAction(
        connection,
        req.user,
        'QUOTATION_APPROVED',
        'quotations',
        quote.quotation_no,
        `Quotation ${quote.quotation_no} (Rev ${quote.revision_no}) approved`
      );

      await notifyRoles(
        connection,
        ['Service Staff', 'Administrator'],
        `Quotation Approved (${quote.quotation_no})`,
        `Quotation ${quote.quotation_no} (Rev ${quote.revision_no}) for ${quote.request_reference_no} has been approved.`
      );

      await connection.commit();
      connection.release();

      const [updated] = await pool.query('SELECT * FROM quotations WHERE quotation_id = ?', [id]);
      return res.status(200).json({
        success: true,
        message: 'Quotation approved successfully.',
        quotation: updated[0]
      });
    }

    // Handle Request Revision
    if (['Request Revision', 'Revision Requested', 'Revise'].includes(normalizedDecision)) {
      await connection.beginTransaction();

      await connection.query(
        `UPDATE quotations
         SET status = 'Revision Requested', customer_decision_notes = ?, decided_at = CURRENT_TIMESTAMP
         WHERE quotation_id = ?`,
        [decisionNotes || 'Customer requested scope/pricing revision.', id]
      );

      await logAction(
        connection,
        req.user,
        'QUOTATION_REVISION_REQUESTED',
        'quotations',
        quote.quotation_no,
        `Revision requested on ${quote.quotation_no}: ${decisionNotes || 'No notes'}`
      );

      await notifyRoles(
        connection,
        ['Service Staff', 'Administrator'],
        `Revision Requested (${quote.quotation_no})`,
        `Customer requested a revision on Quotation ${quote.quotation_no} (${quote.request_reference_no}).`
      );

      await connection.commit();
      connection.release();

      const [updated] = await pool.query('SELECT * FROM quotations WHERE quotation_id = ?', [id]);
      return res.status(200).json({
        success: true,
        message: 'Quotation revision requested.',
        quotation: updated[0]
      });
    }

    connection.release();
    return res.status(400).json({
      success: false,
      message: `Invalid decision '${decision}'. Allowed values: 'Approve', 'Request Revision', 'Cancel'.`
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('[quotationController.submitQuotationDecision Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process quotation decision.',
      error: error.message
    });
  }
};

/**
 * POST /api/quotations/:id/revise (Service Staff, Administrator)
 * Creates a new quotation revision with revision_no = old.revision_no + 1 and parent_quotation_id = old.quotation_id,
 * while marking the previous revision as 'Superseded' (FR-007, TC-008).
 */
const reviseQuotation = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const {
      quote_stage = 'Finalized',
      items = [],
      labor_cost,
      parts_total,
      downpayment_required,
      valid_until,
      customer_decision_notes = null
    } = req.body;

    const [oldRows] = await connection.query(
      `SELECT q.*,
              sr.reference_no AS request_reference_no,
              c.user_id AS customer_user_id
       FROM quotations q
       JOIN service_requests sr ON q.request_id = sr.request_id
       JOIN customers c ON sr.customer_id = c.customer_id
       WHERE q.quotation_id = ?
       LIMIT 1`,
      [id]
    );

    if (oldRows.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Original quotation to revise not found.'
      });
    }

    const oldQuote = oldRows[0];

    // If items were not explicitly passed in body, clone existing items so revision still works
    let itemsToUse = items;
    if (!Array.isArray(itemsToUse) || itemsToUse.length === 0) {
      const [oldItems] = await connection.query(
        'SELECT item_type, description, quantity, quoted_price FROM quotation_items WHERE quotation_id = ?',
        [oldQuote.quotation_id]
      );
      itemsToUse = oldItems;
    }

    const {
      normalizedItems,
      labor_cost: finalLaborCost,
      parts_total: finalPartsTotal,
      total_amount: finalTotalAmount
    } = calculateQuoteTotals(
      itemsToUse,
      labor_cost !== undefined ? labor_cost : oldQuote.labor_cost,
      parts_total !== undefined ? parts_total : oldQuote.parts_total
    );

    await connection.beginTransaction();

    // 1. Mark previous quotation as Superseded
    await connection.query(
      `UPDATE quotations SET status = 'Superseded' WHERE quotation_id = ?`,
      [oldQuote.quotation_id]
    );

    // 2. Compute new revision_no = old.revision_no + 1 and link parent_quotation_id = old.quotation_id
    const nextRevisionNo = Number(oldQuote.revision_no) + 1;
    const newQuotationNo = generateQuotationRef();
    const resolvedValidUntil = valid_until || oldQuote.valid_until || formatDateYMD(new Date(Date.now() + 14 * 86400000));
    const resolvedDownpayment =
      downpayment_required !== undefined
        ? Number(downpayment_required)
        : Number(oldQuote.downpayment_required || (finalTotalAmount * 0.5).toFixed(2));

    const validStage = ['Temporary', 'Finalized'].includes(quote_stage) ? quote_stage : 'Finalized';

    const [newQuoteResult] = await connection.query(
      `INSERT INTO quotations
       (quotation_no, request_id, revision_no, parent_quotation_id, quote_stage,
        labor_cost, parts_total, total_amount, downpayment_required,
        status, customer_decision_notes, valid_until, prepared_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending Customer Review', ?, ?, ?)`,
      [
        newQuotationNo,
        oldQuote.request_id,
        nextRevisionNo,
        oldQuote.quotation_id,
        validStage,
        finalLaborCost,
        finalPartsTotal,
        finalTotalAmount,
        resolvedDownpayment,
        customer_decision_notes,
        resolvedValidUntil,
        req.user.user_id
      ]
    );

    const newQuotationId = newQuoteResult.insertId;

    // 3. Insert revised line items with snapshotted prices
    for (const item of normalizedItems) {
      await connection.query(
        `INSERT INTO quotation_items
         (quotation_id, item_type, description, quantity, quoted_price, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          newQuotationId,
          item.item_type,
          item.description,
          item.quantity,
          item.quoted_price,
          item.subtotal
        ]
      );
    }

    // 4. Keep service request in Quoted state if not already scheduled/in-progress
    await connection.query(
      `UPDATE service_requests
       SET status = CASE WHEN status IN ('Scheduled', 'In Progress', 'Completed') THEN status ELSE 'Quoted' END
       WHERE request_id = ?`,
      [oldQuote.request_id]
    );

    await logAction(
      connection,
      req.user,
      'QUOTATION_REVISED',
      'quotations',
      newQuotationNo,
      {
        new_quotation_id: newQuotationId,
        new_quotation_no: newQuotationNo,
        revision_no: nextRevisionNo,
        parent_quotation_id: oldQuote.quotation_id,
        superseded_quotation_no: oldQuote.quotation_no,
        total_amount: finalTotalAmount
      }
    );

    if (oldQuote.customer_user_id) {
      await createNotification(
        connection,
        oldQuote.customer_user_id,
        `Quotation Revision #${nextRevisionNo} Issued (${newQuotationNo})`,
        `Revision #${nextRevisionNo} (${newQuotationNo}) amounting to PHP ${finalTotalAmount.toLocaleString()} has superseded ${oldQuote.quotation_no}.`
      );
    }

    await connection.commit();
    connection.release();

    const [newQuoteRows] = await pool.query('SELECT * FROM quotations WHERE quotation_id = ?', [newQuotationId]);
    const [newItemRows] = await pool.query('SELECT * FROM quotation_items WHERE quotation_id = ?', [newQuotationId]);

    return res.status(201).json({
      success: true,
      message: `Quotation Revision #${nextRevisionNo} (${newQuotationNo}) created. Previous quotation ${oldQuote.quotation_no} is now Superseded.`,
      superseded_quotation_id: oldQuote.quotation_id,
      quotation: {
        ...newQuoteRows[0],
        items: newItemRows
      }
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('[quotationController.reviseQuotation Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to revise quotation.',
      error: error.message
    });
  }
};

module.exports = {
  getQuotations,
  createQuotation,
  submitQuotationDecision,
  reviseQuotation
};
