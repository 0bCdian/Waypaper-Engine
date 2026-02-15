---
name: pnpm
description: Best practices for pnpm package manager, workspace management, and monorepo configuration
---

# pnpm Development

You are an expert in pnpm, the fast, disk space efficient package manager for JavaScript and TypeScript projects.

## Core Principles

- Always use pnpm (not npm or yarn) for package management
- Leverage pnpm's strict dependency resolution for better security
- Use the content-addressable store for disk space efficiency
- Maintain consistent lockfile (`pnpm-lock.yaml`)

## Installation and Setup

- Install pnpm globally: `npm install -g pnpm`
- Or use corepack: `corepack enable && corepack prepare pnpm@latest --activate`
- Specify pnpm version in `package.json`:
  ```json
  {
    "packageManager": "pnpm@9.0.0"
  }
  ```

## Workspace Configuration

Create `pnpm-workspace.yaml` for monorepo setup:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'tooling/*'
```

- Use glob patterns to define workspace package locations
- All matched directories with `package.json` become workspace packages

## Dependency Management

- Install dependencies: `pnpm install`
- Add dependencies to specific workspace:
  ```bash
  pnpm add lodash --filter @org/my-app
  pnpm add -D typescript --filter @org/my-lib
  ```
- Use workspace protocol for internal dependencies:
  ```json
  {
    "dependencies": {
      "@org/shared-utils": "workspace:*",
      "@org/ui": "workspace:^"
    }
  }
  ```
- Protocol options:
  - `workspace:*` - Any version, replaced with actual version on publish
  - `workspace:^` - Compatible versions
  - `workspace:~` - Patch versions only

## Filtering Commands

Run commands in specific packages:

```bash
pnpm --filter @org/my-app dev
pnpm --filter "./apps/*" build
pnpm --filter "...@org/my-lib" test  # Include dependents
pnpm --filter "@org/my-lib..." build  # Include dependencies
```

- Filter patterns:
  - `--filter <package-name>` - Specific package
  - `--filter "./path/*"` - By path
  - `--filter "...<pkg>"` - Package and its dependents
  - `--filter "<pkg>..."` - Package and its dependencies

## Scripts and Task Running

- Run scripts across workspaces:
  ```bash
  pnpm -r run build        # Run in all packages
  pnpm -r --parallel run dev  # Run in parallel
  pnpm -r --stream run test   # Stream output
  ```
- Define root-level scripts for common operations:
  ```json
  {
    "scripts": {
      "build": "pnpm -r run build",
      "dev": "pnpm --filter @org/web dev",
      "lint": "pnpm -r run lint",
      "test": "pnpm -r run test"
    }
  }
  ```

## Dependency Hoisting

Configure hoisting in `.npmrc`:

```ini
# Strict mode - no hoisting
hoist=false

# Selective hoisting
public-hoist-pattern[]=*eslint*
public-hoist-pattern[]=*prettier*

# Shamefully hoist everything (not recommended)
shamefully-hoist=true
```

- Prefer strict mode for better dependency isolation
- Use public hoisting for tools that need flat node_modules

## Peer Dependencies

Configure peer dependency handling in `.npmrc`:

```ini
auto-install-peers=true
strict-peer-dependencies=false
```

- Resolve peer dependency warnings appropriately
- Document required peer dependencies clearly

## Overrides and Resolutions

Override dependencies in root `package.json`:

```json
{
  "pnpm": {
    "overrides": {
      "lodash": "^4.17.21",
      "foo@1.x": "npm:bar@^2.0.0"
    }
  }
}
```

- Use overrides to fix security vulnerabilities
- Pin problematic transitive dependencies

## Publishing Workspaces

- Configure publishable packages with proper fields
- Publish with `pnpm publish`
- Workspace protocol references are replaced with actual versions

## Performance Optimization

- Use `pnpm fetch` in Docker for better caching:
  ```dockerfile
  COPY pnpm-lock.yaml ./
  RUN pnpm fetch
  COPY . ./
  RUN pnpm install --offline
  ```
- Configure store location for CI caching
- Use `--frozen-lockfile` in CI environments

## Best Practices

- Always commit `pnpm-lock.yaml`
- Use `.npmrc` for consistent team configuration
- Prefer `workspace:*` for internal dependencies
- Keep root `package.json` minimal
- Use `pnpm dedupe` to optimize lockfile
- Audit regularly with `pnpm audit`
- Use `pnpm why <package>` to debug dependency issues
- Integrate with Turborepo or Nx for advanced task running
- Set `engine-strict=true` to enforce Node.js version requirements
