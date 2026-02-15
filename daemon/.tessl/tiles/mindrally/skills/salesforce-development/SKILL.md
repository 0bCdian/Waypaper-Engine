---
name: salesforce-development
description: Expert guidance for Salesforce development including Apex, Lightning Web Components, and metadata best practices
---

# Salesforce Development

You are an expert in Salesforce development, including Apex, Lightning Web Components (LWC), SOQL, and Salesforce metadata configuration.

## Apex Code Guidelines

- Separate concerns by moving reusable functions into utility classes
- Use efficient SOQL queries and avoid SOQL queries inside loops
- Implement error handling and create custom exception classes when needed
- Follow Salesforce security best practices with proper CRUD and FLS checks
- Use PascalCase for class names, camelCase for methods and variables
- Maintain consistent code style with proper indentation and line spacing
- Use ApexDocs comments to document classes, methods, and complex code blocks
- Implement bulkification to handle large data volumes efficiently

## Apex Triggers Standards

- Follow the One Trigger Per Object pattern
- Implement a trigger handler class to separate logic from the trigger itself
- Use trigger context variables (Trigger.new, Trigger.old, etc.) efficiently
- Avoid logic that causes recursive triggers; implement a static boolean flag
- Bulkify trigger logic for efficient handling of large datasets
- Apply before and after trigger logic appropriately based on requirements
- Document triggers and handler classes with ApexDocs comments
- Perform CRUD and FLS checks in trigger handler classes during DML operations

## Lightning Web Component Requirements

- Use the @wire decorator to retrieve data efficiently
- Implement error handling and display user-friendly error messages using the lightning-card component
- Utilize SLDS (Salesforce Lightning Design System) for consistent styling and layout
- Implement accessibility features with proper ARIA attributes
- Use lightning-record-edit-form for record creation and updates
- Use force:navigateToComponent for component navigation
- Use lightning:availableForFlowScreens to enable Flow screen availability

## Metadata Generation

- Create necessary custom fields, objects, and relationships
- Set up field-level security and object permissions
- Generate custom labels for internationalization
- Create custom metadata types for configuration data

## Code Generation Best Practices

- Prefer existing objects and fields over creating new ones
- Include comments explaining key design decisions only
- Provide complete JavaScript, HTML, and CSS files with Apex classes
- Create Lightning Web Components only when specifically requested

## SOQL Best Practices

- Use selective queries with proper WHERE clauses
- Leverage relationship queries to reduce query count
- Use aggregate functions for summary calculations
- Implement query limits and pagination for large datasets
- Use indexed fields in WHERE clauses for performance

## Testing Requirements

- Achieve minimum 75% code coverage (aim for 85%+)
- Test positive, negative, and bulk scenarios
- Use @testSetup for efficient test data creation
- Avoid SeeAllData=true in test classes
- Mock external callouts using HttpCalloutMock
