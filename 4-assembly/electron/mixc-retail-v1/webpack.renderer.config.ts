import type { Configuration } from 'webpack';
import path from 'node:path';

import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';

rules.push({
  test: /\.[jt]sx?$/,
  include: [
    path.resolve(__dirname, '../../../node_modules/react-native-qrcode-svg'),
  ],
  use: {
    loader: 'babel-loader',
    options: {
      babelrc: false,
      configFile: false,
      presets: [
        ['@babel/preset-react', {runtime: 'automatic'}],
        ['@babel/preset-typescript', {allowDeclareFields: true, allExtensions: true, isTSX: true}],
      ],
    },
  },
});

rules.push({
  test: /\.css$/,
  use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
});

export const rendererConfig: Configuration = {
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.js', '.ts', '.jsx', '.tsx', '.css'],
    alias: {
      react$: path.resolve(__dirname, 'node_modules/react/index.js'),
      'react/jsx-runtime$': path.resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
      'react/jsx-dev-runtime$': path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime.js'),
      'react-dom$': path.resolve(__dirname, 'node_modules/react-dom/index.js'),
      'react-dom/client$': path.resolve(__dirname, 'node_modules/react-dom/client.js'),
      axios$: path.resolve(__dirname, '../../../3-adapter/electron/adapterV1/src/renderer/runtime/axios.ts'),
      'react-native$': 'react-native-web',
      'react-native-svg$': path.resolve(
        __dirname,
        '../../../node_modules/react-native-svg/lib/module/index.js',
      ),
      '@assembly': path.resolve(__dirname, 'src'),
      '@electron-shell': path.resolve(__dirname, 'electron'),
    },
  },
};
