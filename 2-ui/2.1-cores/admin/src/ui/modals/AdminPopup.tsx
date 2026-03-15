import React, {useEffect, useState} from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    StatusBar,
    Platform
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {getDeviceId} from '@impos2/kernel-core-base';
import {getResponsiveLayout} from '../responsive';
import {DeviceStatusScreen} from '../screens/DeviceStatusScreen';
import {TerminalConnectionScreen} from '../screens/TerminalConnectionScreen';
import {LocalServerStatusScreen} from '../screens/LocalServerStatusScreen';
import {SwitchInstanceModeScreen} from '../screens/SwitchInstanceModeScreen';
import {AppControlScreen} from '../screens/AppControlScreen';
import {LogFilesScreen} from '../screens/LogFilesScreen';

interface AdminPopupProps {
    visible: boolean;
    onClose: () => void;
}

type Screen = 'login' | 'panel';

const COLORS = {
    primary: '#0F172A',
    surface: '#FFFFFF',
    text: '#020617',
    textSecondary: '#64748B',
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
    menuBg: '#F8FAFC',
    menuActive: '#0369A1',
};

const menuItems = [
    {key: 'device', title: '设备状态'},
    {key: 'logs', title: '日志文件'},
    {key: 'instance', title: '实例模式'},
    {key: 'control', title: 'APP控制'},
    {key: 'terminal', title: '终端连接'},
    {key: 'server', title: '本地服务'},
];

const ScreenWrapper: React.FC<{ children: React.ReactNode }> = ({children}) => (
    <View style={{flex: 1}}>
        {children}
    </View>
);


const LoginScreen: React.FC<{
    password: string;
    isLoading: boolean;
    error: string;
    onPasswordChange: (text: string) => void;
    onSubmit: () => void;
    onClose: () => void;
}> = ({password, isLoading, error, onPasswordChange, onSubmit, onClose}) => {
    const isValidLength = password.length >= 1;
    const canSubmit = isValidLength && !isLoading;
    const [deviceId, setDeviceId] = useState<string>('');

    useEffect(() => {
        setDeviceId(getDeviceId())
    }, []);

    return (
        <View style={styles.loginContainer}>
            <View style={styles.header}>
                <View style={styles.logoBox}>
                    <Text style={styles.logoText}>SA</Text>
                </View>
                <Text style={styles.title}>管理员登录</Text>
                <Text style={styles.subtitle}>请输入管理员密码以继续</Text>
            </View>

            {deviceId && (
                <View style={styles.qrSection}>
                    <View style={styles.qrContainer}>
                        <QRCode value={deviceId} size={120}/>
                    </View>
                    <Text style={styles.deviceIdText}>设备 ID: {deviceId}</Text>
                </View>
            )}

            <View style={styles.inputSection}>
                <Text style={styles.label}>管理员密码</Text>
                <View
                    style={[styles.inputWrapper, error && styles.inputWrapperError, isValidLength && !error && styles.inputWrapperSuccess]}>
                    <TextInput
                        value={password}
                        onChangeText={onPasswordChange}
                        keyboardType="number-pad"
                        placeholder="请输入密码"
                        placeholderTextColor="#94A3B8"
                        secureTextEntry
                        style={styles.input}
                    />
                    {isValidLength && !error && <Text style={styles.successIndicator}>✓</Text>}
                </View>
                {error && (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}
            </View>

            <View style={styles.actionsContainer}>
                <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
                    <Text style={[styles.buttonText, styles.cancelButtonText]}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.button, styles.confirmButton, !canSubmit && styles.buttonDisabled]}
                    onPress={onSubmit}
                    disabled={!canSubmit}
                >
                    {isLoading ? <ActivityIndicator size="small" color="#FFF"/> :
                        <Text style={[styles.buttonText, styles.confirmButtonText]}>确认登录</Text>}
                </TouchableOpacity>
            </View>
        </View>
    );
};

