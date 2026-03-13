import {useCallback, useRef} from 'react';
import {Animated} from 'react-native';
import {kernelCoreNavigationCommands, useEditableUiVariable} from '@impos2/kernel-core-navigation';
import {uiMixcTradeVariables} from '../ui/variables';
import {createOrderActiveScreenPart} from "../ui/screens/CreateOrderActiveScreen";

const DOUBLE_TAP_DELAY = 300;

export const useCreateOrderButton = () => {
    const {value: orderCreationType} = useEditableUiVariable(
        uiMixcTradeVariables.orderCreationType
    );

    const flashAnim = useRef(new Animated.Value(1)).current;
    const lastTapRef = useRef<number>(0);
    const singleTapTimerRef = useRef<NodeJS.Timeout | null>(null);

    const flash = useCallback(() => {
        Animated.sequence([
            Animated.timing(flashAnim, {toValue: 0.15, duration: 80, useNativeDriver: true}),
            Animated.timing(flashAnim, {toValue: 1, duration: 80, useNativeDriver: true}),
            Animated.timing(flashAnim, {toValue: 0.15, duration: 80, useNativeDriver: true}),
            Animated.timing(flashAnim, {toValue: 1, duration: 80, useNativeDriver: true}),
        ]).start();
    }, [flashAnim]);

    const handlePress = useCallback(() => {
        const now = Date.now();
        const delta = now - lastTapRef.current;

        if (delta < DOUBLE_TAP_DELAY) {
            // 双击
            if (singleTapTimerRef.current) {
                clearTimeout(singleTapTimerRef.current);
                singleTapTimerRef.current = null;
            }
            console.log('[CreateOrderButton] double tap');
        } else {
            // 延迟触发单击，等待是否有第二次点击
            singleTapTimerRef.current = setTimeout(() => {
                console.log('[CreateOrderButton] single tap');
                kernelCoreNavigationCommands.navigateTo({
                    target:createOrderActiveScreenPart
                })
                singleTapTimerRef.current = null;
            }, DOUBLE_TAP_DELAY);
        }

        lastTapRef.current = now;
    }, []);

    return {
        orderCreationType: orderCreationType ?? 'active',
        flashAnim,
        flash,
        handlePress,
    };
};
