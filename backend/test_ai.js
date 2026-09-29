const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");

// --- IMAGGA CONFIGURATION ---
const IMAGGA_API_KEY = 'acc_68e75a6767dbc7d';
const IMAGGA_API_SECRET = 'e3bd9346d68f6c8d57a9020c83c742e8';
const AUTH_HEADER = 'Basic ' + Buffer.from(`${IMAGGA_API_KEY}:${IMAGGA_API_SECRET}`).toString('base64');

async function testAI() {
  try {
    console.log("Fetching test image...");
    const imageResponse = await axios.get("https://upload.wikimedia.org/wikipedia/commons/1/15/Red_Apple.jpg", { 
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    const form = new FormData();
    form.append("image", imageResponse.data, {
      filename: "apple.jpg",
      contentType: "image/jpeg",
    });

    console.log("Calling Imagga API...");
    const response = await axios.post("https://api.imagga.com/v2/tags", form, {
      headers: {
        ...form.getHeaders(),
        Authorization: AUTH_HEADER,
      },
    });

    const tags = response.data.result.tags;
    const concepts = tags.slice(0, 5).map(t => ({
      name: t.tag.en,
      confidence: t.confidence.toFixed(1) + "%"
    }));

    console.log("AI Results:", concepts);
    fs.writeFileSync("result.json", JSON.stringify(concepts, null, 2));
    console.log("Successfully wrote results to result.json");
  } catch (error) {
    console.error("Test failed:", error.response?.data || error.message);
  }
}

testAI();
