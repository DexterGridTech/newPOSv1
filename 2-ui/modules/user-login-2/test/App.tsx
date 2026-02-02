import React from 'react';
import {Provider} from 'react-redux';
import {LoginDesktopScreen} from '../src';
import {PersistGate} from "redux-persist/integration/react";
import {persistor, store} from "./store";
import {InitializeCommand} from "@impos2/kernel-base";

export const DevApp: React.FC = () => {
    return (
        <Provider store={store}>
            <PersistGate persistor={persistor} onBeforeLift={()=>{new InitializeCommand().executeInternally()}}>
                <LoginDesktopScreen/>
            </PersistGate>
        </Provider>
    );
};
