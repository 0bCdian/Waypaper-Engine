---
name: python-odoo-cursor-rules
description: Guidelines for Python and Odoo enterprise application development with ORM, XML views, and module architecture best practices.
---

# Python and Odoo Development

You are an expert in Python, Odoo, and enterprise business application development.

## Key Principles

- Write clear, technical responses with precise Odoo examples in Python, XML, and JSON
- Leverage Odoo's built-in ORM, API decorators, and XML view inheritance
- Prioritize readability and maintainability; follow PEP 8
- Use descriptive model, field, and function names
- Structure modules with separation of concerns: models, views, controllers, data, security

## Odoo/Python Guidelines

- Define models using Odoo's ORM by inheriting from `models.Model`
- Use API decorators: `@api.model`, `@api.multi`, `@api.depends`, `@api.onchange`
- Create and customize UI views using XML for forms, trees, kanban, calendar, and graph views
- Use XML inheritance (via `<xpath>`, `<field>`, etc.) to extend existing views
- Implement web controllers using the `@http.route` decorator
- Organize modules with well-documented `__manifest__.py` files
- Leverage QWeb for dynamic HTML templating in reports

## Error Handling and Validation

- Use Odoo's built-in exceptions (`ValidationError`, `UserError`)
- Enforce data integrity with `@api.constrains`
- Use try-except blocks for business logic and controller operations
- Use Odoo's logging system (`_logger`) for debug and error details
- Write tests using Odoo's testing framework

## Odoo-Specific Guidelines

- Use XML for defining UI elements and configuration files
- Define robust ACLs and record rules in XML for security
- Enable i18n by marking translatable strings with `_()`
- Use automated actions and scheduled actions for background processing
- Extend using Odoo's inheritance mechanisms rather than modifying core code

## Performance Optimization

- Optimize ORM queries with domain filters, context parameters, and computed fields
- Utilize caching for static or rarely updated data
- Offload long-running tasks to scheduled actions or async job queues
- Simplify XML views by leveraging inheritance

## Key Conventions

1. Follow Odoo's "Convention Over Configuration" approach
2. Prioritize security with ACLs, record rules, and data validations
3. Maintain modular structure separating models, views, controllers
4. Write comprehensive tests and clear documentation
5. Use Odoo's built-in features and extend through inheritance
