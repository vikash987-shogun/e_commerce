const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:1101@localhost:5432/postgres",
});

async function sync() {
  try {
    const data = fs.readFileSync(path.join(__dirname, "products.json"), "utf8");
    const productsData = JSON.parse(data);

    let addedCount = 0;

    for (const key in productsData) {
      const product = productsData[key];
      
      const checkRes = await pool.query("SELECT id FROM products WHERE key = $1", [key]);
      
      if (checkRes.rows.length === 0) {
        const insertProdRes = await pool.query(
          "INSERT INTO products (key, name) VALUES ($1, $2) RETURNING id",
          [key, product.product]
        );
        const productId = insertProdRes.rows[0].id;

        for (const store of product.stores) {
          await pool.query(
            "INSERT INTO stores (product_id, name, price, rating, offer, lat, lng) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            [productId, store.name, store.price, store.rating, store.offer, store.lat, store.lng]
          );
        }
        console.log(`Added missing product: ${product.product}`);
        addedCount++;
      }
    }
    console.log(`Sync complete. Added ${addedCount} new products.`);
  } catch (err) {
    console.error("Sync error:", err);
  } finally {
    pool.end();
  }
}

sync();
