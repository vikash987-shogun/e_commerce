const concepts = [
  { name: 'vegetable', value: 1.0 },
  { name: 'herb', value: 0.592 },
  { name: 'cabbage', value: 0.571 },
  { name: 'spinach', value: 0.566 },
  { name: 'fresh', value: 0.543 }
];

const products = [
  { id: 1, key: 'milk', name: '1L Whole Milk' },
  { id: 2, key: 'bread', name: 'Whole Wheat Bread (400g)' },
  { id: 3, key: 'soap', name: 'Dove Bathing Bar (100g)' },
  { id: 4, key: 'toothpaste', name: 'Colgate Total (150g)' },
  { id: 5, key: 'tomato', name: 'Fresh Tomatoes (1kg)' },
  { id: 6, key: 'sugar', name: 'White Sugar (1kg)' },
  { id: 10, key: 'onion', name: 'Red Onions (1kg)' },
  { id: 11, key: 'potato', name: 'Potato (1kg)' },
  { id: 12, key: 'carrot', name: 'Carrot (1kg)' },
  { id: 13, key: 'cabbage', name: 'Cabbage (1 pc)' },
  { id: 14, key: 'cauliflower', name: 'Cauliflower (1 pc)' },
  { id: 15, key: 'spinach', name: 'Spinach (1 bunch)' }
];
console.log("Testing handleAIMatch logic...");
const matchedProduct = products.find(p =>
  concepts.some(c => {
    const cName = c.name.toLowerCase();
    const pKey = p.key.toLowerCase();
    const pName = p.name.toLowerCase();
    const result = cName.includes(pKey) || 
                   pKey.includes(cName) || 
                   cName.includes(pName) || 
                   pName.includes(cName);
    if (result) console.log(`   MATCH: Concept "${cName}" matched Product "${pName}" (key: "${pKey}")`);
    return result;
  })
);

if (matchedProduct) {
  console.log("Final Win:", matchedProduct.name);
} else {
  console.log("No match found.");
}
