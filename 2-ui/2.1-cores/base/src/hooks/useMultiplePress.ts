import { useRef, useCallback } from 'react';
import { GestureResponderEvent, Platform } from 'react-native';

interface UseMultiplePressOptions {
    onMultiplePress: () => void;
}

const AREA_SIZE = 100; // 左上角区域大小
const REQUIRED_PRESSES = 10; // 需要的点击次数
const TIME_WINDOW = 3000; // 时间窗口3秒

export const useMultiplePress = ({
    onMultiplePress,
}: UseMultiplePressOptions) => {
    const pressTimesRef = useRef<number[]>([]);

    const handlePress = useCallback((event: GestureResponderEvent) => {
        const { pageX, pageY } = event.nativeEvent;

        // 检查是否在左上角区域内
        if (pageX > AREA_SIZE || pageY > AREA_SIZE) {
            return;
        }

        const now = Date.now();

        // 过滤掉时间窗口外的点击
        pressTimesRef.current = pressTimesRef.current.filter(
            time => now - time < TIME_WINDOW
        );

        // 添加当前点击
        pressTimesRef.current.push(now);

        // 检查是否达到要求的点击次数
        if (pressTimesRef.current.length >= REQUIRED_PRESSES) {
            pressTimesRef.current = [];
            onMultiplePress();
        }
    }, [onMultiplePress]);

    // Web 端
    if (Platform.OS === 'web') {
        return {
            onClick: handlePress,
        };
    }

    // 原生端 - 使用 onTouchEnd 不会影响子组件滑动
    return {
        onTouchEnd: handlePress,
    };
};
