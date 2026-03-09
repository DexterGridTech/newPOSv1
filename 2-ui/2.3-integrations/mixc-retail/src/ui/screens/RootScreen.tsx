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
import {useSelector} from "react-redux";
import {DisplayMode, selectDisplayMode} from "@impos2/kernel-core-interconnection";


export interface AppProps {
    onLoadComplete?: () => void;
}

const RootScreen: React.FC<AppProps> = ({onLoadComplete}) => {
    const isLoadedRef = useRef(false);
    const displayMode = useSelector(selectDisplayMode);

    useEffect(() => {
        console.log('[RootScreen] useEffect triggered, isLoadedRef:', isLoadedRef.current);
        if (!isLoadedRef.current) {
            isLoadedRef.current = true;
            console.log(`[${moduleName}] 所有组件加载完毕，可以正常显示 - ${formattedTime()}`);
            console.log('[RootScreen] calling onLoadComplete');
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
                    {displayMode === DisplayMode.PRIMARY ? (
                        <StackContainer containerPart={uiBaseCoreUiVariables.primaryRootContainer}>
                        </StackContainer>
                    ) : (
                        <StackContainer containerPart={uiBaseCoreUiVariables.secondaryRootContainer}>
                        </StackContainer>
                    )}
                </View>
                <ModalContainer/>
            </FancyContainerV2>

            {/* 必须添加键盘遮罩层 */}
            <FancyKeyboardOverlayV2/>
        </FancyKeyboardProviderV2>
    );
};

export default RootScreen;
