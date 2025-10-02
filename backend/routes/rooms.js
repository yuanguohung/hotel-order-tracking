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

// Get all rooms
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, room_number, floor_number, status, qr_code, created_at, updated_at
      FROM rooms 
      ORDER BY room_number
    `);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get rooms error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get room by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT id, room_number, floor_number, status, qr_code, created_at, updated_at
      FROM rooms 
      WHERE id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Get room error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get room by room number (for QR code access)
router.get("/number/:roomNumber", async (req, res) => {
  try {
    const { roomNumber } = req.params;

    const result = await pool.query(
      `
      SELECT id, room_number, floor_number, status, qr_code, created_at, updated_at
      FROM rooms 
      WHERE room_number = $1
    `,
      [roomNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Get room by number error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get room with current orders
router.get("/:id/orders", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT 
        o.id,
        o.order_number,
        o.customer_name,
        o.customer_phone,
        o.total_amount,
        o.status,
        o.special_instructions,
        o.estimated_delivery_time,
        o.created_at,
        o.updated_at,
        u.username as assigned_staff_name
      FROM orders o
      LEFT JOIN users u ON o.assigned_staff_id = u.id
      WHERE o.room_id = $1
      AND o.status NOT IN ('delivered', 'cancelled')
      ORDER BY o.created_at DESC
    `,
      [id]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get room orders error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ========== ADMIN ROUTES (CRUD Operations) ==========

// Create new room
router.post("/", authenticateToken, requireStaffOrAdmin, async (req, res) => {
  try {
    const { room_number, floor_number, status } = req.body;

    if (!room_number || !floor_number) {
      return res.status(400).json({ 
        error: "Room number and floor number are required" 
      });
    }

    // Check if room number already exists
    const existingRoom = await pool.query(
      "SELECT id FROM rooms WHERE room_number = $1",
      [room_number]
    );

    if (existingRoom.rows.length > 0) {
      return res.status(400).json({ 
        error: "Room number already exists" 
      });
    }

    // Generate QR code (simple format for now)
    const qr_code = `ROOM_${room_number}_${Date.now()}`;

    const result = await pool.query(
      `
      INSERT INTO rooms (room_number, floor_number, status, qr_code)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [room_number, floor_number, status || 'available', qr_code]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Create room error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update room
router.put("/:id", authenticateToken, requireStaffOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { room_number, floor_number, status } = req.body;

    // Check if new room number already exists (if changing)
    if (room_number) {
      const existingRoom = await pool.query(
        "SELECT id FROM rooms WHERE room_number = $1 AND id != $2",
        [room_number, id]
      );

      if (existingRoom.rows.length > 0) {
        return res.status(400).json({ 
          error: "Room number already exists" 
        });
      }
    }

    const result = await pool.query(
      `
      UPDATE rooms 
      SET room_number = $1, floor_number = $2, status = $3, updated_at = NOW()
      WHERE id = $4
      RETURNING *
      `,
      [room_number, floor_number, status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update room error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete room
router.delete("/:id", authenticateToken, requireStaffOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if room has any orders
    const ordersCheck = await pool.query(
      "SELECT COUNT(*) as count FROM orders WHERE room_id = $1",
      [id]
    );

    if (parseInt(ordersCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: "Cannot delete room with existing orders" 
      });
    }

    const result = await pool.query(
      "DELETE FROM rooms WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.json({
      success: true,
      message: "Room deleted successfully",
    });
  } catch (error) {
    console.error("Delete room error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Bulk update room status
router.patch("/bulk-status", authenticateToken, requireStaffOrAdmin, async (req, res) => {
  try {
    const { room_ids, status } = req.body;

    if (!room_ids || !Array.isArray(room_ids) || !status) {
      return res.status(400).json({ 
        error: "Room IDs array and status are required" 
      });
    }

    const result = await pool.query(
      `
      UPDATE rooms 
      SET status = $1, updated_at = NOW()
      WHERE id = ANY($2::int[])
      RETURNING *
      `,
      [status, room_ids]
    );

    res.json({
      success: true,
      data: result.rows,
      message: `Updated ${result.rows.length} rooms`,
    });
  } catch (error) {
    console.error("Bulk update room status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
