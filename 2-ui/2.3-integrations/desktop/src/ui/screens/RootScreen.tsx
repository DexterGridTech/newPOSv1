import React, {useEffect, useRef} from 'react';
import {StyleSheet, View,} from 'react-native';
import {moduleName} from "../../moduleName";
import {formattedTime} from "@impos2/kernel-core-base";
import {
    FancyContainerV2,
    FancyKeyboardOverlayV2,
    FancyKeyboardProviderV2,
    ModalContainer,
    StackContainer,
    useLongPress
} from "@impos2/ui-core-base";
import {uiIntegrationDesktopUiVariables} from "../variables";


export interface AppProps {
    onLoadComplete?: () => void;
}

const RootScreen: React.FC<AppProps> = ({onLoadComplete}) => {
    const isLoadedRef = useRef(false);

    useEffect(() => {
        if (!isLoadedRef.current) {
            isLoadedRef.current = true;
            console.log(`[${moduleName}] 所有组件加载完毕，可以正常显示 - ${formattedTime()}`);
            onLoadComplete?.();
        }
    }, [onLoadComplete]);

    const longPressHandlers = useLongPress({
        onLongPress: () => {

            console.log("---------")
            // new LongPressCommand("primary-container").executeInternally();
        },
        delay: 2000
    });

    return (
        <FancyKeyboardProviderV2
            animationDuration={300}
            animationEasing="easeInOut"
        >
            <FancyContainerV2>
                {/* 你的页面内容 */}
                <View
                    key={"primary-container"}
                    {...longPressHandlers}
                    style={{
                        flex: 1
                    }}
                >
                    <StackContainer containerPart={uiIntegrationDesktopUiVariables.rootScreenContainer}>
                    </StackContainer>
                </View>
                <ModalContainer/>
            </FancyContainerV2>

            {/* 必须添加键盘遮罩层 */}
            <FancyKeyboardOverlayV2/>
        </FancyKeyboardProviderV2>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
    },
    text: {
        marginTop: 20,
        fontSize: 16,
        color: '#666666',
    },
    button: {
        marginTop: 20,
        paddingHorizontal: 24,
        paddingVertical: 10,
        backgroundColor: '#764ba2',
        borderRadius: 8,
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 16,
    },
});

export default RootScreen;
