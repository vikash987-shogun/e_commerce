const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:1101@localhost:5432/postgres",
});

async function check() {
  try {
    const res = await pool.query("SELECT * FROM products");
    console.log("--- PRODUCTS ---");
    console.table(res.rows);
    
    const stores = await pool.query("SELECT COUNT(*) FROM stores");
    console.log(`Total Store Listings: ${stores.rows[0].count}`);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
check();
