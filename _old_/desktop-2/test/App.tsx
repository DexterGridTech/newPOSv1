import React, { useEffect, useState } from 'react';
import {App} from '../src';
import {storePromise} from './store';
import {Provider} from "react-redux";
import {PersistGate} from 'redux-persist/integration/react';
import {InitializeCommand} from "_old_/base";
import type { Store } from '@reduxjs/toolkit';
import type { Persistor } from 'redux-persist';

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
            <PersistGate persistor={storeReady.persistor} onBeforeLift={()=>{new InitializeCommand().executeInternally()}}>
                <App/>
            </PersistGate>
        </Provider>
    )
};
