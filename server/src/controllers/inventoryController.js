const pool = require('../config/db');
const { logAction } = require('../utils/auditLogger');
const { notifyRoles } = require('../utils/notifyHelper');

/**
 * Enriches an inventory_items row with calculated available_stock and is_low_stock
 */
function enrichInventoryItem(item) {
  const totalStock = Number(item.total_stock_qty || 0);
  const reserved = Number(item.reserved_qty || 0);
  const reorderLevel = Number(item.reorder_level || 0);
  const availableStock = Math.max(0, totalStock - reserved);
  const isLowStock = availableStock <= reorderLevel || totalStock <= reorderLevel;

  return {
    ...item,
    total_stock_qty: totalStock,
    reserved_qty: reserved,
    reorder_level: reorderLevel,
    available_stock: availableStock,
    is_low_stock: isLowStock
  };
}

/**
 * GET /api/inventory
 * Returns all spare parts including calculated available_stock = total_stock_qty - reserved_qty
 * and is_low_stock flag
 */
const getInventoryItems = async (req, res) => {
  try {
    const { category, low_stock_only, search } = req.query;
    const conditions = [];
    const params = [];

    if (category) {
      conditions.push('i.category = ?');
      params.push(category);
    }

    if (low_stock_only === 'true') {
      conditions.push('((i.total_stock_qty - i.reserved_qty) <= i.reorder_level OR i.total_stock_qty <= i.reorder_level)');
    }

    if (search) {
      conditions.push('(i.sku_code LIKE ? OR i.part_name LIKE ? OR i.category LIKE ?)');
      const like = `%${search.trim()}%`;
      params.push(like, like, like);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT i.* FROM inventory_items i ${whereClause} ORDER BY i.category ASC, i.part_name ASC`,
      params
    );

    const enriched = rows.map(enrichInventoryItem);

    return res.status(200).json({
      success: true,
      count: enriched.length,
      low_stock_count: enriched.filter((i) => i.is_low_stock).length,
      items: enriched
    });
  } catch (error) {
    console.error('[inventoryController.getInventoryItems Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve spare parts inventory.',
      error: error.message
    });
  }
};

/**
 * POST /api/inventory (Inventory Staff, Administrator)
 * Creates a new spare part or consumable item in inventory_items
 */
const createInventoryItem = async (req, res) => {
  try {
    const {
      sku_code,
      part_name,
      category,
      unit_of_measure = 'pcs',
      unit_price,
      total_stock_qty = 0,
      reserved_qty = 0,
      reorder_level = 5
    } = req.body;

    if (!sku_code || !part_name || !category || unit_price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'SKU code, part name, category, and unit price are required.'
      });
    }

    const [dup] = await pool.query('SELECT item_id FROM inventory_items WHERE sku_code = ? LIMIT 1', [
      sku_code.trim()
    ]);
    if (dup.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Spare part with SKU '${sku_code}' already exists.`
      });
    }

    const [result] = await pool.query(
      `INSERT INTO inventory_items
       (sku_code, part_name, category, unit_of_measure, unit_price, total_stock_qty, reserved_qty, reorder_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sku_code.trim().toUpperCase(),
        part_name.trim(),
        category.trim(),
        unit_of_measure.trim(),
        Number(unit_price),
        Number(total_stock_qty),
        Number(reserved_qty),
        Number(reorder_level)
      ]
    );

    await logAction(
      pool,
      req.user,
      'INVENTORY_ITEM_CREATED',
      'inventory_items',
      result.insertId,
      `Created spare part ${part_name} (${sku_code}) with initial stock ${total_stock_qty}`
    );

    const [created] = await pool.query('SELECT * FROM inventory_items WHERE item_id = ?', [result.insertId]);

    return res.status(201).json({
      success: true,
      message: 'Spare part added to warehouse catalog.',
      item: enrichInventoryItem(created[0])
    });
  } catch (error) {
    console.error('[inventoryController.createInventoryItem Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create inventory item.',
      error: error.message
    });
  }
};

/**
 * PUT /api/inventory/:id (Inventory Staff, Administrator)
 * Updates spare part metadata (part_name, category, unit_price, reorder_level)
 */
const updateInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const [existingRows] = await pool.query('SELECT * FROM inventory_items WHERE item_id = ? LIMIT 1', [id]);
    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Spare part not found.'
      });
    }

    const current = existingRows[0];
    const {
      sku_code = current.sku_code,
      part_name = current.part_name,
      category = current.category,
      unit_of_measure = current.unit_of_measure,
      unit_price = current.unit_price,
      reorder_level = current.reorder_level
    } = req.body;

    await pool.query(
      `UPDATE inventory_items
       SET sku_code = ?, part_name = ?, category = ?, unit_of_measure = ?, unit_price = ?, reorder_level = ?
       WHERE item_id = ?`,
      [
        String(sku_code).trim(),
        String(part_name).trim(),
        String(category).trim(),
        String(unit_of_measure).trim(),
        Number(unit_price),
        Number(reorder_level),
        id
      ]
    );

    await logAction(pool, req.user, 'INVENTORY_ITEM_UPDATED', 'inventory_items', id, {
      sku_code,
      part_name,
      unit_price,
      reorder_level
    });

    const [updated] = await pool.query('SELECT * FROM inventory_items WHERE item_id = ?', [id]);
    return res.status(200).json({
      success: true,
      message: 'Spare part updated successfully.',
      item: enrichInventoryItem(updated[0])
    });
  } catch (error) {
    console.error('[inventoryController.updateInventoryItem Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update spare part.',
      error: error.message
    });
  }
};

/**
 * GET /api/inventory/transactions
 * Lists stock movement ledger entries with optional item_id, work_order_id, and tx_type filters
 */
const getInventoryTransactions = async (req, res) => {
  try {
    const { item_id, work_order_id, tx_type } = req.query;
    const conditions = [];
    const params = [];

    if (item_id) {
      conditions.push('it.item_id = ?');
      params.push(item_id);
    }

    if (work_order_id) {
      conditions.push('it.work_order_id = ?');
      params.push(work_order_id);
    }

    if (tx_type) {
      conditions.push('it.tx_type = ?');
      params.push(tx_type);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT it.*,
              ii.sku_code,
              ii.part_name,
              ii.category,
              ii.unit_of_measure,
              wo.work_order_no,
              u.full_name AS performed_by_name,
              u.role AS performed_by_role
       FROM inventory_transactions it
       JOIN inventory_items ii ON it.item_id = ii.item_id
       LEFT JOIN work_orders wo ON it.work_order_id = wo.work_order_id
       LEFT JOIN users u ON it.performed_by = u.user_id
       ${whereClause}
       ORDER BY it.created_at DESC, it.transaction_id DESC
       LIMIT 200`,
      params
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      transactions: rows
    });
  } catch (error) {
    console.error('[inventoryController.getInventoryTransactions Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve inventory transactions.',
      error: error.message
    });
  }
};

