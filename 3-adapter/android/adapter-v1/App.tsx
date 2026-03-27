import React, {useEffect, useState} from 'react';
import {DevHome} from '@impos2/ui-core-adapter-test';
import type {Store} from "@reduxjs/toolkit";
import type {Persistor} from "redux-persist";
import {Text, View} from "react-native";
import {Provider} from "react-redux";
import {PersistGate} from "redux-persist/integration/react";
import {ApplicationManager, kernelCoreBaseCommands} from "@impos2/kernel-core-base";
import {storePromise} from "./dev/store.ts";

const App = () => {
    const [storeReady, setStoreReady] = useState<{ store: Store; persistor: Persistor } | null>(null);

    useEffect(() => {
        storePromise().then(result => {
            setStoreReady(result);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!storeReady) {
        return <View>
            <Text>Loading</Text>
        </View>
    }

    return (
        <Provider store={storeReady.store}>
            <PersistGate persistor={storeReady.persistor} onBeforeLift={() => {
                ApplicationManager.getInstance().init()
            }}>
                <DevHome>
                </DevHome>
            </PersistGate>
        </Provider>
    );
};

export default App;
