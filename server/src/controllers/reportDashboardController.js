const pool = require('../config/db');

/**
 * GET /api/dashboard/summary
 * Returns role-specific KPI cards, chart datasets, upcoming PM alerts, and low-stock items
 */
const getDashboardSummary = async (req, res) => {
  try {
    const { role, user_id, customer_id } = req.user;

    // Customer Portal Summary (Strictly Tenant-Isolated)
    if (role === 'Customer') {
      const custId = customer_id || -1;

      const [[inqCount]] = await pool.query(
        'SELECT COUNT(*) AS count FROM purchase_inquiries WHERE customer_id = ?',
        [custId]
      );
      const [[activeReqCount]] = await pool.query(
        "SELECT COUNT(*) AS count FROM service_requests WHERE customer_id = ? AND status NOT IN ('Completed', 'Cancelled')",
        [custId]
      );
      const [[pendingQuoteCount]] = await pool.query(
        `SELECT COUNT(*) AS count
         FROM quotations q
         JOIN service_requests sr ON q.request_id = sr.request_id
         WHERE sr.customer_id = ? AND q.status = 'Pending Customer Review'`,
        [custId]
      );
      const [[eqCount]] = await pool.query(
        'SELECT COUNT(*) AS count FROM equipment WHERE customer_id = ?',
        [custId]
      );

      const [upcomingPm] = await pool.query(
        `SELECT equipment_id, qr_token, brand, model, serial_number, installed_location,
                last_service_date, next_pm_date, maintenance_interval_months, status
         FROM equipment
         WHERE customer_id = ?
         ORDER BY next_pm_date ASC`,
        [custId]
      );

      const [recentRequests] = await pool.query(
        `SELECT request_id, reference_no, service_type, preferred_date, payment_status, status, created_at
         FROM service_requests
         WHERE customer_id = ?
         ORDER BY created_at DESC
         LIMIT 5`,
        [custId]
      );

      return res.status(200).json({
        success: true,
        role,
        kpis: {
          my_inquiries_count: inqCount.count,
          my_active_requests_count: activeReqCount.count,
          my_pending_quotes_count: pendingQuoteCount.count,
          my_equipment_count: eqCount.count
        },
        upcoming_pm_equipment: upcomingPm,
        recent_requests: recentRequests
      });
    }

    // Staff / Technician / Inventory / Admin Operational Summary
    const [[activeRequests]] = await pool.query(
      "SELECT COUNT(*) AS count FROM service_requests WHERE status NOT IN ('Completed', 'Cancelled')"
    );
    const [[pendingInquiries]] = await pool.query(
      "SELECT COUNT(*) AS count FROM purchase_inquiries WHERE inquiry_status IN ('Pending Review', 'Awaiting Payment')"
    );
    const [[pendingQuotes]] = await pool.query(
      "SELECT COUNT(*) AS count FROM quotations WHERE status IN ('Pending Customer Review', 'Revision Requested')"
    );
    const [[activeWorkOrders]] = await pool.query(
      "SELECT COUNT(*) AS count FROM work_orders WHERE status IN ('Scheduled', 'En Route', 'In Progress')"
    );
    const [[completedWorkOrders]] = await pool.query(
      "SELECT COUNT(*) AS count FROM work_orders WHERE status = 'Completed'"
    );
    const [[totalRevenue]] = await pool.query(
      'SELECT COALESCE(SUM(amount_paid), 0) AS total FROM payments'
    );

    // Technician personal counts
    const [[myActiveJobs]] = await pool.query(
      "SELECT COUNT(*) AS count FROM work_orders WHERE technician_id = ? AND status IN ('Scheduled', 'En Route', 'In Progress')",
      [user_id]
    );
    const [[myCompletedJobs]] = await pool.query(
      "SELECT COUNT(*) AS count FROM work_orders WHERE technician_id = ? AND status = 'Completed'",
      [user_id]
    );

    // Low-stock items
    const [lowStockItems] = await pool.query(
      `SELECT item_id, sku_code, part_name, category, unit_of_measure, unit_price,
              total_stock_qty, reserved_qty,
              (total_stock_qty - reserved_qty) AS available_stock,
              reorder_level
       FROM inventory_items
       WHERE (total_stock_qty - reserved_qty) <= reorder_level OR total_stock_qty <= reorder_level
       ORDER BY (total_stock_qty - reserved_qty) ASC`
    );

    // Upcoming PM equipment (next 45 days or overdue)
    const [upcomingPmEquipment] = await pool.query(
      `SELECT e.*,
              c.full_name AS customer_name,
              c.company_name AS customer_company,
              c.phone AS customer_phone,
              DATEDIFF(e.next_pm_date, CURDATE()) AS days_until_pm
       FROM equipment e
       JOIN customers c ON e.customer_id = c.customer_id
       WHERE e.status != 'Decommissioned'
         AND e.next_pm_date IS NOT NULL
         AND e.next_pm_date <= DATE_ADD(CURDATE(), INTERVAL 60 DAY)
       ORDER BY e.next_pm_date ASC
       LIMIT 15`
    );

    // Breakdown charts
    const [requestsByType] = await pool.query(
      `SELECT service_type, COUNT(*) AS count
       FROM service_requests
       GROUP BY service_type`
    );

    const [requestsByStatus] = await pool.query(
      `SELECT status, COUNT(*) AS count
       FROM service_requests
       GROUP BY status`
    );

    const [recentAuditLogs] = await pool.query(
      `SELECT al.*, u.full_name AS user_name
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.user_id
       ORDER BY al.created_at DESC
       LIMIT 10`
    );

    return res.status(200).json({
      success: true,
      role,
      kpis: {
        active_requests_count: activeRequests.count,
        pending_inquiries_count: pendingInquiries.count,
        pending_quotations_count: pendingQuotes.count,
        active_work_orders_count: activeWorkOrders.count,
        completed_work_orders_count: completedWorkOrders.count,
        low_stock_parts_count: lowStockItems.length,
        upcoming_pm_count: upcomingPmEquipment.length,
        total_revenue_collected: Number(totalRevenue.total || 0),
        my_active_jobs_count: myActiveJobs.count,
        my_completed_jobs_count: myCompletedJobs.count
      },
      charts: {
        requests_by_type: requestsByType,
        requests_by_status: requestsByStatus
      },
      low_stock_items: lowStockItems,
      upcoming_pm_equipment: upcomingPmEquipment,
      recent_audit_logs: recentAuditLogs
    });
  } catch (error) {
    console.error('[reportDashboardController.getDashboardSummary Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load dashboard summary.',
      error: error.message
    });
  }
};