const PanelScreen: React.FC<{
    layout: ReturnType<typeof getResponsiveLayout>;
    selectedMenu: string;
    onMenuSelect: (key: string) => void;
    onClose: () => void;
    onBackToLogin: () => void;
}> = ({layout, selectedMenu, onMenuSelect, onClose, onBackToLogin}) => {
    return (
        <View style={[styles.panelContainer, {width: layout.modalWidth, height: layout.modalHeight}]}>
            <View style={[styles.titleBar, {paddingHorizontal: layout.padding}]}>
                <Text style={[styles.titleText, {fontSize: layout.titleSize}]}>管理员面板</Text>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                    <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.mainContent}>
                {!layout.isMobile && (
                    <View style={[styles.sidebar, {width: layout.sidebarWidth}]}>
                        <ScrollView>
                            {menuItems.map((item) => (
                                <TouchableOpacity
                                    key={item.key}
                                    style={[styles.menuItem, selectedMenu === item.key && styles.menuItemActive]}
                                    onPress={() => onMenuSelect(item.key)}
                                >
                                    <Text
                                        style={[styles.menuItemText, selectedMenu === item.key && styles.menuItemTextActive]}>
                                        {item.title}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                <View style={styles.contentArea}>
                    {layout.isMobile && (
                        <View style={styles.mobileMenu}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={{paddingHorizontal: layout.padding}}>
                                {menuItems.map((item) => (
                                    <TouchableOpacity
                                        key={item.key}
                                        style={[styles.mobileMenuItem, selectedMenu === item.key && styles.mobileMenuItemActive]}
                                        onPress={() => onMenuSelect(item.key)}
                                    >
                                        <Text
                                            style={[styles.mobileMenuItemText, selectedMenu === item.key && styles.mobileMenuItemTextActive]}>
                                            {item.title}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}
                    <View style={{flex: 1}}>
                        <ScrollView
                            style={{flex: 1}}
                            showsVerticalScrollIndicator={true}
                        >
                            {selectedMenu === 'device' && <DeviceStatusScreen/>}
                            {selectedMenu === 'terminal' && <TerminalConnectionScreen/>}
                            {selectedMenu === 'server' && <LocalServerStatusScreen/>}
                            {selectedMenu === 'instance' && <SwitchInstanceModeScreen/>}
                            {selectedMenu === 'control' && <AppControlScreen/>}
                            {selectedMenu === 'logs' && <LogFilesScreen/>}
                        </ScrollView>
                    </View>
                </View>
            </View>
        </View>
    );
};

export const AdminPopup: React.FC<AdminPopupProps> = ({visible, onClose}) => {
    const [currentScreen, setCurrentScreen] = useState<Screen>('login');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [layout, setLayout] = useState(getResponsiveLayout());
    const [selectedMenu, setSelectedMenu] = useState('device');

    useEffect(() => {
        const subscription = Dimensions.addEventListener('change', () => {
            setLayout(getResponsiveLayout());
        });
        return () => subscription?.remove();
    }, []);

    useEffect(() => {
        if (!visible) {
            setCurrentScreen('login');
            setPassword('');
            setError('');
            setIsLoading(false);
        } else if (Platform.OS === 'android') {
            // 确保 Modal 显示时保持全屏状态
            StatusBar.setHidden(true);
            // 隐藏导航栏
            const timer = setTimeout(() => {
                StatusBar.setHidden(true);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [visible]);

    const handlePasswordChange = (text: string) => {
        setPassword(text);
        setError('');
    };

    const handleSubmit = () => {
        if (password === '123') {
            setIsLoading(true);
            setTimeout(() => {
                setIsLoading(false);
                setCurrentScreen('panel');
            }, 300);
        } else {
            setError('密码错误');
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent
            hardwareAccelerated
        >
            <View style={styles.overlay}>
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose}/>
                {currentScreen === 'login' ? (
                    <LoginScreen
                        password={password}
                        isLoading={isLoading}
                        error={error}
                        onPasswordChange={handlePasswordChange}
                        onSubmit={handleSubmit}
                        onClose={onClose}
                    />
                ) : (
                    <PanelScreen
                        layout={layout}
                        selectedMenu={selectedMenu}
                        onMenuSelect={setSelectedMenu}
                        onClose={onClose}
                        onBackToLogin={() => setCurrentScreen('login')}
                    />
                )}
            </View>
        </Modal>
    );
};

const {width} = Dimensions.get('window');

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: COLORS.overlay,
        justifyContent: 'center',
        alignItems: 'center'
    },
    loginContainer: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        width: Math.min(width - 48, 440),
        shadowColor: COLORS.primary,
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        borderWidth: 1,
        borderColor: COLORS.border
    },
    header: {alignItems: 'center', paddingTop: 32, paddingHorizontal: 24, paddingBottom: 24},
    logoBox: {
        width: 64,
        height: 64,
        backgroundColor: COLORS.primary,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16
    },
    logoText: {fontSize: 28, fontWeight: '700', color: COLORS.surface, letterSpacing: 1},
    title: {fontSize: 24, fontWeight: '600', color: COLORS.text, letterSpacing: -0.3, marginBottom: 8},
    subtitle: {fontSize: 15, color: COLORS.textSecondary, fontWeight: '400'},
    qrSection: {alignItems: 'center', paddingHorizontal: 24, paddingBottom: 20},
    qrContainer: {
        padding: 12,
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 12
    },
    deviceIdText: {fontSize: 12, color: COLORS.textSecondary, fontWeight: '500'},
    inputSection: {paddingHorizontal: 24, paddingBottom: 16},
    label: {fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8},
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        paddingHorizontal: 16,
        height: 48
    },
    inputWrapperError: {borderColor: COLORS.error, backgroundColor: COLORS.errorBg},
    inputWrapperSuccess: {borderColor: COLORS.borderSuccess, backgroundColor: COLORS.successBg},
    input: {flex: 1, fontSize: 16, color: COLORS.text, padding: 0},
    successIndicator: {fontSize: 20, color: COLORS.success, marginLeft: 8},
    errorContainer: {
        backgroundColor: COLORS.errorBg,
        borderRadius: 8,
        padding: 12,
        marginTop: 8,
        borderLeftWidth: 3,
        borderLeftColor: COLORS.error
    },
    errorText: {fontSize: 14, fontWeight: '500', color: COLORS.error},
    actionsContainer: {flexDirection: 'row', paddingHorizontal: 24, paddingBottom: 24, paddingTop: 8, gap: 12},
    button: {flex: 1, minHeight: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center'},
    cancelButton: {backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border},
    confirmButton: {backgroundColor: COLORS.cta},
    buttonDisabled: {backgroundColor: COLORS.disabled},
    buttonText: {fontSize: 15, fontWeight: '600'},
    cancelButtonText: {color: COLORS.textSecondary},
    confirmButtonText: {color: COLORS.surface},
    panelContainer: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        shadowColor: COLORS.primary,
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: 'hidden'
    },
    titleBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border
    },
    titleText: {fontWeight: '600', color: COLORS.text, letterSpacing: -0.3},
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.menuBg
    },
    closeButtonText: {fontSize: 18, color: COLORS.textSecondary, fontWeight: '600'},
    mainContent: {flex: 1, flexDirection: 'row'},
    sidebar: {backgroundColor: COLORS.menuBg, borderRightWidth: 1, borderRightColor: COLORS.border},
    menuItem: {paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border},
    menuItemActive: {backgroundColor: COLORS.menuActive},
    menuItemText: {fontSize: 15, fontWeight: '500', color: COLORS.text},
    menuItemTextActive: {color: COLORS.surface},
    contentArea: {flex: 1, backgroundColor: COLORS.surface},
    mobileMenu: {borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 8},
    mobileMenuItem: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginRight: 8,
        borderRadius: 8,
        backgroundColor: COLORS.menuBg
    },
    mobileMenuItemActive: {backgroundColor: COLORS.menuActive},
    mobileMenuItemText: {fontSize: 13, fontWeight: '500', color: COLORS.text},
    mobileMenuItemTextActive: {color: COLORS.surface},
    content: {flex: 1},
    contentText: {fontSize: 18, color: COLORS.textSecondary},
});

