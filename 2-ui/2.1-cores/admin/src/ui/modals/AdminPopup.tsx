import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {FancyInputV2} from '@impos2/ui-core-base';
import {getDeviceId} from '@impos2/kernel-core-base';
import {getResponsiveLayout} from '../responsive';
import {AppControlScreen} from '../screens/AppControlScreen';
import {ConnectorDiagnosticsScreen} from '../screens/ConnectorDiagnosticsScreen';
import {DeviceStatusScreen} from '../screens/DeviceStatusScreen';
import {LocalServerStatusScreen} from '../screens/LocalServerStatusScreen';
import {LogFilesScreen} from '../screens/LogFilesScreen';
import {SwitchInstanceModeScreen} from '../screens/SwitchInstanceModeScreen';
import {TerminalConnectionScreen} from '../screens/TerminalConnectionScreen';

interface AdminPopupProps {
  onClose: () => void;
}

type Screen = 'login' | 'panel';
type MenuKey = 'device' | 'connector' | 'logs' | 'instance' | 'control' | 'terminal' | 'server';
type ElectronLaunchContext = {
  windowRole: 'primary' | 'secondary';
  displayIndex: number;
  displayCount: number;
  deviceId: string;
  isPackaged: boolean;
  appVersion: string;
  runtimeSource: 'dev-server' | 'bundled';
};

type LayoutMode = 'mobilePortrait' | 'mobileLandscape' | 'tablet' | 'desktop';

const COLORS = {
  pageBg: '#EEF3F8',
  pageAccent: '#D9E7F4',
  pageAccentSoft: '#F7FAFC',
  surface: '#FFFFFF',
  surfaceSecondary: '#F7FAFC',
  surfaceStrong: '#E8F0F7',
  text: '#0F172A',
  textSecondary: '#526072',
  textMuted: '#7A8AA0',
  border: '#D7E1EC',
  borderStrong: '#B9CADC',
  primary: '#0B5FFF',
  primarySoft: '#E8F0FF',
  primaryDeep: '#123B74',
  success: '#0F9D73',
  successSoft: '#EAF8F2',
  error: '#D14343',
  errorSoft: '#FDECEC',
  neutral: '#94A3B8',
  shadow: 'rgba(15, 23, 42, 0.08)',
};

const menuItems: Array<{key: MenuKey; title: string; shortTitle: string; hint: string}> = [
  {key: 'device', title: '设备状态', shortTitle: '设备', hint: '查看设备硬件与系统状态'},
  {key: 'connector', title: '连接器诊断', shortTitle: '连接器', hint: '验证 SERIAL、NETWORK、HID 与 passive 桥接'},
  {key: 'logs', title: '日志文件', shortTitle: '日志', hint: '浏览与导出本地日志'},
  {key: 'instance', title: '实例模式', shortTitle: '实例', hint: '切换与确认实例运行模式'},
  {key: 'control', title: 'APP控制', shortTitle: '控制', hint: '执行全屏、锁定等宿主控制'},
  {key: 'terminal', title: '终端连接', shortTitle: '终端', hint: '检查终端连接状态'},
  {key: 'server', title: '本地服务', shortTitle: '服务', hint: '查看本地服务与连接统计'},
];

const getElectronLaunchContext = async (): Promise<ElectronLaunchContext | null> => {
  const candidate = (globalThis as {
    impos2Host?: {
      getLaunchContext?: () => Promise<ElectronLaunchContext>;
    };
  }).impos2Host;

  if (!candidate?.getLaunchContext) {
    return null;
  }

  try {
    return await candidate.getLaunchContext();
  } catch {
    return null;
  }
};

const getLayoutMode = (width: number, height: number): LayoutMode => {
  const shortest = Math.min(width, height);
  if (width >= 1280) {
    return 'desktop';
  }
  if (shortest >= 900 || width >= 960) {
    return 'tablet';
  }
  if (width > height) {
    return 'mobileLandscape';
  }
  return 'mobilePortrait';
};

