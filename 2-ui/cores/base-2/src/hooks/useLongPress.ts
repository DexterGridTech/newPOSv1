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

    // 原生端使用 Responder System
    const handleStartShouldSetResponder = useCallback(() => {
        return true;
    }, []);

    const handleMoveShouldSetResponder = useCallback(() => {
        return true;
    }, []);

    const handleStartShouldSetResponderCapture = useCallback(() => {
        startTimer();
        return false;
    }, [startTimer]);

    const handleMoveShouldSetResponderCapture = useCallback(() => {
        return false;
    }, []);

    const handleResponderGrant = useCallback((event: GestureResponderEvent) => {
        if (!timerRef.current) {
            startTimer();
        }
    }, [startTimer]);

    const handleResponderRelease = useCallback(() => {
        clearTimer();
    }, [clearTimer]);

    const handleResponderTerminate = useCallback(() => {
        clearTimer();
    }, [clearTimer]);

    const handleResponderEnd = useCallback(() => {
        clearTimer();
    }, [clearTimer]);

    return {
        onStartShouldSetResponder: handleStartShouldSetResponder,
        onMoveShouldSetResponder: handleMoveShouldSetResponder,
        onStartShouldSetResponderCapture: handleStartShouldSetResponderCapture,
        onMoveShouldSetResponderCapture: handleMoveShouldSetResponderCapture,
        onResponderGrant: handleResponderGrant,
        onResponderRelease: handleResponderRelease,
        onResponderTerminate: handleResponderTerminate,
        onResponderEnd: handleResponderEnd,
    };
};
