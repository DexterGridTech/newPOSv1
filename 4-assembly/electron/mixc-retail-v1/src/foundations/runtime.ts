import type {ServerSpace} from '@impos2/kernel-core-base';
import {devServerSpace, productServerSpace} from '@impos2/kernel-server-config';

import type {AppProps} from '../types';

export type AssemblyElectronStoreRuntime = {
  production: boolean;
  serverSpace: ServerSpace;
  environment: {
    deviceId: string;
    production: boolean;
    screenMode: AppProps['screenMode'];
    displayCount: number;
    displayIndex: number;
  };
  debugLabel: string;
};

export function resolveAssemblyElectronStoreRuntime(props: AppProps): AssemblyElectronStoreRuntime {
  const production = props.isPackaged;

  return {
    production,
    serverSpace: production ? productServerSpace : devServerSpace,
    environment: {
      deviceId: props.deviceId,
      production,
      screenMode: props.screenMode,
      displayCount: props.displayCount,
      displayIndex: props.displayIndex,
    },
    debugLabel: `displayIndex=${props.displayIndex} windowRole=${props.windowRole} deviceId=${props.deviceId} runtime=${props.runtimeSource}`,
  };
}
