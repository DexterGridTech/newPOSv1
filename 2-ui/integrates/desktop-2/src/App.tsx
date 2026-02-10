import React from 'react';
import {desktopVariables} from "./ui/desktopVariables";
import {
    FancyContainer,
    FancyKeyboardOverlay,
    FancyKeyboardProvider,
    LongPressCommand,
    ModalContainer,
    StackContainer,
    useLongPress
} from "@impos2/ui-core-base-2";
import {View} from "react-native";

export const App: React.FC = () => {

    const longPressHandlers = useLongPress({
        onLongPress: () => {
            new LongPressCommand("primary-container").executeInternally();
        },
        delay: 2000
    });
    return (
        <FancyKeyboardProvider
            animationDuration={300}
            animationEasing="easeInOut"
        >
            <FancyContainer>
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
            </FancyContainer>

            {/* 必须添加键盘遮罩层 */}
            <FancyKeyboardOverlay/>
        </FancyKeyboardProvider>

    );
};