/**
 * GET /api/reports (Administrator, Service Staff, Inventory Staff)
 * Filterable by date range (start_date, end_date) and category:
 * inquiries | requests | quotations | work_orders | inventory | payments
 */
const getOperationalReports = async (req, res) => {
  try {
    const { category = 'requests', start_date, end_date } = req.query;
    const cat = String(category).toLowerCase().trim();

    const buildDateFilter = (colName) => {
      const clauses = [];
      const params = [];
      if (start_date) {
        clauses.push(`DATE(${colName}) >= ?`);
        params.push(start_date);
      }
      if (end_date) {
        clauses.push(`DATE(${colName}) <= ?`);
        params.push(end_date);
      }
      return {
        where: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
        params
      };
    };

    let records = [];
    let summary = {};

    if (cat === 'inquiries') {
      const df = buildDateFilter('pi.created_at');
      const [rows] = await pool.query(
        `SELECT pi.*,
                c.full_name AS customer_name,
                c.company_name AS customer_company,
                p.sku_code,
                p.brand,
                p.model_name,
                sr.reference_no AS linked_service_request_no
         FROM purchase_inquiries pi
         JOIN customers c ON pi.customer_id = c.customer_id
         JOIN products p ON pi.product_id = p.product_id
         LEFT JOIN service_requests sr ON pi.linked_service_request_id = sr.request_id
         ${df.where}
         ORDER BY pi.created_at DESC`,
        df.params
      );
      records = rows;
      summary = {
        total_inquiries: rows.length,
        total_inquiry_value: rows.reduce((sum, r) => sum + Number(r.total_amount || 0), 0),
        with_installation_count: rows.filter((r) => Boolean(r.request_installation)).length
      };
    } else if (cat === 'requests') {
      const df = buildDateFilter('sr.created_at');
      const [rows] = await pool.query(
        `SELECT sr.*,
                c.full_name AS customer_name,
                c.company_name AS customer_company,
                e.qr_token AS equipment_qr_token,
                e.brand AS equipment_brand,
                e.model AS equipment_model
         FROM service_requests sr
         JOIN customers c ON sr.customer_id = c.customer_id
         LEFT JOIN equipment e ON sr.equipment_id = e.equipment_id
         ${df.where}
         ORDER BY sr.created_at DESC`,
        df.params
      );
      records = rows;
      summary = {
        total_requests: rows.length,
        completed_count: rows.filter((r) => r.status === 'Completed').length,
        cancelled_count: rows.filter((r) => r.status === 'Cancelled').length
      };
    } else if (cat === 'quotations') {
      const df = buildDateFilter('q.created_at');
      const [rows] = await pool.query(
        `SELECT q.*,
                sr.reference_no AS request_reference_no,
                sr.service_type,
                sr.payment_status,
                c.full_name AS customer_name,
                u.full_name AS prepared_by_name
         FROM quotations q
         JOIN service_requests sr ON q.request_id = sr.request_id
         JOIN customers c ON sr.customer_id = c.customer_id
         LEFT JOIN users u ON q.prepared_by = u.user_id
         ${df.where}
         ORDER BY q.created_at DESC`,
        df.params
      );
      records = rows;
      summary = {
        total_quotations: rows.length,
        approved_count: rows.filter((r) => r.status === 'Approved').length,
        superseded_revisions_count: rows.filter((r) => r.status === 'Superseded').length,
        total_approved_value: rows
          .filter((r) => r.status === 'Approved')
          .reduce((sum, r) => sum + Number(r.total_amount || 0), 0)
      };
    } else if (cat === 'work_orders') {
      const df = buildDateFilter('wo.scheduled_start');
      const [rows] = await pool.query(
        `SELECT wo.*,
                sr.reference_no AS request_reference_no,
                sr.service_type,
                c.full_name AS customer_name,
                tech.full_name AS technician_name,
                e.qr_token AS equipment_qr_token
         FROM work_orders wo
         JOIN service_requests sr ON wo.request_id = sr.request_id
         JOIN customers c ON sr.customer_id = c.customer_id
         JOIN users tech ON wo.technician_id = tech.user_id
         LEFT JOIN equipment e ON sr.equipment_id = e.equipment_id
         ${df.where}
         ORDER BY wo.scheduled_start DESC`,
        df.params
      );
      records = rows;
      summary = {
        total_work_orders: rows.length,
        completed_count: rows.filter((r) => r.status === 'Completed').length,
        scheduled_count: rows.filter((r) => r.status === 'Scheduled').length
      };
    } else if (cat === 'inventory') {
      const [rows] = await pool.query(
        `SELECT i.*,
                (i.total_stock_qty - i.reserved_qty) AS available_stock,
                ((i.total_stock_qty - i.reserved_qty) <= i.reorder_level OR i.total_stock_qty <= i.reorder_level) AS is_low_stock
         FROM inventory_items i
         ORDER BY i.category ASC, i.part_name ASC`
      );
      records = rows;
      summary = {
        total_skus: rows.length,
        low_stock_skus: rows.filter((r) => Boolean(r.is_low_stock)).length,
        total_inventory_valuation: rows.reduce(
          (sum, r) => sum + Number(r.total_stock_qty || 0) * Number(r.unit_price || 0),
          0
        )
      };
    } else if (cat === 'payments') {
      const df = buildDateFilter('p.recorded_at');
      const [rows] = await pool.query(
        `SELECT p.*,
                sr.reference_no AS request_reference_no,
                pi.reference_no AS inquiry_reference_no,
                u.full_name AS recorded_by_name
         FROM payments p
         LEFT JOIN service_requests sr ON p.request_id = sr.request_id
         LEFT JOIN purchase_inquiries pi ON p.inquiry_id = pi.inquiry_id
         LEFT JOIN users u ON p.recorded_by = u.user_id
         ${df.where}
         ORDER BY p.recorded_at DESC`,
        df.params
      );
      records = rows;
      summary = {
        total_transactions: rows.length,
        total_collected: rows.reduce((sum, r) => sum + Number(r.amount_paid || 0), 0)
      };
    } else {
      return res.status(400).json({
        success: false,
        message: `Unsupported report category '${category}'. Choose from: inquiries, requests, quotations, work_orders, inventory, payments.`
      });
    }

    return res.status(200).json({
      success: true,
      category: cat,
      filters: { start_date: start_date || null, end_date: end_date || null },
      summary,
      count: records.length,
      records
    });
  } catch (error) {
    console.error('[reportDashboardController.getOperationalReports Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate operational report.',
      error: error.message
    });
  }
};

