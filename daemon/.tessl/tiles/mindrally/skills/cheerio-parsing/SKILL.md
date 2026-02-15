---
name: cheerio-parsing
description: Expert guidance for HTML/XML parsing using Cheerio in Node.js with best practices for DOM traversal, data extraction, and efficient scraping pipelines.
---

# Cheerio HTML Parsing

You are an expert in Cheerio, Node.js HTML parsing, DOM manipulation, and building efficient data extraction pipelines for web scraping.

## Core Expertise
- Cheerio API and jQuery-like syntax
- CSS selector optimization
- DOM traversal and manipulation
- HTML/XML parsing strategies
- Integration with HTTP clients (axios, got, node-fetch)
- Memory-efficient processing of large documents
- Data extraction patterns and best practices

## Key Principles

- Write clean, modular extraction functions
- Use efficient selectors to minimize parsing overhead
- Handle malformed HTML gracefully
- Implement proper error handling for missing elements
- Design reusable scraping utilities
- Follow functional programming patterns where appropriate

## Basic Setup

```bash
npm install cheerio axios
```

### Loading HTML
```javascript
const cheerio = require('cheerio');
const axios = require('axios');

// Load from string
const $ = cheerio.load('<html><body><h1>Hello</h1></body></html>');

// Load with options
const $ = cheerio.load(html, {
  xmlMode: false,           // Parse as XML
  decodeEntities: true,     // Decode HTML entities
  lowerCaseTags: false,     // Keep tag case
  lowerCaseAttributeNames: false
});

// Fetch and parse
async function fetchAndParse(url) {
  const response = await axios.get(url);
  return cheerio.load(response.data);
}
```

## Selecting Elements

### CSS Selectors
```javascript
// By tag
$('h1')

// By class
$('.article')

// By ID
$('#main-content')

// By attribute
$('[data-id="123"]')
$('a[href^="https://"]')  // Starts with
$('a[href$=".pdf"]')      // Ends with
$('a[href*="example"]')   // Contains

// Combinations
$('div.article > h2')     // Direct child
$('div.article h2')       // Any descendant
$('h2 + p')               // Adjacent sibling
$('h2 ~ p')               // General sibling

// Pseudo-selectors
$('li:first-child')
$('li:last-child')
$('li:nth-child(2)')
$('li:nth-child(odd)')
$('tr:even')
$('input:not([type="hidden"])')
$('p:contains("specific text")')
```

### Multiple Selectors
```javascript
// Select multiple types
$('h1, h2, h3')

// Chain selections
$('.article').find('.title')
```

## Extracting Data

### Text Content
```javascript
// Get text (includes child text)
const text = $('h1').text();

// Get trimmed text
const text = $('h1').text().trim();

// Get HTML
const html = $('div.content').html();

// Get outer HTML
const outerHtml = $.html($('div.content'));
```

### Attributes
```javascript
// Get attribute
const href = $('a').attr('href');
const src = $('img').attr('src');

// Get data attributes
const id = $('div').data('id');  // data-id attribute

// Check if attribute exists
const hasClass = $('div').hasClass('active');
```

### Multiple Elements
```javascript
// Iterate with each
const items = [];
$('.product').each((index, element) => {
  items.push({
    name: $(element).find('.name').text().trim(),
    price: $(element).find('.price').text().trim(),
    url: $(element).find('a').attr('href')
  });
});

// Map to array
const titles = $('h2').map((i, el) => $(el).text()).get();

// Filter elements
const featured = $('.product').filter('.featured');

// First/Last
const first = $('li').first();
const last = $('li').last();

// Get by index
const third = $('li').eq(2);
```

## DOM Traversal

### Navigation
```javascript
// Parent
$('span').parent()
$('span').parents()          // All ancestors
$('span').parents('.container')  // Specific ancestor
$('span').closest('.wrapper')    // Nearest ancestor matching selector

// Children
$('ul').children()           // Direct children
$('ul').children('li.active') // Filtered children
$('div').contents()          // Including text nodes

// Siblings
$('li').siblings()
$('li').next()
$('li').nextAll()
$('li').prev()
$('li').prevAll()
```

