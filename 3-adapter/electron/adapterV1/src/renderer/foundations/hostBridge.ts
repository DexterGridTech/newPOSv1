import {hostBridgeNamespace} from '../../shared/index';
import type {HostBridgeApi} from '../../shared/contracts';

declare global {
  interface Window {
    [hostBridgeNamespace]: HostBridgeApi;
  }
}

export function getHostBridge(): HostBridgeApi {
  const bridge = window[hostBridgeNamespace];
  if (!bridge) {
    throw new Error(`Host bridge "${hostBridgeNamespace}" is not available`);
  }
  return bridge;
}
