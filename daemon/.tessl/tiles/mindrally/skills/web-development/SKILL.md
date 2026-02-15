---
name: web-development
description: Web development guidelines covering Bootstrap, Django, HTMX, and general web best practices
---

# Web Development Guidelines

You are an expert in web development with knowledge of various frameworks and best practices.

## Bootstrap Development

### Core Principles
- Use Bootstrap's grid system for responsive layouts
- Leverage utility classes for rapid styling
- Customize through Sass variables
- Follow mobile-first approach

### Grid System
```html
<div class="container">
  <div class="row">
    <div class="col-12 col-md-6 col-lg-4">Column 1</div>
    <div class="col-12 col-md-6 col-lg-4">Column 2</div>
    <div class="col-12 col-md-12 col-lg-4">Column 3</div>
  </div>
</div>
```

### Components
- Use pre-built components (navbar, cards, modals)
- Customize with utility classes
- Ensure accessibility attributes
- Test responsive behavior

### Customization
```scss
// Custom variables
$primary: #0d6efd;
$font-family-base: 'Inter', sans-serif;

// Import Bootstrap
@import "bootstrap/scss/bootstrap";
```

## Django Development

### Project Structure
```
project/
├── apps/
│   ├── core/
│   ├── users/
│   └── api/
├── config/
│   ├── settings/
│   ├── urls.py
│   └── wsgi.py
├── static/
├── templates/
└── manage.py
```

### Views
```python
from django.views.generic import ListView, DetailView
from django.shortcuts import render, get_object_or_404

class ArticleListView(ListView):
    model = Article
    template_name = 'articles/list.html'
    context_object_name = 'articles'
    paginate_by = 10

def article_detail(request, slug):
    article = get_object_or_404(Article, slug=slug)
    return render(request, 'articles/detail.html', {'article': article})
```

### Models
```python
from django.db import models

class Article(models.Model):
    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title
```

### Forms
```python
from django import forms

class ContactForm(forms.Form):
    name = forms.CharField(max_length=100)
    email = forms.EmailField()
    message = forms.CharField(widget=forms.Textarea)

    def clean_email(self):
        email = self.cleaned_data['email']
        # Custom validation
        return email
```

## HTMX Development

### Core Concepts
- Use hx-get, hx-post for AJAX requests
- Update DOM with hx-target and hx-swap
- Trigger events with hx-trigger
- Handle loading states with indicators

### Basic Usage
```html
<!-- Load content on click -->
<button hx-get="/api/data" hx-target="#results">
  Load Data
</button>
<div id="results"></div>

<!-- Form submission -->
<form hx-post="/api/submit" hx-target="#response">
  <input type="text" name="query">
  <button type="submit">Submit</button>
</form>
<div id="response"></div>
```

### Triggers
```html
<!-- Trigger on different events -->
<input hx-get="/search" hx-trigger="keyup changed delay:500ms" hx-target="#results">

<!-- Trigger on page load -->
<div hx-get="/initial-data" hx-trigger="load"></div>

<!-- Trigger on intersection -->
<div hx-get="/more" hx-trigger="intersect once"></div>
```

### Swap Options
```html
<!-- Different swap strategies -->
<div hx-get="/content" hx-swap="innerHTML">Replace inner</div>
<div hx-get="/content" hx-swap="outerHTML">Replace entire element</div>
<div hx-get="/content" hx-swap="beforeend">Append</div>
<div hx-get="/content" hx-swap="afterbegin">Prepend</div>
```

### Loading States
```html
<button hx-get="/data" hx-indicator="#spinner">
  Load
  <img id="spinner" class="htmx-indicator" src="/spinner.gif">
</button>
```

## General Best Practices

### Performance
- Minimize HTTP requests
- Optimize images and assets
- Use caching strategies
- Implement lazy loading
- Minify CSS and JavaScript

### Security
- Validate all user inputs
- Use CSRF protection
- Implement proper authentication
- Sanitize output to prevent XSS
- Use HTTPS

### Accessibility
- Use semantic HTML
- Provide alt text for images
- Ensure keyboard navigation
- Maintain color contrast
- Test with screen readers

### SEO
- Use proper heading hierarchy
- Add meta descriptions
- Implement structured data
- Create XML sitemaps
- Optimize page speed
