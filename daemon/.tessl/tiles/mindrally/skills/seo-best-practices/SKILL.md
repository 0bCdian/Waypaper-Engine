---
name: seo-best-practices
description: Apply SEO best practices for web applications including metadata, performance optimization, and search engine optimization techniques.
---

# SEO Best Practices

You are an expert in SEO (Search Engine Optimization) for modern web applications. Apply these guidelines when building web applications to ensure optimal search engine visibility and ranking.

## Core SEO Principles

- Write semantic HTML to improve accessibility and SEO
- Implement proper metadata and structured data
- Optimize for Core Web Vitals (LCP, CLS, FID)
- Use server-side rendering (SSR) for better crawlability
- Create meaningful, descriptive URLs

## Metadata Implementation

### Next.js Applications
- Use the built-in `metadata` object or `generateMetadata` function for dynamic SEO
- Implement Open Graph and Twitter Card meta tags
- Create dynamic metadata based on page content
- Include canonical URLs to prevent duplicate content issues

### Nuxt.js Applications
- Use `useHead` and `useSeoMeta` composables for SEO metadata
- Implement SEO best practices using Nuxt's built-in composables
- Leverage auto-generated meta tags where appropriate

## Technical SEO Requirements

### Performance Optimization
- Minimize 'use client', 'useEffect', and 'setState'; favor React Server Components (RSC)
- Wrap client components in Suspense with fallback
- Use dynamic loading for non-critical components
- Optimize images: use WebP format, include size data, implement lazy loading
- Implement proper caching strategies

### Content Structure
- Use proper heading hierarchy (h1-h6)
- Include descriptive alt text for all images
- Create meaningful link text (avoid "click here")
- Implement structured data (JSON-LD) for rich snippets
- Use semantic HTML elements (header, main, nav, article, section, aside, footer)

### URL and Routing
- Use lowercase with dashes for URLs (kebab-case)
- Create descriptive, keyword-rich URLs
- Implement proper 301 redirects for moved content
- Create XML sitemaps and robots.txt
- Use canonical tags for duplicate content

### Mobile and Accessibility
- Design mobile-first responsive layouts
- Ensure sufficient color contrast for text
- Provide keyboard navigation for interactive elements
- Implement ARIA labels where semantic HTML is insufficient
- Ensure fast loading on mobile networks

## Image SEO

- Always include descriptive alt text for images
- Use appropriate image formats (WebP preferred)
- Implement lazy loading for below-the-fold images
- Include width and height attributes to prevent layout shift
- Use descriptive file names for images
- Implement responsive images with srcset

## Content Guidelines

- Write unique, valuable content for each page
- Include target keywords naturally in content
- Create compelling meta titles (50-60 characters)
- Write engaging meta descriptions (150-160 characters)
- Use internal linking to establish content hierarchy
- Keep content fresh and regularly updated

## Monitoring and Testing

- Use Lighthouse for performance and SEO audits
- Monitor Core Web Vitals in Search Console
- Test with Google's Mobile-Friendly Test
- Validate structured data with Rich Results Test
- Regularly check for crawl errors and broken links
