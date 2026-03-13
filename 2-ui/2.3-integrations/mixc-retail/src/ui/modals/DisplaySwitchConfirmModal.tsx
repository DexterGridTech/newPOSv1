import React, {useCallback, useEffect, useRef, useState} from "react";
import {Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import Svg, {Circle, Defs, LinearGradient, Stop, Path} from "react-native-svg";
import {ModalScreen} from "@impos2/kernel-core-navigation";
import {InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";
import {ScreenMode, ScreenPartRegistration} from "@impos2/kernel-core-base";
import {useLifecycle} from "@impos2/ui-core-base";
import {useDisplaySwitchConfirm} from "../../hooks/useDisplaySwitchConfirm";

type DisplayType = 'primary' | 'secondary';

interface DisplaySwitchModalProps {
    displayType: DisplayType;
}

// SVG 箭头图标组件
const ArrowIcon: React.FC<{direction: 'left' | 'right'; size?: number; color?: string}> = ({
    direction,
    size = 32,
    color = '#2563EB'
}) => {
    const pathData = direction === 'left'
        ? "M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"
        : "M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z";

    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
            <Path d={pathData} />
        </Svg>
    );
};

export const DisplaySwitchConfirmModal: React.FC<ModalScreen<DisplaySwitchModalProps>> = React.memo((modal) => {
    const displayType = modal.props?.displayType || 'primary';

    const {
        handleConfirm,
        handleCancel,
        cleanup,
    } = useDisplaySwitchConfirm({
        modalId: modal.id,
        displayType,
    });

    // 动画值
    const scaleAnim = useRef(new Animated.Value(0.85)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // 倒计时状态
    const [countdown, setCountdown] = useState(3);
    const [isVisible, setIsVisible] = useState(false);

    const isMountedRef = useRef<boolean>(true);
    const prevOpenRef = useRef<boolean>(false);
    const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

    // 清理定时器
    const clearCountdownTimer = useCallback(() => {
        if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
        }
    }, []);

    // 脉冲动画
    const startPulseAnimation = useCallback(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.08,
                    duration: 600,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 600,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [pulseAnim]);

    // 启动倒计时
    const startCountdown = useCallback(() => {
        clearCountdownTimer();
        setCountdown(3);

        // 启动进度动画 (线性)
        progressAnim.setValue(0);
        Animated.timing(progressAnim, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
        }).start();

        // 启动脉冲动画
        startPulseAnimation();

        // 倒计时逻辑
        let count = 3;
        countdownTimerRef.current = setInterval(() => {
            count -= 1;
            if (isMountedRef.current) {
                setCountdown(count);
            }

            if (count <= 0) {
                clearCountdownTimer();
                if (isMountedRef.current) {
                    handleConfirm();
                }
            }
        }, 1000);
    }, [clearCountdownTimer, handleConfirm, progressAnim, startPulseAnimation]);

    // 打开/关闭动画
    useEffect(() => {
        if (!isMountedRef.current) return;

        const prevOpen = prevOpenRef.current;
        const currentOpen = modal.open;

        if (prevOpen === currentOpen) return;

        if (currentOpen) {
            // 打开动画 - 使用 spring 弹性效果
            setIsVisible(true);

            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 65,
                    friction: 8,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                if (isMountedRef.current) {
                    startCountdown();
                }
            });
        } else if (isVisible) {
            // 关闭动画 - 更快的退出
            clearCountdownTimer();
            pulseAnim.stopAnimation();

            Animated.parallel([
                Animated.timing(scaleAnim, {
                    toValue: 0.85,
                    duration: 180,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: 180,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                if (isMountedRef.current) {
                    setIsVisible(false);
                }
            });
        }

        prevOpenRef.current = currentOpen;
    }, [modal.open, isVisible, scaleAnim, opacityAnim, pulseAnim, startCountdown, clearCountdownTimer]);

    // 生命周期管理
    useLifecycle({
        componentName: 'DisplaySwitchConfirmModal',
        onInitiated: useCallback(() => {
            isMountedRef.current = true;
        }, []),
        onClearance: useCallback(() => {
            isMountedRef.current = false;
            clearCountdownTimer();
            scaleAnim.stopAnimation();
            opacityAnim.stopAnimation();
            progressAnim.stopAnimation();
            pulseAnim.stopAnimation();
            cleanup();
        }, [clearCountdownTimer, scaleAnim, opacityAnim, progressAnim, pulseAnim, cleanup]),
    });

    if (!isVisible) {
        return null;
    }

    const isPrimary = displayType === 'primary';
    const title = isPrimary ? '切换到主屏' : '切换到副屏';
    const subtitle = '检测到电源状态变化';

    // 计算 SVG 圆环进度
    const circumference = 2 * Math.PI * 54; // 半径 54
    const strokeDashoffset = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [circumference, 0],
    });

    return (
        <View style={styles.modalOverlay}>
            {/* 背景遮罩 */}
            <Animated.View style={[styles.backdropAnimated, {opacity: opacityAnim}]}>
                <TouchableOpacity
                    style={styles.backdrop}
                    activeOpacity={1}
                    onPress={handleCancel}
                    accessibilityLabel="取消切换"
                    accessibilityRole="button"
                />
            </Animated.View>

            {/* 弹窗主体 */}
            <Animated.View
                style={[
                    styles.dialogContainer,
                    {
                        transform: [{scale: scaleAnim}],
                        opacity: opacityAnim,
                    },
                ]}
            >
                {/* 渐变背景装饰 */}
                <View style={styles.gradientDecoration} />

                {/* 倒计时圆环区域 */}
                <View style={styles.countdownSection}>
                    <View style={styles.progressRingContainer}>
                        {/* SVG 进度环 */}
                        <Svg width={140} height={140} style={styles.progressSvg}>
                            <Defs>
                                <LinearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <Stop offset="0%" stopColor="#2563EB" stopOpacity="1" />
                                    <Stop offset="100%" stopColor="#3B82F6" stopOpacity="1" />
                                </LinearGradient>
                            </Defs>
                            {/* 背景圆环 */}
                            <Circle
                                cx="70"
                                cy="70"
                                r="54"
                                stroke="#E0F2FE"
                                strokeWidth="8"
                                fill="none"
                            />
                            {/* 进度圆环 */}
                            <AnimatedCircle
                                cx="70"
                                cy="70"
                                r="54"
                                stroke="url(#progressGradient)"
                                strokeWidth="8"
                                fill="none"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                                rotation="-90"
                                origin="70, 70"
                            />
                        </Svg>

                        {/* 中心内容 */}
                        <Animated.View
                            style={[
                                styles.countdownContent,
                                {
                                    transform: [{scale: pulseAnim}],
                                },
                            ]}
                        >
                            <View style={styles.iconContainer}>
                                <ArrowIcon
                                    direction={isPrimary ? 'left' : 'right'}
                                    size={40}
                                    color="#2563EB"
                                />
                            </View>
                            <Text style={styles.countdownText}>{countdown}</Text>
                            <Text style={styles.countdownLabel}>秒</Text>
                        </Animated.View>
                    </View>
                </View>

                {/* 文本区域 */}
                <View style={styles.textSection}>
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.subtitle}>{subtitle}</Text>
                </View>

                {/* 按钮区域 */}
                <View style={styles.actionsContainer}>
                    <TouchableOpacity
                        style={[styles.button, styles.cancelButton]}
                        onPress={handleCancel}
                        activeOpacity={0.7}
                        accessibilityLabel="取消"
                        accessibilityRole="button"
                    >
                        <Text style={[styles.buttonText, styles.cancelButtonText]}>
                            取消
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.button, styles.confirmButton]}
                        onPress={handleConfirm}
                        activeOpacity={0.85}
                        accessibilityLabel="立即切换"
                        accessibilityRole="button"
                    >
                        <Text style={[styles.buttonText, styles.confirmButtonText]}>
                            立即切换
                        </Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </View>
    );
});

