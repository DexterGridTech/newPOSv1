import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { logger, LOG_TAGS } from '@impos2/kernel-base';
import { moduleName } from '../types';

/**
 * Modal 动画配置接口
 */
export interface ModalAnimationConfig {
    /**
     * 打开动画时长（毫秒）
     */
    openDuration?: number;
    /**
     * 关闭动画时长（毫秒）
     */
    closeDuration?: number;
    /**
     * 弹簧动画张力
     */
    tension?: number;
    /**
     * 弹簧动画摩擦力
     */
    friction?: number;
    /**
     * Modal 名称（用于日志）
     */
    modalName?: string;
}

/**
 * Modal 动画 Hook 返回值
 */
export interface ModalAnimationResult {
    /**
     * 缩放动画值
     */
    scaleAnim: Animated.Value;
    /**
     * 透明度动画值
     */
    opacityAnim: Animated.Value;
    /**
     * Modal 是否可见
     */
    isVisible: boolean;
}

/**
 * 通用 Modal 动画 Hook
 *
 * 职责：
 * 1. 管理 Modal 的打开/关闭动画
 * 2. 管理组件的挂载状态，防止内存泄漏
 * 3. 追踪动画状态，避免重复触发
 * 4. 提供统一的动画配置
 *
 * @param open - Modal 是否打开
 * @param modelId - Modal ID（用于日志）
 * @param config - 动画配置
 * @returns Modal 动画相关的状态和动画值
 */
export const useModalAnimation = (
    open: boolean,
    modelId: string,
    config: ModalAnimationConfig = {}
): ModalAnimationResult => {
    const {
        openDuration = 200,
        closeDuration = 150,
        tension = 50,
        friction = 7,
        modalName = 'Modal'
    } = config;

    // 动画值
    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    // 组件状态
    const [isVisible, setIsVisible] = useState(false);

    // 追踪组件挂载状态，防止内存泄漏
    const isMountedRef = useRef<boolean>(true);

    // 追踪动画状态，避免重复触发
    const isAnimatingRef = useRef<boolean>(false);

    // 追踪上一次的 open 状态
    const prevOpenRef = useRef<boolean>(false);

    /**
     * 动画效果管理
     */
    useEffect(() => {
        // 检查组件是否已挂载
        if (!isMountedRef.current) return;

        // 检查是否正在动画中，避免重复触发
        if (isAnimatingRef.current) {
            return;
        }

        const prevOpen = prevOpenRef.current;
        const currentOpen = open;

        // 状态未变化，跳过
        if (prevOpen === currentOpen) return;

        if (currentOpen) {
            // 打开动画
            isAnimatingRef.current = true;
            setIsVisible(true);

            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension,
                    friction,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: openDuration,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                if (isMountedRef.current) {
                    isAnimatingRef.current = false;
                    logger.debug([moduleName, LOG_TAGS.System, modalName], 'Open animation completed');
                }
            });
        } else if (isVisible) {
            // 关闭动画
            isAnimatingRef.current = true;

            Animated.parallel([
                Animated.timing(scaleAnim, {
                    toValue: 0.9,
                    duration: closeDuration,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: closeDuration,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                // 动画完成后卸载组件
                if (isMountedRef.current) {
                    setIsVisible(false);
                    isAnimatingRef.current = false;
                    logger.debug([moduleName, LOG_TAGS.System, modalName], 'Close animation completed');
                }
            });
        }

        // 更新 ref
        prevOpenRef.current = currentOpen;
    }, [open, isVisible, scaleAnim, opacityAnim, openDuration, closeDuration, tension, friction, modalName]);

    /**
     * 组件挂载和卸载的生命周期管理
     */
    useEffect(() => {
        isMountedRef.current = true;

        // 组件卸载时的清理函数
        return () => {
            isMountedRef.current = false;

            // 停止所有正在进行的动画
            scaleAnim.stopAnimation();
            opacityAnim.stopAnimation();

            // 清理 refs
            prevOpenRef.current = false;
            isAnimatingRef.current = false;
        };
    }, [modelId, scaleAnim, opacityAnim]);

    return {
        scaleAnim,
        opacityAnim,
        isVisible,
    };
};
