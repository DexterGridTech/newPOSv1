import React, {useEffect, useRef} from 'react';
import {desktopVariables} from "./ui/desktopVariables";
import {
    FancyContainerV2,
    FancyKeyboardOverlayV2,
    FancyKeyboardProvider, FancyKeyboardProviderV2,
    LongPressCommand,
    ModalContainer,
    StackContainer,
    useLongPress
} from "@impos2/ui-core-base-2";
import {View} from "react-native";
import {formattedTime} from "@impos2/kernel-base";
import {moduleName} from "./moduleName";

export interface AppProps {
    onLoadComplete?: () => void;
}

export const App: React.FC<AppProps> = ({onLoadComplete}) => {
    const isLoadedRef = useRef(false);

    const longPressHandlers = useLongPress({
        onLongPress: () => {
            new LongPressCommand("primary-container").executeInternally();
        },
        delay: 2000
    });

    // 组件挂载完成后的回调
    useEffect(() => {
        // 确保只打印一次
        if (!isLoadedRef.current) {
            isLoadedRef.current = true;
            console.log(`[${moduleName}] 所有组件加载完毕，可以正常显示 - ${formattedTime()}`);
            // 调用父组件传入的回调
            onLoadComplete?.();
        }
    }, [onLoadComplete]);

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
                    <StackContainer containerPart={desktopVariables.rootScreenContainer}>
                    </StackContainer>
                </View>
                <ModalContainer/>
            </FancyContainerV2>

            {/* 必须添加键盘遮罩层 */}
            <FancyKeyboardOverlayV2/>
        </FancyKeyboardProviderV2>

    );
};
