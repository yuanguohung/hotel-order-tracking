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

// Get all menu categories with items
router.get("/", async (req, res) => {
  try {
    const categoriesResult = await pool.query(`
      SELECT id, name, description, display_order
      FROM menu_categories 
      WHERE is_active = true
      ORDER BY display_order, name
    `);

    const categories = [];

    for (const category of categoriesResult.rows) {
      const itemsResult = await pool.query(
        `
        SELECT id, name, description, price, image_url, is_available, preparation_time
        FROM menu_items 
        WHERE category_id = $1 AND is_available = true
        ORDER BY name
      `,
        [category.id]
      );

      categories.push({
        ...category,
        items: itemsResult.rows,
      });
    }

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Get menu error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get menu item by ID
router.get("/items/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT 
        mi.id, mi.name, mi.description, mi.price, mi.image_url, 
        mi.is_available, mi.preparation_time,
        mc.name as category_name
      FROM menu_items mi
      JOIN menu_categories mc ON mi.category_id = mc.id
      WHERE mi.id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Get menu item error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get menu categories only
router.get("/categories", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, description, display_order
      FROM menu_categories 
      WHERE is_active = true
      ORDER BY display_order, name
    `);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get items by category
router.get("/categories/:categoryId/items", async (req, res) => {
  try {
    const { categoryId } = req.params;

    const result = await pool.query(
      `
      SELECT id, name, description, price, image_url, is_available, preparation_time
      FROM menu_items 
      WHERE category_id = $1 AND is_available = true
      ORDER BY name
    `,
      [categoryId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get category items error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ========== ADMIN ROUTES (CRUD Operations) ==========

// Create new menu category
router.post("/categories", authenticateToken, requireStaffOrAdmin, async (req, res) => {
  try {
    const { name, description, display_order } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Category name is required" });
    }

    const result = await pool.query(
      `
      INSERT INTO menu_categories (name, description, display_order, is_active)
      VALUES ($1, $2, $3, true)
      RETURNING *
      `,
      [name, description || null, display_order || 0]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Create category error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update menu category
router.put("/categories/:id", authenticateToken, requireStaffOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, display_order, is_active } = req.body;

    const result = await pool.query(
      `
      UPDATE menu_categories 
      SET name = $1, description = $2, display_order = $3, is_active = $4, updated_at = NOW()
      WHERE id = $5
      RETURNING *
      `,
      [name, description, display_order, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update category error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete menu category
router.delete("/categories/:id", authenticateToken, requireStaffOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if category has menu items
    const itemsCheck = await pool.query(
      "SELECT COUNT(*) as count FROM menu_items WHERE category_id = $1",
      [id]
    );

    if (parseInt(itemsCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: "Cannot delete category with existing menu items" 
      });
    }

    const result = await pool.query(
      "DELETE FROM menu_categories WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Delete category error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create new menu item
router.post("/items", authenticateToken, requireStaffOrAdmin, async (req, res) => {
  try {
    const { 
      name, 
      description, 
      price, 
      category_id, 
      image_url, 
      preparation_time 
    } = req.body;

    if (!name || !price || !category_id) {
      return res.status(400).json({ 
        error: "Name, price, and category are required" 
      });
    }

    // Verify category exists
    const categoryCheck = await pool.query(
      "SELECT id FROM menu_categories WHERE id = $1",
      [category_id]
    );

    if (categoryCheck.rows.length === 0) {
      return res.status(400).json({ error: "Invalid category ID" });
    }

    const result = await pool.query(
      `
      INSERT INTO menu_items (name, description, price, category_id, image_url, preparation_time, is_available)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING *
      `,
      [name, description || null, price, category_id, image_url || null, preparation_time || 15]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Create menu item error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update menu item
router.put("/items/:id", authenticateToken, requireStaffOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      description, 
      price, 
      category_id, 
      image_url, 
      preparation_time, 
      is_available 
    } = req.body;

    const result = await pool.query(
      `
      UPDATE menu_items 
      SET name = $1, description = $2, price = $3, category_id = $4, 
          image_url = $5, preparation_time = $6, is_available = $7, updated_at = NOW()
      WHERE id = $8
      RETURNING *
      `,
      [name, description, price, category_id, image_url, preparation_time, is_available, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update menu item error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete menu item
router.delete("/items/:id", authenticateToken, requireStaffOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM menu_items WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    res.json({
      success: true,
      message: "Menu item deleted successfully",
    });
  } catch (error) {
    console.error("Delete menu item error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
