import React, {useCallback} from "react";
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import {ModalScreen, ScreenMode, ScreenPartRegistration} from "@impos2/kernel-base";
import {FancyInputV2, useLifecycle, useModalAnimation} from "@impos2/ui-core-base-2";
import {moduleName} from "../../moduleName";
import {useAdminLogin} from "../../hooks";

/**
 * 管理员登录表单 Modal 组件 - 企业级设计
 *
 * 职责：
 * 1. 展示管理员登录表单
 * 2. 管理弹窗的打开/关闭动画
 * 3. 处理用户输入和登录提交
 * 4. 管理组件生命周期和资源释放
 * 5. 提供详细的调试日志
 *
 * 设计系统:
 * - 极简主义风格 (Minimalism & Swiss Style)
 * - 企业级配色方案 (Navy/Grey)
 * - 专业字体组合
 * - 流畅的弹簧动画
 * - WCAG AAA 可访问性标准
 */

// 定义 Modal 的 props 类型（如果需要传递额外参数）
export interface AdminLoginModalProps {
    // 可以添加额外的配置参数
}

export const AdminLoginModal: React.FC<ModalScreen<AdminLoginModalProps>> = React.memo((model) => {

    // 使用通用的 Modal 动画 Hook
    const {scaleAnim, opacityAnim, isVisible} = useModalAnimation(model.open, model.id, {
        modalName: 'AdminLoginModal',
        moduleName,
        openDuration: 200,
        closeDuration: 150,
        tension: 50,
        friction: 7,
    });

    // 组件状态
    const [isFocused, setIsFocused] = React.useState(false);

    // 使用 hook 管理登录逻辑
    const {
        password,
        loginStatus,
        handlePasswordChange,
        handleSubmit,
        handleClose,
        cleanup
    } = useAdminLogin({modalId: model.id});

    // 使用 useLifecycle hook 处理组件生命周期
    useLifecycle({
        componentName: 'AdminLoginModal',
        onInitiated: useCallback(() => {
        }, [model.id]),
        onClearance: useCallback(() => {
            cleanup()
        }, [model.id]),
    });

    const isLoading = loginStatus?.status === 'started';
    const hasError = loginStatus?.status === 'error';
    const isValidLength = (password || '').length >= 1;
    const canSubmit = isValidLength && !isLoading;


    /**
     * 提交登录
     */
    const onSubmit = useCallback(() => {
        handleSubmit();
    }, [handleSubmit]);

    /**
     * 边界情况处理：组件不可见时不渲染
     */
    if (!isVisible) {
        return null;
    }

    /**
     * 渲染组件
     */
    return (
        <View style={styles.modalOverlay}>
            <Animated.View style={[styles.backdropAnimated, {opacity: opacityAnim}]}>
                <TouchableOpacity
                    style={styles.backdrop}
                    activeOpacity={1}
                    onPress={handleClose}
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
                {/* 头部区域 */}
                <View style={styles.header}>
                    <View style={styles.logoContainer}>
                        <View style={styles.logoBox}>
                            <Text style={styles.logoText}>SA</Text>
                        </View>
                    </View>
                    <Text style={styles.title}>管理员登录</Text>
                    <Text style={styles.subtitle}>
                        请输入管理员密码以继续
                    </Text>
                </View>

                {/* 输入区域 */}
                <View style={styles.inputSection}>
                    <Text style={styles.label}>管理员密码</Text>
                    <View style={[
                        styles.inputWrapper,
                        isFocused && styles.inputWrapperFocused,
                        hasError && styles.inputWrapperError,
                        isValidLength && !hasError && styles.inputWrapperSuccess
                    ]}>
                        <FancyInputV2
                            value={password || ''}
                            onChangeText={handlePasswordChange}
                            keyboardType="number"
                            onSubmit={() => {
                            }}
                            placeholder="请输入密码"
                            placeholderTextColor="#94A3B8"
                            secureTextEntry={true}
                            promptText="请输入3位数字密码（123）"
                            maxLength={3}
                            style={styles.input}
                        />
                        {isValidLength && !hasError && (
                            <Text style={styles.successIndicator}>✓</Text>
                        )}
                    </View>

                    {/* 辅助文本 */}
                    {!hasError && (
                        <View style={styles.helperTextContainer}>
                            <Text style={styles.helperText}>
                                请输入正确的管理员密码
                            </Text>
                        </View>
                    )}
                    {/* 错误提示 */}
                    {hasError && loginStatus && (
                        Object.values(loginStatus.errors).map(
                            (error) => (
                                <View key={error.key} style={styles.errorContainer}>
                                    <View style={styles.errorIndicator}/>
                                    <Text style={styles.errorText}>
                                        {error.message}
                                    </Text>
                                </View>
                            )
                        )
                    )}
                </View>

                {/* 按钮区域 */}
                <View style={styles.actionsContainer}>
                    <TouchableOpacity
                        style={[styles.button, styles.cancelButton]}
                        onPress={handleClose}
                        activeOpacity={0.7}
                        accessibilityLabel="取消"
                        accessibilityRole="button"
                    >
                        <Text style={[styles.buttonText, styles.cancelButtonText]}>
                            取消
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.button,
                            styles.confirmButton,
                            !canSubmit && styles.buttonDisabled,
                        ]}
                        onPress={onSubmit}
                        disabled={!canSubmit}
                        activeOpacity={0.85}
                        accessibilityLabel="确认登录"
                        accessibilityRole="button"
                        accessibilityState={{disabled: !canSubmit, busy: isLoading}}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#FFFFFF"/>
                        ) : (
                            <Text style={[styles.buttonText, styles.confirmButtonText]}>
                                确认登录
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </View>
    );
}, (prevProps, nextProps) => {
    // 自定义比较函数，优化重渲染
    return prevProps.id === nextProps.id &&
        prevProps.open === nextProps.open &&
        prevProps.partKey === nextProps.partKey;
});

