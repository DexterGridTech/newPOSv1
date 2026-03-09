import React, {useCallback, useEffect, useState} from 'react';
import type {Store} from "@reduxjs/toolkit";
import type {Persistor} from "redux-persist";
import {NativeModules} from 'react-native';
import {Provider} from "react-redux";
import {PersistGate} from "redux-persist/integration/react";
import {ApplicationManager, kernelCoreBaseCommands} from "@impos2/kernel-core-base";
import {storePromise} from "./src/store.ts";
import {LoadingScreen} from "@impos2/ui-core-base";
import {AppProps} from "./src/types/shared/appProps.ts";
import {RootScreen} from "@impos2/ui-integration-mixc-retail";

const {AppTurboModule} = NativeModules;

const App = (props: AppProps) => {
    console.log('App props:', props);
    const [storeReady, setStoreReady] = useState<{ store: Store; persistor: Persistor } | null>(null);
    const handleAppLoadComplete = useCallback(() => {
        console.log('handleAppLoadComplete called');
        ApplicationManager.getInstance().init()
        AppTurboModule.onAppLoadComplete?.().catch((error:Error|any) => {
            console.error('App load complete error',error);
        });
    }, []);
    useEffect(() => {
        console.log('useEffect: calling storePromise');
        storePromise(props).then(result => {
            console.log('storePromise resolved');
            setStoreReady(result);
        }).catch(error => {
            console.error('storePromise error:', error);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!storeReady) {
        console.log('Rendering LoadingScreen');
        return <LoadingScreen/>;
    }

    console.log('Store ready, rendering RootScreen');
    const rootScreen = <RootScreen onLoadComplete={handleAppLoadComplete}/>;

    if (props.displayIndex > 0) {
        console.log('Secondary display, no PersistGate');
        return <Provider store={storeReady.store}>{rootScreen}</Provider>;
    }

    console.log('Primary display, with PersistGate');
    return (
        <Provider store={storeReady.store}>
            <PersistGate loading={null} persistor={storeReady.persistor}>
                {() => {
                    console.log('PersistGate children function called');
                    return rootScreen;
                }}
            </PersistGate>
        </Provider>
    );
};
export default App;