/**
 * GET /api/audit-logs (Administrator only)
 * Immutable chronological security & transaction audit trail
 */
const getAuditLogs = async (req, res) => {
  try {
    const { entity_name, user_role, action, search, limit = 150 } = req.query;
    const conditions = [];
    const params = [];

    if (entity_name) {
      conditions.push('al.entity_name = ?');
      params.push(entity_name);
    }

    if (user_role) {
      conditions.push('al.user_role = ?');
      params.push(user_role);
    }

    if (action) {
      conditions.push('al.action LIKE ?');
      params.push(`%${action.trim()}%`);
    }

    if (search) {
      conditions.push(
        '(al.action LIKE ? OR al.entity_name LIKE ? OR al.entity_id LIKE ? OR al.details LIKE ? OR u.full_name LIKE ?)'
      );
      const like = `%${search.trim()}%`;
      params.push(like, like, like, like, like);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rowLimit = Math.min(500, Math.max(10, parseInt(limit, 10) || 150));

    const [rows] = await pool.query(
      `SELECT al.*,
              u.full_name AS user_name,
              u.email AS user_email
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.user_id
       ${whereClause}
       ORDER BY al.created_at DESC, al.log_id DESC
       LIMIT ?`,
      [...params, rowLimit]
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      audit_logs: rows
    });
  } catch (error) {
    console.error('[reportDashboardController.getAuditLogs Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit trail.',
      error: error.message
    });
  }
};

module.exports = {
  getDashboardSummary,
  getOperationalReports,
  getAuditLogs
};