// 设计系统常量
const COLORS = {
    primary: '#0F172A',
    surface: '#FFFFFF',
    text: '#020617',
    textSecondary: '#64748B',
    textTertiary: '#94A3B8',
    border: '#E2E8F0',
    borderFocus: '#0369A1',
    borderSuccess: '#059669',
    overlay: 'rgba(0, 0, 0, 0.5)',
    cta: '#0369A1',
    success: '#059669',
    successBg: '#ECFDF5',
    error: '#DC2626',
    errorBg: '#FEE2E2',
    disabled: '#CBD5E1',
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
        width: Math.min(width - 48, 440),
        maxWidth: 440,
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
    header: {
        alignItems: 'center',
        paddingTop: 32,
        paddingHorizontal: 24,
        paddingBottom: 24,
    },
    logoContainer: {
        marginBottom: 16,
    },
    logoBox: {
        width: 64,
        height: 64,
        backgroundColor: COLORS.primary,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoText: {
        fontSize: 28,
        fontWeight: '700',
        color: COLORS.surface,
        letterSpacing: 1,
    },
    title: {
        textAlign: 'center',
        fontSize: 24,
        fontWeight: '600',
        color: COLORS.text,
        letterSpacing: -0.3,
        marginBottom: 8,
    },
    subtitle: {
        textAlign: 'center',
        fontSize: 15,
        lineHeight: 22,
        color: COLORS.textSecondary,
        fontWeight: '400',
    },
    inputSection: {
        paddingHorizontal: 24,
        paddingBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 8,
        letterSpacing: 0.2,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        backgroundColor: COLORS.surface,
        paddingHorizontal: 16,
        height: 48,
    },
    inputWrapperFocused: {
        borderColor: COLORS.borderFocus,
        borderWidth: 2,
        shadowColor: COLORS.cta,
        shadowOffset: {
            width: 0,
            height: 0,
        },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 2,
    },
    inputWrapperError: {
        borderColor: COLORS.error,
        backgroundColor: COLORS.errorBg,
    },
    inputWrapperSuccess: {
        borderColor: COLORS.borderSuccess,
        backgroundColor: COLORS.successBg,
    },
    input: {
        flex: 1,
        fontSize: 16,
        fontWeight: '400',
        color: COLORS.text,
        padding: 0,
        lineHeight: 24,
    },
    successIndicator: {
        fontSize: 20,
        color: COLORS.success,
        marginLeft: 8,
    },
    helperTextContainer: {
        marginTop: 8,
        paddingHorizontal: 4,
    },
    helperText: {
        fontSize: 13,
        fontWeight: '400',
        color: COLORS.textSecondary,
        lineHeight: 18,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: COLORS.errorBg,
        borderRadius: 8,
        padding: 12,
        marginTop: 8,
        borderLeftWidth: 3,
        borderLeftColor: COLORS.error,
    },
    errorIndicator: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.error,
        marginTop: 6,
        marginRight: 8,
    },
    errorText: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.error,
        flex: 1,
        lineHeight: 20,
    },
    actionsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 24,
        paddingBottom: 24,
        paddingTop: 8,
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
        backgroundColor: COLORS.cta,
    },
    buttonDisabled: {
        backgroundColor: COLORS.disabled,
        shadowOpacity: 0,
        elevation: 0,
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

// 导出 ScreenPartRegistration
export const adminLoginModalPartKey = 'adminLoginModal';

export const adminLoginModalPart: ScreenPartRegistration = {
    name: 'adminLoginModal',
    title: '管理员登录',
    description: '管理员身份验证登录弹窗',
    partKey: adminLoginModalPartKey,
    screenMode: [ScreenMode.DESKTOP, ScreenMode.MOBILE],
    componentType: AdminLoginModal
};
