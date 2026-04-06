import type {ScreenMode} from '@impos2/kernel-core-base';

export interface HostBridgeInvokeResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface LaunchContext {
  windowRole: 'primary' | 'secondary';
  displayIndex: number;
  displayCount: number;
  screenMode: ScreenMode;
  deviceId: string;
  isPackaged: boolean;
  appVersion: string;
  serverSpacePreset?: string;
  runtimeSource: 'dev-server' | 'bundled';
}

export interface LaunchContextOverrides {
  displayCount: number;
  isPackaged: boolean;
  appVersion: string;
  deviceId?: string;
  serverSpacePreset?: string;
}

export const hostBridgeNamespace = 'impos2Host';
