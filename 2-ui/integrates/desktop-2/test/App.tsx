import React from 'react';
import {App} from '../src';
import {persistor, store} from './store';
import {Provider} from "react-redux";
import {PersistGate} from 'redux-persist/integration/react';
import {InitializeCommand} from "@impos2/kernel-base";

export const DevApp: React.FC = () => {
    return (
        <Provider store={store}>
            <PersistGate persistor={persistor} onBeforeLift={()=>{new InitializeCommand().executeInternally()}}>
                <App/>
            </PersistGate>
        </Provider>
    )
};
