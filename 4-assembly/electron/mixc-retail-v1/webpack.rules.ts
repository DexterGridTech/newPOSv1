import type { ModuleOptions } from 'webpack';

export const rules: Required<ModuleOptions>['rules'] = [
  // Add support for native node modules
  {
    // We're specifying native_modules in the test because the asset relocator loader generates a
    // "fake" .node file which is really a cjs file.
    test: /native_modules[/\\].+\.node$/,
    use: 'node-loader',
  },
  {
    test: /[/\\]node_modules[/\\].+\.(m?js|node)$/,
    exclude: [
      /[/\\]node_modules[/\\]react-native-qrcode-svg[/\\]/,
      /[/\\]node_modules[/\\]react-native-svg[/\\]/,
    ],
    parser: { amd: false },
    use: {
      loader: '@vercel/webpack-asset-relocator-loader',
      options: {
        outputAssetBase: 'native_modules',
      },
    },
  },
  {
    test: /\.tsx?$/,
    exclude: /[/\\]\.webpack[/\\]/,
    include: [
      __dirname,
      /[/\\]1-kernel[/\\]/,
      /[/\\]2-ui[/\\]/,
      /[/\\]3-adapter[/\\]/,
      /[/\\]4-assembly[/\\]/,
      /[/\\]0-mock-server[/\\]/,
    ],
    use: {
      loader: 'ts-loader',
      options: {
        transpileOnly: true,
      },
    },
  },
];
