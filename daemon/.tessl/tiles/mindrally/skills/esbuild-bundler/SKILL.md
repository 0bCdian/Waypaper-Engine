---
name: esbuild-bundler
description: Best practices and guidelines for esbuild, the ultra-fast JavaScript and TypeScript bundler and minifier
---

# esbuild Bundler

You are an expert in esbuild, the extremely fast JavaScript and TypeScript bundler written in Go. Follow these guidelines when working with esbuild configurations.

## Core Principles

- esbuild is 10-100x faster than traditional bundlers
- Zero configuration needed for most use cases
- Native TypeScript and JSX support without additional setup
- Focus on speed while maintaining code quality
- Written in Go for native performance

## Project Structure

```
project/
├── src/
│   ├── index.ts          # Main entry point
│   ├── components/       # UI components
│   └── utils/            # Utility functions
├── dist/                 # Build output
├── esbuild.config.mjs    # Build script (optional)
├── tsconfig.json         # TypeScript config
└── package.json
```

## Basic Usage

### Command Line

```bash
# Basic bundle
esbuild src/index.ts --bundle --outfile=dist/bundle.js

# Production build
esbuild src/index.ts --bundle --minify --sourcemap --outfile=dist/bundle.js

# Watch mode
esbuild src/index.ts --bundle --watch --outfile=dist/bundle.js
```

### JavaScript API

```javascript
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  sourcemap: true,
  outfile: 'dist/bundle.js'
});
```

## TypeScript Configuration

### tsconfig.json Best Practices

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "isolatedModules": true,
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "verbatimModuleSyntax": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["src/**/*"]
}
```

### Important TypeScript Settings

- `isolatedModules: true` - Required for esbuild compatibility
- `esModuleInterop: true` - Better ESM compatibility
- `noEmit: true` - Let esbuild handle output, use tsc for type checking only

## Build Configuration

### Browser Build

```javascript
await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  sourcemap: true,
  target: ['chrome90', 'firefox88', 'safari14', 'edge90'],
  outfile: 'dist/bundle.js'
});
```

### Node.js Build

```javascript
await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/index.js'
});
```

### Multiple Entry Points

```javascript
await esbuild.build({
  entryPoints: ['src/index.ts', 'src/worker.ts'],
  bundle: true,
  outdir: 'dist',
  splitting: true,
  format: 'esm'
});
```

## Output Formats

### ESM (ES Modules)

```javascript
await esbuild.build({
  format: 'esm',
  // Outputs: import/export syntax
});
```

### CommonJS

```javascript
await esbuild.build({
  format: 'cjs',
  // Outputs: require/module.exports
});
```

### IIFE (Browser Scripts)

```javascript
await esbuild.build({
  format: 'iife',
  globalName: 'MyApp',
  // Outputs: self-executing function
});
```

## Loaders

### Built-in Loaders

```javascript
await esbuild.build({
  loader: {
    '.png': 'file',
    '.svg': 'text',
    '.json': 'json',
    '.woff': 'dataurl'
  }
});
```

### Loader Types

- `js` - JavaScript
- `ts` - TypeScript
- `jsx` - JavaScript with JSX
- `tsx` - TypeScript with JSX
- `json` - JSON data
- `text` - Plain text
- `file` - Copy file, return path
- `dataurl` - Inline as data URL
- `binary` - Inline as Uint8Array
- `base64` - Inline as base64
- `copy` - Copy file, no reference

## External Dependencies

### Mark as External

```javascript
await esbuild.build({
  external: ['react', 'react-dom', 'lodash']
});
```

### External Patterns

```javascript
await esbuild.build({
  external: ['*.png', '@aws-sdk/*']
});
```

## Code Splitting

```javascript
await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  splitting: true,
  format: 'esm',
  outdir: 'dist'
});
```

Note: Code splitting requires `format: 'esm'` and `outdir` (not `outfile`).

## Plugins

### Plugin Structure

```javascript
const myPlugin = {
  name: 'my-plugin',
  setup(build) {
    // On resolve - intercept import paths
    build.onResolve({ filter: /^env$/ }, args => ({
      path: args.path,
      namespace: 'env-ns'
    }));

    // On load - provide module contents
    build.onLoad({ filter: /.*/, namespace: 'env-ns' }, () => ({
      contents: JSON.stringify(process.env),
      loader: 'json'
    }));
  }
};

await esbuild.build({
  plugins: [myPlugin]
});
```

### Common Plugins

```javascript
import esbuildPluginTsc from 'esbuild-plugin-tsc';

await esbuild.build({
  plugins: [
    esbuildPluginTsc({
      force: true
    })
  ]
});
```

## Development Server

### Serve API

```javascript
const ctx = await esbuild.context({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outdir: 'dist'
});

await ctx.serve({
  servedir: 'dist',
  port: 3000
});
```

### Watch Mode

```javascript
const ctx = await esbuild.context({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/bundle.js'
});

await ctx.watch();
console.log('Watching for changes...');
```

## Environment Variables

### Define API

```javascript
await esbuild.build({
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.API_URL': JSON.stringify(process.env.API_URL)
  }
});
```

## Optimization

### Minification

```javascript
await esbuild.build({
  minify: true,
  // Or granular control:
  minifyWhitespace: true,
  minifyIdentifiers: true,
  minifySyntax: true
});
```

### Tree Shaking

```javascript
await esbuild.build({
  treeShaking: true,
  // Mark files as side-effect free
  ignoreAnnotations: false
});
```

### Drop Console and Debugger

```javascript
await esbuild.build({
  drop: ['console', 'debugger']
});
```

## Type Checking

esbuild does not perform type checking. Run TypeScript separately:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "npm run typecheck && node esbuild.config.mjs",
    "dev": "concurrently \"tsc --noEmit --watch\" \"node esbuild.config.mjs --watch\""
  }
}
```

## Build Script Example

```javascript
// esbuild.config.mjs
import * as esbuild from 'esbuild';

const isProduction = process.env.NODE_ENV === 'production';
const isWatch = process.argv.includes('--watch');

const config = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'browser',
  target: ['es2020'],
  format: 'esm',
  outdir: 'dist',
  sourcemap: !isProduction,
  minify: isProduction,
  splitting: true,
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  }
};

if (isWatch) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await esbuild.build(config);
  console.log('Build complete!');
}
```

## Best Practices

### Do

- Use `isolatedModules: true` in TypeScript config
- Run type checking separately with `tsc --noEmit`
- Use the context API for watch mode
- Leverage native TypeScript and JSX support
- Use external for peer dependencies in libraries

### Avoid

- Relying on esbuild for type checking
- Using features that require type information (decorators with metadata)
- Ignoring the `isolatedModules` requirement
- Over-configuring when defaults work

## Common Patterns

### Library Build

```javascript
await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  external: ['react', 'react-dom'],
  format: 'esm',
  outfile: 'dist/index.js',
  sourcemap: true
});
```

### Application Build

```javascript
await esbuild.build({
  entryPoints: ['src/index.tsx'],
  bundle: true,
  splitting: true,
  format: 'esm',
  outdir: 'dist',
  minify: true,
  sourcemap: true,
  target: ['chrome90', 'firefox88', 'safari14']
});
```

## Performance Tips

- esbuild parallelizes work automatically
- File system caching is built-in
- Use incremental builds in development
- Avoid unnecessary plugins that slow builds
