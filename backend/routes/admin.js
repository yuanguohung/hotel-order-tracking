const express = require("express");
const { Pool } = require("pg");
const {
  authenticateToken,
  requireAdmin,
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

// All admin routes require authentication
router.use(authenticateToken);

// Dashboard stats (staff and admin)
router.get("/dashboard", requireStaffOrAdmin, async (req, res) => {
  try {
    // Get today's stats
    const today = new Date().toISOString().split("T")[0];

    // Total orders today
    const todayOrdersResult = await pool.query(
      `
      SELECT COUNT(*) as total_orders, SUM(total_amount) as total_revenue
      FROM orders 
      WHERE DATE(created_at) = $1
    `,
      [today]
    );

    // Orders by status today
    const statusStatsResult = await pool.query(
      `
      SELECT status, COUNT(*) as count
      FROM orders 
      WHERE DATE(created_at) = $1
      GROUP BY status
    `,
      [today]
    );

    // Pending orders
    const pendingOrdersResult = await pool.query(`
      SELECT COUNT(*) as pending_count
      FROM orders 
      WHERE status = 'pending'
    `);

    // Active orders (not delivered or cancelled)
    const activeOrdersResult = await pool.query(`
      SELECT 
        o.id, o.order_number, o.customer_name, o.total_amount, 
        o.status, o.estimated_delivery_time, o.created_at,
        r.room_number
      FROM orders o
      JOIN rooms r ON o.room_id = r.id
      WHERE o.status NOT IN ('delivered', 'cancelled')
      ORDER BY o.created_at DESC
      LIMIT 20
    `);

    // Most popular items today
    const popularItemsResult = await pool.query(
      `
      SELECT 
        mi.name, 
        SUM(oi.quantity) as total_quantity,
        COUNT(DISTINCT oi.order_id) as order_count
      FROM order_items oi
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      JOIN orders o ON oi.order_id = o.id
      WHERE DATE(o.created_at) = $1
      GROUP BY mi.id, mi.name
      ORDER BY total_quantity DESC
      LIMIT 10
    `,
      [today]
    );

    const todayStats = todayOrdersResult.rows[0];
    const statusStats = statusStatsResult.rows;
    const pendingCount = pendingOrdersResult.rows[0].pending_count;
    const activeOrders = activeOrdersResult.rows;
    const popularItems = popularItemsResult.rows;

    res.json({
      success: true,
      data: {
        today: {
          totalOrders: parseInt(todayStats.total_orders) || 0,
          totalRevenue: parseFloat(todayStats.total_revenue) || 0,
          pendingOrders: parseInt(pendingCount) || 0,
        },
        statusBreakdown: statusStats,
        activeOrders,
        popularItems,
      },
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Manage menu items (admin only)
router.get("/menu/items", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        mi.id, mi.name, mi.description, mi.price, mi.image_url,
        mi.is_available, mi.preparation_time, mi.created_at, mi.updated_at,
        mc.name as category_name
      FROM menu_items mi
      JOIN menu_categories mc ON mi.category_id = mc.id
      ORDER BY mc.display_order, mi.name
    `);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get menu items error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add new menu item (admin only)
router.post("/menu/items", requireAdmin, async (req, res) => {
  try {
    const {
      categoryId,
      name,
      description,
      price,
      imageUrl,
      preparationTime = 15,
    } = req.body;

    if (!categoryId || !name || !price) {
      return res
        .status(400)
        .json({ error: "Category ID, name, and price are required" });
    }

    const result = await pool.query(
      `
      INSERT INTO menu_items (category_id, name, description, price, image_url, preparation_time)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, description, price, image_url, preparation_time, created_at
    `,
      [categoryId, name, description, price, imageUrl, preparationTime]
    );

    res.status(201).json({
      success: true,
      message: "Menu item created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Create menu item error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update menu item (admin only)
router.put("/menu/items/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      categoryId,
      name,
      description,
      price,
      imageUrl,
      isAvailable,
      preparationTime,
    } = req.body;

    const result = await pool.query(
      `
      UPDATE menu_items 
      SET 
        category_id = COALESCE($1, category_id),
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        price = COALESCE($4, price),
        image_url = COALESCE($5, image_url),
        is_available = COALESCE($6, is_available),
        preparation_time = COALESCE($7, preparation_time),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING id, name, description, price, image_url, is_available, preparation_time, updated_at
    `,
      [
        categoryId,
        name,
        description,
        price,
        imageUrl,
        isAvailable,
        preparationTime,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    res.json({
      success: true,
      message: "Menu item updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update menu item error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete menu item (admin only)
router.delete("/menu/items/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM menu_items WHERE id = $1 RETURNING name",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    res.json({
      success: true,
      message: `Menu item "${result.rows[0].name}" deleted successfully`,
    });
  } catch (error) {
    console.error("Delete menu item error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Manage users (admin only)
router.get("/users", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, username, email, role, is_active, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
    `);

    console.log(`Get users result:`, result.rows);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update user role (admin only)
router.patch("/users/:id/role", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !["admin", "staff"].includes(role)) {
      return res
        .status(400)
        .json({ error: "Valid role (admin/staff) is required" });
    }

    const result = await pool.query(
      `
      UPDATE users 
      SET role = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, username, role, updated_at
    `,
      [role, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      success: true,
      message: "User role updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update user role error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Reports (admin only)
router.get("/reports/daily", requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let dateCondition = "";
    const params = [];

    if (startDate && endDate) {
      dateCondition = "WHERE DATE(created_at) BETWEEN $1 AND $2";
      params.push(startDate, endDate);
    } else if (startDate) {
      dateCondition = "WHERE DATE(created_at) >= $1";
      params.push(startDate);
    } else {
      // Default to last 30 days
      dateCondition = "WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'";
    }

    const result = await pool.query(
      `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_orders,
        SUM(total_amount) as total_revenue,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders
      FROM orders
      ${dateCondition}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `,
      params
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Daily reports error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ========== USER MANAGEMENT ROUTES ==========

// Get all users (admin only)
router.get("/users", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, username, email, role, is_active, created_at
      FROM users 
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create new user (admin only)
router.post("/users", requireAdmin, async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password || !role) {
      return res.status(400).json({ 
        error: "Username, email, password, and role are required" 
      });
    }

    // Check if username already exists
    const usernameCheck = await pool.query(
      "SELECT id FROM users WHERE username = $1",
      [username]
    );

    if (usernameCheck.rows.length > 0) {
      return res.status(400).json({ error: "Username already exists" });
    }

    // Check if email already exists
    const emailCheck = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const bcrypt = require("bcrypt");
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
      INSERT INTO users (username, email, password_hash, role, is_active)
      VALUES ($1, $2, $3, $4, true)
      RETURNING id, username, email, role, is_active, created_at
      `,
      [username, email, hashedPassword, role]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update user (admin only)
router.put("/users/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, role, is_active } = req.body;

    // Check if new username already exists (if changing)
    if (username) {
      const usernameCheck = await pool.query(
        "SELECT id FROM users WHERE username = $1 AND id != $2",
        [username, id]
      );

      if (usernameCheck.rows.length > 0) {
        return res.status(400).json({ error: "Username already exists" });
      }
    }

    // Check if new email already exists (if changing)
    if (email) {
      const emailCheck = await pool.query(
        "SELECT id FROM users WHERE email = $1 AND id != $2",
        [email, id]
      );

      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ error: "Email already exists" });
      }
    }

    const result = await pool.query(
      `
      UPDATE users 
      SET username = $1, email = $2, role = $3, is_active = $4, updated_at = NOW()
      WHERE id = $5
      RETURNING id, username, email, role, is_active, created_at, updated_at
      `,
      [username, email, role, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Reset user password (admin only)
router.patch("/users/:id/reset-password", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;

    if (!new_password) {
      return res.status(400).json({ error: "New password is required" });
    }

    const bcrypt = require("bcrypt");
    const hashedPassword = await bcrypt.hash(new_password, 10);

    const result = await pool.query(
      `
      UPDATE users 
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, username, email
      `,
      [hashedPassword, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      success: true,
      message: "Password reset successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Toggle user active status (admin only)
router.patch("/users/:id/toggle-status", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      UPDATE users 
      SET is_active = NOT is_active, updated_at = NOW()
      WHERE id = $1
      RETURNING id, username, email, role, is_active
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: `User ${result.rows[0].is_active ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    console.error("Toggle user status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
