const QRCode = require('qrcode');
const pool = require('../config/db');
const { generateQrToken } = require('../utils/refGenerator');
const { calculateNextPmDate, formatDateYMD } = require('../utils/pmCalculator');
const { logAction } = require('../utils/auditLogger');

/**
 * GET /api/customers
 * Lists customer profiles (Tenant-isolated for Customer role; full list for Staff/Tech/Admin)
 */
const getCustomers = async (req, res) => {
  try {
    const { search, customer_type } = req.query;
    const conditions = [];
    const params = [];

    if (req.user.role === 'Customer') {
      conditions.push('c.customer_id = ?');
      params.push(req.user.customer_id || -1);
    }

    if (customer_type) {
      conditions.push('c.customer_type = ?');
      params.push(customer_type);
    }

    if (search) {
      conditions.push('(c.full_name LIKE ? OR c.company_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)');
      const like = `%${search.trim()}%`;
      params.push(like, like, like, like);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM equipment e WHERE e.customer_id = c.customer_id) AS equipment_count
       FROM customers c
       ${whereClause}
       ORDER BY c.created_at DESC`,
      params
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      customers: rows
    });
  } catch (error) {
    console.error('[customerEquipmentController.getCustomers Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve customers.',
      error: error.message
    });
  }
};

/**
 * GET /api/products (Public / All Roles)
 * Lists aircon catalog products with optional filters
 */
const getProducts = async (req, res) => {
  try {
    const { ac_type, brand, inverter_type, active_only, search } = req.query;
    const conditions = [];
    const params = [];

    if (active_only === 'true' || (req.user && req.user.role === 'Customer' && active_only !== 'false')) {
      conditions.push('p.is_active = TRUE');
    }

    if (ac_type) {
      conditions.push('p.ac_type = ?');
      params.push(ac_type);
    }

    if (brand) {
      conditions.push('p.brand = ?');
      params.push(brand);
    }

    if (inverter_type) {
      conditions.push('p.inverter_type = ?');
      params.push(inverter_type);
    }

    if (search) {
      conditions.push('(p.brand LIKE ? OR p.model_name LIKE ? OR p.sku_code LIKE ? OR p.specs_summary LIKE ?)');
      const like = `%${search.trim()}%`;
      params.push(like, like, like, like);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT p.* FROM products p ${whereClause} ORDER BY p.brand ASC, p.unit_price ASC`,
      params
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      products: rows
    });
  } catch (error) {
    console.error('[customerEquipmentController.getProducts Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve product catalog.',
      error: error.message
    });
  }
};

/**
 * POST /api/products (Service Staff, Administrator)
 * Adds a new brand-new aircon model to the catalog
 */
