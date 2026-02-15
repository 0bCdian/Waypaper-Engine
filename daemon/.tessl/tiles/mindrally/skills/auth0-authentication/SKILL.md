---
name: auth0-authentication
description: Guidelines for implementing Auth0 authentication with best practices for security, rules, actions, and SDK integration
---

# Auth0 Authentication

You are an expert in Auth0 authentication implementation. Follow these guidelines when working with Auth0 in any project.

## Core Principles

- Always use HTTPS for all Auth0 communications and callbacks
- Store sensitive configuration (client secrets, API keys) in environment variables, never in code
- Implement proper error handling for all authentication flows
- Follow the principle of least privilege for scopes and permissions

## Environment Variables

```bash
# Required Auth0 Configuration
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
AUTH0_AUDIENCE=your-api-audience
AUTH0_CALLBACK_URL=https://your-app.com/callback
AUTH0_LOGOUT_URL=https://your-app.com
```

## Authentication Flows

### Authorization Code Flow with PKCE (Recommended for SPAs and Native Apps)

Always use PKCE for public clients:

```javascript
import { Auth0Client } from '@auth0/auth0-spa-js';

const auth0 = new Auth0Client({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  authorizationParams: {
    redirect_uri: window.location.origin,
    audience: process.env.AUTH0_AUDIENCE,
  },
  cacheLocation: 'localstorage', // Use 'memory' for higher security
  useRefreshTokens: true,
});
```

### Authorization Code Flow (Server-Side Applications)

```javascript
// Express.js example
const { auth } = require('express-openid-connect');

app.use(
  auth({
    authRequired: false,
    auth0Logout: true,
    secret: process.env.AUTH0_SECRET,
    baseURL: process.env.BASE_URL,
    clientID: process.env.AUTH0_CLIENT_ID,
    issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  })
);
```

## Auth0 Actions Best Practices

Actions have replaced Rules. Follow these guidelines:

### Action Structure

```javascript
exports.onExecutePostLogin = async (event, api) => {
  // 1. Early returns for efficiency
  if (!event.user.email_verified) {
    api.access.deny('Please verify your email before logging in.');
    return;
  }

  // 2. Use secrets for sensitive data (configured in Auth0 Dashboard)
  const apiKey = event.secrets.EXTERNAL_API_KEY;

  // 3. Minimize external calls - they affect login latency
  // 4. Never log sensitive information
  console.log(`User logged in: ${event.user.user_id}`);

  // 5. Add custom claims sparingly
  api.idToken.setCustomClaim('https://myapp.com/roles', event.authorization?.roles || []);
  api.accessToken.setCustomClaim('https://myapp.com/roles', event.authorization?.roles || []);
};
```

### Action Security Rules

- Store secrets in Action Secrets, never hardcode them
- Limit the data sent to external services - never send the entire event object
- Use short timeouts for external API calls (default 20-second limit)
- Implement proper error handling to avoid authentication failures

## Token Management

### Access Token Best Practices

```javascript
// Always validate tokens server-side
const { auth, requiredScopes } = require('express-oauth2-jwt-bearer');

const checkJwt = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
  tokenSigningAlg: 'RS256',
});

// Require specific scopes
const checkScopes = requiredScopes('read:messages');

app.get('/api/private-scoped', checkJwt, checkScopes, (req, res) => {
  res.json({ message: 'Protected resource' });
});
```

### Refresh Token Configuration

- Enable refresh token rotation
- Set appropriate token lifetimes (access tokens: 1 hour max, refresh tokens: based on risk)
- Implement automatic token refresh in your client

## Security Best Practices

### CSRF Protection

```javascript
// State parameter is automatically handled by Auth0 SDKs
// For custom implementations, always validate the state parameter
const state = generateSecureRandomString();
sessionStorage.setItem('auth0_state', state);
```

### Redirect URI Security

- Whitelist all redirect URIs in Auth0 Dashboard
- Use exact string matching for redirect URIs
- Never use wildcard redirect URIs in production

### Session Management

```javascript
// Implement session timeouts
const sessionConfig = {
  absoluteDuration: 86400, // 24 hours
  inactivityDuration: 3600, // 1 hour of inactivity
};
```

## Multi-Factor Authentication

```javascript
// Enforce MFA for sensitive operations
exports.onExecutePostLogin = async (event, api) => {
  // Check if MFA has been completed
  if (!event.authentication?.methods?.find(m => m.name === 'mfa')) {
    // Trigger MFA challenge
    api.authentication.challengeWithAny([
      { type: 'otp' },
      { type: 'push-notification' },
    ]);
  }
};
```

## Error Handling

```javascript
try {
  await auth0.loginWithRedirect();
} catch (error) {
  if (error.error === 'access_denied') {
    // User denied access or email not verified
    handleAccessDenied(error);
  } else if (error.error === 'login_required') {
    // Session expired
    handleSessionExpired();
  } else {
    // Generic error handling
    console.error('Authentication error:', error.message);
    showUserFriendlyError();
  }
}
```

## MCP Integration

Auth0 provides an MCP server for AI-assisted development:

```bash
# Initialize Auth0 MCP server for Cursor
npx @auth0/auth0-mcp-server init --client cursor
```

This enables natural language Auth0 management operations within your IDE.

## Testing

- Use Auth0's test users for development
- Implement integration tests for authentication flows
- Test token expiration and refresh scenarios
- Verify MFA flows in staging environments

## Common Anti-Patterns to Avoid

1. Storing tokens in localStorage without considering XSS risks
2. Not validating tokens on the server side
3. Using the implicit flow (deprecated)
4. Hardcoding client secrets in frontend code
5. Not implementing proper logout (both local and Auth0 session)
6. Ignoring token expiration in API calls
7. Storing too much data in user metadata
