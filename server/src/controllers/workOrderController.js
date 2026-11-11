const pool = require('../config/db');
const { generateWorkOrderRef, generateQrToken } = require('../utils/refGenerator');
const { calculateNextPmDate, formatDateYMD } = require('../utils/pmCalculator');
const { logAction } = require('../utils/auditLogger');
const { createNotification, notifyRoles } = require('../utils/notifyHelper');

/**
 * Normalizes datetime inputs (e.g. '2026-11-14T13:00' -> '2026-11-14 13:00:00')
 */
function normalizeDateTime(dtInput) {
  if (!dtInput) return null;
  const s = String(dtInput).trim().replace('T', ' ');
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s)) {
    return `${s}:00`;
  }
  return s;
}

/**
 * Helper: Executes the exact schedule conflict query for a technician
 * new_start < existing_end AND new_end > existing_start
 */
async function findTechnicianConflicts(executor, technicianId, scheduledStart, scheduledEnd, excludeWorkOrderId = null) {
  let sql = `
    SELECT wo.work_order_id, wo.work_order_no, wo.scheduled_start, wo.scheduled_end, wo.status,
           sr.reference_no AS request_reference_no, sr.service_type,
           c.full_name AS customer_name
    FROM work_orders wo
    JOIN service_requests sr ON wo.request_id = sr.request_id
    JOIN customers c ON sr.customer_id = c.customer_id
    WHERE wo.technician_id = ?
      AND wo.status IN ('Scheduled', 'En Route', 'In Progress')
      AND (? < wo.scheduled_end AND ? > wo.scheduled_start)
  `;
  const params = [Number(technicianId), scheduledStart, scheduledEnd];

  if (excludeWorkOrderId) {
    sql += ' AND wo.work_order_id != ?';
    params.push(Number(excludeWorkOrderId));
  }

  const [conflicts] = await executor.query(sql, params);
  return conflicts;
}

/**
 * GET /api/work-orders
 * Lists work orders with technician, customer, equipment, and linked inventory transaction details
 */
