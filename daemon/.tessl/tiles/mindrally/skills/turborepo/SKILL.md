---
name: turborepo
description: Best practices for Turborepo monorepo build system configuration and optimization
---

# Turborepo Development

You are an expert in Turborepo, the high-performance build system for JavaScript and TypeScript monorepos.

## Project Structure

- Organize workspaces following the standard Turborepo structure:
  - `apps/` - Application workspaces (web apps, APIs, mobile apps)
  - `packages/` - Shared packages (UI components, utilities, configs)
  - `tooling/` - Build tools and configurations (optional)
- Keep the root `package.json` minimal with workspace configuration
- Use consistent naming conventions across all workspaces

## Workspace Configuration

- Define workspaces in the root `package.json`:
  ```json
  {
    "workspaces": ["apps/*", "packages/*"]
  }
  ```
- Each workspace should have its own `package.json` with proper dependencies
- Use internal package references with workspace protocol: `"@repo/ui": "workspace:*"`

## turbo.json Configuration

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "test": {
      "dependsOn": ["build"]
    }
  }
}
```

- Use `^` prefix for topological dependencies (build dependencies first)
- Define proper `outputs` for caching
- Mark development tasks with `cache: false` and `persistent: true`

## Caching Strategy

- Configure remote caching for CI/CD with Vercel or self-hosted solutions
- Define accurate `outputs` arrays to ensure proper cache hits
- Use `inputs` to specify which files affect task caching
- Exclude cache directories from outputs (e.g., `!.next/cache/**`)

## Task Dependencies

- Use `dependsOn` to define task relationships:
  - `"^build"` - Run build in dependencies first
  - `"lint"` - Run lint in the same package
  - `"@repo/ui#build"` - Run build in a specific package
- Define proper task ordering for complex build pipelines

## Shared Configurations

- Create shared config packages:
  - `@repo/typescript-config` - Shared TypeScript configurations
  - `@repo/eslint-config` - Shared ESLint configurations
  - `@repo/tailwind-config` - Shared Tailwind configurations
- Reference configs using `extends` or imports in workspace configs

## Development Workflow

- Use `turbo dev` to run development servers across workspaces
- Filter commands to specific workspaces: `turbo build --filter=web`
- Use `--filter` with patterns: `turbo build --filter=./apps/*`
- Watch mode with `turbo watch` for continuous builds

## CI/CD Integration

- Enable remote caching in CI for faster builds
- Use `--dry-run` to preview what would be executed
- Implement proper environment variable handling with `globalEnv` and `env`
- Set up GitHub Actions or other CI with Turborepo caching

## Best Practices

- Keep task definitions consistent across similar workspaces
- Use workspace-level `turbo.json` for package-specific overrides
- Minimize root-level dependencies; install in workspaces that need them
- Document workspace purposes and relationships in README files
- Use TypeScript project references for faster type checking
- Implement incremental builds for large codebases
