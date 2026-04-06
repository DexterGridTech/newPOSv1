import {ScreenMode} from '@impos2/kernel-core-base';

import {exposeLaunchContextBridge} from './createBridge';

const readArgument = (name: string): string | undefined =>
  process.argv.find(argument => argument.startsWith(`--${name}=`))?.split('=').slice(1).join('=');

exposeLaunchContextBridge({
  windowRole: 'secondary',
  displayIndex: Number(readArgument('impos2-display-index') ?? 1),
  displayCount: Number(readArgument('impos2-display-count') ?? 2),
  screenMode: ScreenMode.DESKTOP,
  deviceId: readArgument('impos2-device-id') ?? 'electron-device',
  isPackaged: readArgument('impos2-is-packaged') === 'true',
  appVersion: readArgument('impos2-app-version') ?? '0.0.0-dev',
  runtimeSource: readArgument('impos2-runtime-source') === 'bundled' ? 'bundled' : 'dev-server',
});
