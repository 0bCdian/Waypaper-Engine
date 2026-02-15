---
name: beautifulsoup-parsing
description: Expert guidance for HTML/XML parsing using BeautifulSoup in Python with best practices for DOM navigation, data extraction, and efficient scraping workflows.
---

# BeautifulSoup HTML Parsing

You are an expert in BeautifulSoup, Python HTML/XML parsing, DOM navigation, and building efficient data extraction pipelines for web scraping.

## Core Expertise
- BeautifulSoup API and parsing methods
- CSS selectors and find methods
- DOM traversal and navigation
- HTML/XML parsing with different parsers
- Integration with requests library
- Handling malformed HTML gracefully
- Data extraction patterns and best practices
- Memory-efficient processing

## Key Principles

- Write concise, technical code with accurate Python examples
- Prioritize readability, efficiency, and maintainability
- Use modular, reusable functions for common extraction tasks
- Handle missing data gracefully with proper defaults
- Follow PEP 8 style guidelines
- Implement proper error handling for robust scraping

## Basic Setup

```bash
pip install beautifulsoup4 requests lxml
```

### Loading HTML
```python
from bs4 import BeautifulSoup
import requests

# From string
html = '<html><body><h1>Hello</h1></body></html>'
soup = BeautifulSoup(html, 'lxml')

# From file
with open('page.html', 'r', encoding='utf-8') as f:
    soup = BeautifulSoup(f, 'lxml')

# From URL
response = requests.get('https://example.com')
soup = BeautifulSoup(response.content, 'lxml')
```

### Parser Options
```python
# lxml - Fast, lenient (recommended)
soup = BeautifulSoup(html, 'lxml')

# html.parser - Built-in, no dependencies
soup = BeautifulSoup(html, 'html.parser')

# html5lib - Most lenient, slowest
soup = BeautifulSoup(html, 'html5lib')

# lxml-xml - For XML documents
soup = BeautifulSoup(xml, 'lxml-xml')
```

## Finding Elements

### By Tag
```python
# First matching element
soup.find('h1')

# All matching elements
soup.find_all('p')

# Shorthand
soup.h1  # Same as soup.find('h1')
```

### By Attributes
```python
# By class
soup.find('div', class_='article')
soup.find_all('div', class_='article')

# By ID
soup.find(id='main-content')

# By any attribute
soup.find('a', href='https://example.com')
soup.find_all('input', attrs={'type': 'text', 'name': 'email'})

# By data attributes
soup.find('div', attrs={'data-id': '123'})
```

### CSS Selectors
```python
# Single element
soup.select_one('div.article > h2')

# Multiple elements
soup.select('div.article h2')

# Complex selectors
soup.select('a[href^="https://"]')  # Starts with
soup.select('a[href$=".pdf"]')      # Ends with
soup.select('a[href*="example"]')   # Contains
soup.select('li:nth-child(2)')
soup.select('h1, h2, h3')           # Multiple
```

### With Functions
```python
import re

# By regex
soup.find_all('a', href=re.compile(r'^https://'))

# By function
def has_data_attr(tag):
    return tag.has_attr('data-id')

soup.find_all(has_data_attr)

# String matching
soup.find_all(string='exact text')
soup.find_all(string=re.compile('pattern'))
```

## Extracting Data

### Text Content
```python
# Get text
element.text
element.get_text()

# Get text with separator
element.get_text(separator=' ')

# Get stripped text
element.get_text(strip=True)

# Get strings (generator)
for string in element.stripped_strings:
    print(string)
```

### Attributes
```python
# Get attribute
element['href']
element.get('href')  # Returns None if missing
element.get('href', 'default')  # With default

# Get all attributes
element.attrs  # Returns dict

# Check attribute exists
element.has_attr('class')
```

### HTML Content
```python
# Inner HTML
str(element)

# Just the tag
element.name

# Prettified HTML
element.prettify()
```

## DOM Navigation

### Parent/Ancestors
```python
element.parent
element.parents  # Generator of all ancestors

# Find specific ancestor
for parent in element.parents:
    if parent.name == 'div' and 'article' in parent.get('class', []):
        break
```

### Children
```python
element.children      # Direct children (generator)
list(element.children)

element.contents      # Direct children (list)
element.descendants   # All descendants (generator)

# Find in children
element.find('span')  # Searches descendants
```

### Siblings
```python
element.next_sibling
element.previous_sibling

element.next_siblings      # Generator
element.previous_siblings  # Generator

# Next/previous element (skips whitespace)
element.next_element
element.previous_element
```

## Data Extraction Patterns

