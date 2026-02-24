import React, {useEffect, useRef, useContext} from 'react';
import {Animated, StyleSheet, Platform} from 'react-native';
import {FancyKeyboardDisplayContextV2} from '../../contexts/FancyKeyboardContextV2';

interface FancyContainerV2Props {
    children: React.ReactNode;
}

/**
 * FancyContainerV2 组件
 * 负责管理内容区域的位移动画
 */
export const FancyContainerV2: React.FC<FancyContainerV2Props> = ({children}) => {
    const display = useContext(FancyKeyboardDisplayContextV2);
    const containerOffset = display?.containerOffset ?? 0;
    const translateY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(translateY, {
            toValue: containerOffset,
            duration: 300,
            useNativeDriver: Platform.OS !== 'web',
        }).start();
    }, [containerOffset, translateY]);

    return (
        <Animated.View style={[styles.container, {transform: [{translateY}]}]}>
            {children}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