const DecorativeGrid: React.FC<{layoutMode: LayoutMode}> = ({layoutMode}) => {
  const dotCount = layoutMode === 'desktop' ? 28 : layoutMode === 'tablet' ? 20 : 12;
  return (
    <View style={styles.decorativeGrid} pointerEvents="none">
      {Array.from({length: dotCount}).map((_, index) => (
        <View key={`grid-${index}`} style={styles.decorativeDot} />
      ))}
    </View>
  );
};

const MetricCard: React.FC<{label: string; value: string; accent?: 'primary' | 'neutral'}> = ({
  label,
  value,
  accent = 'neutral',
}) => (
  <View style={[styles.metricCard, accent === 'primary' ? styles.metricCardPrimary : null]}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricValue}>{value}</Text>
  </View>
);

const DeviceIdentityCard: React.FC<{deviceId: string}> = ({deviceId}) => (
  <View style={styles.identityCard}>
    <View style={styles.identityCardHeader}>
      <Text style={styles.identityCardEyebrow}>设备验证</Text>
      <Text style={styles.identityCardTitle}>当前终端身份</Text>
    </View>
    <View style={styles.identityCardBody}>
      <View style={styles.qrShell}>
        <QRCode value={deviceId} size={108} />
      </View>
      <View style={styles.identityMeta}>
        <Text style={styles.identityMetaLabel}>设备 ID</Text>
        <Text selectable style={styles.identityMetaValue}>
          {deviceId}
        </Text>
        <Text style={styles.identityMetaHint}>扫码后可用于终端识别、远程核验与问题排查。</Text>
      </View>
    </View>
  </View>
);

