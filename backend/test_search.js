const axios = require("axios");

async function test() {
  console.log("🧪 Testing search matching logic...");
  
  const cases = [
    { term: "milk", expected: "1L Whole Milk" },
    { term: "wheat", expected: "Whole Wheat Bread (400g)" }, // Bread contains bread. Wheat flour contains wheat. Wait.
    { term: "wheat_flour", expected: "Wheat Flour (1kg)" },
    { term: "bread", expected: "Whole Wheat Bread (400g)" }
  ];

  for (const c of cases) {
    try {
      const resp = await axios.get(`http://localhost:5000/search?q=${c.term}`);
      console.log(`Query: "${c.term}" -> Result: "${resp.data.product}"`);
      if (resp.data.product !== c.expected && c.expected !== "") {
        console.log(`   ⚠️ Expected: ${c.expected}`);
      }
    } catch (e) {
      console.log(`   ❌ Failed: ${e.message}`);
    }
  }
}

test();
