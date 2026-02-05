/**
 * IMPos2 Desktop V1 - 测试调试界面
 * @format
 */

import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  NativeModules,
} from 'react-native';
import { posAdapter } from '@impos2/adapter-impos2-adapterv1';
import MultiDisplayManager from './utils/MultiDisplayManager.ts';

// 获取 ScreenInitModule
const { ScreenInitModule } = NativeModules;

// 定义 Props 接口
interface TestScreenProps {
  screenType?: string;
  displayId?: number;
  displayName?: string;
}

function TestScreen(props: TestScreenProps): React.JSX.Element {
  console.log('========== TestScreen 组件函数被调用 ==========');
  console.log('接收到的 props:', props);

  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);

  // 直接从 props 获取屏幕参数
  const screenParams = {
    screenType: props.screenType || 'primary',
    displayId: props.displayId || 0,
    displayName: props.displayName || 'Primary Display',
  };

  console.log('TestScreen 组件状态初始化完成');
  console.log('屏幕参数:', screenParams);

  useEffect(() => {
    console.log('========== TestScreen useEffect 执行 ==========');

    // 定义初始化流程
    const initializeScreen = async () => {
      try {
        // 1. 先加载设备信息
        console.log('开始加载设备信息...');
        await handleGetDeviceInfo();
        console.log('设备信息加载完成');

        // 2. 设备信息加载完成后，通知原生层屏幕初始化完成
        if (ScreenInitModule) {
          console.log('通知原生层屏幕初始化完成:', screenParams);
          ScreenInitModule.notifyScreenInitialized(
            screenParams.screenType,
            screenParams
          );
        }
      } catch (error) {
        console.error('屏幕初始化流程出错:', error);
        // 即使出错也通知原生层（避免原生层一直等待）
        if (ScreenInitModule) {
          console.log('初始化出错，仍通知原生层:', screenParams);
          ScreenInitModule.notifyScreenInitialized(
            screenParams.screenType,
            screenParams
          );
        }
      }
    };
    // 执行初始化流程
    initializeScreen();
  }, []);

  const handleGetDeviceInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const info = await posAdapter.deviceInfo.getDeviceInfo();
      setDeviceInfo(info);
    } catch (err: any) {
      setError(err.msg || '获取设备信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = async () => {
    Alert.alert(
      '确认重启应用',
      '确定要重启应用吗？主屏将跳转到加载页重启，3秒后副屏自动重启。',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '确定',
          onPress: async () => {
            setRestarting(true);
            try {
              await MultiDisplayManager.restartApplication();
              console.log('应用重启成功');
              // 6秒后恢复按钮状态（主屏2.5秒+副屏3秒）
              setTimeout(() => {
                setRestarting(false);
              }, 6000);
            } catch (err: any) {
              console.error('重启失败:', err);
              Alert.alert('重启失败', err.message || '未知错误');
              setRestarting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <View style={styles.header}>
          <Text style={styles.title}>IMPos2 Desktop V1</Text>
          <Text style={styles.subtitle}>整合层 - 多屏调试界面</Text>
        </View>

        <View style={styles.content}>
          {/* 屏幕参数显示 */}
          {screenParams && (
            <View style={styles.screenParamsContainer}>
              <Text style={styles.sectionTitle}>当前屏幕参数</Text>
              <View style={styles.paramRow}>
                <Text style={styles.paramKey}>屏幕类型:</Text>
                <Text style={[
                  styles.paramValue,
                  screenParams.screenType === 'primary' ? styles.primaryScreen : styles.secondaryScreen
                ]}>
                  {screenParams.screenType === 'primary' ? '主屏 (Primary)' :
                   screenParams.screenType === 'secondary' ? '副屏 (Secondary)' : '未知'}
                </Text>
              </View>
              <View style={styles.paramRow}>
                <Text style={styles.paramKey}>Display ID:</Text>
                <Text style={styles.paramValue}>{screenParams.displayId}</Text>
              </View>
              <View style={styles.paramRow}>
                <Text style={styles.paramKey}>Display Name:</Text>
                <Text style={styles.paramValue}>{screenParams.displayName}</Text>
              </View>
            </View>
          )}

          {/* 重启按钮 */}
          <TouchableOpacity
            style={[styles.button, styles.restartButton]}
            onPress={handleRestart}
            disabled={restarting}>
            {restarting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>🔄 重启应用</Text>
            )}
          </TouchableOpacity>

          {/* 刷新设备信息按钮 */}
          <TouchableOpacity
            style={styles.button}
            onPress={handleGetDeviceInfo}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>刷新设备信息</Text>
            )}
          </TouchableOpacity>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {deviceInfo && (
            <View style={styles.infoContainer}>
              <Text style={styles.infoTitle}>设备信息：</Text>
              {Object.entries(deviceInfo).map(([key, value]) => (
                <View key={key} style={styles.infoRow}>
                  <Text style={styles.infoKey}>{key}:</Text>
                  {key === 'displays' && Array.isArray(value) ? (
                    <View style={styles.displaysContainer}>
                      {value.map((display, index) => (
                        <View key={index} style={styles.displayItemContainer}>
                          <Text style={styles.displayItemTitle}>屏幕 {index + 1}:</Text>
                          <Text style={styles.displayItem}>ID: {display.id}</Text>
                          <Text style={styles.displayItem}>类型: {display.displayType}</Text>
                          <Text style={styles.displayItem}>分辨率: {display.width}x{display.height}</Text>
                          <Text style={styles.displayItem}>物理尺寸: {display.physicalWidth.toFixed(1)}mm x {display.physicalHeight.toFixed(1)}mm</Text>
                          <Text style={styles.displayItem}>刷新率: {display.refreshRate}Hz</Text>
                          <Text style={styles.displayItem}>方向: {display.orientation}</Text>
                          <Text style={styles.displayItem}>移动设备: {display.isMobile ? '是' : '否'}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.infoValue}>{String(value)}</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
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
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  content: {
    padding: 20,
  },
  screenParamsContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 15,
  },
  paramRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  paramKey: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    width: 120,
  },
  paramValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    fontWeight: '600',
  },
  primaryScreen: {
    color: '#4CAF50',
  },
  secondaryScreen: {
    color: '#FF9800',
  },
  restartButton: {
    backgroundColor: '#FF5722',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  displaysContainer: {
    flex: 1,
  },
  displayItemContainer: {
    backgroundColor: '#f9f9f9',
    padding: 10,
    marginVertical: 5,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  displayItemTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 5,
  },
  displayItem: {
    fontSize: 13,
    color: '#333',
    paddingVertical: 2,
    lineHeight: 18,
  },
});

export default TestScreen;
