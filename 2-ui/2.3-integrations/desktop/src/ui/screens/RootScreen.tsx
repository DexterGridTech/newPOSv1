import React, {useEffect, useRef} from 'react';
import {View,} from 'react-native';
import {moduleName} from "../../moduleName";
import {formattedTime} from "@impos2/kernel-core-base";
import {
    FancyContainerV2,
    FancyKeyboardOverlayV2,
    FancyKeyboardProviderV2,
    ModalContainer,
    StackContainer,
    uiBaseCoreUiVariables,
    uiCoreBaseCommands,
    useLongPress
} from "@impos2/ui-core-base";


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
            uiCoreBaseCommands.screenLongPressed().executeInternally();
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
                    <StackContainer containerPart={uiBaseCoreUiVariables.rootScreenContainer}>
                    </StackContainer>
                </View>
                <ModalContainer/>
            </FancyContainerV2>

            {/* 必须添加键盘遮罩层 */}
            <FancyKeyboardOverlayV2/>
        </FancyKeyboardProviderV2>
    );
};

export default RootScreen;
