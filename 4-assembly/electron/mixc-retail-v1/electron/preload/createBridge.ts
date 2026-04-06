import {contextBridge} from 'electron';
import {createHostBridgeApi, type HostBridgeApi} from '@impos2/adapter-electron-v1/preload';
import {hostBridgeNamespace, type LaunchContext} from '@impos2/adapter-electron-v1/shared';

export function exposeLaunchContextBridge(launchContext: LaunchContext) {
  const bridge: HostBridgeApi = createHostBridgeApi({
    getLaunchContext: async () => launchContext,
  });
  contextBridge.exposeInMainWorld(hostBridgeNamespace, bridge);
}
