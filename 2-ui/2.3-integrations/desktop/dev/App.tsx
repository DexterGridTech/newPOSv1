import React, {useEffect, useState} from 'react';
import {Provider} from 'react-redux';
import {storePromise} from './store';
import {PersistGate} from "redux-persist/integration/react";
import type {Store} from '@reduxjs/toolkit';
import type {Persistor} from 'redux-persist';
import {kernelCoreBaseCommands} from "@impos2/kernel-core-base";
import RootScreen from "../src/ui/screens/RootScreen";

export const DevApp: React.FC = () => {
    const [storeReady, setStoreReady] = useState<{ store: Store; persistor: Persistor } | null>(null);

    useEffect(() => {
        storePromise.then(result => {
            setStoreReady(result);
        });
    }, []);

    if (!storeReady) {
        return <div>Loading store...</div>;
    }

    return (
        <Provider store={storeReady.store}>
            <PersistGate persistor={storeReady.persistor} onBeforeLift={() => {
                kernelCoreBaseCommands.initialize().executeInternally()
            }}>
                <RootScreen onLoadComplete={ () => {
                    console.log("---------------onLoadComplete---------------")
                }}>
                </RootScreen>
            </PersistGate>
        </Provider>
    );
};