### Safe Extraction
```python
def safe_text(element, selector, default=''):
    """Safely extract text from element."""
    found = element.select_one(selector)
    return found.get_text(strip=True) if found else default

def safe_attr(element, selector, attr, default=None):
    """Safely extract attribute from element."""
    found = element.select_one(selector)
    return found.get(attr, default) if found else default
```

### Table Extraction
```python
def extract_table(table):
    """Extract table data as list of dictionaries."""
    headers = [th.get_text(strip=True) for th in table.select('th')]

    rows = []
    for tr in table.select('tbody tr'):
        cells = [td.get_text(strip=True) for td in tr.select('td')]
        if cells:
            rows.append(dict(zip(headers, cells)))

    return rows
```

### List Extraction
```python
def extract_items(soup, selector, extractor):
    """Extract multiple items using a custom extractor function."""
    return [extractor(item) for item in soup.select(selector)]

# Usage
def extract_product(item):
    return {
        'name': safe_text(item, '.name'),
        'price': safe_text(item, '.price'),
        'url': safe_attr(item, 'a', 'href')
    }

products = extract_items(soup, '.product', extract_product)
```

## URL Resolution

```python
from urllib.parse import urljoin

def resolve_url(base_url, relative_url):
    """Convert relative URL to absolute."""
    if not relative_url:
        return None
    return urljoin(base_url, relative_url)

# Usage
base_url = 'https://example.com/products/'
for link in soup.select('a'):
    href = link.get('href')
    absolute_url = resolve_url(base_url, href)
    print(absolute_url)
```

## Handling Malformed HTML

```python
# lxml parser is lenient with malformed HTML
soup = BeautifulSoup(malformed_html, 'lxml')

# For very broken HTML, use html5lib
soup = BeautifulSoup(very_broken_html, 'html5lib')

# Handle encoding issues
response = requests.get(url)
response.encoding = response.apparent_encoding
soup = BeautifulSoup(response.text, 'lxml')
```

## Complete Scraping Example

```python
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import time

class ProductScraper:
    def __init__(self, base_url):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (compatible; MyScraper/1.0)'
        })

    def fetch_page(self, url):
        """Fetch and parse a page."""
        response = self.session.get(url, timeout=30)
        response.raise_for_status()
        return BeautifulSoup(response.content, 'lxml')

    def extract_product(self, item):
        """Extract product data from a card element."""
        return {
            'name': self._safe_text(item, '.product-title'),
            'price': self._parse_price(item.select_one('.price')),
            'rating': self._safe_attr(item, '.rating', 'data-rating'),
            'image': self._resolve(self._safe_attr(item, 'img', 'src')),
            'url': self._resolve(self._safe_attr(item, 'a', 'href')),
            'in_stock': not item.select_one('.out-of-stock')
        }

    def scrape_products(self, url):
        """Scrape all products from a page."""
        soup = self.fetch_page(url)
        items = soup.select('.product-card')
        return [self.extract_product(item) for item in items]

    def _safe_text(self, element, selector, default=''):
        found = element.select_one(selector)
        return found.get_text(strip=True) if found else default

    def _safe_attr(self, element, selector, attr, default=None):
        found = element.select_one(selector)
        return found.get(attr, default) if found else default

    def _parse_price(self, element):
        if not element:
            return None
        text = element.get_text(strip=True)
        try:
            return float(text.replace('$', '').replace(',', ''))
        except ValueError:
            return None

    def _resolve(self, url):
        return urljoin(self.base_url, url) if url else None


# Usage
scraper = ProductScraper('https://example.com')
products = scraper.scrape_products('https://example.com/products')
for product in products:
    print(product)
```

## Performance Optimization

```python
# Use SoupStrainer to parse only needed elements
from bs4 import SoupStrainer

only_articles = SoupStrainer('article')
soup = BeautifulSoup(html, 'lxml', parse_only=only_articles)

# Use lxml parser for speed
soup = BeautifulSoup(html, 'lxml')  # Fastest

# Decompose unneeded elements
for script in soup.find_all('script'):
    script.decompose()

# Use generators for memory efficiency
for item in soup.select('.item'):
    yield extract_data(item)
```

## Key Dependencies

- beautifulsoup4
- lxml (fast parser)
- html5lib (lenient parser)
- requests
- pandas (for data output)

## Best Practices

1. Always use lxml parser for best performance
2. Handle missing elements with default values
3. Use `select()` and `select_one()` for CSS selectors
4. Use `get_text(strip=True)` for clean text extraction
5. Resolve relative URLs to absolute
6. Validate extracted data types
7. Implement rate limiting between requests
8. Use proper User-Agent headers
9. Handle character encoding properly
10. Use SoupStrainer for large documents
11. Follow robots.txt and website terms of service
12. Implement retry logic for failed requests
