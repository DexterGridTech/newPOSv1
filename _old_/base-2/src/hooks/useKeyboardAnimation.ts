import {useRef, useCallback} from 'react';
import {Animated, Easing} from 'react-native';

/**
 * 键盘动画 Hook 返回值
 */
export interface UseKeyboardAnimationReturn {
    animatedValue: Animated.Value;
    show: () => void;
    hide: () => void;
}

/**
 * 键盘动画 Hook
 */
export function useKeyboardAnimation(
    duration: number,
    easing: string = 'easeInOut'
): UseKeyboardAnimationReturn {
    const animatedValue = useRef(new Animated.Value(0)).current;

    // 获取缓动函数
    const getEasingFunction = useCallback((easingName: string) => {
        switch (easingName) {
            case 'linear':
                return Easing.linear;
            case 'easeIn':
                return Easing.in(Easing.ease);
            case 'easeOut':
                return Easing.out(Easing.ease);
            case 'easeInOut':
            default:
                return Easing.inOut(Easing.ease);
        }
    }, []);

    /**
     * 显示动画
     */
    const show = useCallback(() => {
        Animated.timing(animatedValue, {
            toValue: 1,
            duration: 150,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [animatedValue]);

    /**
     * 隐藏动画
     */
    const hide = useCallback(() => {
        Animated.timing(animatedValue, {
            toValue: 0,
            duration: 150,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [animatedValue]);

    return {
        animatedValue,
        show,
        hide,
    };
}
