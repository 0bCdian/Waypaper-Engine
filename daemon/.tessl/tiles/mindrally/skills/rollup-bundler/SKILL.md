---
name: rollup-bundler
description: Best practices and guidelines for Rollup.js module bundler configuration, ES modules, and library bundling
---

# Rollup Bundler

You are an expert in Rollup.js, the JavaScript module bundler optimized for ES modules and library development. Follow these guidelines when working with Rollup configurations.

## Core Principles

- Rollup is designed for ES modules and produces cleaner, smaller bundles
- Superior tree-shaking through deep execution path analysis
- Ideal for libraries and packages that will be consumed by other projects
- Focus on producing efficient, readable output code

## Project Structure

```
project/
├── src/
│   ├── index.js          # Main entry point
│   ├── modules/          # Internal modules
│   └── utils/            # Utility functions
├── dist/                 # Build output
│   ├── bundle.esm.js     # ES module format
│   ├── bundle.cjs.js     # CommonJS format
│   └── bundle.umd.js     # UMD format
├── rollup.config.mjs     # Configuration file
└── package.json
```

## Configuration Basics

### Basic Configuration

```javascript
// rollup.config.mjs
export default {
  input: 'src/index.js',
  output: {
    file: 'dist/bundle.js',
    format: 'esm',
    sourcemap: true
  }
};
```

### Multiple Output Formats

```javascript
export default {
  input: 'src/index.js',
  output: [
    {
      file: 'dist/bundle.esm.js',
      format: 'esm',
      sourcemap: true
    },
    {
      file: 'dist/bundle.cjs.js',
      format: 'cjs',
      sourcemap: true
    },
    {
      file: 'dist/bundle.umd.js',
      format: 'umd',
      name: 'MyLibrary',
      sourcemap: true
    }
  ]
};
```

## Output Formats

### ES Modules (esm)

- Keeps bundle as ES module file
- Best for modern bundlers and browsers
- Supports tree-shaking in consuming projects

### CommonJS (cjs)

- For Node.js environments
- Compatible with require() syntax

### UMD (Universal Module Definition)

- Works as AMD, CJS, and IIFE
- Best for libraries that need broad compatibility

### IIFE (Immediately Invoked Function Expression)

- Self-executing function
- Suitable for script tags in browsers

## ES Modules Best Practices

### Use Named Exports

```javascript
// Prefer named exports for better tree-shaking
export const add = (a, b) => a + b;
export const subtract = (a, b) => a - b;

// Avoid default exports when possible
// export default { add, subtract }; // Less tree-shakeable
```

### Static Imports

```javascript
// Static imports enable tree-shaking
import { specificFunction } from './utils';

// Avoid dynamic requires in library code
// const utils = require('./utils'); // CommonJS - no tree-shaking
```

## Essential Plugins

### Node Resolve

```javascript
import resolve from '@rollup/plugin-node-resolve';

export default {
  plugins: [
    resolve({
      browser: true,
      preferBuiltins: false
    })
  ]
};
```

### CommonJS Conversion

```javascript
import commonjs from '@rollup/plugin-commonjs';

export default {
  plugins: [
    commonjs()
  ]
};
```

### Babel Transpilation

```javascript
import babel from '@rollup/plugin-babel';

export default {
  plugins: [
    babel({
      babelHelpers: 'bundled',
      presets: ['@babel/preset-env']
    })
  ]
};
```

### TypeScript Support

```javascript
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/index.ts',
  plugins: [
    typescript({
      tsconfig: './tsconfig.json'
    })
  ]
};
```

### Minification

```javascript
import terser from '@rollup/plugin-terser';

export default {
  plugins: [
    terser()
  ]
};
```

### Environment Variables

```javascript
import replace from '@rollup/plugin-replace';

export default {
  plugins: [
    replace({
      preventAssignment: true,
      'process.env.NODE_ENV': JSON.stringify('production')
    })
  ]
};
```

## External Dependencies

### Marking Dependencies as External

```javascript
export default {
  input: 'src/index.js',
  external: ['react', 'react-dom', 'lodash'],
  output: {
    file: 'dist/bundle.js',
    format: 'esm',
    globals: {
      react: 'React',
      'react-dom': 'ReactDOM'
    }
  }
};
```

### Peer Dependencies Pattern

```javascript
import pkg from './package.json';

export default {
  external: [
    ...Object.keys(pkg.peerDependencies || {}),
    ...Object.keys(pkg.dependencies || {})
  ]
};
```

## Code Splitting

### Multiple Entry Points

```javascript
export default {
  input: {
    main: 'src/index.js',
    utils: 'src/utils/index.js'
  },
  output: {
    dir: 'dist',
    format: 'esm'
  }
};
```

### Dynamic Imports

```javascript
// Rollup handles dynamic imports automatically
async function loadModule() {
  const module = await import('./heavy-module.js');
  return module.default;
}
```

## Tree Shaking Optimization

### Pure Function Annotations

```javascript
// Mark functions as pure for better tree-shaking
export const compute = /*#__PURE__*/ createCompute();
```

### Side Effects Configuration

```json
{
  "name": "my-library",
  "sideEffects": false
}
```

## Watch Mode

```javascript
// rollup.config.mjs
export default {
  watch: {
    include: 'src/**',
    clearScreen: false
  }
};
```

Command line:

```bash
rollup -c -w
```

## Package.json Configuration

```json
{
  "name": "my-library",
  "version": "1.0.0",
  "main": "dist/bundle.cjs.js",
  "module": "dist/bundle.esm.js",
  "browser": "dist/bundle.umd.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/bundle.esm.js",
      "require": "./dist/bundle.cjs.js"
    }
  },
  "files": ["dist"],
  "sideEffects": false
}
```

## Best Practices

### Do

- Use ES6 module syntax consistently
- Mark third-party dependencies as external
- Generate source maps for debugging
- Use named exports for better tree-shaking
- Test all output formats
- Use watch mode during development

### Avoid

- Bundling peer dependencies
- Using CommonJS modules when ES modules are available
- Ignoring bundle size
- Skipping TypeScript declaration files for libraries

## Common Configuration Patterns

### Library Configuration

```javascript
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import pkg from './package.json';

export default {
  input: 'src/index.ts',
  external: Object.keys(pkg.peerDependencies || {}),
  plugins: [
    resolve(),
    commonjs(),
    typescript({ tsconfig: './tsconfig.json' }),
    terser()
  ],
  output: [
    { file: pkg.main, format: 'cjs', sourcemap: true },
    { file: pkg.module, format: 'esm', sourcemap: true }
  ]
};
```

## Debugging and Analysis

- Use `--configDebug` flag for configuration debugging
- Generate source maps for all formats
- Use rollup-plugin-visualizer for bundle analysis
- Check output code readability
