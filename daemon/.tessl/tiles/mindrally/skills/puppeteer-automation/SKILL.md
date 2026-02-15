---
name: puppeteer-automation
description: Expert guidance for browser automation using Puppeteer with best practices for web scraping, testing, screenshot capture, and JavaScript execution in headless Chrome.
---

# Puppeteer Browser Automation

You are an expert in Puppeteer, Node.js browser automation, web scraping, and building reliable automation scripts for Chrome and Chromium browsers.

## Core Expertise
- Puppeteer API and browser automation patterns
- Page navigation and interaction
- Element selection and manipulation
- Screenshot and PDF generation
- Network request interception
- Headless and headful browser modes
- Performance optimization and memory management
- Integration with testing frameworks (Jest, Mocha)

## Key Principles

- Write clean, async/await based code for readability
- Use proper error handling with try/catch blocks
- Implement robust waiting strategies for dynamic content
- Close browser instances properly to prevent memory leaks
- Follow modular design patterns for reusable automation code
- Handle browser context and page lifecycle appropriately

## Project Setup

```bash
npm init -y
npm install puppeteer
```

### Basic Structure
```javascript
const puppeteer = require('puppeteer');

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.goto('https://example.com');
    // Your automation code here
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
```

## Browser Launch Options

```javascript
const browser = await puppeteer.launch({
  headless: 'new',  // 'new' for new headless mode, false for visible browser
  slowMo: 50,       // Slow down operations for debugging
  devtools: true,   // Open DevTools automatically
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--window-size=1920,1080'
  ],
  defaultViewport: {
    width: 1920,
    height: 1080
  }
});
```

## Page Navigation

```javascript
// Navigate to URL
await page.goto('https://example.com', {
  waitUntil: 'networkidle2',  // Wait until network is idle
  timeout: 30000
});

// Wait options:
// - 'load': Wait for load event
// - 'domcontentloaded': Wait for DOMContentLoaded event
// - 'networkidle0': No network connections for 500ms
// - 'networkidle2': No more than 2 network connections for 500ms

// Navigate back/forward
await page.goBack();
await page.goForward();

// Reload page
await page.reload({ waitUntil: 'networkidle2' });
```

## Element Selection

### Query Selectors
```javascript
// Single element
const element = await page.$('selector');

// Multiple elements
const elements = await page.$$('selector');

// Wait for element
const element = await page.waitForSelector('selector', {
  visible: true,
  timeout: 5000
});

// XPath selection
const elements = await page.$x('//xpath/expression');
```

### Evaluation in Page Context
```javascript
// Get text content
const text = await page.$eval('selector', el => el.textContent);

// Get attribute
const href = await page.$eval('a', el => el.getAttribute('href'));

// Multiple elements
const texts = await page.$$eval('.items', elements =>
  elements.map(el => el.textContent)
);

// Execute arbitrary JavaScript
const result = await page.evaluate(() => {
  return document.title;
});
```

## Page Interactions

### Clicking
```javascript
await page.click('button#submit');

// Click with options
await page.click('button', {
  button: 'left',  // 'left', 'right', 'middle'
  clickCount: 1,
  delay: 100       // Time between mousedown and mouseup
});

// Click and wait for navigation
await Promise.all([
  page.waitForNavigation(),
  page.click('a.nav-link')
]);
```

### Typing
```javascript
// Type text
await page.type('input#username', 'myuser', { delay: 50 });

// Clear and type
await page.click('input#username', { clickCount: 3 });
await page.type('input#username', 'newvalue');

// Press keys
await page.keyboard.press('Enter');
await page.keyboard.down('Shift');
await page.keyboard.press('Tab');
await page.keyboard.up('Shift');
```

### Form Handling
```javascript
// Select dropdown
await page.select('select#country', 'us');

// Check checkbox
await page.click('input[type="checkbox"]');

// File upload
const inputFile = await page.$('input[type="file"]');
await inputFile.uploadFile('/path/to/file.pdf');
```

## Waiting Strategies

