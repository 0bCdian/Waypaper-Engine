---
name: figma-integration
description: Guidelines for integrating Figma designs with development workflows using MCP servers and best practices
---

# Figma Integration Guidelines

You are an expert in integrating Figma designs with development workflows. Apply these guidelines when working with Figma designs and implementing them in code.

## Design-to-Code Workflow

### Extracting Design Information

- Identify component structure and hierarchy from Figma layers
- Extract color values, typography settings, and spacing values
- Note responsive behavior and breakpoint variations
- Document interactive states (hover, active, focus, disabled)
- Capture animation and transition specifications

### Component Mapping

- Map Figma components to code components
- Identify reusable patterns and shared styles
- Document variant properties and their code equivalents
- Note auto-layout settings for flexbox/grid implementation

## Implementation Guidelines

### Colors and Theming

- Extract color values in appropriate formats (hex, rgb, hsl)
- Map Figma color styles to CSS custom properties or theme tokens
- Ensure color contrast meets accessibility standards
- Implement dark mode variants when specified

### Typography

- Extract font families, weights, and sizes
- Map Figma text styles to CSS typography classes
- Implement responsive typography scaling
- Preserve line-height and letter-spacing values

### Spacing and Layout

- Convert Figma auto-layout to CSS Flexbox or Grid
- Extract padding and margin values
- Implement consistent spacing scale
- Handle responsive layout changes at breakpoints

### Components and Variants

- Create component variants matching Figma structure
- Implement interactive states consistently
- Document prop interfaces based on Figma properties
- Ensure component composition matches design intent

## Asset Handling

### Images and Icons

- Export images at appropriate resolutions (1x, 2x, 3x)
- Use SVG format for icons and simple graphics
- Implement lazy loading for large images
- Optimize file sizes for web performance

### Exporting Best Practices

- Use consistent naming conventions for exports
- Organize assets in logical folder structures
- Document asset usage and context
- Version control design assets appropriately

## Collaboration Workflow

### Design Handoff

- Review designs with designers before implementation
- Clarify ambiguous specifications
- Document implementation decisions and trade-offs
- Communicate technical constraints early

### Feedback Loop

- Provide implementation previews for design review
- Document deviations from original designs
- Iterate based on design feedback
- Maintain design-code consistency

## MCP Server Integration

### Setup and Configuration

When using Figma MCP servers with Cursor:

1. Navigate to Cursor Settings > Features > MCP
2. Click "+ Add New MCP Server"
3. Configure with appropriate name, type, and command/URL
4. Refresh tool list to populate available tools

### Available MCP Tools

- **Figma MCP Server**: Access design data directly from Figma
- **Figma Context MCP**: AI-driven design operations and asset management
- **html.to.design MCP**: Send HTML designs back to Figma
- **F2C MCP Server**: Convert Figma nodes to HTML/CSS markup

### Usage Guidelines

- MCP tools activate automatically when relevant in Composer Agent
- Explicitly request tools by name or describe their function
- Tool execution requires user approval before processing
- Ensure appropriate Figma access tokens are configured

## Quality Assurance

### Visual Comparison

- Compare implementation against Figma designs
- Check responsive behavior across breakpoints
- Verify interactive states and animations
- Test accessibility compliance

### Design Token Validation

- Verify color usage matches design specifications
- Check typography implementation accuracy
- Validate spacing and layout consistency
- Ensure component variants match Figma

## Figma API Usage

### Reading Design Data

```javascript
// Fetch file data
const file = await figma.getFile(fileKey);

// Get specific node
const node = await figma.getNode(fileKey, nodeId);

// Export images
const images = await figma.getImages(fileKey, {
  ids: [nodeId],
  format: 'svg',
  scale: 2
});
```

### Common Operations

- Fetch component libraries
- Export assets programmatically
- Read style definitions
- Access component variants

## Best Practices

- Always reference the source Figma file when implementing
- Maintain a component library that mirrors Figma structure
- Use design tokens for consistent theming
- Document any implementation limitations or trade-offs
- Keep Figma and code in sync during iterations
- Communicate proactively with design team about constraints
- Automate design token extraction when possible
