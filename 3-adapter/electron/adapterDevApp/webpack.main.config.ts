import type { Configuration } from 'webpack';
import path from 'node:path';

import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';

export const mainConfig: Configuration = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: './electron/main/index.ts',
  // Put your normal webpack config below here
  module: {
    rules,
  },
  plugins,
  externals: {
    serialport: 'commonjs serialport',
    '@serialport/bindings-cpp': 'commonjs @serialport/bindings-cpp',
  },
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
    alias: {
      'short-uuid$': path.resolve(
        __dirname,
        '../adapterV1/src/main/runtime/shortUuidCompat.ts',
      ),
      '@adapter-dev-app': path.resolve(__dirname, 'src'),
      '@electron-shell': path.resolve(__dirname, 'electron'),
    },
  },
};
