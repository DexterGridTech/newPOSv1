import React, { useEffect, useState } from 'react';
import {Provider} from 'react-redux';
import {storePromise} from './store';
import {ActivateDesktopScreen} from '../src';
import {PersistGate} from "redux-persist/integration/react";
import {InitializeCommand} from "@impos2/kernel-base";
import type { Store } from '@reduxjs/toolkit';
import type { Persistor } from 'redux-persist';

export const DevApp: React.FC = () => {
    const [storeReady, setStoreReady] = useState<{ store: Store; persistor: Persistor } | null>(null);

    useEffect(() => {
        console.log("DevApp useEffect 开始执行");
        storePromise.then(result => {
            console.log("storePromise resolved，准备设置 storeReady", result);
            setStoreReady(result);
            console.log("setStoreReady 已调用");
        }).catch(error => {
            console.error("storePromise 失败:", error);
        });
    }, []);

    console.log("DevApp 渲染，storeReady:", storeReady);

    if (!storeReady) {
        return <div>Loading store...</div>;
    }

    console.log("准备渲染 Provider 和 PersistGate");

    return (
        <Provider store={storeReady.store}>
            <PersistGate
                persistor={storeReady.persistor}
                loading={<div>PersistGate loading...</div>}
                onBeforeLift={()=>{
                    console.log("PersistGate onBeforeLift 开始执行");
                    try {
                        new InitializeCommand().executeInternally();
                        console.log("InitializeCommand 执行完成");
                    } catch (error) {
                        console.error("InitializeCommand 执行失败:", error);
                    }
                }}
            >
                <ActivateDesktopScreen/>
            </PersistGate>
        </Provider>
    );
};
