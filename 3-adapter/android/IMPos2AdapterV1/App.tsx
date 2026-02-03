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
} from 'react-native';
import { posAdapter } from './src/adapters';

type MenuType = 'deviceInfo' | 'storage';

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
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.title}>IMPos2 Adapter 开发调试</Text>
      </View>

      <View style={styles.mainContainer}>
        {/* 左侧菜单 */}
        <View style={styles.sidebar}>
          <TouchableOpacity
            style={[styles.menuItem, activeMenu === 'deviceInfo' && styles.activeMenuItem]}
            onPress={() => setActiveMenu('deviceInfo')}>
            <Text style={[styles.menuText, activeMenu === 'deviceInfo' && styles.activeMenuText]}>
              DeviceInfo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuItem, activeMenu === 'storage' && styles.activeMenuItem]}
            onPress={() => setActiveMenu('storage')}>
            <Text style={[styles.menuText, activeMenu === 'storage' && styles.activeMenuText]}>
              Storage
            </Text>
          </TouchableOpacity>
        </View>

        {/* 右侧内容区域 */}
        <ScrollView style={styles.contentArea} contentInsetAdjustmentBehavior="automatic">
          {activeMenu === 'deviceInfo' ? (
          <View style={styles.content}>
            <Text style={styles.sectionTitle}>DeviceInfo Adapter 测试</Text>
            
            <TouchableOpacity
              style={styles.button}
              onPress={handleGetDeviceInfo}
              disabled={deviceLoading}>
              {deviceLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>获取设备信息</Text>
              )}
            </TouchableOpacity>

            {deviceError && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{deviceError}</Text>
              </View>
            )}

            {deviceInfo && (
              <View style={styles.infoContainer}>
                <Text style={styles.infoTitle}>设备信息：</Text>
                {Object.entries(deviceInfo).map(([key, value]) => (
                  <View key={key} style={styles.infoRow}>
                    <Text style={styles.infoKey}>{key}:</Text>
                    <Text style={styles.infoValue}>{String(value)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.content}>
            <Text style={styles.sectionTitle}>Storage Adapter 测试</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>命名空间 (Namespace):</Text>
              <TextInput
                style={styles.input}
                value={namespace}
                onChangeText={setNamespace}
                placeholder="输入命名空间"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>键 (Key):</Text>
              <TextInput
                style={styles.input}
                value={key}
                onChangeText={setKey}
                placeholder="输入键"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>值 (Value):</Text>
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={setValue}
                placeholder="输入值"
                multiline
              />
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSmall]}
                onPress={handleSetItem}
                disabled={storageLoading}>
                <Text style={styles.buttonText}>存储</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.buttonSmall, styles.buttonSecondary]}
                onPress={handleGetItem}
                disabled={storageLoading}>
                <Text style={styles.buttonText}>读取</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.buttonSmall, styles.buttonDanger]}
                onPress={handleRemoveItem}
                disabled={storageLoading}>
                <Text style={styles.buttonText}>删除</Text>
              </TouchableOpacity>
            </View>

            {storageLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#007AFF" />
              </View>
            )}

            {storageError && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{storageError}</Text>
              </View>
            )}

            {storageSuccess && (
              <View style={styles.successContainer}>
                <Text style={styles.successText}>{storageSuccess}</Text>
              </View>
            )}

            {retrievedValue !== null && (
              <View style={styles.infoContainer}>
                <Text style={styles.infoTitle}>读取的值：</Text>
                <Text style={styles.retrievedValue}>
                  {typeof retrievedValue === 'object' 
                    ? JSON.stringify(retrievedValue, null, 2) 
                    : String(retrievedValue)}
                </Text>
              </View>
            )}
          </View>
        )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  mainContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 180,
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    paddingVertical: 10,
  },
  menuItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  activeMenuItem: {
    backgroundColor: '#f0f8ff',
    borderLeftColor: '#007AFF',
  },
  menuText: {
    fontSize: 16,
    color: '#666',
  },
  activeMenuText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  contentArea: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonSmall: {
    flex: 1,
    marginHorizontal: 5,
    marginBottom: 10,
  },
  buttonSecondary: {
    backgroundColor: '#34C759',
  },
  buttonDanger: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 14,
    color: '#333',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
  },
  successContainer: {
    backgroundColor: '#e8f5e9',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  successText: {
    color: '#2e7d32',
    fontSize: 14,
  },
  infoContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoKey: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    width: 120,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  retrievedValue: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'monospace',
  },
});

export default App;
