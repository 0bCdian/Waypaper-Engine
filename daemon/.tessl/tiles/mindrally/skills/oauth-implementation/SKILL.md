---
name: oauth-implementation
description: Guidelines for implementing OAuth 2.0 and OAuth 2.1 authentication flows with security best practices and PKCE
---

# OAuth Implementation

You are an expert in OAuth 2.0 and OAuth 2.1 implementation. Follow these guidelines when implementing OAuth authentication flows.

## Core Principles

- Always use OAuth 2.1 patterns (PKCE required, no implicit flow)
- Use HTTPS for all OAuth communications
- Implement proper state management for CSRF protection
- Follow the principle of least privilege for scopes
- Validate all tokens server-side

## OAuth 2.1 Key Requirements

OAuth 2.1 consolidates best practices and deprecates insecure patterns:

- PKCE is required for ALL clients using authorization code flow
- Implicit grant is removed
- Resource Owner Password Credentials grant is removed
- Redirect URIs must use exact string matching
- Refresh tokens must be sender-constrained or use rotation

## Authorization Code Flow with PKCE

### Step 1: Generate PKCE Parameters

```javascript
// Generate cryptographically secure code verifier
function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

// Create code challenge from verifier
async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(new Uint8Array(digest));
}

function base64URLEncode(buffer) {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
```

### Step 2: Authorization Request

```javascript
async function initiateOAuthFlow() {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateSecureRandomString();

  // Store for later verification
  sessionStorage.setItem('oauth_code_verifier', codeVerifier);
  sessionStorage.setItem('oauth_state', state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'openid profile email',
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  window.location.href = `${AUTHORIZATION_ENDPOINT}?${params}`;
}
```

### Step 3: Handle Callback and Token Exchange

```javascript
async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');

  // Check for errors
  if (error) {
    throw new Error(`OAuth error: ${error} - ${params.get('error_description')}`);
  }

  // Validate state to prevent CSRF
  const storedState = sessionStorage.getItem('oauth_state');
  if (state !== storedState) {
    throw new Error('Invalid state parameter - possible CSRF attack');
  }

  // Retrieve code verifier
  const codeVerifier = sessionStorage.getItem('oauth_code_verifier');

  // Exchange code for tokens
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    throw new Error('Token exchange failed');
  }

  const tokens = await response.json();

  // Clean up
  sessionStorage.removeItem('oauth_code_verifier');
  sessionStorage.removeItem('oauth_state');

  return tokens;
}
```

## Server-Side Implementation

### Confidential Client Token Exchange

```javascript
// Node.js/Express example
app.post('/oauth/callback', async (req, res) => {
  const { code, state } = req.body;

  // Validate state
  if (state !== req.session.oauthState) {
    return res.status(400).json({ error: 'Invalid state' });
  }

  try {
    const tokenResponse = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // Client authentication for confidential clients
        Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        code_verifier: req.session.codeVerifier,
      }),
    });

    const tokens = await tokenResponse.json();

    // Store tokens securely server-side
    req.session.accessToken = tokens.access_token;
    req.session.refreshToken = tokens.refresh_token;

    res.redirect('/dashboard');
  } catch (error) {
    res.status(500).json({ error: 'Token exchange failed' });
  }
});
```

## Token Security Best Practices

### Access Token Validation

```javascript
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const client = jwksClient({
  jwksUri: `${ISSUER}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 600000, // 10 minutes
});

function getSigningKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

async function validateToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getSigningKey,
      {
        audience: EXPECTED_AUDIENCE,
        issuer: EXPECTED_ISSUER,
        algorithms: ['RS256'], // Whitelist allowed algorithms
      },
      (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded);
      }
    );
  });
}
```

### Refresh Token Rotation

```javascript
async function refreshAccessToken(refreshToken) {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }),
  });

  if (!response.ok) {
    // Refresh token may be expired or revoked
    throw new Error('Refresh token invalid');
  }

  const tokens = await response.json();

  // If rotation is enabled, you'll receive a new refresh token
  // Store the new refresh token and invalidate the old one
  return tokens;
}
```

## Security Requirements

### Redirect URI Validation

```javascript
// Server-side: validate redirect URIs against whitelist
const ALLOWED_REDIRECT_URIS = [
  'https://myapp.com/callback',
  'https://myapp.com/oauth/callback',
];

function validateRedirectUri(uri) {
  // Exact string matching - no wildcards
  return ALLOWED_REDIRECT_URIS.includes(uri);
}
```

### Scope Management

```javascript
// Request minimum necessary scopes
const SCOPES = {
  basic: 'openid profile email',
  readOnly: 'openid profile email read:data',
  fullAccess: 'openid profile email read:data write:data',
};

// Validate scopes on the server
function validateScopes(requestedScopes, allowedScopes) {
  const requested = requestedScopes.split(' ');
  const allowed = allowedScopes.split(' ');
  return requested.every(scope => allowed.includes(scope));
}
```

## Common Vulnerabilities to Prevent

### 1. Authorization Code Injection

Always use PKCE - the code_verifier ensures only the original requester can exchange the code.

### 2. CSRF Attacks

```javascript
// Always use and validate the state parameter
const state = crypto.randomBytes(32).toString('hex');
// Store in session and validate on callback
```

### 3. Open Redirect

```javascript
// Never construct redirect URIs from user input
// Always use whitelisted URIs
const redirectUri = ALLOWED_REDIRECT_URIS[0]; // Don't: req.query.redirect_uri
```

### 4. Token Leakage

```javascript
// Never log tokens
console.log('User authenticated'); // Good
console.log(`Token: ${accessToken}`); // NEVER DO THIS

// Don't include tokens in URLs
// Use Authorization header instead
fetch('/api/resource', {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});
```

## Token Storage Recommendations

### Browser Applications

```javascript
// Option 1: Memory (most secure, but lost on refresh)
let accessToken = null;

// Option 2: HttpOnly cookies (requires backend)
// Set by server with appropriate flags
// Secure, HttpOnly, SameSite=Strict

// Option 3: sessionStorage (cleared when tab closes)
sessionStorage.setItem('access_token', token);

// Avoid localStorage for sensitive tokens
// Vulnerable to XSS attacks
```

### Server Applications

```javascript
// Store tokens encrypted in session or database
const encryptedToken = encrypt(accessToken, SESSION_ENCRYPTION_KEY);
req.session.encryptedAccessToken = encryptedToken;
```

## Error Handling

```javascript
const OAUTH_ERRORS = {
  invalid_request: 'The request is missing a required parameter',
  unauthorized_client: 'The client is not authorized',
  access_denied: 'The user denied the request',
  unsupported_response_type: 'The response type is not supported',
  invalid_scope: 'The requested scope is invalid',
  server_error: 'The authorization server encountered an error',
  temporarily_unavailable: 'The server is temporarily unavailable',
};

function handleOAuthError(error, errorDescription) {
  const message = OAUTH_ERRORS[error] || 'Unknown error';
  console.error(`OAuth Error: ${message}. Details: ${errorDescription}`);
  // Show user-friendly error message
}
```

## Testing Checklist

- [ ] PKCE flow works correctly
- [ ] State parameter is validated
- [ ] Invalid state is rejected
- [ ] Token expiration is handled
- [ ] Refresh token rotation works
- [ ] Invalid tokens are rejected
- [ ] Scopes are properly enforced
- [ ] Redirect URIs are validated
- [ ] Error cases are handled gracefully
