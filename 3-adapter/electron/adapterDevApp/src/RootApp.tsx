import React, {useEffect, useRef, useState} from 'react';
import {Provider} from 'react-redux';
import {ApplicationManager, appControl} from '@impos2/kernel-core-base';
import {DevHome} from '@impos2/ui-core-adapter-test';

import {bootstrapAdapterDevStore} from './bootstrap';
import {ensureModulePreSetup} from './modulePreSetup';
import type {AppProps} from './types/shared/appProps';

type StoreReady = {
  store: any;
  persistor?: any;
};

export function RootApp(props: AppProps) {
  ensureModulePreSetup();
  const [storeReady, setStoreReady] = useState<StoreReady | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const loadCompleteRef = useRef(false);

  useEffect(() => {
    bootstrapAdapterDevStore(props)
      .then(result => {
        console.log('bootstrapAdapterDevStore success');
        setStoreReady(result);
      })
      .catch((error: unknown) => {
        console.error('bootstrapAdapterDevStore error', error);
        setBootstrapError(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
      });
  }, [props]);

  useEffect(() => {
    if (!storeReady || loadCompleteRef.current) {
      return;
    }

    loadCompleteRef.current = true;
    ApplicationManager.getInstance().init();
    appControl.onAppLoadComplete(props.displayIndex).catch((error: unknown) => {
      console.error('App load complete error', error);
      loadCompleteRef.current = false;
    });
  }, [props.displayIndex, storeReady]);

  if (bootstrapError) {
    return (
      <div style={{padding: 16, fontFamily: 'monospace', color: '#b91c1c', whiteSpace: 'pre-wrap'}}>
        {bootstrapError}
      </div>
    );
  }

  if (!storeReady) {
    return null;
  }

  return (
    <Provider store={storeReady.store}>
      <DevHome />
    </Provider>
  );
}
