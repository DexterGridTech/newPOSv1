import React, {useEffect, useRef} from 'react';
import {Animated, ViewStyle, StyleProp} from 'react-native';
import {useFancyKeyboard} from '../../../hooks/useFancyKeyboard';

/**
 * FancyContainer Props
 */
export interface FancyContainerProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}

/**
 * FancyContainer 组件
 * 包裹页面内容，根据键盘状态动态调整位置
 */
export const FancyContainer: React.FC<FancyContainerProps> = React.memo(({children, style}) => {
    const {containerOffset} = useFancyKeyboard();
    const translateY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(translateY, {
            toValue: containerOffset,
            duration: 150,
            useNativeDriver: true,
        }).start();
    }, [containerOffset, translateY]);

    return (
        <Animated.View
            style={[
                {flex: 1},
                style,
                {
                    transform: [{translateY}],
                },
            ]}
        >
            {children}
        </Animated.View>
    );
});
