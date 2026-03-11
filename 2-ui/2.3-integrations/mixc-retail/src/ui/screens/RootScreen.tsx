import React, {useEffect, useRef, useState} from 'react';
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
    useLongPress
} from "@impos2/ui-core-base";
import {useSelector} from "react-redux";
import {DisplayMode, getStandalone, selectDisplayMode} from "@impos2/kernel-core-interconnection";
import {AdminPopup} from "@impos2/ui-core-admin";


export interface AppProps {
    onLoadComplete?: () => void;
}

const RootScreen: React.FC<AppProps> = ({onLoadComplete}) => {
    const isLoadedRef = useRef(false);
    const displayMode = useSelector(selectDisplayMode);
    const [showAdminPopup, setShowAdminPopup] = useState(false);

    useEffect(() => {
        if (!isLoadedRef.current) {
            isLoadedRef.current = true;
            console.log(`[${moduleName}] 所有组件加载完毕，可以正常显示 - ${formattedTime()}`);
            onLoadComplete?.();
        }
    }, [onLoadComplete]);

    const longPressHandlers = useLongPress({
        onLongPress: () => {
            const standalone=getStandalone()
            if (standalone)
                setShowAdminPopup(true);
        },
        delay: 2000
    });

    return (
        <FancyKeyboardProviderV2>
            <FancyContainerV2>
                {/* 你的页面内容 */}
                <View key={"primary-container"} {...longPressHandlers} style={{flex: 1}}>
                    {displayMode === DisplayMode.PRIMARY ? (
                        <StackContainer containerPart={uiBaseCoreUiVariables.primaryRootContainer}>
                        </StackContainer>
                    ) : (
                        <StackContainer containerPart={uiBaseCoreUiVariables.secondaryRootContainer}>
                        </StackContainer>
                    )}
                </View>
                <ModalContainer/>
                <AdminPopup visible={showAdminPopup} onClose={() => setShowAdminPopup(false)}/>
            </FancyContainerV2>
            {/* 必须添加键盘遮罩层 */}
            <FancyKeyboardOverlayV2/>
        </FancyKeyboardProviderV2>
    );
};

export default RootScreen;
