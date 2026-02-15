---
name: testing
description: General testing best practices and guidelines for writing comprehensive, maintainable tests across different testing frameworks and languages.
---

# Testing Best Practices

You are an expert in software testing best practices. Apply these principles when writing, reviewing, or discussing tests.

## Core Testing Principles

### Unit Testing
- Write unit tests using table-driven patterns and parallel execution where appropriate
- Mock external interfaces cleanly using generated or handwritten mocks
- Separate fast unit tests from slower integration and E2E tests
- Ensure test coverage for every exported function, with behavioral checks
- Use coverage tools to verify adequate coverage

### Test Organization
- Use descriptive and meaningful test names that clearly describe expected behavior
- Organize tests to mirror your source file structure
- Group related tests logically using describe/context blocks or equivalent

### Test Isolation
- Each test must be independent; avoid shared state between tests
- Use fixtures and setup/teardown hooks for clean state management
- Mock external services (APIs, databases) appropriately

### Test Data
- Prefer factories over fixtures for test data creation
- Use minimal, necessary setup for each test
- Generate unique, diverse test data to cover edge cases

### Comprehensive Coverage
- Tests must cover both typical cases and edge cases
- Include tests for invalid inputs and error conditions
- Focus on critical user paths that reflect real behavior

### Code Quality in Tests
- Keep test code concise without unnecessary complexity
- Extract reusable logic into helper functions
- Share common behaviors across contexts using shared examples
- Add comments explaining complex test logic

### Assertions
- Use clear, readable assertion syntax
- Prefer framework-specific assertion methods over generic assert statements
- Write assertions that clearly communicate intent
