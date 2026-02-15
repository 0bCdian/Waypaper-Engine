---
name: vite
description: Expert guidance for Vite development with modern build tooling, HMR, framework integrations, and performance optimization
---

# Vite Development

You are an expert in Vite, modern JavaScript/TypeScript build tooling, and frontend development.

## Key Principles

- Leverage native ES modules for fast development
- Use Vite's opinionated defaults when possible
- Configure only what needs customization
- Understand the dev/build differences
- Optimize for both development speed and production performance

## Project Setup

### Basic Configuration
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
```

### Path Aliases
```typescript
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
});
```

## Environment Variables

### Usage
```typescript
// .env
VITE_API_URL=https://api.example.com
VITE_APP_TITLE=My App

// In code
const apiUrl = import.meta.env.VITE_API_URL;
const isDev = import.meta.env.DEV;
const isProd = import.meta.env.PROD;
const mode = import.meta.env.MODE;
```

### Type Definitions
```typescript
// src/vite-env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APP_TITLE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

## Hot Module Replacement

### Manual HMR
```typescript
// For libraries without HMR support
if (import.meta.hot) {
  import.meta.hot.accept('./module.ts', (newModule) => {
    // Handle the updated module
    console.log('Module updated:', newModule);
  });

  import.meta.hot.dispose(() => {
    // Cleanup before module is replaced
  });
}
```

## Asset Handling

### Static Assets
```typescript
// Import as URL
import imageUrl from './image.png';
// <img src={imageUrl} />

// Import as string (raw)
import shaderCode from './shader.glsl?raw';

// Import as worker
import Worker from './worker.ts?worker';
const worker = new Worker();
```

### Public Directory
```
public/
├── favicon.ico      # Served at /favicon.ico
├── robots.txt       # Served at /robots.txt
└── images/          # Served at /images/
```

## Framework Integrations

### React
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      // Enable Fast Refresh
      fastRefresh: true,
      // Babel plugins
      babel: {
        plugins: ['@emotion/babel-plugin'],
      },
    }),
  ],
});
```

### Vue
```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
});
```

### Svelte
```typescript
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
});
```

## Build Optimization

### Code Splitting
```typescript
// Dynamic imports create separate chunks
const AdminPanel = lazy(() => import('./AdminPanel'));

// Manual chunks
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          utils: ['lodash', 'date-fns'],
        },
      },
    },
  },
});
```

### Chunk Size Optimization
```typescript
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return id.split('node_modules/')[1].split('/')[0];
          }
        },
      },
    },
  },
});
```

## CSS Handling

### CSS Modules
```typescript
// styles.module.css is auto-detected
import styles from './styles.module.css';

// <div className={styles.container}>
```

### PostCSS
```javascript
// postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

### Preprocessors
```typescript
// Automatically handled with package installed
// npm install -D sass
import './styles.scss';
```

## Proxy Configuration

```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/socket.io': {
        target: 'ws://localhost:4000',
        ws: true,
      },
    },
  },
});
```

## Plugin Development

```typescript
// my-vite-plugin.ts
import type { Plugin } from 'vite';

export function myPlugin(): Plugin {
  return {
    name: 'my-plugin',

    // Hook: modify config
    config(config, { mode }) {
      return {
        define: {
          __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
        },
      };
    },

    // Hook: transform code
    transform(code, id) {
      if (id.endsWith('.md')) {
        return {
          code: `export default ${JSON.stringify(code)}`,
          map: null,
        };
      }
    },

    // Hook: configure dev server
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Custom middleware
        next();
      });
    },
  };
}
```

## Testing with Vitest

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

## SSR Configuration

```typescript
export default defineConfig({
  build: {
    ssr: true,
    rollupOptions: {
      input: './src/entry-server.ts',
    },
  },
  ssr: {
    external: ['express'],
    noExternal: ['my-ui-library'],
  },
});
```

## Library Mode

```typescript
export default defineConfig({
  build: {
    lib: {
      entry: './src/index.ts',
      name: 'MyLib',
      fileName: (format) => `my-lib.${format}.js`,
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
});
```

## Best Practices

- Use `vite preview` to test production builds locally
- Keep dependencies that support ESM in regular deps
- Use `optimizeDeps.include` for CommonJS dependencies
- Enable `build.sourcemap` for debugging production
- Use `server.warmup` for faster dev server starts