const getWorkOrders = async (req, res) => {
  try {
    const { status, technician_id, request_id, my_jobs, search } = req.query;
    const conditions = [];
    const params = [];

    if (req.user.role === 'Customer') {
      conditions.push('sr.customer_id = ?');
      params.push(req.user.customer_id || -1);
    } else if (req.user.role === 'Technician' && my_jobs === 'true') {
      conditions.push('wo.technician_id = ?');
      params.push(req.user.user_id);
    } else if (technician_id) {
      conditions.push('wo.technician_id = ?');
      params.push(technician_id);
    }

    if (status) {
      conditions.push('wo.status = ?');
      params.push(status);
    }

    if (request_id) {
      conditions.push('wo.request_id = ?');
      params.push(request_id);
    }

    if (search) {
      conditions.push(
        '(wo.work_order_no LIKE ? OR sr.reference_no LIKE ? OR c.full_name LIKE ? OR c.company_name LIKE ? OR tech.full_name LIKE ? OR e.qr_token LIKE ?)'
      );
      const like = `%${search.trim()}%`;
      params.push(like, like, like, like, like, like);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT wo.*,
              sr.reference_no AS request_reference_no,
              sr.service_type,
              sr.issue_description,
              sr.current_location,
              sr.destination_location,
              sr.priority,
              sr.payment_status,
              sr.equipment_id,
              sr.customer_id,
              c.full_name AS customer_name,
              c.company_name AS customer_company,
              c.phone AS customer_phone,
              tech.full_name AS technician_name,
              tech.specialization AS technician_specialization,
              tech.phone AS technician_phone,
              e.qr_token AS equipment_qr_token,
              e.brand AS equipment_brand,
              e.model AS equipment_model,
              e.serial_number AS equipment_serial,
              e.capacity_hp AS equipment_hp,
              e.maintenance_interval_months,
              e.last_service_date,
              e.next_pm_date,
              q.quotation_no,
              q.revision_no AS quotation_revision_no,
              q.total_amount AS quotation_total_amount
       FROM work_orders wo
       JOIN service_requests sr ON wo.request_id = sr.request_id
       JOIN customers c ON sr.customer_id = c.customer_id
       JOIN users tech ON wo.technician_id = tech.user_id
       LEFT JOIN equipment e ON sr.equipment_id = e.equipment_id
       LEFT JOIN quotations q ON wo.quotation_id = q.quotation_id
       ${whereClause}
       ORDER BY wo.scheduled_start DESC, wo.work_order_id DESC`,
      params
    );

    const woIds = rows.map((r) => r.work_order_id);
    const txByWorkOrder = {};

    if (woIds.length > 0) {
      const placeholders = woIds.map(() => '?').join(', ');
      const [txRows] = await pool.query(
        `SELECT it.*, ii.sku_code, ii.part_name, ii.unit_of_measure, ii.unit_price, u.full_name AS performed_by_name
         FROM inventory_transactions it
         JOIN inventory_items ii ON it.item_id = ii.item_id
         LEFT JOIN users u ON it.performed_by = u.user_id
         WHERE it.work_order_id IN (${placeholders})
         ORDER BY it.created_at DESC`,
        woIds
      );
      for (const tx of txRows) {
        if (!txByWorkOrder[tx.work_order_id]) {
          txByWorkOrder[tx.work_order_id] = [];
        }
        txByWorkOrder[tx.work_order_id].push(tx);
      }
    }

    const workOrders = rows.map((wo) => ({
      ...wo,
      inventory_transactions: txByWorkOrder[wo.work_order_id] || []
    }));

    return res.status(200).json({
      success: true,
      count: workOrders.length,
      work_orders: workOrders
    });
  } catch (error) {
    console.error('[workOrderController.getWorkOrders Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve work orders.',
      error: error.message
    });
  }
};

/**
 * POST /api/work-orders/check-conflict (Service Staff, Administrator)
 * Real-time conflict check endpoint for Dispatch Calendar UI
 */
const checkScheduleConflict = async (req, res) => {
  try {
    const { technician_id, scheduled_start, scheduled_end, exclude_work_order_id } = req.body;
    if (!technician_id || !scheduled_start || !scheduled_end) {
      return res.status(400).json({
        success: false,
        message: 'Technician ID, scheduled_start, and scheduled_end are required.'
      });
    }

    const normStart = normalizeDateTime(scheduled_start);
    const normEnd = normalizeDateTime(scheduled_end);

    if (new Date(normEnd) <= new Date(normStart)) {
      return res.status(400).json({
        success: false,
        message: 'Scheduled end time must be after scheduled start time.'
      });
    }

    const conflicts = await findTechnicianConflicts(
      pool,
      technician_id,
      normStart,
      normEnd,
      exclude_work_order_id
    );

    return res.status(200).json({
      success: true,
      has_conflict: conflicts.length > 0,
      conflicts
    });
  } catch (error) {
    console.error('[workOrderController.checkScheduleConflict Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check schedule conflicts.',
      error: error.message
    });
  }
};

/**
 * POST /api/work-orders (Service Staff, Administrator)
 * Assigns a technician to a schedule/work order with strict conflict detection (FR-008, TC-009):
 * Blocks assignment and returns HTTP 409 Conflict if:
 *   new_start < existing_end AND new_end > existing_start
 */
const createWorkOrder = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const {
      request_id,
      quotation_id = null,
      technician_id,
      scheduled_start,
      scheduled_end,
      technician_remarks = null
    } = req.body;

    if (!request_id || !technician_id || !scheduled_start || !scheduled_end) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Service request ID, technician ID, scheduled_start, and scheduled_end are required.'
      });
    }

    const normStart = normalizeDateTime(scheduled_start);
    const normEnd = normalizeDateTime(scheduled_end);

    if (new Date(normEnd) <= new Date(normStart)) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Scheduled end datetime must be later than scheduled start datetime.'
      });
    }

    const [techRows] = await connection.query(
      "SELECT user_id, full_name, role, is_active FROM users WHERE user_id = ? AND role = 'Technician' LIMIT 1",
      [technician_id]
    );
    if (techRows.length === 0 || !techRows[0].is_active) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Selected technician does not exist or is inactive.'
      });
    }

    const technician = techRows[0];

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
        message: 'Service request not found.'
      });
    }

    const serviceRequest = srRows[0];

    // FR-008 / TC-009: Execute exact overlap check
    const conflicts = await findTechnicianConflicts(connection, technician_id, normStart, normEnd);

    if (conflicts.length > 0) {
      const firstConflict = conflicts[0];
      await logAction(
        connection,
        req.user,
        'SCHEDULE_CONFLICT_BLOCKED',
        'work_orders',
        firstConflict.work_order_no,
        `Blocked double-booking of Technician ${technician.full_name} (${normStart} to ${normEnd}); overlaps with ${firstConflict.work_order_no} (${firstConflict.scheduled_start} to ${firstConflict.scheduled_end})`
      );
      connection.release();
      return res.status(409).json({
        success: false,
        message: `Schedule Conflict Detected: Technician ${technician.full_name} is already assigned to Work Order ${firstConflict.work_order_no} (${firstConflict.scheduled_start} to ${firstConflict.scheduled_end}).`,
        conflict: firstConflict,
        conflicts
      });
    }

    await connection.beginTransaction();

    // Auto-resolve active quotation if quotation_id was not explicitly passed
    let resolvedQuotationId = quotation_id ? Number(quotation_id) : null;
    if (!resolvedQuotationId) {
      const [activeQuote] = await connection.query(
        `SELECT quotation_id FROM quotations
         WHERE request_id = ? AND status != 'Superseded'
         ORDER BY revision_no DESC, quotation_id DESC
         LIMIT 1`,
        [request_id]
      );
      if (activeQuote.length > 0) {
        resolvedQuotationId = activeQuote[0].quotation_id;
      }
    }

    const workOrderNo = generateWorkOrderRef();

    const [woResult] = await connection.query(
      `INSERT INTO work_orders
       (work_order_no, request_id, quotation_id, technician_id, scheduled_start, scheduled_end, technician_remarks, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Scheduled')`,
      [
        workOrderNo,
        Number(request_id),
        resolvedQuotationId,
        Number(technician_id),
        normStart,
        normEnd,
        technician_remarks
      ]
    );

    const newWorkOrderId = woResult.insertId;

    await connection.query(
      `UPDATE service_requests SET status = 'Scheduled' WHERE request_id = ?`,
      [request_id]
    );

    await logAction(
      connection,
      req.user,
      'WORK_ORDER_DISPATCHED',
      'work_orders',
      workOrderNo,
      `Dispatched Technician ${technician.full_name} for ${serviceRequest.reference_no} (${normStart} to ${normEnd})`
    );

    await createNotification(
      connection,
      technician.user_id,
      `New Work Order Assigned (${workOrderNo})`,
      `You have been assigned to ${workOrderNo} (${serviceRequest.service_type}) from ${normStart} to ${normEnd}.`
    );

    if (serviceRequest.customer_user_id) {
      await createNotification(
        connection,
        serviceRequest.customer_user_id,
        `Technician Scheduled (${workOrderNo})`,
        `Technician ${technician.full_name} has been scheduled for your ${serviceRequest.service_type} request (${serviceRequest.reference_no}) on ${normStart}.`
      );
    }

    await connection.commit();
    connection.release();

    const [createdRows] = await pool.query(
      `SELECT wo.*, tech.full_name AS technician_name, sr.reference_no AS request_reference_no
       FROM work_orders wo
       JOIN users tech ON wo.technician_id = tech.user_id
       JOIN service_requests sr ON wo.request_id = sr.request_id
       WHERE wo.work_order_id = ?`,
      [newWorkOrderId]
    );

    return res.status(201).json({
      success: true,
      message: `Work Order ${workOrderNo} scheduled and assigned to ${technician.full_name}.`,
      work_order: createdRows[0]
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('[workOrderController.createWorkOrder Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to schedule work order.',
      error: error.message
    });
  }
};

/**
 * PATCH /api/work-orders/:id/status (Technician, Service Staff, Administrator)
 * Updates operational dispatch status (En Route, In Progress, Cancelled)
 */
const updateWorkOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, scheduled_start, scheduled_end } = req.body;

    const [rows] = await pool.query('SELECT * FROM work_orders WHERE work_order_id = ? LIMIT 1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Work order not found.'
      });
    }

    const wo = rows[0];

    // If rescheduling times, verify no conflict
    const nextStart = scheduled_start ? normalizeDateTime(scheduled_start) : wo.scheduled_start;
    const nextEnd = scheduled_end ? normalizeDateTime(scheduled_end) : wo.scheduled_end;

    if (scheduled_start || scheduled_end) {
      const conflicts = await findTechnicianConflicts(pool, wo.technician_id, nextStart, nextEnd, wo.work_order_id);
      if (conflicts.length > 0) {
        return res.status(409).json({
          success: false,
          message: `Schedule Conflict Detected with ${conflicts[0].work_order_no} (${conflicts[0].scheduled_start} to ${conflicts[0].scheduled_end}).`,
          conflict: conflicts[0],
          conflicts
        });
      }
    }

    const nextStatus = status || wo.status;

    await pool.query(
      `UPDATE work_orders
       SET status = ?, scheduled_start = ?, scheduled_end = ?
       WHERE work_order_id = ?`,
      [nextStatus, nextStart, nextEnd, id]
    );

    if (nextStatus === 'En Route' || nextStatus === 'In Progress') {
      await pool.query(
        `UPDATE service_requests SET status = 'In Progress' WHERE request_id = ?`,
        [wo.request_id]
      );
    }

    await logAction(
      pool,
      req.user,
      'WORK_ORDER_STATUS_UPDATED',
      'work_orders',
      wo.work_order_no,
      { status: nextStatus, scheduled_start: nextStart, scheduled_end: nextEnd }
    );

    const [updated] = await pool.query('SELECT * FROM work_orders WHERE work_order_id = ?', [id]);
    return res.status(200).json({
      success: true,
      message: `Work order status updated to '${nextStatus}'.`,
      work_order: updated[0]
    });
  } catch (error) {
    console.error('[workOrderController.updateWorkOrderStatus Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update work order status.',
      error: error.message
    });
  }
};

