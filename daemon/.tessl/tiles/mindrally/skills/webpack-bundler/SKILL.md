---
name: webpack-bundler
description: Best practices and guidelines for Webpack module bundler configuration, optimization, and development workflows
---

# Webpack Bundler

You are an expert in Webpack, the powerful module bundler for JavaScript applications. Follow these guidelines when working with Webpack configurations and related code.

## Core Principles

- Webpack is a static module bundler that builds a dependency graph from entry points
- Focus on optimal bundle size, build performance, and developer experience
- Use Webpack 5+ features for best practices and performance
- Understand the plugin and loader ecosystem

## Project Structure

```
project/
├── src/
│   ├── index.js          # Main entry point
│   ├── components/       # UI components
│   ├── utils/            # Utility functions
│   ├── styles/           # CSS/SCSS files
│   └── assets/           # Images, fonts, etc.
├── dist/                 # Build output (gitignored)
├── webpack.config.js     # Main configuration
├── webpack.dev.js        # Development config
├── webpack.prod.js       # Production config
└── package.json
```

## Configuration Best Practices

### Entry and Output

```javascript
module.exports = {
  entry: {
    main: './src/index.js',
    vendor: './src/vendor.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
    clean: true
  }
};
```

### Mode Configuration

```javascript
module.exports = {
  mode: 'production', // or 'development'
  // production mode enables tree-shaking, minification, and optimizations
};
```

## Code Splitting

### Dynamic Imports

```javascript
// Use dynamic imports for on-demand loading
const module = await import('./heavy-module.js');

// With React
const LazyComponent = React.lazy(() => import('./LazyComponent'));
```

### SplitChunks Configuration

```javascript
optimization: {
  splitChunks: {
    chunks: 'all',
    cacheGroups: {
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendors',
        chunks: 'all'
      }
    }
  }
}
```

## Tree Shaking

### Enable Tree Shaking

1. Use ES6 module syntax (import/export)
2. Set `mode: 'production'`
3. Configure `sideEffects` in package.json

```json
{
  "sideEffects": false
}
```

Or specify files with side effects:

```json
{
  "sideEffects": ["*.css", "*.scss"]
}
```

### Babel Configuration for Tree Shaking

```json
{
  "presets": [
    ["@babel/preset-env", { "modules": false }]
  ]
}
```

## Loaders

### Common Loader Configuration

```javascript
module: {
  rules: [
    {
      test: /\.jsx?$/,
      exclude: /node_modules/,
      use: 'babel-loader'
    },
    {
      test: /\.tsx?$/,
      exclude: /node_modules/,
      use: 'ts-loader'
    },
    {
      test: /\.css$/,
      use: ['style-loader', 'css-loader']
    },
    {
      test: /\.scss$/,
      use: ['style-loader', 'css-loader', 'sass-loader']
    },
    {
      test: /\.(png|svg|jpg|jpeg|gif)$/i,
      type: 'asset/resource'
    }
  ]
}
```

## Plugins

### Essential Plugins

```javascript
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

plugins: [
  new HtmlWebpackPlugin({
    template: './src/index.html'
  }),
  new MiniCssExtractPlugin({
    filename: '[name].[contenthash].css'
  }),
  // Use for bundle analysis
  new BundleAnalyzerPlugin()
]
```

## Performance Optimization

### Bundle Size Optimization

- Use `webpack-bundle-analyzer` to identify large dependencies
- Enable tree shaking to remove unused code
- Replace large dependencies with smaller alternatives
- Enable Gzip or Brotli compression

### Build Performance

```javascript
module.exports = {
  cache: {
    type: 'filesystem'
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  }
};
```

### Production Optimization

```javascript
optimization: {
  minimize: true,
  minimizer: [
    new TerserPlugin({
      parallel: true
    }),
    new CssMinimizerPlugin()
  ],
  moduleIds: 'deterministic',
  runtimeChunk: 'single'
}
```

## Development Server

```javascript
devServer: {
  static: './dist',
  hot: true,
  port: 3000,
  historyApiFallback: true,
  proxy: {
    '/api': 'http://localhost:8080'
  }
}
```

## Environment Variables

```javascript
const webpack = require('webpack');

plugins: [
  new webpack.DefinePlugin({
    'process.env.API_URL': JSON.stringify(process.env.API_URL)
  })
]
```

## Common Anti-Patterns to Avoid

- Do not bundle everything into a single file
- Avoid importing entire libraries when only specific functions are needed
- Do not skip source maps in development
- Avoid hardcoding environment-specific values
- Do not ignore bundle size warnings

## Testing and Debugging

- Use source maps for debugging (`devtool: 'source-map'`)
- Analyze bundles regularly with `webpack-bundle-analyzer`
- Test production builds locally before deployment
- Use `stats` option to understand build output

## Security Considerations

- Keep Webpack and plugins up to date
- Validate and sanitize all user inputs
- Use Content Security Policy headers
- Avoid exposing sensitive data in bundles

## Integration with CI/CD

- Cache node_modules and Webpack cache
- Run production builds with `--mode production`
- Fail builds on bundle size budget violations
- Generate and store bundle analysis reports