/**
 * POST /api/inventory/transactions (Inventory Staff, Technician, Administrator)
 * Executes work-order-linked stock movements inside an ACID DB transaction (FR-009, TC-012):
 * - Reservation: Checks Available_Stock >= qty; increments reserved_qty.
 * - Issue: Decrements total_stock_qty and (if reserved) reserved_qty.
 * - Return: Decrements reserved_qty (if unissued) or increments total_stock_qty (if already issued).
 * - Adjustment: Directly modifies total_stock_qty with mandatory remarks and logs to audit_logs.
 */
const createInventoryTransaction = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const {
      item_id,
      work_order_id = null,
      tx_type,
      quantity,
      remarks = null,
      return_mode = null // optional: 'unissued' | 'issued'
    } = req.body;

    const validTxTypes = ['Reservation', 'Issue', 'Return', 'Adjustment'];
    if (!item_id || !tx_type || !validTxTypes.includes(tx_type) || quantity === undefined) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: `item_id, valid tx_type (${validTxTypes.join(', ')}), and quantity are required.`
      });
    }

    const rawQty = parseInt(quantity, 10);
    if (!Number.isFinite(rawQty) || rawQty === 0) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a non-zero integer.'
      });
    }

    if (tx_type !== 'Adjustment' && rawQty <= 0) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: `Quantity must be a positive integer for '${tx_type}' transactions.`
      });
    }

    if (tx_type === 'Adjustment' && (!remarks || String(remarks).trim().length === 0)) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Mandatory remarks are required when performing a stock Adjustment.'
      });
    }

    await connection.beginTransaction();

    // Lock the inventory item row for update
    const [itemRows] = await connection.query(
      'SELECT * FROM inventory_items WHERE item_id = ? FOR UPDATE',
      [item_id]
    );

    if (itemRows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found.'
      });
    }

    const item = itemRows[0];
    let totalStock = Number(item.total_stock_qty);
    let reservedQty = Number(item.reserved_qty);
    const availableStock = totalStock - reservedQty;

    let newTotalStock = totalStock;
    let newReservedQty = reservedQty;

    if (tx_type === 'Reservation') {
      if (availableStock < rawQty) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: `Insufficient available stock for ${item.part_name}. Available: ${availableStock} ${item.unit_of_measure}, Requested: ${rawQty}.`
        });
      }
      newReservedQty = reservedQty + rawQty;
    } else if (tx_type === 'Issue') {
      // Determine how much of this Issue was previously reserved
      let reservedToRelease = 0;

      if (work_order_id) {
        const [woTx] = await connection.query(
          `SELECT
             SUM(CASE WHEN tx_type = 'Reservation' THEN quantity ELSE 0 END) AS res_qty,
             SUM(CASE WHEN tx_type = 'Issue' THEN quantity ELSE 0 END) AS iss_qty,
             SUM(CASE WHEN tx_type = 'Return' THEN quantity ELSE 0 END) AS ret_qty
           FROM inventory_transactions
           WHERE item_id = ? AND work_order_id = ?`,
          [item_id, work_order_id]
        );
        const netWoReserved = Math.max(
          0,
          Number(woTx[0]?.res_qty || 0) - Number(woTx[0]?.iss_qty || 0) - Number(woTx[0]?.ret_qty || 0)
        );
        reservedToRelease = Math.min(rawQty, netWoReserved > 0 ? netWoReserved : reservedQty, reservedQty);
      } else if (reservedQty > 0) {
        // Fallback when Issue is called without explicit work_order_id after a Reservation
        reservedToRelease = Math.min(rawQty, reservedQty);
      }

      const additionalUnreservedNeeded = rawQty - reservedToRelease;
      if (availableStock < additionalUnreservedNeeded) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock to issue ${rawQty} ${item.unit_of_measure} of ${item.part_name}. Available unreserved: ${availableStock}, Reserved for release: ${reservedToRelease}.`
        });
      }

      newTotalStock = totalStock - rawQty;
      newReservedQty = Math.max(0, reservedQty - reservedToRelease);
    } else if (tx_type === 'Return') {
      // Check if returning unissued reservation vs returning already-issued stock
      let isUnissuedReservationReturn = return_mode === 'unissued';

      if (!return_mode && work_order_id) {
        const [woTx] = await connection.query(
          `SELECT
             SUM(CASE WHEN tx_type = 'Reservation' THEN quantity ELSE 0 END) AS res_qty,
             SUM(CASE WHEN tx_type = 'Issue' THEN quantity ELSE 0 END) AS iss_qty
           FROM inventory_transactions
           WHERE item_id = ? AND work_order_id = ?`,
          [item_id, work_order_id]
        );
        const resCount = Number(woTx[0]?.res_qty || 0);
        const issCount = Number(woTx[0]?.iss_qty || 0);
        if (resCount > issCount && reservedQty >= rawQty) {
          isUnissuedReservationReturn = true;
        }
      }

      if (isUnissuedReservationReturn) {
        newReservedQty = Math.max(0, reservedQty - rawQty);
      } else {
        newTotalStock = totalStock + rawQty;
      }
    } else if (tx_type === 'Adjustment') {
      // rawQty can be positive (restock/gain) or negative (shrinkage/write-off)
      const candidateTotal = totalStock + rawQty;
      if (candidateTotal < reservedQty) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: `Adjustment cannot reduce total stock (${candidateTotal}) below currently reserved quantity (${reservedQty}).`
        });
      }
      newTotalStock = candidateTotal;
    }

    await connection.query(
      `UPDATE inventory_items
       SET total_stock_qty = ?, reserved_qty = ?
       WHERE item_id = ?`,
      [newTotalStock, newReservedQty, item_id]
    );

    const [txResult] = await connection.query(
      `INSERT INTO inventory_transactions
       (item_id, work_order_id, tx_type, quantity, performed_by, remarks)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        Number(item_id),
        work_order_id ? Number(work_order_id) : null,
        tx_type,
        Math.abs(rawQty),
        req.user.user_id,
        remarks ? remarks.trim() : `${tx_type} of ${Math.abs(rawQty)} ${item.unit_of_measure}`
      ]
    );

    await logAction(
      connection,
      req.user,
      `INVENTORY_${tx_type.toUpperCase()}`,
      'inventory_transactions',
      txResult.insertId,
      {
        item_id: item.item_id,
        sku_code: item.sku_code,
        part_name: item.part_name,
        tx_type,
        quantity: rawQty,
        work_order_id,
        previous_total: totalStock,
        new_total: newTotalStock,
        previous_reserved: reservedQty,
        new_reserved: newReservedQty,
        new_available: newTotalStock - newReservedQty,
        remarks
      }
    );

    const newAvailable = newTotalStock - newReservedQty;
    if (newAvailable <= Number(item.reorder_level)) {
      await notifyRoles(
        connection,
        ['Inventory Staff', 'Administrator'],
        `Low Stock Alert: ${item.part_name} (${item.sku_code})`,
        `Available stock for ${item.part_name} is now ${newAvailable} ${item.unit_of_measure} (Reorder Level: ${item.reorder_level}).`
      );
    }

    await connection.commit();
    connection.release();

    const [updatedItemRows] = await pool.query('SELECT * FROM inventory_items WHERE item_id = ?', [item_id]);
    const [createdTxRows] = await pool.query(
      'SELECT * FROM inventory_transactions WHERE transaction_id = ?',
      [txResult.insertId]
    );

    return res.status(201).json({
      success: true,
      message: `Inventory ${tx_type} recorded successfully. Available stock is now ${newAvailable} ${item.unit_of_measure}.`,
      transaction: createdTxRows[0],
      item: enrichInventoryItem(updatedItemRows[0])
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('[inventoryController.createInventoryTransaction Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process inventory transaction.',
      error: error.message
    });
  }
};

module.exports = {
  getInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  getInventoryTransactions,
  createInventoryTransaction
};
