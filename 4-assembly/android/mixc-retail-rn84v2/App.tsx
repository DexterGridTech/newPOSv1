import React, {useCallback, useEffect, useState} from 'react';
import type {Store} from "@reduxjs/toolkit";
import type {Persistor} from "redux-persist";
import {Provider} from "react-redux";
import {PersistGate} from "redux-persist/integration/react";
import BootSplash from 'react-native-bootsplash';
import {ApplicationManager, appControl} from "@impos2/kernel-core-base";
import {storePromise} from "./src/store.ts";
import {AppProps} from "./src/types/shared/appProps.ts";
import {RootScreen} from "@impos2/ui-integration-mixc-retail";
import {ensureModulePreSetup} from "./src/application/modulePreSetup";

const App = (props: AppProps) => {
    ensureModulePreSetup();
    const [storeReady, setStoreReady] = useState<{ store: Store; persistor: Persistor } | null>(null);

    const hideBootSplash = useCallback(() => {
        BootSplash.hide({fade: false}).catch((error: Error | any) => {
            console.error('BootSplash hide error', error);
        });
    }, []);

    const handleAppLoadComplete = useCallback(() => {
        ApplicationManager.getInstance().init();
        appControl.onAppLoadComplete(props.displayIndex)
            .catch((error: Error | any) => {
                console.error('App load complete error', error);
            })
            .finally(() => {
                hideBootSplash();
            });
    }, [hideBootSplash, props.displayIndex]);

    useEffect(() => {
        storePromise(props)
            .then(result => {
                setStoreReady(result);
            })
            .catch(error => {
                console.error('storePromise error:', error);
                hideBootSplash();
            });
    }, [hideBootSplash, props]);

    if (!storeReady) {
        return null;
    }

    const rootScreen = <RootScreen onLoadComplete={handleAppLoadComplete}/>;

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
};

export default App;
