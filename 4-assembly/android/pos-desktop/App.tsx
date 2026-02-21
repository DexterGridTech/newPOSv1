import React, {useCallback, useEffect, useState} from 'react';
import type {Store} from "@reduxjs/toolkit";
import type {Persistor} from "redux-persist";
import {NativeModules} from 'react-native';
import {Provider} from "react-redux";
import {PersistGate} from "redux-persist/integration/react";
import {kernelCoreBaseCommands} from "@impos2/kernel-core-base";
import {storePromise} from "./src/store.ts";
import LoadingScreen from "./src/ui/screens/LoadingScreen.tsx";
import RootScreen from "./src/ui/screens/RootScreen.tsx";
import {AppProps} from "./src/types/shared/appProps.ts";

const {AppTurboModule} = NativeModules;

const App = (props: AppProps) => {
    const [storeReady, setStoreReady] = useState<{ store: Store; persistor: Persistor } | null>(null);
    const handleAppLoadComplete = useCallback(() => {
        console.log('App load complete',props);
        AppTurboModule.onAppLoadComplete?.().catch((error:Error|any) => {
            console.error('App load complete error',error);
        });
    }, []);
    useEffect(() => {
        storePromise.then(result => {
            setStoreReady(result);
        });
    }, []);

    if (!storeReady) {
        return <LoadingScreen/>;
    }
    return (
        <Provider store={storeReady.store}>
            <PersistGate persistor={storeReady.persistor} onBeforeLift={() => {
                kernelCoreBaseCommands.initialize().executeInternally()
            }}>
                <RootScreen onLoadComplete={handleAppLoadComplete}>
                </RootScreen>
            </PersistGate>
        </Provider>
    );
};
export default App;
