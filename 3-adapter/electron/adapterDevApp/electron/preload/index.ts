import {contextBridge} from 'electron';
import {ScreenMode} from '@impos2/kernel-core-base';
import {createHostBridgeApi, type HostBridgeApi} from '@impos2/adapter-electron-v1/preload';
import {hostBridgeNamespace, type LaunchContext} from '@impos2/adapter-electron-v1/shared';

const readArgument = (name: string): string | undefined =>
  process.argv.find(argument => argument.startsWith(`--${name}=`))?.split('=').slice(1).join('=');

const launchContext: LaunchContext = {
  windowRole: 'primary',
  displayIndex: Number(readArgument('impos2-display-index') ?? 0),
  displayCount: Number(readArgument('impos2-display-count') ?? 1),
  screenMode: ScreenMode.DESKTOP,
  deviceId: readArgument('impos2-device-id') ?? 'electron-adapter-dev',
  isPackaged: readArgument('impos2-is-packaged') === 'true',
  appVersion: readArgument('impos2-app-version') ?? '0.0.0-dev',
  runtimeSource: readArgument('impos2-runtime-source') === 'bundled' ? 'bundled' : 'dev-server',
};

const bridge: HostBridgeApi = createHostBridgeApi({
  getLaunchContext: async () => launchContext,
});

contextBridge.exposeInMainWorld(hostBridgeNamespace, bridge);
