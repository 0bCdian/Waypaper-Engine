---
name: security-best-practices
description: Security best practices for backend development, microservices, and secure coding patterns with emphasis on input validation and authentication
---

# Security Best Practices

Apply these security principles when developing backend services, microservices, and any code handling sensitive data or external inputs.

## Input Validation and Sanitization

- Apply input validation and sanitization rigorously, especially on inputs from external sources
- Validate all user inputs at the boundary of your application
- Use allowlists over denylists when validating input
- Sanitize data before storing or displaying to prevent injection attacks
- Implement strict type checking and schema validation

## Authentication and Authorization

- Use secure defaults for JWT, cookies, and configuration settings
- Implement proper token expiration and refresh mechanisms
- Store secrets securely using environment variables or secret management services
- Never hardcode credentials or API keys in source code
- Use secure password hashing algorithms (bcrypt, Argon2)

## Permission Boundaries

- Isolate sensitive operations with clear permission boundaries
- Apply the principle of least privilege throughout the system
- Implement role-based access control (RBAC) where appropriate
- Audit and log access to sensitive resources
- Use separate service accounts for different components

## Resilience and Protection

- Implement retries, exponential backoff, and timeouts on all external calls
- Deploy circuit breakers and rate limiting for service protection
- Consider distributed rate-limiting to prevent abuse across services (e.g., using Redis)
- Implement request throttling to prevent denial of service
- Use connection pooling with appropriate limits

## Secure Configuration

- Use HTTPS/TLS for all network communications
- Configure secure HTTP headers (HSTS, CSP, X-Frame-Options)
- Disable verbose error messages in production
- Keep dependencies updated and scan for vulnerabilities
- Use secure defaults and fail securely

## Error Handling

- Implement comprehensive error handling throughout the application
- Never expose stack traces or internal details to end users
- Log security-relevant events with appropriate detail
- Propagate context appropriately for debugging while maintaining security
- Handle authentication and authorization failures gracefully

## Secrets Management

- Use environment variables or dedicated secrets managers
- Rotate credentials and keys regularly
- Implement proper key management practices
- Avoid logging sensitive information
- Use encryption at rest for sensitive data storage

## SQL Injection Prevention

- Use parameterized queries or prepared statements
- Never concatenate user input into SQL queries
- Use ORM features that automatically escape values
- Validate and sanitize all database inputs
- Limit database user permissions

## Cross-Site Scripting (XSS) Prevention

- Escape all output rendered in HTML
- Use Content Security Policy headers
- Sanitize user-generated content before display
- Use framework-provided escaping functions
- Avoid innerHTML and similar dangerous APIs

## Cross-Site Request Forgery (CSRF) Prevention

- Implement CSRF tokens for state-changing operations
- Verify origin and referer headers
- Use SameSite cookie attribute
- Require re-authentication for sensitive actions
- Implement proper session management

## API Security

- Implement API authentication (JWT, API keys, OAuth)
- Use rate limiting to prevent abuse
- Validate request content types
- Implement request size limits
- Log API access for auditing

## Dependency Security

- Regularly audit dependencies for vulnerabilities
- Use lockfiles to ensure consistent versions
- Remove unused dependencies
- Monitor security advisories for your stack
- Implement automated vulnerability scanning in CI/CD
