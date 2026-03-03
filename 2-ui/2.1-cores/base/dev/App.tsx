import React, {useEffect, useState} from 'react';
import {Provider} from 'react-redux';
import {storePromise} from './store';
import {PersistGate} from "redux-persist/integration/react";
import type {Store} from '@reduxjs/toolkit';
import type {Persistor} from 'redux-persist';
import {Text, View} from "react-native";
import {kernelCoreBaseCommands} from "@impos2/kernel-core-base";

export const DevApp: React.FC = () => {
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
                <View>
                    <Text>DevApp</Text>
                </View>
            </PersistGate>
        </Provider>
    );
};
