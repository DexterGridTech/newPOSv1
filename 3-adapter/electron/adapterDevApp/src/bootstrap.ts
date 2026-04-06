import {ApplicationManager, type ApplicationConfig} from '@impos2/kernel-core-base';
import {devServerSpace} from '@impos2/kernel-server-config';
import {uiCoreAdapterTestModule} from '@impos2/ui-core-adapter-test';

import type {AppProps} from './types/shared/appProps';

type StoreReady = {
  store: any;
  persistor?: any;
};

let bootstrapPromise: Promise<StoreReady> | null = null;
let bootstrapKey: string | null = null;

function buildBootstrapKey(props: AppProps) {
  return [
    props.deviceId,
    props.screenMode,
    props.displayCount,
    props.displayIndex,
  ].join('::');
}

export async function bootstrapAdapterDevStore(props: AppProps) {
  const nextKey = buildBootstrapKey(props);
  if (bootstrapPromise && bootstrapKey === nextKey) {
    return bootstrapPromise;
  }

  const appConfig: ApplicationConfig = {
    serverSpace: devServerSpace,
    environment: {
      deviceId: props.deviceId,
      production: false,
      screenMode: props.screenMode,
      displayCount: props.displayCount,
      displayIndex: props.displayIndex,
    },
    preInitiatedState: {},
    module: uiCoreAdapterTestModule,
  };

  bootstrapKey = nextKey;
  bootstrapPromise = ApplicationManager.getInstance()
    .generateStore(appConfig)
    .catch((error: unknown) => {
      if (bootstrapKey === nextKey) {
        bootstrapPromise = null;
        bootstrapKey = null;
      }
      throw error;
    });

  return bootstrapPromise;
}
