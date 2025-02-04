// test-puppeteer.js
const puppeteer = require('puppeteer');

(async () => {
  try {
	// Launch puppeteer with minimal configuration
	const browser = await puppeteer.launch({
	  headless: true,
	  // You might need these arguments on some systems; try removing them if they cause issues locally.
	  args: ['--no-sandbox', '--disable-setuid-sandbox']
	});
	const page = await browser.newPage();
	// Set a small viewport to test
	await page.setViewport({ width: 800, height: 600 });
	// Navigate to a simple website
	await page.goto('https://example.com', { waitUntil: 'networkidle0' });
	// Take a screenshot and save it to a file
	await page.screenshot({ path: 'example-screenshot.png', type: 'png' });
	await browser.close();
	console.log('Screenshot saved as example-screenshot.png');
  } catch (error) {
	console.error('Error with Puppeteer:', error);
	process.exit(1);
  }
})();
