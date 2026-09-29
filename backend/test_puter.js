const puter = require('@heyputer/puter.js').default || require('@heyputer/puter.js');

async function testPuter() {
  try {
    const result = await puter.ai.chat(
      "What is this image? Reply with a single word.",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/SNice.svg/1200px-SNice.svg.png"
    );
    console.log("Puter result:", result);
  } catch (err) {
    console.error("Puter error:", err);
  }
}

testPuter();
