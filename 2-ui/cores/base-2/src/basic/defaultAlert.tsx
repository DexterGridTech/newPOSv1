import React from "react";
import {Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View,} from "react-native";
import {
    AlertInfo,
    defaultAlertPartKey,
    ModalScreen,
    ScreenPartRegistration
} from "@impos2/kernel-module-ui-navigation";
import {CommandRegistry, ScreenMode} from "@impos2/kernel-base";
import {CloseModalCommand} from "@impos2/kernel-module-ui-navigation/";

/**
 * Alert 弹窗组件 - 企业级设计
 *
 * 设计系统:
 * - 极简主义风格 (Minimalism & Swiss Style)
 * - 企业级配色方案 (Navy/Grey)
 * - 专业字体组合
 * - 流畅的弹簧动画
 * - WCAG AAA 可访问性标准
 * - 支持多种状态类型（成功、警告、错误、信息）
 */
export const DefaultAlert: React.FC<ModalScreen<AlertInfo>> = (model) => {
    const scaleAnim = React.useRef(new Animated.Value(0.9)).current;
    const opacityAnim = React.useRef(new Animated.Value(0)).current;
    const [isVisible, setIsVisible] = React.useState(false);

    // 动画效果
    React.useEffect(() => {
        if (model.open) {
            // 打开动画
            setIsVisible(true);
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
            ]).start();
        } else if (isVisible) {
            // 关闭动画
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
                setIsVisible(false);
            });
        }
    }, [model.open, isVisible]);

    if (!isVisible) return null;

    // 根据标题判断 Alert 类型
    const getAlertType = (): 'success' | 'warning' | 'error' | 'info' => {
        const title = model.props?.title?.toLowerCase() || '';
        if (title.includes('成功') || title.includes('success')) return 'success';
        if (title.includes('警告') || title.includes('warning')) return 'warning';
        if (title.includes('错误') || title.includes('失败') || title.includes('error')) return 'error';
        return 'info';
    };

    const alertType = getAlertType();

    // 根据类型获取配置 - 企业级配色
    const getAlertConfig = () => {
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
    };

    const config = getAlertConfig();

    const confirm = () => {
        const confirmCommand = model.props?.confirmCommandName
            ? CommandRegistry.create(model.props.confirmCommandName, model.props.confirmCommandPayload)
            : null;
        if (confirmCommand) {
            confirmCommand.executeInternally();
        }
        closeAlert();
    };

    const closeAlert = () => {
        new CloseModalCommand({modelId: model.id}).executeInternally();
    };

    return (
        <View style={styles.modalOverlay}>
            <Animated.View style={[styles.backdropAnimated, { opacity: opacityAnim }]}>
                <TouchableOpacity
                    style={styles.backdrop}
                    activeOpacity={1}
                    onPress={closeAlert}
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
                    <View style={styles.titleContainer}>
                        <Text style={styles.title}>{model.props?.title}</Text>
                    </View>

                    {/* 内容 */}
                    <View style={styles.contentContainer}>
                        <Text style={styles.message}>{model.props?.message}</Text>
                    </View>

                    {/* 按钮区域 */}
                    <View style={styles.actionsContainer}>
                        {model.props?.cancelText && (
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
                                !model.props?.cancelText && styles.singleButton,
                            ]}
                            onPress={confirm}
                            activeOpacity={0.85}
                            accessibilityLabel={model.props?.confirmText}
                            accessibilityRole="button"
                        >
                            <Text style={[styles.buttonText, styles.confirmButtonText]}>
                                {model.props?.confirmText}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
        </View>
    );
};

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
    partKey: defaultAlertPartKey,
    screenMode: [ScreenMode.DESKTOP, ScreenMode.MOBILE],
    componentType: DefaultAlert
};
