const express = require("express");
const cors = require("cors");
const multer = require("multer");
const FormData = require("form-data");
const { Pool } = require("pg");
const axios = require("axios");

const GEOAPIFY_API_KEY = "87a8fc6436c845408642bfebd2fb8056";

function getGeoapifyCategory(productKey) {
  const map = {
    soap: "commercial.health_and_beauty,commercial.chemist",
    toothpaste: "commercial.health_and_beauty,commercial.chemist",
  };
  return map[productKey] || "commercial.supermarket,commercial.food_and_drink";
}

const app = express();
app.use(cors());
app.use(express.json());

const USE_MOCK_AI = process.env.USE_MOCK_AI === "true" || false;

const upload = multer({ storage: multer.memoryStorage() });

/* -----------------------------
   PostgreSQL Database Setup
----------------------------- */
const pool = new Pool({
  // You can set DATABASE_URL as an environment variable before running.
  // E.g.: postgresql://postgres:password@localhost:5432/pricecompare
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:1101@localhost:5432/postgres",
});

async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL
      );
      CREATE TABLE IF NOT EXISTS stores (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        rating NUMERIC(3, 1),
        offer VARCHAR(255),
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL
      );
    `);
    console.log("✅ PostgreSQL tables ensured.");

    const res = await pool.query("SELECT COUNT(*) FROM products");
    if (parseInt(res.rows[0].count) === 0) {
      console.log("Seeding initial data from products.json...");
      try {
        const fs = require("fs");
        const path = require("path");
        const data = fs.readFileSync(path.join(__dirname, "products.json"), "utf8");
        const productsData = JSON.parse(data);

        for (const key in productsData) {
          const product = productsData[key];
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
        }
        console.log("✅ PostgreSQL Seeded successfully!");
      } catch (seedErr) {
        console.error("Could not seed data:", seedErr);
      }
    }
  } catch (err) {
    console.error("❌ DB Init Error! Check if your Postgres is running and connectionString is valid.", err.message);
  }
}
initDB();

/* -----------------------------
   Haversine Formula
----------------------------- */
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/* -----------------------------
   Image Upload Route
----------------------------- */
/* -----------------------------
   Search by Tags Route (Puter.js)
----------------------------- */
app.post("/search-tags", async (req, res) => {
  const { tags, lat, lng } = req.body;
  if (!tags || !Array.isArray(tags)) {
    return res.status(400).json({ error: "No tags provided" });
  }

  console.log("📂 Received search-tags request with tags:", tags);

  if (USE_MOCK_AI) {
    console.log("🧪 Using MOCK AI response");
    return handleAIMatch([{ name: "apple", value: 0.99 }], lat, lng, res);
  }

  try {
    const concepts = tags.map(tag => ({
      name: tag,
      value: 1.0 // Assign full confidence to tags returned by Puter
    }));

    handleAIMatch(concepts, lat, lng, res);
  } catch (error) {
    console.error("Tags Processing Error:", error);
    return res.status(500).json({ error: "Processing tags failed" });
  }
});

async function handleAIMatch(concepts, lat, lng, res) {
  try {
    const { rows } = await pool.query("SELECT * FROM products");
    const conceptNames = concepts.map(c => c.name.toLowerCase());
    
    console.log("🧠 Analyzing AI concepts:", conceptNames);

    // 1. Try Exact Match First (on Key or Name)
    let matchedProduct = rows.find(p => 
      conceptNames.includes(p.key.toLowerCase()) || 
      conceptNames.includes(p.name.toLowerCase())
    );

    // 2. Fallback to Partial Match (but stricter than before)
    if (!matchedProduct) {
      const ignoredTags = ["vegetable", "fresh", "herb", "ingredient", "food", "nobody", "no person", "container", "outdoors", "market", "organic"];
      const usefulConcepts = conceptNames.filter(c => !ignoredTags.includes(c) && c.length > 2);
      
      console.log("🏷️  Attempting stricter partial match with:", usefulConcepts);

      matchedProduct = rows.find(p =>
        usefulConcepts.some(c => 
          p.key.toLowerCase().includes(c) || 
          c.includes(p.key.toLowerCase()) ||
          p.name.toLowerCase().includes(c) ||
          c.includes(p.name.toLowerCase())
        )
      );
    }

    if (matchedProduct) {
      console.log(`✅ Final Match: ${matchedProduct.name}`);
      const storesRes = await pool.query("SELECT * FROM stores WHERE product_id = $1", [matchedProduct.id]);
      
      const userLat = lat ? parseFloat(lat) : 11.00687;
      const userLng = lng ? parseFloat(lng) : 77.08116;

      const dynamicStores = storesRes.rows
        .map(store => ({
          name: store.name,
          price: parseFloat(store.price),
          rating: parseFloat(store.rating),
          offer: store.offer,
          lat: store.lat,
          lng: store.lng,
          distance: Number(getDistance(userLat, userLng, store.lat, store.lng).toFixed(2))
        }))
        .sort((a, b) => a.distance - b.distance);

      return res.json({ 
        product: matchedProduct.name, 
        stores: dynamicStores,
        concepts: conceptNames.slice(0, 5) // Send tags back for UI feedback
      });
    }

    console.log("❌ No reliable match found.");
    return res.json({ 
      product: "Not found", 
      stores: [], 
      concepts: conceptNames.slice(0, 3) 
    });
  } catch (dbErr) {
    console.error("Database error in /upload handler:", dbErr);
    return res.status(500).json({ error: "Database error" });
  }
}

/* -----------------------------
   Search Route
----------------------------- */
app.get("/search", async (req, res) => {
  let { q, name, lat, lng } = req.query;

  // Accept both ?q= and ?name=
  const searchTerm = (q || name || "").toLowerCase().trim();

  if (!searchTerm) {
    return res.status(400).json({ error: "No query" });
  }

  console.log("🔍 Search Term:", searchTerm);

  try {
    const productsRes = await pool.query("SELECT * FROM products");
    console.log("📦 Products in DB:", productsRes.rows);

    // ✅ Improved matching logic: Try exact key/name first, then inclusion
    const matchedProduct = 
      productsRes.rows.find(p => p.key.toLowerCase() === searchTerm || p.name.toLowerCase() === searchTerm) ||
      productsRes.rows.find(p => p.key.toLowerCase().includes(searchTerm) || p.name.toLowerCase().includes(searchTerm));

    console.log("✅ Matched Product:", matchedProduct);

    if (!matchedProduct) {
      return res.json({ product: "Not found", stores: [] });
    }

    const storesRes = await pool.query(
      "SELECT * FROM stores WHERE product_id = $1",
      [matchedProduct.id]
    );

    console.log("🏪 Mocks found:", storesRes.rows.length);

    const userLat = lat ? parseFloat(lat) : 11.00687;
    const userLng = lng ? parseFloat(lng) : 77.08116;

    // Use Geoapify to find real nearby locations
    const category = getGeoapifyCategory(matchedProduct.key);
    const radius = 10000; // 10km radius
    const geoapifyUrl = `https://api.geoapify.com/v2/places?categories=${category}&filter=circle:${userLng},${userLat},${radius}&limit=10&apiKey=${GEOAPIFY_API_KEY}`;

    let results = [];
    try {
      console.log(`🌍 Fetching real places from Geoapify...`);
      const geoResp = await axios.get(geoapifyUrl);

      if (geoResp.data && geoResp.data.features && geoResp.data.features.length > 0) {
        // Base prices for simulation
        const basePrices = {
          milk: 60, bread: 40, soap: 50, toothpaste: 90, tomato: 30, sugar: 45, rice: 60, 
          egg: 70, oil: 140, onion: 40, potato: 30, carrot: 50, cabbage: 25, 
          cauliflower: 35, spinach: 15, brinjal: 30, capsicum: 45, apple: 150, 
          banana: 60, orange: 80, mango: 100, grapes: 70, papaya: 40, 
          pomegranate: 180, basmati_rice: 120, wheat_flour: 45, atta: 50
        };
        const basePrice = basePrices[matchedProduct.key] || 50;

        results = geoResp.data.features.map((feature, index) => {
          const place = feature.properties;
          const simulatedPrice = basePrice + (Math.random() * basePrice * 0.2 - basePrice * 0.1);
          const randomRating = (Math.random() * 1.5 + 3.5).toFixed(1);
          const offers = ["None", "5% off", "Buy 2 Get 1", "Free Delivery"];
          const randomOffer = offers[index % offers.length];
          const storeName = place.name || (place.address_line1 ? place.address_line1.split(",")[0] : "Local Store");
          const distance = Number(getDistance(userLat, userLng, place.lat, place.lon).toFixed(2));

          return {
            name: storeName,
            price: parseFloat(simulatedPrice.toFixed(2)),
            rating: parseFloat(randomRating),
            offer: randomOffer,
            lat: place.lat,
            lng: place.lon,
            distance
          };
        });
        console.log(`✅ Found ${results.length} real places.`);
      }
    } catch (err) {
      console.error("Geoapify error:", err.message);
    }

    // Fallback to mock DB if Geoapify fails or finds no locations
    if (results.length === 0) {
      console.log("⚠️ No Geoapify places found, falling back to mock DB.");
      results = storesRes.rows.map((store) => ({
        name: store.name,
        price: parseFloat(store.price),
        rating: parseFloat(store.rating),
        offer: store.offer,
        lat: store.lat,
        lng: store.lng,
        distance: Number(getDistance(userLat, userLng, store.lat, store.lng).toFixed(2))
      }));
    }

    results.sort((a, b) => a.distance - b.distance);

    return res.json({ product: matchedProduct.name, stores: results });

  } catch (err) {
    console.error("❌ Database search error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

/* -----------------------------
   Add New Product Route
----------------------------- */
app.post("/add-product", async (req, res) => {
  const { key, name, stores } = req.body;
  if (!key || !name || !stores) return res.status(400).json({ error: "Missing required fields" });

  try {
    const insertProd = await pool.query(
      "INSERT INTO products (key, name) VALUES ($1, $2) RETURNING id",
      [key.toLowerCase(), name]
    );
    const productId = insertProd.rows[0].id;

    for (const store of stores) {
      await pool.query(
        "INSERT INTO stores (product_id, name, price, rating, offer, lat, lng) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [productId, store.name, store.price, store.rating, store.offer, store.lat, store.lng]
      );
    }
    res.json({ success: true, message: "Product and stores added to DB!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not add product" });
  }
});

app.listen(5000, () => console.log("🚀 AI Server running on http://localhost:5000"));