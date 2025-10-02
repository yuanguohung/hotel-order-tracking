require("dotenv").config();
const pool = require("../config/database");
const fs = require("fs");
const path = require("path");

async function initializeDatabase() {
  try {
    console.log("Initializing database...");

    // Read and execute schema.sql
    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");

    await pool.query(schema);

    console.log("Database initialized successfully!");
    console.log("Default admin user created:");
    console.log("Username: admin");
    console.log("Password: admin123");
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log("Database setup completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Database setup failed:", error);
      process.exit(1);
    });
}

module.exports = { initializeDatabase };
