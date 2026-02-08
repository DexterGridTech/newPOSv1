import React, { useEffect, useRef, useMemo, useCallback } from "react";
import {Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View,} from "react-native";
import {
    AlertInfo,
    defaultAlertPartKey,
    ModalScreen,
    ScreenPartRegistration
} from "@impos2/kernel-base";
import {CommandRegistry, ScreenMode, logger, LOG_TAGS} from "@impos2/kernel-base";
import {CloseModalCommand} from "@impos2/kernel-base/";
import { moduleName } from "../moduleName";

/**
 * Alert 弹窗组件 - 企业级设计
 *
 * 职责：
 * 1. 展示不同类型的弹窗提示（成功、警告、错误、信息）
 * 2. 管理弹窗的打开/关闭动画
 * 3. 处理用户交互（确认、取消）
 * 4. 执行关联的命令
 * 5. 管理组件生命周期和资源释放
 * 6. 提供详细的调试日志
 *
 * 设计系统:
 * - 极简主义风格 (Minimalism & Swiss Style)
 * - 企业级配色方案 (Navy/Grey)
 * - 专业字体组合
 * - 流畅的弹簧动画
 * - WCAG AAA 可访问性标准
 * - 支持多种状态类型（成功、警告、错误、信息）
 */
export const DefaultAlert: React.FC<ModalScreen<AlertInfo>> = React.memo((model) => {
    // 动画值
    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    // 组件状态
    const [isVisible, setIsVisible] = React.useState(false);

    // 追踪组件挂载状态，防止内存泄漏
    const isMountedRef = useRef<boolean>(true);

    // 追踪动画状态，避免重复触发
    const isAnimatingRef = useRef<boolean>(false);

    // 追踪上一次的 open 状态，初始化为 false 以确保首次打开时能触发动画
    const prevOpenRef = useRef<boolean>(false);

    /**
     * 根据标题判断 Alert 类型
     */
    const getAlertType = useCallback((): 'success' | 'warning' | 'error' | 'info' => {
        const title = model.props?.title?.toLowerCase() || '';
        if (title.includes('成功') || title.includes('success')) return 'success';
        if (title.includes('警告') || title.includes('warning')) return 'warning';
        if (title.includes('错误') || title.includes('失败') || title.includes('error')) return 'error';
        return 'info';
    }, [model.props?.title]);

    /**
     * 打印详细的日志信息
     */
    const logAlertInfo = useCallback((action: 'open' | 'close' | 'confirm' | 'cancel', extraInfo?: any) => {
        const timestamp = new Date().toISOString();
        const alertInfo = {
            action,
            timestamp,
            modelId: model.id,
            title: model.props?.title || 'undefined',
            message: model.props?.message || 'undefined',
            alertType: getAlertType(),
            hasConfirmCommand: !!model.props?.confirmCommandName,
            confirmCommandName: model.props?.confirmCommandName || 'none',
            hasCancelButton: !!model.props?.cancelText,
            ...extraInfo
        };

        logger.log([moduleName, LOG_TAGS.System, 'DefaultAlert'], `${action.toUpperCase()}`, alertInfo);
    }, [model, getAlertType]);

    /**
     * 打印错误信息
     */
    const logError = useCallback((error: string, details?: any) => {
        const errorInfo = {
            timestamp: new Date().toISOString(),
            modelId: model.id,
            error,
            title: model.props?.title,
            ...details
        };

        logger.error([moduleName, LOG_TAGS.System, 'DefaultAlert'], 'Error', errorInfo);
    }, [model]);

    /**
     * 使用 useMemo 缓存 Alert 类型，避免重复计算
     */
    const alertType = useMemo(() => getAlertType(), [getAlertType]);

    /**
     * 使用 useMemo 缓存配置，避免重复计算
     */
    const config = useMemo(() => {
        switch (alertType) {
            case 'success':
                return {
                    color: '#059669',      // Green 600
                    bgColor: '#ECFDF5',    // Green 50
                    iconBg: '#059669',
                };
            case 'warning':
                return {
                    color: '#D97706',      // Amber 600
                    bgColor: '#FFFBEB',    // Amber 50
                    iconBg: '#D97706',
                };
            case 'error':
                return {
                    color: '#DC2626',      // Red 600
                    bgColor: '#FEF2F2',    // Red 50
                    iconBg: '#DC2626',
                };
            case 'info':
            default:
                return {
                    color: '#0369A1',      // Sky 700
                    bgColor: '#F0F9FF',    // Sky 50
                    iconBg: '#0369A1',
                };
        }
    }, [alertType]);

    /**
     * 关闭弹窗函数
     */
    const closeAlert = useCallback(() => {
        try {
            logAlertInfo('cancel');
            new CloseModalCommand({modelId: model.id}).executeInternally();
        } catch (error) {
            logError('Error closing alert', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }, [model.id, logAlertInfo, logError]);

    /**
     * 确认按钮处理函数
     */
    const confirm = useCallback(() => {
        try {
            logAlertInfo('confirm', {
                hasCommand: !!model.props?.confirmCommandName,
                commandName: model.props?.confirmCommandName
            });

            const confirmCommand = model.props?.confirmCommandName
                ? CommandRegistry.create(model.props.confirmCommandName, model.props.confirmCommandPayload)
                : null;

            if (confirmCommand) {
                logger.debug([moduleName, LOG_TAGS.System, 'DefaultAlert'], 'Executing confirm command', {
                    commandName: model.props?.confirmCommandName,
                    payload: model.props?.confirmCommandPayload
                });
                confirmCommand.executeInternally();
            } else if (model.props?.confirmCommandName) {
                logError('Confirm command not found', {
                    commandName: model.props.confirmCommandName
                });
            }

            closeAlert();
        } catch (error) {
            logError('Error executing confirm command', {
                error: error instanceof Error ? error.message : String(error),
                commandName: model.props?.confirmCommandName
            });
            // 即使出错也要关闭弹窗
            closeAlert();
        }
    }, [model.props?.confirmCommandName, model.props?.confirmCommandPayload, logAlertInfo, logError, closeAlert]);

    /**
     * 动画效果管理
     */
    useEffect(() => {
        // 检查组件是否已挂载
        if (!isMountedRef.current) return;

        // 检查是否正在动画中，避免重复触发
        if (isAnimatingRef.current) {
            logger.debug([moduleName, LOG_TAGS.System, 'DefaultAlert'], 'Animation already in progress, skipping');
            return;
        }

        const prevOpen = prevOpenRef.current;
        const currentOpen = model.open;

        // 状态未变化，跳过
        if (prevOpen === currentOpen) return;

        if (currentOpen) {
            // 打开动画
            isAnimatingRef.current = true;
            setIsVisible(true);
            logAlertInfo('open', { animationDuration: 200 });

            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 50,
                    friction: 7,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                if (isMountedRef.current) {
                    isAnimatingRef.current = false;
                    logger.debug([moduleName, LOG_TAGS.System, 'DefaultAlert'], 'Open animation completed');
                }
            });
        } else if (isVisible) {
            // 关闭动画
            isAnimatingRef.current = true;
            logAlertInfo('close', { animationDuration: 150 });

            Animated.parallel([
                Animated.timing(scaleAnim, {
                    toValue: 0.9,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: 150,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                // 动画完成后卸载组件
                if (isMountedRef.current) {
                    setIsVisible(false);
                    isAnimatingRef.current = false;
                    logger.debug([moduleName, LOG_TAGS.System, 'DefaultAlert'], 'Close animation completed');
                }
            });
        }

        // 更新 ref
        prevOpenRef.current = currentOpen;
    }, [model.open, isVisible, scaleAnim, opacityAnim, logAlertInfo]);

    /**
     * 组件挂载和卸载的生命周期管理
     */
    useEffect(() => {
        isMountedRef.current = true;

        logger.debug([moduleName, LOG_TAGS.System, 'DefaultAlert'], 'Component mounted', {
            modelId: model.id,
            title: model.props?.title,
            timestamp: new Date().toISOString()
        });

        // 组件卸载时的清理函数
        return () => {
            isMountedRef.current = false;

            // 停止所有正在进行的动画
            scaleAnim.stopAnimation();
            opacityAnim.stopAnimation();

            logger.debug([moduleName, LOG_TAGS.System, 'DefaultAlert'], 'Component unmounting', {
                modelId: model.id,
                wasVisible: isVisible,
                timestamp: new Date().toISOString()
            });

            // 清理 refs
            prevOpenRef.current = false;
            isAnimatingRef.current = false;

            logger.debug([moduleName, LOG_TAGS.System, 'DefaultAlert'], 'Component unmounted and resources released');
        };
    }, [model.id, scaleAnim, opacityAnim]);

    /**
     * 边界情况处理：组件不可见时不渲染
     */
    if (!isVisible) {
        return null;
    }

    /**
     * 边界情况处理：缺少必要的 props
     */
    if (!model.props) {
        logger.warn([moduleName, LOG_TAGS.System, 'DefaultAlert'], 'Missing props', { modelId: model.id });
        return null;
    }

    if (!model.props.title && !model.props.message) {
        logger.warn([moduleName, LOG_TAGS.System, 'DefaultAlert'], 'Missing title and message', { modelId: model.id });
        return null;
    }

    /**
     * 渲染组件
     */
    return (
        <View style={styles.modalOverlay}>
            <Animated.View style={[styles.backdropAnimated, { opacity: opacityAnim }]}>
                <TouchableOpacity
                    style={styles.backdrop}
                    activeOpacity={1}
                    onPress={closeAlert}
                    accessibilityLabel="关闭弹窗"
                    accessibilityRole="button"
                />
            </Animated.View>

            <Animated.View
                    style={[
                        styles.dialogContainer,
                        {
                            transform: [{scale: scaleAnim}],
                            opacity: opacityAnim,
                        },
                    ]}
                >
                    {/* 图标区域 */}
                    <View style={[styles.iconContainer, {backgroundColor: config.bgColor}]}>
                        <View style={[styles.iconCircle, {backgroundColor: config.iconBg}]}>
                            <Text style={styles.iconText}>
                                {alertType === 'success' ? '✓' : alertType === 'warning' ? '!' : alertType === 'error' ? '✕' : 'i'}
                            </Text>
                        </View>
                    </View>

                    {/* 标题 */}
                    {model.props.title && (
                        <View style={styles.titleContainer}>
                            <Text style={styles.title}>{model.props.title}</Text>
                        </View>
                    )}

                    {/* 内容 */}
                    {model.props.message && (
                        <View style={styles.contentContainer}>
                            <Text style={styles.message}>{model.props.message}</Text>
                        </View>
                    )}

                    {/* 按钮区域 */}
                    <View style={styles.actionsContainer}>
                        {model.props.cancelText && (
                            <TouchableOpacity
                                style={[styles.button, styles.cancelButton]}
                                onPress={closeAlert}
                                activeOpacity={0.7}
                                accessibilityLabel={model.props.cancelText}
                                accessibilityRole="button"
                            >
                                <Text style={[styles.buttonText, styles.cancelButtonText]}>
                                    {model.props.cancelText}
                                </Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[
                                styles.button,
                                styles.confirmButton,
                                {backgroundColor: config.color},
                                !model.props.cancelText && styles.singleButton,
                            ]}
                            onPress={confirm}
                            activeOpacity={0.85}
                            accessibilityLabel={model.props.confirmText || '确认'}
                            accessibilityRole="button"
                        >
                            <Text style={[styles.buttonText, styles.confirmButtonText]}>
                                {model.props.confirmText || '确认'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
        </View>
    );
}, (prevProps, nextProps) => {
    // 自定义比较函数，优化重渲染
    // 注意：传入的是整个 ModalScreen 对象，不是单独的 props
    return prevProps.id === nextProps.id &&
           prevProps.open === nextProps.open &&
           prevProps.partKey === nextProps.partKey &&
           prevProps.props?.title === nextProps.props?.title &&
           prevProps.props?.message === nextProps.props?.message &&
           prevProps.props?.confirmText === nextProps.props?.confirmText &&
           prevProps.props?.cancelText === nextProps.props?.cancelText &&
           prevProps.props?.confirmCommandName === nextProps.props?.confirmCommandName;
});

// 设计系统常量
const COLORS = {
    primary: '#0F172A',
    surface: '#FFFFFF',
    text: '#020617',
    textSecondary: '#64748B',
    border: '#E2E8F0',
    overlay: 'rgba(0, 0, 0, 0.5)',
};

const {width} = Dimensions.get('window');

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
        borderRadius: 16,
        width: Math.min(width - 48, 400),
        maxWidth: 400,
        shadowColor: COLORS.primary,
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        zIndex: 2,
    },
    iconContainer: {
        alignItems: 'center',
        paddingTop: 32,
        paddingBottom: 16,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconText: {
        fontSize: 32,
        color: COLORS.surface,
        fontWeight: '700',
    },
    titleContainer: {
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 8,
    },
    title: {
        textAlign: 'center',
        fontSize: 20,
        fontWeight: '600',
        color: COLORS.text,
        letterSpacing: -0.3,
    },
    contentContainer: {
        paddingHorizontal: 24,
        paddingVertical: 16,
    },
    message: {
        textAlign: 'center',
        fontSize: 15,
        lineHeight: 22,
        color: COLORS.textSecondary,
        fontWeight: '400',
    },
    actionsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 24,
        paddingBottom: 24,
        paddingTop: 16,
        gap: 12,
    },
    button: {
        flex: 1,
        minHeight: 48,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    cancelButton: {
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    confirmButton: {
        backgroundColor: '#0369A1',
    },
    singleButton: {
        flex: 1,
    },
    buttonText: {
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    cancelButtonText: {
        color: COLORS.textSecondary,
    },
    confirmButtonText: {
        color: COLORS.surface,
    },
});

export const defaultAlertPart: ScreenPartRegistration = {
    name: 'defaultAlert',
    title: '系统提示',
    description: '默认的系统提示弹窗组件',
    partKey: defaultAlertPartKey,
    screenMode: [ScreenMode.DESKTOP, ScreenMode.MOBILE],
    componentType: DefaultAlert
};
