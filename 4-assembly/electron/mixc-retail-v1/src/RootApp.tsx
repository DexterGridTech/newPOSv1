import React, {useCallback, useEffect, useState} from 'react';
import {Provider} from 'react-redux';
import {PersistGate} from 'redux-persist/integration/react';
import {ApplicationManager, appControl} from '@impos2/kernel-core-base';
import {RootScreen} from '@impos2/ui-integration-mixc-retail';

import {ensureModulePreSetup} from './application/modulePreSetup';
import {storePromise} from './store';
import type {AppProps} from './types';

type StoreReady = {
  store: any;
  persistor: any;
};

export function RootApp(props: AppProps) {
  ensureModulePreSetup();

  const [storeReady, setStoreReady] = useState<StoreReady | null>(null);
  const [storeError, setStoreError] = useState<string | null>(null);

  const handleAppLoadComplete = useCallback(() => {
    ApplicationManager.getInstance().init();
    appControl.onAppLoadComplete(props.displayIndex).catch((error: unknown) => {
      console.error('App load complete error', error);
    });
  }, [props.displayIndex]);

  useEffect(() => {
    storePromise(props)
      .then(result => {
        setStoreReady(result);
      })
      .catch((error: unknown) => {
        console.error('storePromise error', error);
        setStoreError(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
      });
  }, [props]);

  if (storeError) {
    return (
      <div style={{padding: 16, fontFamily: 'monospace', color: '#b91c1c', whiteSpace: 'pre-wrap'}}>
        {storeError}
      </div>
    );
  }

  if (!storeReady) {
    return null;
  }

  const rootScreen = <RootScreen onLoadComplete={handleAppLoadComplete} />;

  if (props.displayIndex > 0) {
    return <Provider store={storeReady.store}>{rootScreen}</Provider>;
  }

  return (
    <Provider store={storeReady.store}>
      <PersistGate loading={null} persistor={storeReady.persistor}>
        {() => rootScreen}
      </PersistGate>
    </Provider>
  );
}
