import React, {useCallback, useEffect, useState} from 'react';
import type {Store} from "@reduxjs/toolkit";
import type {Persistor} from "redux-persist";
import {NativeModules} from 'react-native';
import {Provider} from "react-redux";
import {PersistGate} from "redux-persist/integration/react";
import {kernelCoreBaseCommands} from "@impos2/kernel-core-base";
import {storePromise} from "./src/store.ts";
import LoadingScreen from "./src/ui/screens/LoadingScreen.tsx";
import {AppProps} from "./src/types/shared/appProps.ts";
import RootScreen from "@impos2/ui-integration-desktop/src/ui/screens/RootScreen.tsx";

const {AppTurboModule} = NativeModules;

const App = (props: AppProps) => {
    const [storeReady, setStoreReady] = useState<{ store: Store; persistor: Persistor } | null>(null);
    const handleAppLoadComplete = useCallback(() => {
        console.log('==================');
        kernelCoreBaseCommands.initialize().executeInternally()
        AppTurboModule.onAppLoadComplete?.().catch((error:Error|any) => {
            console.error('App load complete error',error);
        });
    }, []);
    useEffect(() => {
        storePromise(props).then(result => {
            setStoreReady(result);
        });
    }, []);

    if (!storeReady) {
        return <LoadingScreen/>;
    }

    const rootScreen = <RootScreen onLoadComplete={handleAppLoadComplete}/>;

    if (props.displayIndex > 0) {
        return <Provider store={storeReady.store}>{rootScreen}</Provider>;
    }

    return (
        <Provider store={storeReady.store}>
            <PersistGate persistor={storeReady.persistor}>
                {rootScreen}
            </PersistGate>
        </Provider>
    );
};
export default App;
