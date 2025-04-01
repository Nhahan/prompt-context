const path = require('path');
const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');

module.exports = {
  target: 'node',
  mode: 'production',
  entry: './src/__tests__/test-mcp.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'mcp-server.test.bundle.js',
    clean: false,
  },
  resolve: {
    extensions: ['.js', '.ts'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.node$/,
        use: 'node-loader',
        type: 'javascript/auto',
      },
    ],
  },
  performance: {
    hints: false,
    maxEntrypointSize: 512000,
    maxAssetSize: 512000,
  },
  externals: [nodeExternals(), /\.node$/],
  devtool: false,
  node: {
    __dirname: false,
    __filename: false,
  },
  plugins: [
    new webpack.BannerPlugin({
      banner: '#!/usr/bin/env node',
      raw: true,
    }),
  ],
};