const createProduct = async (req, res) => {
  try {
    const {
      sku_code,
      brand,
      model_name,
      ac_type,
      horsepower,
      inverter_type = 'Inverter',
      unit_price,
      stock_qty = 0,
      warranty_months = 12,
      specs_summary = null,
      is_active = true
    } = req.body;

    if (!sku_code || !brand || !model_name || !ac_type || !horsepower || unit_price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'SKU code, brand, model name, AC type, horsepower, and unit price are required.'
      });
    }

    const [existing] = await pool.query('SELECT product_id FROM products WHERE sku_code = ? LIMIT 1', [sku_code.trim()]);
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: `A product with SKU code '${sku_code}' already exists.`
      });
    }

    const [result] = await pool.query(
      `INSERT INTO products
       (sku_code, brand, model_name, ac_type, horsepower, inverter_type, unit_price, stock_qty, warranty_months, specs_summary, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sku_code.trim().toUpperCase(),
        brand.trim(),
        model_name.trim(),
        ac_type,
        horsepower.trim(),
        inverter_type,
        Number(unit_price),
        Number(stock_qty),
        Number(warranty_months),
        specs_summary,
        Boolean(is_active)
      ]
    );

    await logAction(
      pool,
      req.user,
      'PRODUCT_CREATED',
      'products',
      result.insertId,
      `Added catalog unit ${brand} ${model_name} (${sku_code})`
    );

    const [created] = await pool.query('SELECT * FROM products WHERE product_id = ?', [result.insertId]);

    return res.status(201).json({
      success: true,
      message: 'Aircon product added to catalog successfully.',
      product: created[0]
    });
  } catch (error) {
    console.error('[customerEquipmentController.createProduct Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create product.',
      error: error.message
    });
  }
};

/**
 * PUT /api/products/:id (Service Staff, Administrator)
 * Updates an aircon catalog item (Note: historical quotations_items keep their quoted_price snapshot)
 */
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const [existingRows] = await pool.query('SELECT * FROM products WHERE product_id = ? LIMIT 1', [id]);
    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    const current = existingRows[0];
    const {
      sku_code = current.sku_code,
      brand = current.brand,
      model_name = current.model_name,
      ac_type = current.ac_type,
      horsepower = current.horsepower,
      inverter_type = current.inverter_type,
      unit_price = current.unit_price,
      stock_qty = current.stock_qty,
      warranty_months = current.warranty_months,
      specs_summary = current.specs_summary,
      is_active = current.is_active
    } = req.body;

    await pool.query(
      `UPDATE products
       SET sku_code = ?, brand = ?, model_name = ?, ac_type = ?, horsepower = ?,
           inverter_type = ?, unit_price = ?, stock_qty = ?, warranty_months = ?,
           specs_summary = ?, is_active = ?
       WHERE product_id = ?`,
      [
        String(sku_code).trim(),
        String(brand).trim(),
        String(model_name).trim(),
        ac_type,
        String(horsepower).trim(),
        inverter_type,
        Number(unit_price),
        Number(stock_qty),
        Number(warranty_months),
        specs_summary,
        Boolean(is_active),
        id
      ]
    );

    await logAction(
      pool,
      req.user,
      'PRODUCT_UPDATED',
      'products',
      id,
      `Updated product ${brand} ${model_name} (Price: ${unit_price}, Stock: ${stock_qty})`
    );

    const [updated] = await pool.query('SELECT * FROM products WHERE product_id = ?', [id]);

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully.',
      product: updated[0]
    });
  } catch (error) {
    console.error('[customerEquipmentController.updateProduct Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update product.',
      error: error.message
    });
  }
};

/**
 * GET /api/equipment
 * Lists registered customer AC units. Enforces strict Customer tenant isolation.
 */
const getEquipmentList = async (req, res) => {
  try {
    const { customer_id, status, search } = req.query;
    const conditions = [];
    const params = [];

    // Tenant Isolation Rule: Customers can ONLY view their own registered units
    if (req.user.role === 'Customer') {
      conditions.push('e.customer_id = ?');
      params.push(req.user.customer_id || -1);
    } else if (customer_id) {
      conditions.push('e.customer_id = ?');
      params.push(customer_id);
    }

    if (status) {
      conditions.push('e.status = ?');
      params.push(status);
    }

    if (search) {
      conditions.push(
        '(e.qr_token LIKE ? OR e.serial_number LIKE ? OR e.brand LIKE ? OR e.model LIKE ? OR c.full_name LIKE ? OR c.company_name LIKE ?)'
      );
      const like = `%${search.trim()}%`;
      params.push(like, like, like, like, like, like);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT e.*,
              c.full_name AS customer_name,
              c.company_name AS customer_company,
              c.phone AS customer_phone,
              c.email AS customer_email,
              c.customer_type,
              (SELECT COUNT(*) FROM service_history sh WHERE sh.equipment_id = e.equipment_id) AS history_count
       FROM equipment e
       JOIN customers c ON e.customer_id = c.customer_id
       ${whereClause}
       ORDER BY e.created_at DESC`,
      params
    );

    // Attach service_history to each unit if requested or for convenience
    const equipmentIds = rows.map((r) => r.equipment_id);
    let historyMap = {};
    if (equipmentIds.length > 0) {
      const placeholders = equipmentIds.map(() => '?').join(', ');
      const [historyRows] = await pool.query(
        `SELECT * FROM service_history
         WHERE equipment_id IN (${placeholders})
         ORDER BY service_date DESC, history_id DESC`,
        equipmentIds
      );
      for (const h of historyRows) {
        if (!historyMap[h.equipment_id]) historyMap[h.equipment_id] = [];
        historyMap[h.equipment_id].push(h);
      }
    }

    const enriched = rows.map((unit) => ({
      ...unit,
      service_history: historyMap[unit.equipment_id] || []
    }));

    return res.status(200).json({
      success: true,
      count: enriched.length,
      equipment: enriched
    });
  } catch (error) {
    console.error('[customerEquipmentController.getEquipmentList Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve registered equipment.',
      error: error.message
    });
  }
};