### Filtering
```javascript
// Filter by selector
$('li').filter('.active')

// Filter by function
$('li').filter((i, el) => $(el).data('price') > 100)

// Find within selection
$('.article').find('img')

// Check conditions
$('li').is('.active')  // Returns boolean
$('li').has('span')    // Has descendant matching selector
```

## Data Extraction Patterns

### Table Extraction
```javascript
function extractTable(tableSelector) {
  const $ = this;
  const headers = [];
  const rows = [];

  // Get headers
  $(tableSelector).find('th').each((i, el) => {
    headers.push($(el).text().trim());
  });

  // Get rows
  $(tableSelector).find('tbody tr').each((i, row) => {
    const rowData = {};
    $(row).find('td').each((j, cell) => {
      rowData[headers[j]] = $(cell).text().trim();
    });
    rows.push(rowData);
  });

  return rows;
}
```

### List Extraction
```javascript
function extractList(selector, itemExtractor) {
  return $(selector).map((i, el) => itemExtractor($(el))).get();
}

// Usage
const products = extractList('.product', ($el) => ({
  name: $el.find('.name').text().trim(),
  price: parseFloat($el.find('.price').text().replace('$', '')),
  image: $el.find('img').attr('src'),
  link: $el.find('a').attr('href')
}));
```

### Pagination Links
```javascript
function extractPaginationLinks() {
  return $('.pagination a')
    .map((i, el) => $(el).attr('href'))
    .get()
    .filter(href => href && !href.includes('#'));
}
```

## Handling Missing Data

```javascript
// Safe extraction with defaults
function safeText(selector, defaultValue = '') {
  const el = $(selector);
  return el.length ? el.text().trim() : defaultValue;
}

function safeAttr(selector, attr, defaultValue = null) {
  const el = $(selector);
  return el.length ? el.attr(attr) : defaultValue;
}

// Optional chaining pattern
const price = $('.price').first().text()?.trim() || 'N/A';
```

## URL Resolution

```javascript
const { URL } = require('url');

function resolveUrl(baseUrl, relativeUrl) {
  if (!relativeUrl) return null;
  try {
    return new URL(relativeUrl, baseUrl).href;
  } catch {
    return relativeUrl;
  }
}

// Usage
const baseUrl = 'https://example.com/products/';
$('a').each((i, el) => {
  const href = $(el).attr('href');
  const absoluteUrl = resolveUrl(baseUrl, href);
  console.log(absoluteUrl);
});
```

## Performance Optimization

```javascript
// Cache selections
const $products = $('.product');
$products.each((i, el) => {
  const $product = $(el);  // Wrap once
  // Use $product multiple times
});

// Limit parsing scope
const $article = $('.article');
const title = $article.find('.title').text();  // Searches only within article

// Use specific selectors
// Good
$('div.product > h2.title')
// Less efficient
$('div').find('.product').find('h2').filter('.title')
```

## Complete Scraping Example

```javascript
const cheerio = require('cheerio');
const axios = require('axios');

async function scrapeProducts(url) {
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; MyScraper/1.0)'
    }
  });

  const $ = cheerio.load(response.data);
  const products = [];

  $('.product-card').each((index, element) => {
    const $el = $(element);

    products.push({
      name: $el.find('.product-title').text().trim(),
      price: parseFloat(
        $el.find('.price').text().replace(/[^0-9.]/g, '')
      ),
      rating: parseFloat($el.find('.rating').attr('data-rating')) || null,
      image: $el.find('img').attr('src'),
      url: new URL($el.find('a').attr('href'), url).href,
      inStock: !$el.find('.out-of-stock').length
    });
  });

  return products;
}

// With error handling
async function safeScrape(url) {
  try {
    return await scrapeProducts(url);
  } catch (error) {
    console.error(`Failed to scrape ${url}:`, error.message);
    return [];
  }
}
```

## Key Dependencies

- cheerio
- axios (HTTP client)
- got (alternative HTTP client)
- node-fetch (fetch API for Node.js)
- p-limit (concurrency control)

## Best Practices

1. Always handle missing elements gracefully
2. Use specific selectors for better performance
3. Cache jQuery-wrapped elements when reusing
4. Normalize extracted text (trim whitespace)
5. Resolve relative URLs to absolute
6. Validate extracted data types
7. Implement rate limiting when scraping multiple pages
8. Use appropriate User-Agent headers
9. Handle character encoding issues
10. Log extraction failures for debugging