// 创建 Animated Circle 组件
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const displaySwitchConfirmModalPartKey = "display-switch-confirm";

export const displaySwitchConfirmModalPart: ScreenPartRegistration = {
    name: 'displaySwitchConfirm',
    title: '显示切换确认',
    description: '显示切换确认弹窗',
    partKey: displaySwitchConfirmModalPartKey,
    screenMode: [ScreenMode.DESKTOP],
    instanceMode: [InstanceMode.SLAVE],
    workspace: [Workspace.MAIN, Workspace.BRANCH],
    componentType: DisplaySwitchConfirmModal
};

// 设计系统配色 - Minimalism & Swiss Style
const COLORS = {
    // 主色 - 蓝色系
    primary: '#2563EB',
    primaryLight: '#3B82F6',
    primaryBg: '#EFF6FF',
    progressBg: '#E0F2FE',

    // CTA - 橙色
    cta: '#F97316',

    // 中性色
    surface: '#FFFFFF',
    background: '#F8FAFC',
    text: '#1E293B',
    textSecondary: '#64748B',
    border: '#E2E8F0',

    // 遮罩
    overlay: 'rgba(15, 23, 42, 0.6)',
};

const {width, height} = Dimensions.get('window');

const styles = StyleSheet.create({
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1,
    },
    backdropAnimated: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: COLORS.overlay,
    },
    dialogContainer: {
        backgroundColor: COLORS.surface,
        borderRadius: 24,
        width: Math.min(width - 64, 420),
        maxWidth: 420,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 20,
        },
        shadowOpacity: 0.25,
        shadowRadius: 40,
        elevation: 24,
        zIndex: 2,
        overflow: 'hidden',
    },
    gradientDecoration: {
        position: 'absolute',
        top: -100,
        left: -100,
        right: -100,
        height: 300,
        backgroundColor: COLORS.primaryBg,
        opacity: 0.4,
        borderRadius: 200,
    },
    countdownSection: {
        paddingTop: 48,
        paddingBottom: 32,
        alignItems: 'center',
    },
    progressRingContainer: {
        width: 140,
        height: 140,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    progressSvg: {
        position: 'absolute',
    },
    countdownContent: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconContainer: {
        marginBottom: 4,
    },
    countdownText: {
        fontSize: 36,
        fontWeight: '700',
        color: COLORS.primary,
        lineHeight: 40,
        fontFamily: 'System',
    },
    countdownLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: COLORS.textSecondary,
        marginTop: 2,
        letterSpacing: 0.5,
    },
    textSection: {
        paddingHorizontal: 32,
        paddingBottom: 32,
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: '600',
        color: COLORS.text,
        textAlign: 'center',
        marginBottom: 8,
        letterSpacing: -0.5,
        fontFamily: 'System',
    },
    subtitle: {
        fontSize: 15,
        fontWeight: '400',
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
    actionsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 24,
        paddingBottom: 24,
        gap: 12,
    },
    button: {
        flex: 1,
        height: 52,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    cancelButton: {
        backgroundColor: COLORS.surface,
        borderWidth: 2,
        borderColor: COLORS.border,
    },
    confirmButton: {
        backgroundColor: COLORS.primary,
        shadowColor: COLORS.primary,
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 0.2,
        fontFamily: 'System',
    },
    cancelButtonText: {
        color: COLORS.textSecondary,
    },
    confirmButtonText: {
        color: COLORS.surface,
    },
});