/**
 * POST /api/equipment (Service Staff, Administrator)
 * Registers a customer AC unit and generates a unique QR sticker token
 */
const registerEquipment = async (req, res) => {
  try {
    const {
      customer_id,
      product_id = null,
      qr_token,
      brand,
      model,
      serial_number,
      ac_type,
      capacity_hp,
      installed_location,
      installation_date = null,
      warranty_expiry = null,
      maintenance_interval_months = 6,
      last_service_date = null,
      next_pm_date = null,
      status = 'Active'
    } = req.body;

    if (!customer_id || !brand || !model || !serial_number || !ac_type || !capacity_hp || !installed_location) {
      return res.status(400).json({
        success: false,
        message: 'Customer, brand, model, serial number, AC type, horsepower capacity, and installed location are required.'
      });
    }

    const [dupSerial] = await pool.query(
      'SELECT equipment_id FROM equipment WHERE serial_number = ? LIMIT 1',
      [serial_number.trim()]
    );
    if (dupSerial.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Equipment with serial number '${serial_number}' is already registered.`
      });
    }

    // Generate unique QR token
    let finalQrToken = qr_token ? qr_token.trim().toUpperCase() : generateQrToken();
    for (let attempt = 0; attempt < 5; attempt++) {
      const [existingToken] = await pool.query(
        'SELECT equipment_id FROM equipment WHERE qr_token = ? LIMIT 1',
        [finalQrToken]
      );
      if (existingToken.length === 0) break;
      finalQrToken = `NP-QR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const intervalMonths = Number(maintenance_interval_months) || 6;
    const baseDateForPm = last_service_date || installation_date || formatDateYMD(new Date());
    const computedNextPm = next_pm_date || calculateNextPmDate(baseDateForPm, intervalMonths);

    const [result] = await pool.query(
      `INSERT INTO equipment
       (customer_id, product_id, qr_token, brand, model, serial_number, ac_type, capacity_hp,
        installed_location, installation_date, warranty_expiry, maintenance_interval_months,
        last_service_date, next_pm_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(customer_id),
        product_id ? Number(product_id) : null,
        finalQrToken,
        brand.trim(),
        model.trim(),
        serial_number.trim(),
        ac_type.trim(),
        capacity_hp.trim(),
        installed_location.trim(),
        installation_date || null,
        warranty_expiry || null,
        intervalMonths,
        last_service_date || null,
        computedNextPm,
        status
      ]
    );

    await logAction(
      pool,
      req.user,
      'EQUIPMENT_REGISTERED',
      'equipment',
      finalQrToken,
      `Registered ${brand} ${model} (SN: ${serial_number}) with QR token ${finalQrToken}`
    );

    const [createdRows] = await pool.query(
      `SELECT e.*, c.full_name AS customer_name, c.company_name AS customer_company
       FROM equipment e
       JOIN customers c ON e.customer_id = c.customer_id
       WHERE e.equipment_id = ?`,
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: `Equipment registered successfully with QR Token ${finalQrToken}.`,
      equipment: createdRows[0]
    });
  } catch (error) {
    console.error('[customerEquipmentController.registerEquipment Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to register equipment.',
      error: error.message
    });
  }
};

/**
 * PUT /api/equipment/:id (Service Staff, Administrator)
 */
const updateEquipment = async (req, res) => {
  try {
    const { id } = req.params;
    const [existingRows] = await pool.query('SELECT * FROM equipment WHERE equipment_id = ? LIMIT 1', [id]);
    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Equipment unit not found.'
      });
    }

    const current = existingRows[0];
    const {
      brand = current.brand,
      model = current.model,
      serial_number = current.serial_number,
      ac_type = current.ac_type,
      capacity_hp = current.capacity_hp,
      installed_location = current.installed_location,
      installation_date = current.installation_date,
      warranty_expiry = current.warranty_expiry,
      maintenance_interval_months = current.maintenance_interval_months,
      last_service_date = current.last_service_date,
      next_pm_date = current.next_pm_date,
      status = current.status
    } = req.body;

    await pool.query(
      `UPDATE equipment
       SET brand = ?, model = ?, serial_number = ?, ac_type = ?, capacity_hp = ?,
           installed_location = ?, installation_date = ?, warranty_expiry = ?,
           maintenance_interval_months = ?, last_service_date = ?, next_pm_date = ?, status = ?
       WHERE equipment_id = ?`,
      [
        brand,
        model,
        serial_number,
        ac_type,
        capacity_hp,
        installed_location,
        installation_date,
        warranty_expiry,
        Number(maintenance_interval_months),
        last_service_date,
        next_pm_date,
        status,
        id
      ]
    );

    await logAction(pool, req.user, 'EQUIPMENT_UPDATED', 'equipment', current.qr_token, {
      equipment_id: id,
      status,
      installed_location
    });

    const [updated] = await pool.query('SELECT * FROM equipment WHERE equipment_id = ?', [id]);
    return res.status(200).json({
      success: true,
      message: 'Equipment unit updated successfully.',
      equipment: updated[0]
    });
  } catch (error) {
    console.error('[customerEquipmentController.updateEquipment Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update equipment.',
      error: error.message
    });
  }
};

/**
 * GET /api/equipment/qr/:token (Technician, Service Staff, Customer, Administrator)
 * Looks up equipment by qr_token, enforces Customer tenant isolation (TC-004 & TC-014),
 * and returns unit specs + chronological service_history + QR Data URL
 */
const getEquipmentByQrToken = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'QR token is required.'
      });
    }

    const cleanToken = token.trim();

    const [rows] = await pool.query(
      `SELECT e.*,
              c.full_name AS customer_name,
              c.company_name AS customer_company,
              c.customer_type,
              c.phone AS customer_phone,
              c.email AS customer_email,
              c.service_address AS customer_service_address
       FROM equipment e
       JOIN customers c ON e.customer_id = c.customer_id
       WHERE UPPER(e.qr_token) = UPPER(?) OR UPPER(e.serial_number) = UPPER(?)
       LIMIT 1`,
      [cleanToken, cleanToken]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No registered aircon unit found matching QR token '${cleanToken}'.`
      });
    }

    const unit = rows[0];

    // Multi-Tenant Security Isolation (TC-014): Customer A cannot view Customer B's QR code record
    if (req.user.role === 'Customer' && Number(unit.customer_id) !== Number(req.user.customer_id)) {
      await logAction(
        pool,
        req.user,
        'UNAUTHORIZED_QR_LOOKUP_BLOCKED',
        'equipment',
        unit.qr_token,
        `Customer ${req.user.customer_id} attempted to access QR ${unit.qr_token} belonging to Customer ${unit.customer_id}`
      );
      return res.status(403).json({
        success: false,
        message: "Forbidden: You are not authorized to access another customer's equipment QR record."
      });
    }

    const [historyRows] = await pool.query(
      `SELECT sh.*, wo.work_order_no, wo.evidence_photo_url
       FROM service_history sh
       LEFT JOIN work_orders wo ON sh.work_order_id = wo.work_order_id
       WHERE sh.equipment_id = ?
       ORDER BY sh.service_date DESC, sh.history_id DESC`,
      [unit.equipment_id]
    );

    const [activeRequests] = await pool.query(
      `SELECT request_id, reference_no, service_type, status, preferred_date, priority
       FROM service_requests
       WHERE equipment_id = ?
       ORDER BY created_at DESC
       LIMIT 5`,
      [unit.equipment_id]
    );

    let qrDataUrl = null;
    try {
      qrDataUrl = await QRCode.toDataURL(unit.qr_token, {
        width: 256,
        margin: 2
      });
    } catch (qrErr) {
      qrDataUrl = null;
    }

    return res.status(200).json({
      success: true,
      equipment: {
        ...unit,
        qr_data_url: qrDataUrl,
        service_history: historyRows,
        recent_requests: activeRequests
      }
    });
  } catch (error) {
    console.error('[customerEquipmentController.getEquipmentByQrToken Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to look up equipment QR code.',
      error: error.message
    });
  }
};

module.exports = {
  getCustomers,
  getProducts,
  createProduct,
  updateProduct,
  getEquipmentList,
  registerEquipment,
  updateEquipment,
  getEquipmentByQrToken
};
