import {ApplicationManager, type ApplicationConfig} from '@impos2/kernel-core-base';

import {resolveAssemblyElectronStoreRuntime} from './foundations';
import {assemblyElectronMixcRetailModule} from './index';
import type {AppProps} from './types';

type StoreReady = {
  store: any;
  persistor: any;
};

let storePromiseCache: Promise<StoreReady> | null = null;
let storePromiseKey: string | null = null;

function buildStoreKey(props: AppProps) {
  return [
    props.deviceId,
    props.screenMode,
    props.displayCount,
    props.displayIndex,
    props.windowRole,
    props.isPackaged,
    props.runtimeSource,
  ].join('::');
}

export const storePromise = async (props: AppProps) => {
  const nextKey = buildStoreKey(props);
  if (storePromiseCache && storePromiseKey === nextKey) {
    return storePromiseCache;
  }

  const runtime = resolveAssemblyElectronStoreRuntime(props);

  if (!runtime.production) {
    console.info(`[Store] init ${runtime.debugLabel}`);
  }

  const appConfig: ApplicationConfig = {
    serverSpace: runtime.serverSpace,
    environment: runtime.environment,
    preInitiatedState: {},
    module: assemblyElectronMixcRetailModule,
  };

  storePromiseKey = nextKey;
  storePromiseCache = ApplicationManager.getInstance()
    .generateStore(appConfig)
    .catch((error: unknown) => {
      if (storePromiseKey === nextKey) {
        storePromiseCache = null;
        storePromiseKey = null;
      }
      throw error;
    });

  return storePromiseCache;
};
