/**
 * IMPos2 Adapter V1 - 开发调试入口
 * @format
 */

import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { posAdapter } from './src/adapters';
import { ExternalCallDebugger } from './dev/screens/ExternalCallDebugger';
import LoggerDebugger from './dev/screens/LoggerDebugger';
import SystemStatusDebugger from './dev/screens/SystemStatusDebugger';

type MenuType = 'deviceInfo' | 'storage' | 'externalCall' | 'logger' | 'systemStatus';

function App(): React.JSX.Element {
  const [activeMenu, setActiveMenu] = useState<MenuType>('deviceInfo');
  
  // DeviceInfo 状态
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  // Storage 状态
  const [namespace, setNamespace] = useState('test');
  const [key, setKey] = useState('myKey');
  const [value, setValue] = useState('myValue');
  const [retrievedValue, setRetrievedValue] = useState<any>(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [storageSuccess, setStorageSuccess] = useState<string | null>(null);

  const handleGetDeviceInfo = async () => {
    setDeviceLoading(true);
    setDeviceError(null);
    try {
      const info = await posAdapter.deviceInfo.getDeviceInfo();
      setDeviceInfo(info);
    } catch (err: any) {
      setDeviceError(err.msg || '获取设备信息失败');
    } finally {
      setDeviceLoading(false);
    }
  };

  const handleSetItem = async () => {
    setStorageLoading(true);
    setStorageError(null);
    setStorageSuccess(null);
    try {
      await posAdapter.storage.setItem(namespace, key, value);
      setStorageSuccess('存储成功！');
    } catch (err: any) {
      setStorageError(err.message || '存储失败');
    } finally {
      setStorageLoading(false);
    }
  };

  const handleGetItem = async () => {
    setStorageLoading(true);
    setStorageError(null);
    setStorageSuccess(null);
    try {
      const result = await posAdapter.storage.getItem(namespace, key);
      setRetrievedValue(result);
      setStorageSuccess('读取成功！');
    } catch (err: any) {
      setStorageError(err.message || '读取失败');
    } finally {
      setStorageLoading(false);
    }
  };

  const handleRemoveItem = async () => {
    setStorageLoading(true);
    setStorageError(null);
    setStorageSuccess(null);
    try {
      await posAdapter.storage.removeItem(namespace, key);
      setRetrievedValue(null);
      setStorageSuccess('删除成功！');
    } catch (err: any) {
      setStorageError(err.message || '删除失败');
    } finally {
      setStorageLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />

      {/* 顶部标题栏 */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>IM</Text>
            </View>
            <View>
              <Text style={styles.title}>IMPos2 Adapter</Text>
              <Text style={styles.subtitle}>开发调试控制台</Text>
            </View>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>v1.0</Text>
          </View>
        </View>
      </View>

      <View style={styles.mainContainer}>
        {/* 左侧菜单 */}
        <View style={styles.sidebar}>
          <TouchableOpacity
            style={[styles.menuItem, activeMenu === 'deviceInfo' && styles.activeMenuItem]}
            onPress={() => setActiveMenu('deviceInfo')}
            activeOpacity={0.7}>
            <View style={[styles.menuIcon, activeMenu === 'deviceInfo' && styles.activeMenuIcon]}>
              <Text style={styles.menuIconText}>📱</Text>
            </View>
            <Text style={[styles.menuText, activeMenu === 'deviceInfo' && styles.activeMenuText]}>
              设备信息
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, activeMenu === 'storage' && styles.activeMenuItem]}
            onPress={() => setActiveMenu('storage')}
            activeOpacity={0.7}>
            <View style={[styles.menuIcon, activeMenu === 'storage' && styles.activeMenuIcon]}>
              <Text style={styles.menuIconText}>💾</Text>
            </View>
            <Text style={[styles.menuText, activeMenu === 'storage' && styles.activeMenuText]}>
              存储管理
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, activeMenu === 'externalCall' && styles.activeMenuItem]}
            onPress={() => setActiveMenu('externalCall')}
            activeOpacity={0.7}>
            <View style={[styles.menuIcon, activeMenu === 'externalCall' && styles.activeMenuIcon]}>
              <Text style={styles.menuIconText}>🔗</Text>
            </View>
            <Text style={[styles.menuText, activeMenu === 'externalCall' && styles.activeMenuText]}>
              外部调用
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, activeMenu === 'logger' && styles.activeMenuItem]}
            onPress={() => setActiveMenu('logger')}
            activeOpacity={0.7}>
            <View style={[styles.menuIcon, activeMenu === 'logger' && styles.activeMenuIcon]}>
              <Text style={styles.menuIconText}>📝</Text>
            </View>
            <Text style={[styles.menuText, activeMenu === 'logger' && styles.activeMenuText]}>
              日志管理
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, activeMenu === 'systemStatus' && styles.activeMenuItem]}
            onPress={() => setActiveMenu('systemStatus')}
            activeOpacity={0.7}>
            <View style={[styles.menuIcon, activeMenu === 'systemStatus' && styles.activeMenuIcon]}>
              <Text style={styles.menuIconText}>📊</Text>
            </View>
            <Text style={[styles.menuText, activeMenu === 'systemStatus' && styles.activeMenuText]}>
              系统状态
            </Text>
          </TouchableOpacity>
        </View>

        {/* 右侧内容区域 */}
        <ScrollView style={styles.contentArea} contentInsetAdjustmentBehavior="automatic">
          {activeMenu === 'deviceInfo' ? (
          <View style={styles.content}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>📱 设备信息检测</Text>
                <Text style={styles.cardSubtitle}>获取当前设备的详细硬件信息</Text>
              </View>

              <TouchableOpacity
                style={[styles.button, deviceLoading && styles.buttonDisabled]}
                onPress={handleGetDeviceInfo}
                disabled={deviceLoading}
                activeOpacity={0.8}>
                {deviceLoading ? (
                  <View style={styles.buttonContent}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.buttonText}>检测中...</Text>
                  </View>
                ) : (
                  <Text style={styles.buttonText}>🔍 开始检测</Text>
                )}
              </TouchableOpacity>

              {deviceError && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorIcon}>⚠️</Text>
                  <Text style={styles.errorText}>{deviceError}</Text>
                </View>
              )}

              {deviceInfo && (
                <View style={styles.resultContainer}>
                  <Text style={styles.resultTitle}>✅ 检测结果</Text>
                  {Object.entries(deviceInfo).map(([key, value]) => (
                    <View key={key} style={styles.infoRow}>
                      <Text style={styles.infoKey}>{key}</Text>
                      <Text style={styles.infoValue}>{String(value)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        ) : activeMenu === 'storage' ? (
          <View style={styles.content}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>💾 存储管理</Text>
                <Text style={styles.cardSubtitle}>测试键值对存储功能</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>📁 命名空间</Text>
                <TextInput
                  style={styles.input}
                  value={namespace}
                  onChangeText={setNamespace}
                  placeholder="输入命名空间"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>🔑 键名</Text>
                <TextInput
                  style={styles.input}
                  value={key}
                  onChangeText={setKey}
                  placeholder="输入键名"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>📝 值</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={value}
                  onChangeText={setValue}
                  placeholder="输入值"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.buttonSmall, styles.buttonPrimary, storageLoading && styles.buttonDisabled]}
                  onPress={handleSetItem}
                  disabled={storageLoading}
                  activeOpacity={0.8}>
                  <Text style={styles.buttonSmallText}>💾 存储</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.buttonSmall, styles.buttonSuccess, storageLoading && styles.buttonDisabled]}
                  onPress={handleGetItem}
                  disabled={storageLoading}
                  activeOpacity={0.8}>
                  <Text style={styles.buttonSmallText}>📖 读取</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.buttonSmall, styles.buttonDanger, storageLoading && styles.buttonDisabled]}
                  onPress={handleRemoveItem}
                  disabled={storageLoading}
                  activeOpacity={0.8}>
                  <Text style={styles.buttonSmallText}>🗑️ 删除</Text>
                </TouchableOpacity>
              </View>

              {storageLoading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="#6366f1" size="large" />
                  <Text style={styles.loadingText}>处理中...</Text>
                </View>
              )}

              {storageError && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorIcon}>⚠️</Text>
                  <Text style={styles.errorText}>{storageError}</Text>
                </View>
              )}

              {storageSuccess && (
                <View style={styles.successContainer}>
                  <Text style={styles.successIcon}>✅</Text>
                  <Text style={styles.successText}>{storageSuccess}</Text>
                </View>
              )}

              {retrievedValue !== null && (
                <View style={styles.resultContainer}>
                  <Text style={styles.resultTitle}>📦 读取结果</Text>
                  <View style={styles.codeBlock}>
                    <Text style={styles.codeText}>
                      {typeof retrievedValue === 'object'
                        ? JSON.stringify(retrievedValue, null, 2)
                        : String(retrievedValue)}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        ) : activeMenu === 'externalCall' ? (
          <ExternalCallDebugger />
        ) : activeMenu === 'logger' ? (
          <LoggerDebugger />
        ) : (
          <SystemStatusDebugger />
        )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#1a1a2e',
    paddingVertical: 20,
    paddingHorizontal: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: '#a0a0b0',
  },
  badge: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  mainContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 200,
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    paddingVertical: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 10,
    gap: 12,
  },
  activeMenuItem: {
    backgroundColor: '#eef2ff',
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeMenuIcon: {
    backgroundColor: '#6366f1',
  },
  menuIconText: {
    fontSize: 18,
  },
  menuText: {
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '500',
  },
  activeMenuText: {
    color: '#6366f1',
    fontWeight: '600',
  },
  contentArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardHeader: {
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  button: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  buttonSmall: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#6366f1',
  },
  buttonSuccess: {
    backgroundColor: '#10b981',
  },
  buttonDanger: {
    backgroundColor: '#ef4444',
  },
  buttonSmallText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 15,
    color: '#1f2937',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: '#6366f1',
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 16,
    borderRadius: 10,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
    gap: 10,
  },
  errorIcon: {
    fontSize: 20,
  },
  errorText: {
    flex: 1,
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '500',
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 16,
    borderRadius: 10,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
    gap: 10,
  },
  successIcon: {
    fontSize: 20,
  },
  successText: {
    flex: 1,
    color: '#059669',
    fontSize: 14,
    fontWeight: '500',
  },
  resultContainer: {
    backgroundColor: '#f9fafb',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  infoKey: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    width: 100,
  },
  infoValue: {
    fontSize: 14,
    color: '#1f2937',
    flex: 1,
    lineHeight: 20,
  },
  codeBlock: {
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  codeText: {
    fontSize: 13,
    color: '#10b981',
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
    }),
    lineHeight: 20,
  },
  targetItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  targetText: {
    fontSize: 13,
    color: '#1f2937',
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
    }),
  },
});

export default App;
