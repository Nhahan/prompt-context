const path = require('path');
const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');

module.exports = {
  target: 'node',
  mode: 'production',
  entry: './src/main.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'mcp-server.bundle.js',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      // Configuration for binary file handling
      {
        test: /\.node$/,
        use: 'node-loader',
        // Process binary files as external instead of including in bundle
        type: 'javascript/auto',
      },
    ],
  },
  // Increase bundle size limits
  performance: {
    hints: false,
    maxEntrypointSize: 512000,
    maxAssetSize: 512000,
  },
  // Bundle internal dependencies and exclude external ones
  externalsPresets: { node: true }, // Treat node.js built-in modules as external
  externals: [
    nodeExternals({
      // Important: externalize packages with native modules
      // No allowlist used
    }),
    // Explicitly externalize modules with .node extension
    /\.node$/,
  ],
  // No source maps generation
  devtool: false,
  // Disable node polyfills
  node: {
    __dirname: false,
    __filename: false,
  },
  plugins: [
    // Add executable file header
    new webpack.BannerPlugin({
      banner: '#!/usr/bin/env node',
      raw: true,
    }),
    // Suppress emitting of declaration files
    new webpack.DefinePlugin({
      'process.env.SUPPRESS_TS_DECLARATIONS': JSON.stringify('true'),
    }),
  ],
  optimization: {
    // Ensure we have a single output file
    runtimeChunk: false,
    splitChunks: false,
  },
};
