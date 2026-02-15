---
name: cypress
description: Cypress end-to-end testing best practices for web applications, covering test structure, commands, and reliability patterns.
---

# Cypress Testing Best Practices

You are an expert in Cypress end-to-end testing.

## Core Principles

### Test Structure
- Use descriptive test names that clearly explain expected behavior
- Organize tests by feature or user flow
- Keep tests focused on critical user paths
- Follow the Given-When-Then pattern for clarity

### Selecting Elements
- Prefer `data-testid` or `data-cy` attributes for test selectors
- Use `cy.contains()` for text-based selection when appropriate
- Avoid brittle selectors like CSS classes or tag hierarchies

```javascript
// Recommended
cy.get('[data-testid="submit-button"]').click();
cy.contains('Submit').click();

// Avoid
cy.get('.btn-primary').click();
```

### Commands and Assertions
- Chain commands fluently for readability
- Use built-in retry-ability; avoid explicit waits
- Prefer `.should()` assertions over `.then()` for automatic retries
- Use `.within()` to scope commands to a specific element

### Custom Commands
- Create custom commands for repeated actions
- Place custom commands in `cypress/support/commands.js`
- Document custom commands with JSDoc comments

```javascript
Cypress.Commands.add('login', (email, password) => {
  cy.session([email, password], () => {
    cy.visit('/login');
    cy.get('[data-testid="email"]').type(email);
    cy.get('[data-testid="password"]').type(password);
    cy.get('[data-testid="submit"]').click();
    cy.url().should('include', '/dashboard');
  });
});
```

### Handling Async Operations
- Cypress commands are automatically queued; don't mix with async/await
- Use `cy.intercept()` to mock or wait for network requests
- Use `cy.wait()` with aliases, not arbitrary timeouts

```javascript
cy.intercept('GET', '/api/users').as('getUsers');
cy.visit('/users');
cy.wait('@getUsers');
cy.get('[data-testid="user-list"]').should('be.visible');
```

### Test Isolation
- Each test should be independent and repeatable
- Use `beforeEach` hooks for setup
- Use `cy.session()` for efficient authentication

### Anti-Patterns to Avoid
- Using `cy.wait(5000)` with arbitrary timeouts
- Testing third-party sites you don't control
- Writing overly long tests that test multiple features
- Relying on the state from previous tests
