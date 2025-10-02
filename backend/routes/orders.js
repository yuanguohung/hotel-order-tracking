const express = require("express");
const { Pool } = require("pg");
const {
  authenticateToken,
  requireStaffOrAdmin,
} = require("../middleware/auth");

const router = express.Router();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Generate order number
function generateOrderNumber() {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, "0");
  return `ORDER${timestamp}${random}`;
}

// Create new order (no authentication required for customers)
router.post("/", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const {
      roomId,
      customerName,
      customerPhone,
      items, // Array of {menuItemId, quantity, specialRequests}
      specialInstructions,
    } = req.body;

    if (!roomId || !items || items.length === 0) {
      return res.status(400).json({ error: "Room ID and items are required" });
    }

    // Verify room exists
    const roomResult = await client.query(
      "SELECT id FROM rooms WHERE id = $1",
      [roomId]
    );
    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    // Generate order number
    const orderNumber = generateOrderNumber();

    // Calculate total amount and estimated delivery time
    let totalAmount = 0;
    let maxPrepTime = 0;

    for (const item of items) {
      const menuItemResult = await client.query(
        "SELECT price, preparation_time FROM menu_items WHERE id = $1 AND is_available = true",
        [item.menuItemId]
      );

      if (menuItemResult.rows.length === 0) {
        throw new Error(
          `Menu item ${item.menuItemId} not found or unavailable`
        );
      }

      const menuItem = menuItemResult.rows[0];
      totalAmount += menuItem.price * item.quantity;
      maxPrepTime = Math.max(maxPrepTime, menuItem.preparation_time);
    }

    // Estimate delivery time (prep time + 10 minutes for delivery)
    const estimatedDeliveryTime = new Date(
      Date.now() + (maxPrepTime + 10) * 60000
    );

    // Create order
    const orderResult = await client.query(
      `
      INSERT INTO orders (
        room_id, order_number, customer_name, customer_phone, 
        total_amount, special_instructions, estimated_delivery_time
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, order_number, created_at
    `,
      [
        roomId,
        orderNumber,
        customerName,
        customerPhone,
        totalAmount,
        specialInstructions,
        estimatedDeliveryTime,
      ]
    );

    const order = orderResult.rows[0];

    // Create order items
    for (const item of items) {
      const menuItemResult = await client.query(
        "SELECT price FROM menu_items WHERE id = $1",
        [item.menuItemId]
      );

      const unitPrice = menuItemResult.rows[0].price;
      const subtotal = unitPrice * item.quantity;

      await client.query(
        `
        INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, subtotal, special_requests)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
        [
          order.id,
          item.menuItemId,
          item.quantity,
          unitPrice,
          subtotal,
          item.specialRequests,
        ]
      );
    }

    // Log status history
    await client.query(
      `
      INSERT INTO order_status_history (order_id, status, notes)
      VALUES ($1, 'pending', 'Order created')
    `,
      [order.id]
    );

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: {
        id: order.id,
        orderNumber: order.order_number,
        totalAmount,
        estimatedDeliveryTime,
        createdAt: order.created_at,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create order error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  } finally {
    client.release();
  }
});

// // Get order by ID
// router.get("/:id", async (req, res) => {
//   try {
//     const { id } = req.params;

//     const orderResult = await pool.query(
//       `
//       SELECT 
//         o.id, o.order_number, o.customer_name, o.customer_phone,
//         o.total_amount, o.status, o.special_instructions,
//         o.estimated_delivery_time, o.created_at, o.updated_at,
//         r.room_number, r.floor_number,
//         u.username as assigned_staff_name
//       FROM orders o
//       JOIN rooms r ON o.room_id = r.id
//       LEFT JOIN users u ON o.assigned_staff_id = u.id
//       WHERE o.id = $1
//     `,
//       [id]
//     );

//     if (orderResult.rows.length === 0) {
//       return res.status(404).json({ error: "Order not found" });
//     }

//     const order = orderResult.rows[0];

//     // Get order items
//     const itemsResult = await pool.query(
//       `
//       SELECT 
//         oi.id, oi.quantity, oi.unit_price, oi.subtotal, oi.special_requests,
//         mi.name as menu_item_name, mi.description as menu_item_description
//       FROM order_items oi
//       JOIN menu_items mi ON oi.menu_item_id = mi.id
//       WHERE oi.order_id = $1
//     `,
//       [id]
//     );

//     res.json({
//       success: true,
//       data: {
//         ...order,
//         items: itemsResult.rows,
//       },
//     });
//   } catch (error) {
//     console.error("Get order error:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// Get all orders (staff/admin only)
router.get("/", authenticateToken, requireStaffOrAdmin, async (req, res) => {
  try {
    const { status, roomId, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT 
        o.id, o.order_number, o.customer_name, o.customer_phone,
        o.total_amount, o.status, o.special_instructions,
        o.estimated_delivery_time, o.created_at, o.updated_at,
        r.room_number, r.floor_number,
        u.username as assigned_staff_name
      FROM orders o
      JOIN rooms r ON o.room_id = r.id
      LEFT JOIN users u ON o.assigned_staff_id = u.id
    `;

    const conditions = [];
    const params = [];

    if (status) {
      const statusArray = status.split(",").map((s) => s.trim());
      const placeholders = statusArray.map(
        (_, idx) => `$${params.length + idx + 1}`
      );
      conditions.push(`o.status IN (${placeholders.join(",")})`);
      params.push(...statusArray);
    }

    if (roomId) {
      conditions.push(`o.room_id = $${params.length + 1}`);
      params.push(roomId);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${
      params.length + 2
    }`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get orders error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update order status (staff/admin only)
router.patch(
  "/:id/status",
  authenticateToken,
  requireStaffOrAdmin,
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const { id } = req.params;
      const { status, notes } = req.body;
      const userId = req.user.id;

      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }

      // Get current order status
      const currentResult = await client.query(
        "SELECT status FROM orders WHERE id = $1",
        [id]
      );

      if (currentResult.rows.length === 0) {
        return res.status(404).json({ error: "Order not found" });
      }

      const oldStatus = currentResult.rows[0].status;

      // Update order status
      const updateResult = await client.query(
        `
      UPDATE orders 
      SET status = $1, assigned_staff_id = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING order_number, status, updated_at
    `,
        [status, userId, id]
      );

      // Log status history
      await client.query(
        `
      INSERT INTO order_status_history (order_id, status, changed_by, notes)
      VALUES ($1, $2, $3, $4)
    `,
        [id, status, userId, notes]
      );

      await client.query("COMMIT");

      res.json({
        success: true,
        message: "Order status updated successfully",
        data: updateResult.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Update order status error:", error);
      res.status(500).json({ error: "Internal server error" });
    } finally {
      client.release();
    }
  }
);

// Get order status history
router.get(
  "/:id/history",
  authenticateToken,
  requireStaffOrAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `
      SELECT 
        osh.status, osh.notes, osh.created_at,
        u.username as changed_by_name
      FROM order_status_history osh
      LEFT JOIN users u ON osh.changed_by = u.id
      WHERE osh.order_id = $1
      ORDER BY osh.created_at DESC
    `,
        [id]
      );

      res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      console.error("Get order history error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ========== STAFF MANAGEMENT ROUTES ==========

// Get orders for staff management (with filtering)
router.get("/manage", authenticateToken, requireStaffOrAdmin, async (req, res) => {
  try {
    const { 
      status, 
      date_from, 
      date_to, 
      room_number, 
      page = 1, 
      limit = 20 
    } = req.query;

    let whereConditions = [];
    let queryParams = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      whereConditions.push(`o.status = $${paramCount}`);
      queryParams.push(status);
    }

    if (date_from) {
      paramCount++;
      whereConditions.push(`o.created_at >= $${paramCount}`);
      queryParams.push(date_from);
    }

    if (date_to) {
      paramCount++;
      whereConditions.push(`o.created_at <= $${paramCount}`);
      queryParams.push(date_to);
    }

    if (room_number) {
      paramCount++;
      whereConditions.push(`r.room_number = $${paramCount}`);
      queryParams.push(room_number);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM orders o
      JOIN rooms r ON o.room_id = r.id
      ${whereClause}
    `;

    const countResult = await pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Calculate pagination
    const offset = (page - 1) * limit;
    paramCount++;
    queryParams.push(limit);
    paramCount++;
    queryParams.push(offset);

    // Get orders with pagination
    const ordersQuery = `
      SELECT 
        o.*,
        r.room_number,
        r.floor_number,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'menu_item_name', mi.name,
              'quantity', oi.quantity,
              'price', oi.unit_price,
              'special_requests', oi.special_requests
            )
          ) FILTER (WHERE oi.id IS NOT NULL), 
          '[]'
        ) as items
      FROM orders o
      JOIN rooms r ON o.room_id = r.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      ${whereClause}
      GROUP BY o.id, r.room_number, r.floor_number
      ORDER BY o.created_at DESC
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `;

    const ordersResult = await pool.query(ordersQuery, queryParams);

    res.json({
      success: true,
      data: {
        orders: ordersResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          total_pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get manage orders error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get order status history
router.get("/:id/history", authenticateToken, requireStaffOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT 
        osh.*,
        u.username as changed_by_username
      FROM order_status_history osh
      LEFT JOIN users u ON osh.changed_by = u.id
      WHERE osh.order_id = $1
      ORDER BY osh.created_at DESC
      `,
      [id]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get order history error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Bulk update order status
router.patch("/bulk-status", authenticateToken, requireStaffOrAdmin, async (req, res) => {
  try {
    const { order_ids, status, notes } = req.body;

    if (!order_ids || !Array.isArray(order_ids) || !status) {
      return res.status(400).json({ 
        error: "Order IDs array and status are required" 
      });
    }

    const validStatuses = ['pending', 'preparing', 'ready', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Update all orders
      const result = await client.query(
        `
        UPDATE orders 
        SET status = $1, updated_at = NOW()
        WHERE id = ANY($2::int[])
        RETURNING *
        `,
        [status, order_ids]
      );

      // Add status change to order history for each order
      for (const order_id of order_ids) {
        await client.query(
          `
          INSERT INTO order_status_history (order_id, status, changed_by, notes)
          VALUES ($1, $2, $3, $4)
          `,
          [order_id, status, req.user.id, notes || null]
        );
      }

      await client.query("COMMIT");

      res.json({
        success: true,
        data: result.rows,
        message: `Updated ${result.rows.length} orders to ${status}`,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Bulk update order status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
