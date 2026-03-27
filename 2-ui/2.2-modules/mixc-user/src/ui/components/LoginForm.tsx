import React from 'react';
import {ActivityIndicator, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {FancyInputV2, useLifecycle} from "@impos2/ui-core-base";
import {useLogin} from "../../hooks/useLogin";
import QRCode from 'react-native-qrcode-svg';

const COLORS = {
    primary: '#0F172A',
    secondary: '#334155',
    cta: '#0369A1',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    text: '#020617',
    textSecondary: '#475569',
    textTertiary: '#94A3B8',
    border: '#E2E8F0',
    borderActive: '#0369A1',
    disabled: '#CBD5E1',
};

export const LoginForm: React.FC = () => {
    const {
        loginMode,
        username,
        password,
        phone,
        smsCode,
        qrcodeUrl,
        loginStatus,
        handleModeChange,
        handleUsernameChange,
        handlePasswordChange,
        handlePhoneChange,
        handleSmsCodeChange,
        handlePasswordLogin,
        handleSmsLogin,
        handleSendSms,
        cleanup,
    } = useLogin();

    useLifecycle({
        componentName: 'LoginForm',
        onClearance: cleanup,
    });

    const canPasswordLogin = username.length > 0 && password.length > 0 && (loginStatus?.status!='started');
    const canSmsLogin = phone.length === 11 && smsCode.length === 6 && (loginStatus?.status!='started');

    return (
        <View style={styles.container}>
            <View style={styles.backgroundDecoration}>
                <View style={styles.gridPattern}/>
            </View>

            <View style={styles.card}>
                {/* 头部 */}
                <View style={styles.header}>
                    <View style={styles.logoContainer}>
                        <View style={styles.logoBox}>
                            <Text style={styles.logoText}>IM</Text>
                        </View>
                    </View>
                    <Text style={styles.title}>用户登录</Text>
                    <Text style={styles.subtitle}>选择您的登录方式</Text>
                </View>

                {/* Tab 切换 */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, loginMode === 'password' && styles.tabActive]}
                        onPress={() => handleModeChange('password')}
                    >
                        <Text style={[styles.tabText, loginMode === 'password' && styles.tabTextActive]}>
                            密码登录
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, loginMode === 'sms' && styles.tabActive]}
                        onPress={() => handleModeChange('sms')}
                    >
                        <Text style={[styles.tabText, loginMode === 'sms' && styles.tabTextActive]}>
                            验证码登录
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, loginMode === 'qrcode' && styles.tabActive]}
                        onPress={() => handleModeChange('qrcode')}
                    >
                        <Text style={[styles.tabText, loginMode === 'qrcode' && styles.tabTextActive]}>
                            扫码登录
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* 密码登录 */}
                {loginMode === 'password' && (
                    <View style={styles.formSection}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>用户名</Text>
                            <View style={styles.inputWrapper}>
                                <FancyInputV2
                                    value={username}
                                    onChangeText={handleUsernameChange}
                                    keyboardType="full"
                                    // onSubmit={handlePasswordLogin}
                                    editable={(loginStatus?.status!='started')}
                                    placeholder="请输入用户名"
                                    placeholderTextColor={COLORS.textTertiary}
                                    promptText="请输入用户名"
                                    style={styles.input}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>密码</Text>
                            <View style={styles.inputWrapper}>
                                <FancyInputV2
                                    value={password}
                                    onChangeText={handlePasswordChange}
                                    keyboardType="full"
                                    // onSubmit={handlePasswordLogin}
                                    editable={(loginStatus?.status!='started')}
                                    placeholder="请输入密码"
                                    placeholderTextColor={COLORS.textTertiary}
                                    promptText="请输入密码"
                                    secureTextEntry
                                    style={styles.input}
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.button, !canPasswordLogin && styles.buttonDisabled]}
                            onPress={handlePasswordLogin}
                            disabled={!canPasswordLogin}
                            activeOpacity={0.85}
                        >
                            {(loginStatus?.status==='started') ? (
                                <ActivityIndicator size="small" color="#FFFFFF"/>
                            ) : (
                                <Text style={styles.buttonText}>登录</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* 验证码登录 */}
                {loginMode === 'sms' && (
                    <View style={styles.formSection}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>手机号</Text>
                            <View style={styles.inputWrapper}>
                                <FancyInputV2
                                    value={phone}
                                    onChangeText={handlePhoneChange}
                                    keyboardType="number"
                                    onSubmit={() => {}}
                                    editable={(loginStatus?.status!='started')}
                                    placeholder="请输入手机号"
                                    placeholderTextColor={COLORS.textTertiary}
                                    promptText="请输入11位手机号"
                                    maxLength={11}
                                    style={styles.input}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>验证码</Text>
                            <View style={styles.smsInputRow}>
                                <View style={[styles.inputWrapper, styles.smsInput]}>
                                    <FancyInputV2
                                        value={smsCode}
                                        onChangeText={handleSmsCodeChange}
                                        keyboardType="number"
                                        onSubmit={handleSmsLogin}
                                        editable={(loginStatus?.status!='started')}
                                        placeholder="请输入验证码"
                                        placeholderTextColor={COLORS.textTertiary}
                                        promptText="请输入6位验证码"
                                        maxLength={6}
                                        style={styles.input}
                                    />
                                </View>
                                <TouchableOpacity
                                    style={styles.smsButton}
                                    onPress={handleSendSms}
                                    disabled={phone.length !== 11 || (loginStatus?.status!='started')}
                                >
                                    <Text style={styles.smsButtonText}>发送验证码</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.button, !canSmsLogin && styles.buttonDisabled]}
                            onPress={handleSmsLogin}
                            disabled={!canSmsLogin}
                            activeOpacity={0.85}
                        >
                            {(loginStatus?.status==='started') ? (
                                <ActivityIndicator size="small" color="#FFFFFF"/>
                            ) : (
                                <Text style={styles.buttonText}>登录</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* 扫码登录 */}
                {loginMode === 'qrcode' && (
                    <View style={styles.formSection}>
                        <View style={styles.qrcodeContainer}>
                            <View style={styles.qrcodePlaceholder}>
                                {qrcodeUrl ? (
                                    <QRCode value={qrcodeUrl} size={180} />
                                ) : (
                                    <Text style={styles.qrcodeText}>生成中...</Text>
                                )}
                            </View>
                            <Text style={styles.qrcodeHint}>请使用手机扫描二维码登录</Text>
                        </View>
                    </View>
                )}

                {/* 底部 */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>遇到问题？请联系技术支持</Text>
                </View>
            </View>
        </View>
    );
};

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
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
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
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: COLORS.background,
        borderRadius: 8,
        padding: 4,
        marginBottom: 32,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 6,
    },
    tabActive: {
        backgroundColor: COLORS.surface,
        shadowColor: COLORS.primary,
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.textSecondary,
    },
    tabTextActive: {
        color: COLORS.cta,
        fontWeight: '600',
    },
    formSection: {
        marginBottom: 24,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 8,
        letterSpacing: 0.2,
    },
    inputWrapper: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        backgroundColor: COLORS.surface,
        paddingHorizontal: 16,
        height: 56,
        justifyContent: 'center',
    },
    input: {
        fontSize: 16,
        fontWeight: '400',
        color: COLORS.text,
        padding: 0,
        lineHeight: 24,
    },
    smsInputRow: {
        flexDirection: 'row',
        gap: 12,
    },
    smsInput: {
        flex: 1,
    },
    smsButton: {
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        paddingHorizontal: 16,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 110,
    },
    smsButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.cta,
    },
    button: {
        backgroundColor: COLORS.cta,
        borderRadius: 8,
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.cta,
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
        marginTop: 12,
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
    qrcodeContainer: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    qrcodePlaceholder: {
        width: 200,
        height: 200,
        backgroundColor: COLORS.background,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: COLORS.border,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    qrcodeText: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginBottom: 8,
    },
    qrcodeUrl: {
        fontSize: 10,
        color: COLORS.textTertiary,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    qrcodeHint: {
        fontSize: 14,
        fontWeight: '400',
        color: COLORS.textSecondary,
        textAlign: 'center',
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
