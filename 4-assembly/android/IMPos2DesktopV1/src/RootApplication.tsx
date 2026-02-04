import {AppProps} from "./types/AppProps.ts";
import React, {useEffect, useState} from 'react';
import {InitializeCommand, RootState} from "@impos2/kernel-base";
import {posAdapter} from '@impos2/adapter-impos2-adapterv1';
import createStore from "./utils/createStore.ts";
import {EnhancedStore} from "@reduxjs/toolkit";
import {NativeModules} from "react-native";
import {PersistGate} from "redux-persist/integration/react";
import LoadingScreen from "./components/LoadingScreen.tsx";
import {App} from "@impos2/integrate-desktop-2";
import {Provider} from "react-redux";
import {Persistor} from "redux-persist/es/types";

const {ScreenInitModule} = NativeModules;

function RootApplication(props: AppProps): React.JSX.Element {
    const [store, setStore] = useState<EnhancedStore<RootState> | null>(null);
    const [persistor, setPersistor] = useState<Persistor | null>(null);
    useEffect(() => {
        createStore(props, posAdapter).then(
            ({store, persistor}) => {
                setStore(store);
                setPersistor(persistor);
                ScreenInitModule.notifyScreenInitialized(
                    props.screenType,
                    props
                );

            }
        ).catch(error => console.error('createStore error', error))
    }, [])
    if (!store || !persistor) {
        // 防御性检查
        return <LoadingScreen/>;
    }
    return (
        <Provider store={store}>
            <PersistGate
                persistor={persistor}
                onBeforeLift={() => {
                    new InitializeCommand().executeInternally();
                }}
            >
                <App/>
            </PersistGate>
        </Provider>
    )
}

export default RootApplication;