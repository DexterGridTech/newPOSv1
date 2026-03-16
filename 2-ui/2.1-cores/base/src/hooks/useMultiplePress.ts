import { useRef, useCallback } from 'react';
import { Platform } from 'react-native';

interface UseMultiplePressOptions {
    onMultiplePress: () => void;
}

export const useMultiplePress = ({
    onMultiplePress,
}: UseMultiplePressOptions) => {
    const stageRef = useRef(0); // 0: 等待开始, 1: 等待2连击, 2: 等待3连击
    const stageCountRef = useRef(0); // 当前阶段内的点击次数
    const lastPressTimeRef = useRef(0);
    const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

    const resetState = useCallback(() => {
        stageRef.current = 0;
        stageCountRef.current = 0;
        lastPressTimeRef.current = 0;
        if (resetTimerRef.current) {
            clearTimeout(resetTimerRef.current);
            resetTimerRef.current = null;
        }
    }, []);

    const handlePress = useCallback(() => {
        const now = Date.now();
        const timeSinceLastPress = now - lastPressTimeRef.current;

        // 清除之前的重置定时器
        if (resetTimerRef.current) {
            clearTimeout(resetTimerRef.current);
            resetTimerRef.current = null;
        }

        if (stageRef.current === 0) {
            // 初始状态：第一次点击
            stageRef.current = 1;
            stageCountRef.current = 1;
            lastPressTimeRef.current = now;
            resetTimerRef.current = setTimeout(resetState, 3000);
        } else if (stageRef.current === 1) {
            // 阶段1：等待2连击
            if (timeSinceLastPress < 1000) {
                // 快速连击（<1秒）
                stageCountRef.current++;
                lastPressTimeRef.current = now;

                if (stageCountRef.current === 2) {
                    // 完成2连击，进入阶段2
                    stageRef.current = 2;
                    stageCountRef.current = 0;
                }
                resetTimerRef.current = setTimeout(resetState, 3000);
            } else if (timeSinceLastPress >= 1000 && timeSinceLastPress <= 3000) {
                // 停顿后点击，重新开始阶段1
                stageCountRef.current = 1;
                lastPressTimeRef.current = now;
                resetTimerRef.current = setTimeout(resetState, 3000);
            } else {
                // 超时
                resetState();
            }
        } else if (stageRef.current === 2) {
            // 阶段2：等待3连击
            if (timeSinceLastPress < 1000) {
                // 快速连击（<1秒）
                stageCountRef.current++;
                lastPressTimeRef.current = now;

                if (stageCountRef.current === 3) {
                    // 完成3连击，触发事件
                    resetState();
                    onMultiplePress();
                } else {
                    resetTimerRef.current = setTimeout(resetState, 3000);
                }
            } else if (timeSinceLastPress >= 1000 && timeSinceLastPress <= 3000) {
                // 停顿后点击，开始3连击计数
                stageCountRef.current = 1;
                lastPressTimeRef.current = now;
                resetTimerRef.current = setTimeout(resetState, 3000);
            } else {
                // 超时
                resetState();
            }
        }
    }, [onMultiplePress, resetState]);

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
