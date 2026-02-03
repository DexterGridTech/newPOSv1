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
} from 'react-native';
import { deviceInfoAdapter } from '../src/adapters';

function DevApp(): React.JSX.Element {
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGetDeviceInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const info = await deviceInfoAdapter.getDeviceInfo();
      setDeviceInfo(info);
    } catch (err: any) {
      setError(err.msg || '获取设备信息失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <View style={styles.header}>
          <Text style={styles.title}>IMPos2 Adapter 开发调试</Text>
          <Text style={styles.subtitle}>DeviceInfo Adapter 测试</Text>
        </View>

        <View style={styles.content}>
          <TouchableOpacity
            style={styles.button}
            onPress={handleGetDeviceInfo}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>获取设备信息</Text>
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
                  <Text style={styles.infoValue}>{String(value)}</Text>
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
});

export default DevApp;
