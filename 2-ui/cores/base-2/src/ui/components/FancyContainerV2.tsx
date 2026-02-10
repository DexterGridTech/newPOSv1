import React, {useRef, useEffect} from 'react';
import {Animated, StyleSheet, View, Dimensions, Platform} from 'react-native';
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

        if (Platform.OS === 'web') {
            // Web 环境：使用 timing 动画，不使用 useNativeDriver
            Animated.timing(translateY, {
                toValue: containerOffset,
                duration: animationConfig.duration,
                useNativeDriver: false,
            }).start();
        } else {
            // 原生环境：使用 timing 动画，使用 useNativeDriver
            Animated.timing(translateY, {
                toValue: containerOffset,
                duration: animationConfig.duration,
                useNativeDriver: true,
            }).start();
        }
    }, [containerOffset, animationConfig.duration, translateY]);

    return (
        <Animated.View
            style={[
                styles.container,
                Platform.OS === 'web'
                    ? {
                          // Web 环境：使用 top 而不是 transform
                          position: 'relative',
                          top: translateY,
                      }
                    : {
                          // 原生环境：使用 transform
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