const LoginScreen: React.FC<{
  layoutMode: LayoutMode;
  password: string;
  isLoading: boolean;
  error: string;
  onPasswordChange: (text: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}> = ({layoutMode, password, isLoading, error, onPasswordChange, onSubmit, onClose}) => {
  const isValidLength = password.length >= 1;
  const canSubmit = isValidLength && !isLoading;
  const [deviceId, setDeviceId] = useState<string>('');

  useEffect(() => {
    setDeviceId(getDeviceId());
  }, []);

  const isWide = layoutMode === 'desktop' || layoutMode === 'tablet' || layoutMode === 'mobileLandscape';

  return (
    <View style={styles.loginPage}>
      <DecorativeGrid layoutMode={layoutMode} />
      <View style={[styles.loginShell, isWide ? styles.loginShellWide : styles.loginShellCompact]}>
        <View style={[styles.loginInfoPane, isWide ? styles.loginInfoPaneWide : styles.loginInfoPaneCompact]}>
          <View style={styles.loginInfoTop}>
            <View style={styles.utilityBadgeRow}>
              <View style={styles.utilityBadge}>
                <View style={styles.utilityBadgeDot} />
                <Text style={styles.utilityBadgeText}>系统管理入口</Text>
              </View>
            </View>
              <Text style={styles.loginHeadline}>系统管理总览</Text>
              <Text style={styles.loginSubheadline}>
              进入后可查看设备状态、日志、本地服务、终端连接和实例模式，并执行宿主级控制操作。
              </Text>
          </View>

          <View style={styles.metricRow}>
            <MetricCard label="访问模式" value="受保护" accent="primary" />
            <MetricCard label="界面形态" value={isWide ? '全屏工作台' : '紧凑工作台'} />
          </View>

          {!!deviceId ? <DeviceIdentityCard deviceId={deviceId} /> : null}
        </View>

        <View style={[styles.loginFormPane, isWide ? styles.loginFormPaneWide : styles.loginFormPaneCompact]}>
          <View style={styles.formCard}>
            <View style={styles.formCardHeader}>
              <Text style={styles.formEyebrow}>安全验证</Text>
              <Text style={styles.formTitle}>管理员登录</Text>
              <Text style={styles.formDescription}>请输入管理员密码以进入系统管理工作台。</Text>
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.label}>管理员密码</Text>
              <View
                style={[
                  styles.inputWrapper,
                  error ? styles.inputWrapperError : null,
                  isValidLength && !error ? styles.inputWrapperSuccess : null,
                ]}>
                <FancyInputV2
                  value={password}
                  onChangeText={onPasswordChange}
                  keyboardType="number"
                  placeholder="请输入密码"
                  placeholderTextColor={COLORS.textMuted}
                  promptText="请输入密码"
                  secureTextEntry
                  style={styles.input}
                />
                {isValidLength && !error ? <Text style={styles.successIndicator}>✓</Text> : null}
              </View>
              {error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.loginHintCard}>
              <Text style={styles.loginHintTitle}>登录后可访问</Text>
              <Text style={styles.loginHintText}>设备诊断、模式切换、服务监控、日志浏览和应用控制模块。</Text>
            </View>

            <View style={styles.actionsContainer}>
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
                <Text style={[styles.buttonText, styles.cancelButtonText]}>关闭</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.confirmButton, !canSubmit ? styles.buttonDisabled : null]}
                onPress={onSubmit}
                disabled={!canSubmit}>
                {isLoading ? (
                  <ActivityIndicator size="small" color={COLORS.surface} />
                ) : (
                  <Text style={[styles.buttonText, styles.confirmButtonText]}>进入工作台</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const PanelScreen: React.FC<{
  layoutMode: LayoutMode;
  selectedMenu: MenuKey;
  onMenuSelect: (key: MenuKey) => void;
  onClose: () => void;
  onBackToLogin: () => void;
}> = ({layoutMode, selectedMenu, onMenuSelect, onClose, onBackToLogin}) => {
  const [launchContext, setLaunchContext] = useState<ElectronLaunchContext | null>(null);

  useEffect(() => {
    void getElectronLaunchContext().then(setLaunchContext);
  }, []);

  const resolvedMenuItems = useMemo(() => {
    const isElectronStandalone = Boolean(launchContext && launchContext.displayIndex === 0);
    return menuItems.filter(item => item.key !== 'connector' || isElectronStandalone);
  }, [launchContext]);

  const activeMenu = resolvedMenuItems.find(item => item.key === selectedMenu) ?? resolvedMenuItems[0];
  const isDesktopLike = layoutMode === 'desktop' || layoutMode === 'tablet';

  return (
    <View style={styles.panelPage}>
      <View style={styles.panelTopBar}>
        <View style={styles.panelTopBarLeft}>
          <View style={styles.panelSignalCluster}>
            <View style={[styles.panelSignalDot, styles.panelSignalDotActive]} />
            <View style={styles.panelSignalDot} />
            <View style={styles.panelSignalDot} />
          </View>
          <View>
            <Text style={styles.panelTitle}>系统管理工作台</Text>
            <Text style={styles.panelSubtitle}>{activeMenu.title} · {activeMenu.hint}</Text>
          </View>
        </View>

        <View style={styles.panelTopBarActions}>
          <TouchableOpacity style={styles.topBarSecondaryButton} onPress={onBackToLogin}>
            <Text style={styles.topBarSecondaryButtonText}>返回登录</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.topBarPrimaryButton} onPress={onClose}>
            <Text style={styles.topBarPrimaryButtonText}>关闭</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.panelBody}>
        {isDesktopLike ? (
          <View style={styles.sidebarPane}>
            <Text style={styles.sidebarTitle}>模块导航</Text>
            <Text style={styles.sidebarHint}>选择要查看或执行的系统模块。</Text>
            <ScrollView style={styles.sidebarMenu} contentContainerStyle={styles.sidebarMenuContent}>
              {resolvedMenuItems.map(item => {
                const active = item.key === selectedMenu;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.sidebarItem, active ? styles.sidebarItemActive : null]}
                    onPress={() => onMenuSelect(item.key)}>
                    <Text style={[styles.sidebarItemTitle, active ? styles.sidebarItemTitleActive : null]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.sidebarItemHint, active ? styles.sidebarItemHintActive : null]}>
                      {item.hint}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.mobileTabStrip}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mobileTabStripContent}>
              {resolvedMenuItems.map(item => {
                const active = item.key === selectedMenu;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.mobileTab, active ? styles.mobileTabActive : null]}
                    onPress={() => onMenuSelect(item.key)}>
                    <Text style={[styles.mobileTabText, active ? styles.mobileTabTextActive : null]}>
                      {item.shortTitle}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={styles.workspacePane}>
          <View style={styles.workspaceHeader}>
            <View>
              <Text style={styles.workspaceTitle}>{activeMenu.title}</Text>
              <Text style={styles.workspaceDescription}>{activeMenu.hint}</Text>
            </View>
          </View>
          <View style={styles.workspaceBody}>
            <ScrollView style={styles.workspaceScroll} contentContainerStyle={styles.workspaceScrollContent}>
              {selectedMenu === 'device' ? <DeviceStatusScreen /> : null}
              {selectedMenu === 'connector' ? <ConnectorDiagnosticsScreen /> : null}
              {selectedMenu === 'terminal' ? <TerminalConnectionScreen /> : null}
              {selectedMenu === 'server' ? <LocalServerStatusScreen /> : null}
              {selectedMenu === 'instance' ? <SwitchInstanceModeScreen /> : null}
              {selectedMenu === 'control' ? <AppControlScreen /> : null}
              {selectedMenu === 'logs' ? <LogFilesScreen /> : null}
            </ScrollView>
          </View>
        </View>
      </View>
    </View>
  );
};

export const AdminPopup: React.FC<AdminPopupProps> = ({onClose}) => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [layout, setLayout] = useState(getResponsiveLayout());
  const [selectedMenu, setSelectedMenu] = useState<MenuKey>('device');
  const [windowSize, setWindowSize] = useState(Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({window}) => {
      setLayout(getResponsiveLayout());
      setWindowSize(window);
    });
    return () => subscription?.remove();
  }, []);

  const layoutMode = useMemo(
    () => getLayoutMode(windowSize.width, windowSize.height),
    [windowSize.height, windowSize.width],
  );

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
    <View style={styles.root}>
      {currentScreen === 'login' ? (
        <LoginScreen
          layoutMode={layoutMode}
          password={password}
          isLoading={isLoading}
          error={error}
          onPasswordChange={handlePasswordChange}
          onSubmit={handleSubmit}
          onClose={onClose}
        />
      ) : (
        <PanelScreen
          layoutMode={layoutMode}
          selectedMenu={selectedMenu}
          onMenuSelect={setSelectedMenu}
          onClose={onClose}
          onBackToLogin={() => setCurrentScreen('login')}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.pageBg,
    zIndex: 1000,
  },
  loginPage: {
    flex: 1,
    backgroundColor: COLORS.pageBg,
    overflow: 'hidden',
  },
  decorativeGrid: {
    position: 'absolute',
    top: 28,
    right: 28,
    width: 168,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    opacity: 0.5,
  },
  decorativeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.pageAccent,
  },
  loginShell: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  loginShellWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 20,
  },
  loginShellCompact: {
    justifyContent: 'center',
    gap: 16,
  },
  loginInfoPane: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  loginInfoPaneWide: {
    flex: 1.15,
    padding: 28,
    justifyContent: 'space-between',
  },
  loginInfoPaneCompact: {
    padding: 20,
    gap: 20,
  },
  loginInfoTop: {
    gap: 14,
  },
  utilityBadgeRow: {
    flexDirection: 'row',
  },
  utilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  utilityBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  utilityBadgeText: {
    color: COLORS.primaryDeep,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  loginHeadline: {
    color: COLORS.text,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1.1,
  },
  loginSubheadline: {
    color: COLORS.textSecondary,
    fontSize: 16,
    lineHeight: 24,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  metricCard: {
    minWidth: 132,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metricCardPrimary: {
    backgroundColor: COLORS.primarySoft,
    borderColor: '#C9D8FF',
  },
  metricLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  metricValue: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
  },
  identityCard: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 16,
  },
  identityCardHeader: {
    gap: 6,
  },
  identityCardEyebrow: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  identityCardTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
  },
  identityCardBody: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    alignItems: 'center',
  },
  qrShell: {
    padding: 12,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  identityMeta: {
    flex: 1,
    minWidth: 220,
    gap: 8,
  },
  identityMetaLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  identityMetaValue: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  identityMetaHint: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  loginFormPane: {
    alignSelf: 'stretch',
  },
  loginFormPaneWide: {
    flex: 0.92,
    minWidth: 360,
    alignSelf: 'stretch',
  },
  loginFormPaneCompact: {
    width: '100%',
  },
  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 22,
    paddingVertical: 22,
    shadowColor: COLORS.shadow,
    shadowOffset: {width: 0, height: 16},
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 8,
    gap: 18,
    flex: 1,
  },
  formCardHeader: {
    gap: 8,
  },
  formEyebrow: {
    color: COLORS.primaryDeep,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  formTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  formDescription: {
    color: COLORS.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  inputSection: {
    gap: 10,
  },
  label: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 18,
    paddingHorizontal: 16,
    backgroundColor: COLORS.surfaceSecondary,
  },
  inputWrapperError: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.errorSoft,
  },
  inputWrapperSuccess: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.successSoft,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    padding: 0,
  },
  successIndicator: {
    color: COLORS.success,
    fontSize: 20,
    fontWeight: '800',
    marginLeft: 10,
  },
  errorContainer: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: COLORS.errorSoft,
    borderWidth: 1,
    borderColor: '#F4C7C7',
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: '600',
  },
  loginHintCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  loginHintTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  loginHintText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  cancelButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
  },
  buttonDisabled: {
    backgroundColor: COLORS.neutral,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '800',
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
  },
  confirmButtonText: {
    color: COLORS.surface,
  },
  panelPage: {
    flex: 1,
    backgroundColor: COLORS.pageBg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  panelTopBar: {
    minHeight: 72,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  panelTopBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flexShrink: 1,
  },
  panelSignalCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  panelSignalDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D6DEE8',
  },
  panelSignalDotActive: {
    backgroundColor: COLORS.primary,
  },
  panelTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  panelSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  panelTopBarActions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  topBarSecondaryButton: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarSecondaryButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  topBarPrimaryButton: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarPrimaryButtonText: {
    color: COLORS.surface,
    fontSize: 14,
    fontWeight: '800',
  },
  panelBody: {
    flex: 1,
    flexDirection: 'row',
    gap: 14,
  },
  sidebarPane: {
    width: 280,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  sidebarTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  sidebarHint: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  sidebarMenu: {
    flex: 1,
  },
  sidebarMenuContent: {
    gap: 10,
    paddingBottom: 8,
  },
  sidebarItem: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  sidebarItemActive: {
    backgroundColor: COLORS.primaryDeep,
    borderColor: COLORS.primaryDeep,
  },
  sidebarItemTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '800',
  },
  sidebarItemTitleActive: {
    color: COLORS.surface,
  },
  sidebarItemHint: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  sidebarItemHintActive: {
    color: '#D7E6FF',
  },
  mobileTabStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  mobileTabStripContent: {
    paddingRight: 8,
    gap: 10,
  },
  mobileTab: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mobileTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  mobileTabText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  mobileTabTextActive: {
    color: COLORS.surface,
  },
  workspacePane: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  workspaceHeader: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
    marginTop: 0,
  },
  workspaceTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  workspaceDescription: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 6,
  },
  workspaceBody: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  workspaceScroll: {
    flex: 1,
  },
  workspaceScrollContent: {
    paddingBottom: 24,
  },
});
