/**
 * External Call 调试工具
 * 完整测试 IExternalCallAdapter 的所有接口方法
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { posAdapter } from '../../../src/adapters';
import { CallType, CallMethod } from '@impos2/kernel-base';

type TestMethod = 'call' | 'isAvailable' | 'getAvailableTargets' | 'cancel';

// 预设的测试场景
const PRESET_SCENARIOS = {
  settings: {
    name: '打开系统设置',
    type: CallType.APP,
    method: CallMethod.INTENT,
    target: 'com.android.settings',
    action: 'android.settings.SETTINGS',
    params: {},
  },
  wifi: {
    name: 'WiFi 设置',
    type: CallType.APP,
    method: CallMethod.INTENT,
    target: 'com.android.settings',
    action: 'android.settings.WIFI_SETTINGS',
    params: {},
  },
  bluetooth: {
    name: '蓝牙设置',
    type: CallType.APP,
    method: CallMethod.INTENT,
    target: 'com.android.settings',
    action: 'android.settings.BLUETOOTH_SETTINGS',
    params: {},
  },
  alipay: {
    name: '支付宝支付',
    type: CallType.APP,
    method: CallMethod.INTENT,
    target: 'com.alipay.android.app',
    action: 'payment',
    params: { amount: 10000, orderId: 'TEST001' },
  },
};

export const ExternalCallDebugger: React.FC = () => {
  const [activeMethod, setActiveMethod] = useState<TestMethod>('call');
  const [response, setResponse] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // call() 方法的状态
  const [callType, setCallType] = useState<CallType>(CallType.APP);
  const [callMethod, setCallMethod] = useState<CallMethod>(CallMethod.INTENT);
  const [target, setTarget] = useState('com.android.settings');
  const [action, setAction] = useState('android.settings.SETTINGS');
  const [params, setParams] = useState('{}');
  const [timeout, setTimeout] = useState('30000');
  const [requestId, setRequestId] = useState('');

  // isAvailable() 方法的状态
  const [checkType, setCheckType] = useState<CallType>(CallType.APP);
  const [checkTarget, setCheckTarget] = useState('com.android.settings');

  // getAvailableTargets() 方法的状态
  const [targetsType, setTargetsType] = useState<CallType>(CallType.APP);

  // cancel() 方法的状态
  const [cancelRequestId, setCancelRequestId] = useState('');

  // 应用预设场景
  const applyPreset = (key: keyof typeof PRESET_SCENARIOS) => {
    const preset = PRESET_SCENARIOS[key];
    setCallType(preset.type);
    setCallMethod(preset.method);
    setTarget(preset.target);
    setAction(preset.action);
    setParams(JSON.stringify(preset.params, null, 2));
  };

  // 执行 call() 方法
  const handleCall = async () => {
    setLoading(true);
    setResponse('');
    try {
      const parsedParams = params ? JSON.parse(params) : undefined;
      const result = await posAdapter.externalCall.call({
        requestId: requestId || undefined,
        type: callType,
        method: callMethod,
        target,
        action,
        params: parsedParams,
        timeout: parseInt(timeout, 10),
      });
      setResponse(JSON.stringify(result, null, 2));
    } catch (error: any) {
      setResponse(`错误: ${error.message}\n\n${JSON.stringify(error, null, 2)}`);
    } finally {
      setLoading(false);
    }
  };

  // 执行 isAvailable() 方法
  const handleIsAvailable = async () => {
    setLoading(true);
    setResponse('');
    try {
      const result = await posAdapter.externalCall.isAvailable(checkType, checkTarget);
      setResponse(JSON.stringify({ available: result }, null, 2));
    } catch (error: any) {
      setResponse(`错误: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 执行 getAvailableTargets() 方法
  const handleGetTargets = async () => {
    setLoading(true);
    setResponse('');
    try {
      const result = await posAdapter.externalCall.getAvailableTargets(targetsType);
      setResponse(JSON.stringify({ targets: result, count: result.length }, null, 2));
    } catch (error: any) {
      setResponse(`错误: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 执行 cancel() 方法
  const handleCancel = async () => {
    setLoading(true);
    setResponse('');
    try {
      await posAdapter.externalCall.cancel(cancelRequestId || undefined);
      setResponse('取消成功');
    } catch (error: any) {
      setResponse(`错误: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 渲染部分
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🔗 External Call 调试工具</Text>

      {/* 方法选择 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>选择测试方法</Text>
        <View style={styles.methodGroup}>
          {(['call', 'isAvailable', 'getAvailableTargets', 'cancel'] as TestMethod[]).map((method) => (
            <TouchableOpacity
              key={method}
              style={[
                styles.methodButton,
                activeMethod === method && styles.methodButtonActive,
              ]}
              onPress={() => {
                setActiveMethod(method);
                setResponse('');
              }}
            >
              <Text
                style={[
                  styles.methodButtonText,
                  activeMethod === method && styles.methodButtonTextActive,
                ]}
              >
                {method}()
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 预设场景 */}
      {activeMethod === 'call' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>快速预设场景</Text>
          <View style={styles.presetGroup}>
            {Object.entries(PRESET_SCENARIOS).map(([key, preset]) => (
              <TouchableOpacity
                key={key}
                style={styles.presetButton}
                onPress={() => applyPreset(key as keyof typeof PRESET_SCENARIOS)}
              >
                <Text style={styles.presetButtonText}>{preset.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* call() 方法测试界面 */}
      {activeMethod === 'call' && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>调用类型 (CallType)</Text>
            <View style={styles.buttonGroup}>
              {Object.values(CallType).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeButton, callType === type && styles.typeButtonActive]}
                  onPress={() => setCallType(type)}
                >
                  <Text style={[styles.typeButtonText, callType === type && styles.typeButtonTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>调用方式 (CallMethod)</Text>
            <View style={styles.buttonGroup}>
              {Object.values(CallMethod).map((method) => (
                <TouchableOpacity
                  key={method}
                  style={[styles.typeButton, callMethod === method && styles.typeButtonActive]}
                  onPress={() => setCallMethod(method)}
                >
                  <Text style={[styles.typeButtonText, callMethod === method && styles.typeButtonTextActive]}>
                    {method}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>目标 (target)</Text>
            <TextInput
              style={styles.input}
              value={target}
              onChangeText={setTarget}
              placeholder="com.example.app"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>动作 (action)</Text>
            <TextInput
              style={styles.input}
              value={action}
              onChangeText={setAction}
              placeholder="android.intent.action.VIEW"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>参数 (params) - JSON 格式</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={params}
              onChangeText={setParams}
              placeholder='{"key": "value"}'
              placeholderTextColor="#999"
              multiline
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>超时时间 (timeout) - 毫秒</Text>
            <TextInput
              style={styles.input}
              value={timeout}
              onChangeText={setTimeout}
              placeholder="30000"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>请求 ID (requestId) - 可选</Text>
            <TextInput
              style={styles.input}
              value={requestId}
              onChangeText={setRequestId}
              placeholder="留空自动生成"
              placeholderTextColor="#999"
            />
          </View>

          <TouchableOpacity
            style={[styles.executeButton, loading && styles.executeButtonDisabled]}
            onPress={handleCall}
            disabled={loading}
          >
            <Text style={styles.executeButtonText}>
              {loading ? '执行中...' : '🚀 执行调用'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* isAvailable() 方法测试界面 */}
      {activeMethod === 'isAvailable' && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>调用类型 (CallType)</Text>
            <View style={styles.buttonGroup}>
              {Object.values(CallType).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeButton, checkType === type && styles.typeButtonActive]}
                  onPress={() => setCheckType(type)}
                >
                  <Text style={[styles.typeButtonText, checkType === type && styles.typeButtonTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>目标 (target)</Text>
            <TextInput
              style={styles.input}
              value={checkTarget}
              onChangeText={setCheckTarget}
              placeholder="com.example.app"
              placeholderTextColor="#999"
            />
          </View>

          <TouchableOpacity
            style={[styles.executeButton, loading && styles.executeButtonDisabled]}
            onPress={handleIsAvailable}
            disabled={loading}
          >
            <Text style={styles.executeButtonText}>
              {loading ? '检查中...' : '✅ 检查可用性'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* getAvailableTargets() 方法测试界面 */}
      {activeMethod === 'getAvailableTargets' && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>调用类型 (CallType)</Text>
            <View style={styles.buttonGroup}>
              {Object.values(CallType).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeButton, targetsType === type && styles.typeButtonActive]}
                  onPress={() => setTargetsType(type)}
                >
                  <Text style={[styles.typeButtonText, targetsType === type && styles.typeButtonTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.executeButton, loading && styles.executeButtonDisabled]}
            onPress={handleGetTargets}
            disabled={loading}
          >
            <Text style={styles.executeButtonText}>
              {loading ? '获取中...' : '📋 获取目标列表'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* cancel() 方法测试界面 */}
      {activeMethod === 'cancel' && (
        <>
          <View style={styles.section}>
            <Text style={styles.label}>请求 ID (requestId) - 可选</Text>
            <TextInput
              style={styles.input}
              value={cancelRequestId}
              onChangeText={setCancelRequestId}
              placeholder="留空取消所有请求"
              placeholderTextColor="#999"
            />
          </View>

          <TouchableOpacity
            style={[styles.executeButton, loading && styles.executeButtonDisabled]}
            onPress={handleCancel}
            disabled={loading}
          >
            <Text style={styles.executeButtonText}>
              {loading ? '取消中...' : '❌ 取消调用'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* 响应显示区域 */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>执行中...</Text>
        </View>
      )}

      {response && !loading && (
        <View style={styles.responseContainer}>
          <Text style={styles.responseTitle}>📡 响应结果</Text>
          <ScrollView style={styles.responseScroll} nestedScrollEnabled>
            <Text style={styles.responseText}>{response}</Text>
          </ScrollView>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  methodGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  methodButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  methodButtonActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  methodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  methodButtonTextActive: {
    color: '#fff',
  },
  presetGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    borderWidth: 1,
    borderColor: '#059669',
  },
  presetButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  buttonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  typeButtonActive: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  typeButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  input: {
    backgroundColor: '#f9fafb',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 14,
    color: '#1f2937',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  executeButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  executeButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowOpacity: 0,
  },
  executeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 20,
  },
  loadingText: {
    fontSize: 15,
    color: '#6366f1',
    fontWeight: '500',
    marginLeft: 12,
  },
  responseContainer: {
    marginTop: 20,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    maxHeight: 400,
  },
  responseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
    marginBottom: 12,
  },
  responseScroll: {
    maxHeight: 350,
  },
  responseText: {
    fontSize: 13,
    color: '#10b981',
    fontFamily: 'monospace',
    lineHeight: 20,
  },
});
