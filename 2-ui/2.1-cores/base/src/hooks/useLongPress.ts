import { useRef, useCallback } from 'react';
import { GestureResponderEvent, Platform } from 'react-native';

interface UseLongPressOptions {
    onLongPress: () => void;
    delay?: number;
}

export const useLongPress = ({ onLongPress, delay = 1000 }: UseLongPressOptions) => {
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const isLongPressRef = useRef(false);

    const startTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        isLongPressRef.current = false;
        timerRef.current = setTimeout(() => {
            isLongPressRef.current = true;
            onLongPress();
        }, delay);
    }, [onLongPress, delay]);

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        isLongPressRef.current = false;
    }, []);

    // Web 端使用 mouse/touch 事件
    if (Platform.OS === 'web') {
        const handleMouseDown = useCallback((event: any) => {
            startTimer();
        }, [startTimer]);

        const handleMouseUp = useCallback(() => {
            clearTimer();
        }, [clearTimer]);

        const handleMouseLeave = useCallback(() => {
            clearTimer();
        }, [clearTimer]);

        const handleTouchStart = useCallback((event: any) => {
            startTimer();
        }, [startTimer]);

        const handleTouchEnd = useCallback(() => {
            clearTimer();
        }, [clearTimer]);

        const handleTouchCancel = useCallback(() => {
            clearTimer();
        }, [clearTimer]);

        return {
            onMouseDown: handleMouseDown,
            onMouseUp: handleMouseUp,
            onMouseLeave: handleMouseLeave,
            onTouchStart: handleTouchStart,
            onTouchEnd: handleTouchEnd,
            onTouchCancel: handleTouchCancel,
        };
    }

    // 原生端使用 touch 事件，避免根节点抢占 responder 导致 ScrollView/FlatList 无法滚动
    const handleTouchStart = useCallback((_event: GestureResponderEvent) => {
        startTimer();
    }, [startTimer]);

    const handleTouchEnd = useCallback(() => {
        clearTimer();
    }, [clearTimer]);

    const handleTouchCancel = useCallback(() => {
        clearTimer();
    }, [clearTimer]);

    const handleTouchMove = useCallback(() => {
        // 一旦发生移动则取消长按，避免与滚动手势冲突
        clearTimer();
    }, [clearTimer]);

    return {
        onTouchStart: handleTouchStart,
        onTouchEnd: handleTouchEnd,
        onTouchCancel: handleTouchCancel,
        onTouchMove: handleTouchMove,
    };
};
