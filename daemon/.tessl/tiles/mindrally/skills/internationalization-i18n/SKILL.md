---
name: internationalization-i18n
description: Implement internationalization (i18n) best practices for web and mobile applications to support multiple languages and locales.
---

# Internationalization (i18n)

You are an expert in internationalization for web and mobile applications. Apply these guidelines to ensure applications can be easily adapted for different languages, regions, and cultures.

## Core Principles

- Write concise, technical TypeScript code with accurate examples
- Use functional and declarative programming patterns; avoid classes
- Ensure all user-facing text is internationalized and supports localization
- Use descriptive variable names with auxiliary verbs (isLoading, hasError)
- Design for text expansion (some languages require 30-50% more space)

## Web Application i18n

### React/Next.js Applications
- Use i18next and react-i18next for web applications
- Implement namespace-based translation organization
- Use interpolation for dynamic values in translations
- Leverage pluralization features for count-based text
- Implement context-based translations where needed

### Implementation Pattern
```typescript
// Use translation hooks
const { t } = useTranslation('common');

// Basic translation
<h1>{t('welcome.title')}</h1>

// With interpolation
<p>{t('greeting', { name: userName })}</p>

// With pluralization
<span>{t('items', { count: itemCount })}</span>
```

### Nuxt.js Applications
- Use @nuxtjs/i18n module for Vue applications
- Implement SEO best practices with localized routes
- Use `useI18n` composable for translations
- Leverage lazy loading for translation files

## React Native/Expo Applications

### Mobile i18n Setup
- Use expo-localization for React Native apps
- Use react-native-i18n or i18n-js for translations
- Detect device locale automatically
- Support fallback languages

### Mobile-Specific Considerations
- Support RTL (right-to-left) layouts
- Ensure proper text scaling for accessibility
- Handle device locale changes dynamically
- Test on devices with different system languages

## Translation File Organization

### File Structure
```
locales/
  en/
    common.json
    auth.json
    errors.json
  es/
    common.json
    auth.json
    errors.json
  fr/
    common.json
    auth.json
    errors.json
```

### Translation Keys Best Practices
- Use descriptive, hierarchical keys (e.g., `auth.login.button`, `errors.network.timeout`)
- Avoid embedding HTML in translations when possible
- Keep translations context-aware and meaningful
- Document translation context for translators

## Locale-Aware Formatting

### Date and Time
- Use Intl.DateTimeFormat for date formatting
- Respect user's locale preferences
- Store dates in UTC, display in local timezone
- Support multiple date format preferences

### Numbers and Currency
- Use Intl.NumberFormat for number formatting
- Display currency in user's preferred format
- Handle decimal and thousand separators by locale
- Support right-to-left number display where needed

### Sorting and Comparison
- Use Intl.Collator for locale-aware string comparison
- Implement locale-specific sorting rules
- Handle diacritics and special characters correctly

## RTL (Right-to-Left) Support

### Layout Considerations
- Use CSS logical properties (margin-inline-start, padding-inline-end)
- Implement bidirectional text support
- Mirror UI layouts for RTL languages
- Test thoroughly with RTL languages (Arabic, Hebrew, etc.)

### Implementation
```css
/* Use logical properties */
.element {
  margin-inline-start: 1rem;
  padding-inline-end: 0.5rem;
}
```

## Best Practices

### Development Guidelines
- Never hardcode user-facing strings
- Extract all text to translation files
- Use ICU message format for complex translations
- Implement fallback mechanisms for missing translations
- Support language switching without page reload

### Content Considerations
- Avoid text in images; use CSS/SVG text when possible
- Design flexible layouts that accommodate text expansion
- Use icons with text labels, not icons alone
- Consider cultural differences in imagery and color

### Testing Requirements
- Test with pseudolocalization during development
- Verify text doesn't overflow containers
- Test with actual translations before release
- Verify RTL layout with native speakers
- Test currency and date formats across locales

## State Management for i18n

### Storing User Preferences
- Use Zustand or React Context for language state
- Persist language preference (localStorage, AsyncStorage)
- Sync language preference with user account
- Handle server-side rendering with correct locale

### Data Fetching
- Use TanStack React Query for caching translated content
- Invalidate queries on language change when needed
- Fetch locale-specific content from APIs
- Handle translation loading states gracefully

## Error Handling

- Provide translated error messages
- Implement fallback to default language for missing translations
- Log missing translation keys in development
- Handle RTL/LTR text direction in error displays
- Use Zod for runtime validation with localized error messages
