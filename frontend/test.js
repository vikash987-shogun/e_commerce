import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));

  console.log("Navigating to http://localhost:5173 ...");
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  
  await new Promise(r => setTimeout(r, 2000));
  console.log("Testing showRoute...");
  await page.evaluate(() => { window.testShowRoute(); });
  
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
