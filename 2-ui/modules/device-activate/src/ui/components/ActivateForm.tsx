import React, {useCallback} from 'react';
import {ActivityIndicator, Dimensions, StyleSheet, Text, TextInput, TouchableOpacity, View,} from 'react-native';
import {useLifecycle} from "@impos2/ui-core-base-2";
import {useDeviceActivate} from "../../hooks";

/**
 * 设备激活表单组件 - 企业级设计
 */
export const ActivateForm: React.FC = () => {
    const {
        activationCode,
        activateStatus,
        handleActivationCodeChange,
        handleSubmit,
        cleanup
    } = useDeviceActivate();

    const [isFocused, setIsFocused] = React.useState(false);
    const isLoading = activateStatus?.status === 'started';
    const hasError = activateStatus?.status === 'error';
    const isValidLength = activationCode.length >= 6;
    const canSubmit = isValidLength && !isLoading;

    useLifecycle({
        isVisible: true,
        componentName: 'ActivateForm',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
            cleanup();
        }, [cleanup]),
    });
    return (
        <View style={styles.container}>
            {/* 背景 - 极简设计 */}
            <View style={styles.backgroundDecoration}>
                <View style={styles.gridPattern}/>
            </View>

            {/* 主卡片 */}
            <View style={styles.card}>
                {/* 头部区域 */}
                <View style={styles.header}>
                    <View style={styles.logoContainer}>
                        <View style={styles.logoBox}>
                            <Text style={styles.logoText}>IM</Text>
                        </View>
                    </View>
                    <Text style={styles.title}>设备激活</Text>
                    <Text style={styles.subtitle}>
                        请输入您的激活码以开始使用设备
                    </Text>
                </View>

                {/* 输入区域 */}
                <View style={styles.inputSection}>
                    <Text style={styles.label}>激活码</Text>
                    <View style={[
                        styles.inputWrapper,
                        isFocused && styles.inputWrapperFocused,
                        hasError && styles.inputWrapperError,
                        isValidLength && !hasError && styles.inputWrapperSuccess
                    ]}>
                        <TextInput
                            style={styles.input}
                            placeholder="请输入至少6位激活码"
                            placeholderTextColor="#94A3B8"
                            value={activationCode}
                            onChangeText={handleActivationCodeChange}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            editable={!isLoading}
                            autoCapitalize="none"
                            autoCorrect={false}
                            accessibilityLabel="激活码输入框"
                            accessibilityHint="请输入至少6位激活码"
                        />
                        {isValidLength && !hasError && (
                            <Text style={styles.successIndicator}>✓</Text>
                        )}
                    </View>

                    {/* 辅助文本 */}
                    {!hasError && (
                        <View style={styles.helperTextContainer}>
                            <Text style={styles.helperText}>
                                激活码由管理员提供，区分大小写
                            </Text>
                        </View>
                    )}
                    {/* 错误提示 */}
                    {hasError && (
                        Object.values(activateStatus!.errors).map(
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

                {/* 激活按钮 */}
                <TouchableOpacity
                    style={[
                        styles.button,
                        !canSubmit && styles.buttonDisabled
                    ]}
                    onPress={handleSubmit}
                    disabled={!canSubmit}
                    activeOpacity={0.85}
                    accessibilityLabel="激活按钮"
                    accessibilityRole="button"
                    accessibilityState={{disabled: !canSubmit, busy: isLoading}}
                >
                    {isLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF"/>
                    ) : (
                        <Text style={styles.buttonText}>
                            {isLoading ? '激活中...' : '立即激活'}
                        </Text>
                    )}
                </TouchableOpacity>

                {/* 底部提示 */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        遇到问题？请联系技术支持
                    </Text>
                </View>
            </View>
        </View>
    );
};

// 设计系统常量
const COLORS = {
    primary: '#0F172A',
    secondary: '#334155',
    cta: '#0369A1',
    success: '#059669',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    text: '#020617',
    textSecondary: '#475569',
    textTertiary: '#94A3B8',
    border: '#E2E8F0',
    borderFocus: '#0369A1',
    borderSuccess: '#059669',
    error: '#DC2626',
    errorBg: '#FEE2E2',
    successBg: '#ECFDF5',
    disabled: '#CBD5E1',
};

const {width, height} = Dimensions.get('window');

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    backgroundDecoration: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
    },
    gridPattern: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.background,
        opacity: 0.4,
    },
    card: {
        width: '100%',
        maxWidth: 440,
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 40,
        shadowColor: COLORS.primary,
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoContainer: {
        marginBottom: 24,
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
        fontSize: 28,
        fontWeight: '600',
        color: COLORS.text,
        textAlign: 'center',
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 15,
        fontWeight: '400',
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
    inputSection: {
        marginBottom: 32,
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
        height: 56,
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
    button: {
        backgroundColor: COLORS.cta,
        borderRadius: 8,
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.cta,
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    buttonDisabled: {
        backgroundColor: COLORS.disabled,
        shadowOpacity: 0,
        elevation: 0,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.surface,
        letterSpacing: 0.5,
    },
    footer: {
        alignItems: 'center',
        marginTop: 24,
    },
    footerText: {
        fontSize: 14,
        fontWeight: '400',
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
});