```javascript
// Wait for selector
await page.waitForSelector('.loaded');

// Wait for selector to disappear
await page.waitForSelector('.loading', { hidden: true });

// Wait for function
await page.waitForFunction(
  () => document.querySelector('.count').textContent === '10'
);

// Wait for navigation
await page.waitForNavigation({ waitUntil: 'networkidle2' });

// Wait for network request
await page.waitForRequest(request =>
  request.url().includes('/api/data')
);

// Wait for network response
await page.waitForResponse(response =>
  response.url().includes('/api/data') && response.status() === 200
);

// Fixed timeout (use sparingly)
await page.waitForTimeout(1000);
```

## Screenshots and PDFs

### Screenshots
```javascript
// Full page screenshot
await page.screenshot({
  path: 'screenshot.png',
  fullPage: true
});

// Element screenshot
const element = await page.$('.chart');
await element.screenshot({ path: 'chart.png' });

// Screenshot options
await page.screenshot({
  path: 'screenshot.png',
  type: 'png',  // 'png' or 'jpeg'
  quality: 80,   // jpeg only, 0-100
  clip: {
    x: 0,
    y: 0,
    width: 800,
    height: 600
  }
});
```

### PDF Generation
```javascript
await page.pdf({
  path: 'document.pdf',
  format: 'A4',
  printBackground: true,
  margin: {
    top: '20px',
    right: '20px',
    bottom: '20px',
    left: '20px'
  }
});
```

## Network Interception

```javascript
// Enable request interception
await page.setRequestInterception(true);

page.on('request', request => {
  // Block images and stylesheets
  if (['image', 'stylesheet'].includes(request.resourceType())) {
    request.abort();
  } else {
    request.continue();
  }
});

// Modify requests
page.on('request', request => {
  request.continue({
    headers: {
      ...request.headers(),
      'X-Custom-Header': 'value'
    }
  });
});

// Monitor responses
page.on('response', async response => {
  if (response.url().includes('/api/')) {
    const data = await response.json();
    console.log('API Response:', data);
  }
});
```

## Authentication and Cookies

```javascript
// Basic HTTP authentication
await page.authenticate({
  username: 'user',
  password: 'pass'
});

// Set cookies
await page.setCookie({
  name: 'session',
  value: 'abc123',
  domain: 'example.com'
});

// Get cookies
const cookies = await page.cookies();

// Clear cookies
await page.deleteCookie({ name: 'session' });
```

## Browser Context and Multiple Pages

```javascript
// Create incognito context
const context = await browser.createIncognitoBrowserContext();
const page = await context.newPage();

// Multiple pages
const page1 = await browser.newPage();
const page2 = await browser.newPage();

// Get all pages
const pages = await browser.pages();

// Handle popups
page.on('popup', async popup => {
  await popup.waitForLoadState();
  console.log('Popup URL:', popup.url());
});
```

## Error Handling

```javascript
async function scrapeWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const browser = await puppeteer.launch();
      const page = await browser.newPage();

      // Set timeout
      page.setDefaultTimeout(30000);

      await page.goto(url, { waitUntil: 'networkidle2' });
      const data = await page.$eval('.content', el => el.textContent);

      await browser.close();
      return data;
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error.message);
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
}
```

## Performance Optimization

```javascript
// Disable unnecessary features
await page.setRequestInterception(true);
page.on('request', request => {
  const blockedTypes = ['image', 'stylesheet', 'font'];
  if (blockedTypes.includes(request.resourceType())) {
    request.abort();
  } else {
    request.continue();
  }
});

// Reuse browser instance
const browser = await puppeteer.launch();

async function scrape(url) {
  const page = await browser.newPage();
  try {
    await page.goto(url);
    // ... scraping logic
  } finally {
    await page.close();  // Close page, not browser
  }
}

// Use connection pool for parallel scraping
const cluster = require('puppeteer-cluster');
```

## Key Dependencies

- puppeteer
- puppeteer-core (for custom Chrome installations)
- puppeteer-cluster (for parallel scraping)
- puppeteer-extra (for plugins)
- puppeteer-extra-plugin-stealth (anti-detection)

## Best Practices

1. Always close browser instances in finally blocks
2. Use `waitForSelector` before interacting with elements
3. Prefer `networkidle2` over `networkidle0` for faster loads
4. Use stealth plugin for anti-bot bypass
5. Implement proper error handling and retries
6. Monitor memory usage in long-running scripts
7. Use browser context for isolated sessions
8. Set reasonable timeouts for all operations
