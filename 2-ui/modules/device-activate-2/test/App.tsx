import React from 'react';
import {Provider} from 'react-redux';
import {persistor, store} from './store';
import {ActivateDesktopScreen} from '../src';
import {PersistGate} from "redux-persist/integration/react";
import {InitializeCommand} from "@impos2/kernel-base";

export const DevApp: React.FC = () => {
    return (
        <Provider store={store}>
            <PersistGate persistor={persistor} onBeforeLift={()=>{new InitializeCommand().executeInternally()}}>
                <ActivateDesktopScreen/>
            </PersistGate>
        </Provider>
    );
};
