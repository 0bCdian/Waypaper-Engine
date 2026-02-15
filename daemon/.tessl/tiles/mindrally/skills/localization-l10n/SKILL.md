---
name: localization-l10n
description: Implement localization (l10n) best practices to adapt applications for specific regions, languages, and cultural preferences.
---

# Localization (l10n)

You are an expert in localization for web and mobile applications. Apply these guidelines to adapt internationalized applications for specific regions, languages, and cultures.

## Core Principles

- Localization (l10n) builds on internationalization (i18n)
- Ensure all user-facing text supports localization
- Adapt content for cultural appropriateness
- Respect regional conventions for dates, numbers, and currency
- Design for content that varies significantly between locales

## Localization Libraries

### Web Applications
- Use i18next and react-i18next for web applications
- Implement namespace-based translation organization
- Use libraries like react-intl or next-i18next for Next.js applications
- Leverage formatjs for ICU message format support

### Mobile Applications
- Use expo-localization for React Native apps
- Use react-native-i18n or expo-localization for internationalization and localization
- Support multiple languages with fallback mechanisms
- Handle device locale detection automatically

## Translation Management

### File Organization
```
locales/
  en-US/
    common.json
    legal.json
    marketing.json
  en-GB/
    common.json
    legal.json
    marketing.json
  es-ES/
    common.json
    legal.json
    marketing.json
  es-MX/
    common.json
    legal.json
    marketing.json
```

### Regional Variants
- Support regional language variants (en-US vs en-GB, es-ES vs es-MX)
- Implement fallback chains (es-MX -> es -> en)
- Handle spelling differences (color vs colour)
- Adapt terminology for regional preferences

## Locale-Specific Formatting

### Date and Time Formatting
```typescript
// Format dates according to locale
const formatDate = (date: Date, locale: string) => {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
};

// US: January 23, 2026
// UK: 23 January 2026
// Germany: 23. Januar 2026
```

### Number Formatting
```typescript
// Format numbers according to locale
const formatNumber = (num: number, locale: string) => {
  return new Intl.NumberFormat(locale).format(num);
};

// US: 1,234,567.89
// Germany: 1.234.567,89
// France: 1 234 567,89
```

### Currency Formatting
```typescript
// Format currency according to locale
const formatCurrency = (amount: number, locale: string, currency: string) => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency
  }).format(amount);
};

// US/USD: $1,234.56
// Germany/EUR: 1.234,56 EUR
// Japan/JPY: JPY 1,235
```

## Cultural Adaptation

### Content Localization
- Adapt imagery for cultural appropriateness
- Localize marketing content, not just translate
- Consider cultural sensitivities in color choices
- Adapt examples and references for local relevance

### Legal and Compliance
- Localize privacy policies and terms of service
- Adapt for regional legal requirements (GDPR, CCPA)
- Display appropriate regulatory information
- Handle region-specific disclaimers

## Layout and Typography

### Text Expansion
- Design for 30-50% text expansion from English
- Use flexible layouts that accommodate longer text
- Test with German (often longest) and Chinese (often shortest)
- Avoid fixed-width containers for text

### RTL Support
- Implement full RTL (right-to-left) support for Arabic, Hebrew, etc.
- Use CSS logical properties for directional layouts
- Mirror UI elements appropriately
- Handle bidirectional text (mixed LTR/RTL)

```css
/* Use logical properties for RTL support */
.card {
  margin-inline-start: 1rem;
  padding-inline-end: 0.5rem;
  text-align: start;
}
```

### Typography Considerations
- Use fonts that support required character sets
- Consider CJK (Chinese, Japanese, Korean) typography needs
- Support Arabic and other script-specific requirements
- Implement proper line breaking for different languages

## Regional Features

### Address Formats
- Adapt address forms for regional formats
- Support international phone number formats
- Handle postal/ZIP code validation by country
- Implement country-specific form validation

### Measurement Units
- Support metric and imperial units
- Display appropriate units based on locale
- Allow user preference override
- Convert values accurately

### Calendars and Time
- Support different calendar systems (Gregorian, Hijri, etc.)
- Handle timezone display preferences
- Support different week start days (Sunday vs Monday)
- Display appropriate date formats

## Testing and Quality Assurance

### Localization Testing
- Test with native speakers for each locale
- Verify layout with actual translated content
- Test all date, number, and currency formats
- Verify RTL layouts function correctly

### Automated Checks
- Implement missing translation detection
- Check for hardcoded strings in code
- Validate translation file format and completeness
- Monitor for translation quality issues

### Pseudolocalization
- Use pseudolocalization during development
- Detect hardcoded strings early
- Verify UI handles text expansion
- Test character encoding support

## Content Delivery

### Language Detection
- Detect user language from browser/device settings
- Support URL-based locale switching (/en/, /es/, /fr/)
- Persist user language preference
- Implement graceful fallback mechanisms

### Performance Optimization
- Lazy load translation files by namespace
- Cache translations appropriately
- Use CDN for static translation files
- Minimize initial translation bundle size

## Integration Best Practices

### State Management
- Store locale preference in user settings
- Sync preference across devices when logged in
- Handle locale changes without full page reload
- Update all components on locale switch

### API Integration
- Pass locale in API requests
- Return localized content from backend when appropriate
- Handle server-side locale negotiation
- Support content negotiation headers
