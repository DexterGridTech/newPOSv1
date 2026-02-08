import React, {useCallback, useState} from 'react';
import {ActivityIndicator, Dimensions, StyleSheet, Text, TextInput, TouchableOpacity, View,} from 'react-native';
import {useUserLogin} from "../../hooks";
import {useLifecycle} from "@impos2/ui-core-base-2";


export const LoginForm: React.FC = () => {

    const {
        userId,
        password,
        loginStatus,
        handleUserIdChange,
        handlePasswordChange,
        handleSubmit,
        cleanup
    } = useUserLogin();
    const [showPassword, setShowPassword] = useState(false);
    const [focusedField, setFocusedField] = useState<'userId' | 'password' | null>(null);

    const isLoading = loginStatus?.status === 'started';
    const hasError = loginStatus?.status === 'error';
    const isValidForm = userId.length > 0 && password.length > 0;
    const canSubmit = isValidForm && !isLoading;


    useLifecycle({
        isVisible: true,
        componentName: 'LoginForm',
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
                    <Text style={styles.title}>用户登录</Text>
                    <Text style={styles.subtitle}>请输入您的账号信息以继续</Text>
                </View>

                {/* 输入区域 */}
                <View style={styles.inputSection}>
                    {/* 用户ID输入 */}
                    <View style={styles.fieldContainer}>
                        <Text style={styles.label}>账号</Text>
                        <View style={[
                            styles.inputWrapper,
                            focusedField === 'userId' && styles.inputWrapperFocused,
                            hasError && styles.inputWrapperError
                        ]}>
                            <TextInput
                                style={styles.input}
                                placeholder="请输入账号"
                                placeholderTextColor="#94A3B8"
                                value={userId}
                                onChangeText={handleUserIdChange}
                                onFocus={() => setFocusedField('userId')}
                                onBlur={() => setFocusedField(null)}
                                editable={!isLoading}
                                autoCapitalize="none"
                                autoCorrect={false}
                                accessibilityLabel="账号输入框"
                                accessibilityHint="请输入您的登录账号"
                            />
                        </View>
                    </View>

                    {/* 密码输入 */}
                    <View style={styles.fieldContainer}>
                        <Text style={styles.label}>密码</Text>
                        <View style={[
                            styles.inputWrapper,
                            focusedField === 'password' && styles.inputWrapperFocused,
                            hasError && styles.inputWrapperError
                        ]}>
                            <TextInput
                                style={styles.input}
                                placeholder="请输入密码"
                                placeholderTextColor="#94A3B8"
                                value={password}
                                onChangeText={handlePasswordChange}
                                onFocus={() => setFocusedField('password')}
                                onBlur={() => setFocusedField(null)}
                                editable={!isLoading}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                                autoCorrect={false}
                                accessibilityLabel="密码输入框"
                                accessibilityHint="请输入您的登录密码"
                            />
                            <TouchableOpacity
                                style={styles.eyeButton}
                                onPress={() => setShowPassword(!showPassword)}
                                activeOpacity={0.7}
                                accessibilityLabel={showPassword ? "隐藏密码" : "显示密码"}
                                accessibilityRole="button"
                            >
                                <Text style={styles.eyeButtonText}>
                                    {showPassword ? '隐藏' : '显示'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* 错误提示 */}
                    {hasError && (
                        Object.values(loginStatus!.errors).map(
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

                {/* 登录按钮 */}
                <TouchableOpacity
                    style={[
                        styles.button,
                        !canSubmit && styles.buttonDisabled
                    ]}
                    onPress={handleSubmit}
                    disabled={!canSubmit}
                    activeOpacity={0.85}
                    accessibilityLabel="登录按钮"
                    accessibilityRole="button"
                    accessibilityState={{disabled: !canSubmit, busy: isLoading}}
                >
                    {isLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF"/>
                    ) : (
                        <Text style={styles.buttonText}>
                            {isLoading ? '登录中...' : '登录！'}
                        </Text>
                    )}
                </TouchableOpacity>

                {/* 底部提示 */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        忘记密码？请联系管理员
                    </Text>
                </View>
            </View>
        </View>
    );
};

// 设计系统常量
const COLORS = {
    primary: '#0F172A',      // Navy - 主色
    secondary: '#334155',    // Slate - 次要色
    cta: '#0369A1',         // Sky Blue - CTA按钮
    background: '#F8FAFC',   // Slate 50 - 背景
    surface: '#FFFFFF',      // 白色 - 卡片表面
    text: '#020617',        // Slate 950 - 主文本
    textSecondary: '#475569', // Slate 600 - 次要文本
    textTertiary: '#94A3B8', // Slate 400 - 占位符
    border: '#E2E8F0',      // Slate 200 - 边框
    borderFocus: '#0369A1',  // 聚焦边框
    error: '#DC2626',       // Red 600 - 错误
    errorBg: '#FEE2E2',     // Red 100 - 错误背景
    disabled: '#CBD5E1',    // Slate 300 - 禁用
};

const {width} = Dimensions.get('window');

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
    fieldContainer: {
        marginBottom: 24,
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
    input: {
        flex: 1,
        fontSize: 16,
        fontWeight: '400',
        color: COLORS.text,
        padding: 0,
        lineHeight: 24,
    },
    eyeButton: {
        marginLeft: 12,
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    eyeButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.cta,
        letterSpacing: 0.3,
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
