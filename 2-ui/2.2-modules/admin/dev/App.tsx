import React, {useEffect, useState} from 'react';
import {Provider} from 'react-redux';
import {storePromise} from './store';
import {PersistGate} from "redux-persist/integration/react";
import type {Store} from '@reduxjs/toolkit';
import type {Persistor} from 'redux-persist';
import {View} from "react-native";
import {kernelCoreBaseCommands} from "@impos2/kernel-core-base";
import {
    FancyContainerV2,
    FancyKeyboardOverlayV2,
    FancyKeyboardProviderV2,
    ModalContainer,
    StackContainer,
    uiBaseCoreUiVariables,
    uiCoreBaseCommands
} from "@impos2/ui-core-base";

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
                kernelCoreBaseCommands.initialize().executeInternally();
                uiCoreBaseCommands.screenLongPressed().executeInternally();
            }}>
                <FancyKeyboardProviderV2
                >
                    <FancyContainerV2>
                        {/* 你的页面内容 */}
                        <View
                            key={"primary-container"}
                            style={{
                                flex: 1
                            }}
                        >
                            <StackContainer containerPart={uiBaseCoreUiVariables.rootScreenContainer}>
                            </StackContainer>
                        </View>
                        <ModalContainer/>
                    </FancyContainerV2>

                    {/* 必须添加键盘遮罩层 */}
                    <FancyKeyboardOverlayV2/>
                </FancyKeyboardProviderV2>
            </PersistGate>
        </Provider>
    );
};
