import React, {useEffect, useRef} from 'react';
import {Animated, StyleSheet} from 'react-native';
import {useFancyKeyboardV2} from '../../hooks/useFancyKeyboardV2';

interface FancyContainerV2Props {
    children: React.ReactNode;
}

/**
 * FancyContainerV2 组件
 * 负责管理内容区域的位移动画
 */
export const FancyContainerV2: React.FC<FancyContainerV2Props> = ({children}) => {
    const {containerOffset, animationConfig} = useFancyKeyboardV2();
    const translateY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // 统一使用 timing 动画，使用 useNativeDriver
        Animated.timing(translateY, {
            toValue: containerOffset,
            duration: animationConfig.duration,
            useNativeDriver: true,
        }).start();
    }, [containerOffset, animationConfig.duration, translateY]);

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [{translateY}],
                },
            ]}
        >
            {children}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