/**
 * PATCH /api/work-orders/:id/complete (Technician, Service Staff, Administrator)
 * Completes a Work Order inside a single ACID transaction (FR-008, TC-010, TC-011):
 * 1. Validates required diagnosis_notes, work_performed, and technician_remarks.
 * 2. Updates work_orders.status = 'Completed' and service_requests.status = 'Completed'.
 * 3. Consumes any unissued 'Reservation' inventory items linked to this work_order_id (converts to 'Issue' and deducts total_stock_qty & reserved_qty).
 * 4. Inserts a record into service_history.
 * 5. Updates equipment.last_service_date and equipment.next_pm_date by adding maintenance_interval_months (default 6 months) to completion date.
 */
const completeWorkOrder = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const {
      diagnosis_notes,
      work_performed,
      technician_remarks,
      parts_replaced_summary: explicitPartsSummary,
      completion_date,
      equipment_id: bodyEquipmentId,
      evidence_photo_url: bodyPhotoUrl
    } = req.body;

    if (
      !diagnosis_notes ||
      !String(diagnosis_notes).trim() ||
      !work_performed ||
      !String(work_performed).trim() ||
      !technician_remarks ||
      !String(technician_remarks).trim()
    ) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Diagnostic notes, work performed (actions taken), and technician remarks are all required to complete a work order.'
      });
    }

    const [woRows] = await connection.query(
      `SELECT wo.*,
              sr.reference_no AS request_reference_no,
              sr.customer_id,
              sr.equipment_id AS request_equipment_id,
              sr.service_type,
              sr.current_location,
              sr.destination_location,
              tech.full_name AS technician_name,
              c.user_id AS customer_user_id
       FROM work_orders wo
       JOIN service_requests sr ON wo.request_id = sr.request_id
       JOIN users tech ON wo.technician_id = tech.user_id
       JOIN customers c ON sr.customer_id = c.customer_id
       WHERE wo.work_order_id = ?
       LIMIT 1`,
      [id]
    );

    if (woRows.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Work order not found.'
      });
    }

    const wo = woRows[0];

    if (wo.status === 'Completed') {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'This work order has already been marked as Completed.'
      });
    }

    const evidencePhotoUrl = req.file
      ? `/uploads/evidence/${req.file.filename}`
      : bodyPhotoUrl || wo.evidence_photo_url || null;

    await connection.beginTransaction();

    // 1. Consume any remaining Reserved inventory items for this work order
    const [txRows] = await connection.query(
      `SELECT it.item_id,
              ii.part_name,
              ii.sku_code,
              ii.unit_of_measure,
              SUM(CASE WHEN it.tx_type = 'Reservation' THEN it.quantity ELSE 0 END) AS total_reserved,
              SUM(CASE WHEN it.tx_type = 'Issue' THEN it.quantity ELSE 0 END) AS total_issued,
              SUM(CASE WHEN it.tx_type = 'Return' THEN it.quantity ELSE 0 END) AS total_returned
       FROM inventory_transactions it
       JOIN inventory_items ii ON it.item_id = ii.item_id
       WHERE it.work_order_id = ?
       GROUP BY it.item_id, ii.part_name, ii.sku_code, ii.unit_of_measure`,
      [wo.work_order_id]
    );

    const consumedPartsList = [];

    for (const row of txRows) {
      const reservedQty = Number(row.total_reserved || 0);
      const issuedQty = Number(row.total_issued || 0);
      const returnedQty = Number(row.total_returned || 0);
      const unissuedReserved = Math.max(0, reservedQty - issuedQty - returnedQty);

      if (unissuedReserved > 0) {
        // Convert reservation to Issue: decrement both total_stock_qty and reserved_qty
        await connection.query(
          `UPDATE inventory_items
           SET total_stock_qty = GREATEST(0, total_stock_qty - ?),
               reserved_qty = GREATEST(0, reserved_qty - ?)
           WHERE item_id = ?`,
          [unissuedReserved, unissuedReserved, row.item_id]
        );

        await connection.query(
          `INSERT INTO inventory_transactions
           (item_id, work_order_id, tx_type, quantity, performed_by, remarks)
           VALUES (?, ?, 'Issue', ?, ?, ?)`,
          [
            row.item_id,
            wo.work_order_id,
            unissuedReserved,
            req.user.user_id,
            `Auto-issued reserved parts upon completion of ${wo.work_order_no}`
          ]
        );
      }

      const finalUsedQty = issuedQty + unissuedReserved;
      if (finalUsedQty > 0) {
        consumedPartsList.push(`${finalUsedQty} ${row.unit_of_measure} ${row.part_name} (${row.sku_code})`);
      }
    }

    const finalPartsSummary =
      explicitPartsSummary && String(explicitPartsSummary).trim()
        ? String(explicitPartsSummary).trim()
        : consumedPartsList.length > 0
        ? consumedPartsList.join('; ')
        : 'Standard consumables / no major parts replaced';

    // 2. Resolve equipment_id (or auto-register if brand-new installation without equipment_id yet)
    let targetEquipmentId = bodyEquipmentId || wo.request_equipment_id || null;

    if (!targetEquipmentId) {
      // Look up if customer already has an equipment unit or create one for this installation
      const newQrToken = generateQrToken();
      const serviceDateStr = formatDateYMD(completion_date || new Date());
      const nextPmDefault = calculateNextPmDate(serviceDateStr, 6);

      const [eqInsert] = await connection.query(
        `INSERT INTO equipment
         (customer_id, product_id, qr_token, brand, model, serial_number, ac_type, capacity_hp,
          installed_location, installation_date, warranty_expiry, maintenance_interval_months,
          last_service_date, next_pm_date, status)
         VALUES (?, NULL, ?, 'Daikin / NorthPeak', 'Installed Split-Type AC Unit', ?, 'Split Type', '1.5 HP',
                 ?, ?, DATE_ADD(?, INTERVAL 12 MONTH), 6, ?, ?, 'Active')`,
        [
          wo.customer_id,
          newQrToken,
          `SN-INST-${Date.now()}`,
          wo.destination_location || wo.current_location,
          serviceDateStr,
          serviceDateStr,
          serviceDateStr,
          nextPmDefault
        ]
      );

      targetEquipmentId = eqInsert.insertId;

      await connection.query(
        `UPDATE service_requests SET equipment_id = ? WHERE request_id = ?`,
        [targetEquipmentId, wo.request_id]
      );
    }

    // 3. Fetch equipment's maintenance_interval_months and compute last_service_date & next_pm_date
    const [eqRows] = await connection.query(
      'SELECT * FROM equipment WHERE equipment_id = ? LIMIT 1',
      [targetEquipmentId]
    );

    const equipmentRecord = eqRows[0];
    const intervalMonths = Number(equipmentRecord?.maintenance_interval_months) || 6;
    const serviceDate = formatDateYMD(completion_date || new Date());
    const computedNextPmDate = calculateNextPmDate(serviceDate, intervalMonths);

    // 4. Update work_orders status = 'Completed'
    await connection.query(
      `UPDATE work_orders
       SET status = 'Completed',
           diagnosis_notes = ?,
           work_performed = ?,
           technician_remarks = ?,
           evidence_photo_url = ?,
           completed_at = CURRENT_TIMESTAMP
       WHERE work_order_id = ?`,
      [
        diagnosis_notes.trim(),
        work_performed.trim(),
        technician_remarks.trim(),
        evidencePhotoUrl,
        wo.work_order_id
      ]
    );

    // 5. Update service_requests status = 'Completed'
    await connection.query(
      `UPDATE service_requests SET status = 'Completed' WHERE request_id = ?`,
      [wo.request_id]
    );

    // 6. Insert chronological record into service_history
    const [historyInsert] = await connection.query(
      `INSERT INTO service_history
       (equipment_id, work_order_id, service_type, diagnosis_summary, actions_taken,
        parts_replaced_summary, technician_name, service_date, computed_next_pm_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        targetEquipmentId,
        wo.work_order_id,
        wo.service_type,
        diagnosis_notes.trim(),
        work_performed.trim(),
        finalPartsSummary,
        wo.technician_name,
        serviceDate,
        computedNextPmDate
      ]
    );

    // 7. Update equipment last_service_date, next_pm_date, status = 'Active', and installed_location if relocated
    const updatedLocation =
      wo.service_type === 'Relocation or Transfer' && wo.destination_location
        ? wo.destination_location
        : equipmentRecord.installed_location;

    await connection.query(
      `UPDATE equipment
       SET last_service_date = ?,
           next_pm_date = ?,
           installed_location = ?,
           status = 'Active'
       WHERE equipment_id = ?`,
      [serviceDate, computedNextPmDate, updatedLocation, targetEquipmentId]
    );

    await logAction(
      connection,
      req.user,
      'WORK_ORDER_COMPLETED',
      'work_orders',
      wo.work_order_no,
      {
        work_order_id: wo.work_order_id,
        equipment_id: targetEquipmentId,
        qr_token: equipmentRecord?.qr_token,
        service_date: serviceDate,
        computed_next_pm_date: computedNextPmDate,
        history_id: historyInsert.insertId
      }
    );

    if (wo.customer_user_id) {
      await createNotification(
        connection,
        wo.customer_user_id,
        `Service Completed (${wo.work_order_no})`,
        `Your ${wo.service_type} job (${wo.request_reference_no}) is complete! Next Preventive Maintenance is scheduled for ${computedNextPmDate}.`
      );
    }

    await notifyRoles(
      connection,
      ['Service Staff', 'Administrator'],
      `Work Order Completed (${wo.work_order_no})`,
      `Technician ${wo.technician_name} completed ${wo.work_order_no}. Equipment next PM date updated to ${computedNextPmDate}.`
    );

    await connection.commit();
    connection.release();

    const [updatedWo] = await pool.query('SELECT * FROM work_orders WHERE work_order_id = ?', [wo.work_order_id]);
    const [updatedEq] = await pool.query('SELECT * FROM equipment WHERE equipment_id = ?', [targetEquipmentId]);
    const [createdHistory] = await pool.query(
      'SELECT * FROM service_history WHERE history_id = ?',
      [historyInsert.insertId]
    );

    return res.status(200).json({
      success: true,
      message: `Work Order ${wo.work_order_no} completed. Equipment next PM date automatically set to ${computedNextPmDate}.`,
      work_order: updatedWo[0],
      equipment: updatedEq[0],
      service_history_entry: createdHistory[0]
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('[workOrderController.completeWorkOrder Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete work order.',
      error: error.message
    });
  }
};

module.exports = {
  getWorkOrders,
  checkScheduleConflict,
  createWorkOrder,
  updateWorkOrderStatus,
  completeWorkOrder
};
