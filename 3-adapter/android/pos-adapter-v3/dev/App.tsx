import React, {useEffect, useState} from 'react';
import DevHome from './screens/DevHome';
import type {Store} from "@reduxjs/toolkit";
import type {Persistor} from "redux-persist";
import {Text, View, LogBox} from "react-native";
import {Provider} from "react-redux";
import {PersistGate} from "redux-persist/integration/react";
import {kernelCoreBaseCommands} from "@impos2/kernel-core-base";
import {storePromise} from "./store.ts";

const App = () => {
    const [storeReady, setStoreReady] = useState<{ store: Store; persistor: Persistor } | null>(null);

    useEffect(() => {
        // 禁用键盘导航相关的警告
        LogBox.ignoreLogs(['VirtualizedLists should never be nested']);

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
                kernelCoreBaseCommands.initialize().executeInternally()
            }}>
                <DevHome />
            </PersistGate>
        </Provider>
    );
};

export default App;
