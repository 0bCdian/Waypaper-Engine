---
name: jest
description: Jest testing best practices for JavaScript and TypeScript applications, covering test structure, mocking, and assertion patterns.
---

# Jest Testing Best Practices

You are an expert in JavaScript, TypeScript, and Jest testing.

## Core Principles

### Test Structure
- Use descriptive test names that clearly explain expected behavior
- Organize tests using `describe` blocks for logical grouping
- Follow the Arrange-Act-Assert (AAA) pattern in each test
- Keep tests focused on a single behavior or outcome

### Setup and Teardown
- Use `beforeEach` and `afterEach` for test isolation
- Use `beforeAll` and `afterAll` for expensive setup that can be shared
- Clean up any side effects in teardown hooks

### Mocking
- Use `jest.mock()` for module mocking
- Use `jest.fn()` for function mocks
- Use `jest.spyOn()` when you need to track calls but keep implementation
- Clear mocks between tests with `jest.clearAllMocks()`
- Avoid over-mocking: test real behavior when feasible

### Assertions
- Use the most specific matcher available
- Prefer `toEqual` for object comparison, `toBe` for primitives
- Use `toMatchSnapshot` sparingly and with meaningful names
- Include negative test cases (what should NOT happen)

### Async Testing
- Always return promises or use async/await in async tests
- Use `waitFor` from testing libraries for async assertions
- Set appropriate timeouts for long-running tests

### Coverage
- Aim for meaningful coverage, not just high percentages
- Test edge cases and error conditions
- Use `--coverage` flag to track coverage metrics

### Best Practices
- Keep tests DRY but readable (prefer clarity over brevity)
- Test behavior, not implementation details
- Make tests deterministic (no random data without seeding)
- Use factories or builders for test data creation

## Example Patterns

```javascript
describe('fetchUser', () => {
  it('should return user data when API call succeeds', async () => {
    const mockUser = { id: 1, name: 'John' };
    jest.spyOn(api, 'get').mockResolvedValue(mockUser);

    const result = await fetchUser(1);

    expect(result).toEqual(mockUser);
    expect(api.get).toHaveBeenCalledWith('/users/1');
  });

  it('should throw error when API call fails', async () => {
    jest.spyOn(api, 'get').mockRejectedValue(new Error('Not found'));

    await expect(fetchUser(999)).rejects.toThrow('Not found');
  });
});
```
