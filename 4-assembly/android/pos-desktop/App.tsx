import React, {useEffect, useState} from 'react';
import type {Store} from "@reduxjs/toolkit";
import type {Persistor} from "redux-persist";
import {Text, View} from "react-native";
import {Provider} from "react-redux";
import {PersistGate} from "redux-persist/integration/react";
import {kernelCoreBaseCommands} from "@impos2/kernel-core-base";
import {storePromise} from "./src/store.ts";
import DevHome from "./src/ui/screens/DevHome.tsx";

const App = () => {
    const [storeReady, setStoreReady] = useState<{ store: Store; persistor: Persistor } | null>(null);

    useEffect(() => {
        storePromise.then(result => {
            setStoreReady(result);
        });
    }, []);

    if (!storeReady) {
        return <View>
            <Text>Loading</Text>
        </View>
    }

    return (
        <Provider store={storeReady.store}>
            <PersistGate persistor={storeReady.persistor} onBeforeLift={() => {
                kernelCoreBaseCommands.initialize().executeInternally()
            }}>
                <DevHome>
                </DevHome>
            </PersistGate>
        </Provider>
    );
};
export default App;
