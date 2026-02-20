import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';

// 导入所有调试器
import ExternalCallDebugger from './screens/ExternalCallDebugger';
import LoggerDebugger from './screens/LoggerDebugger';
import SystemStatusDebugger from './screens/SystemStatusDebugger';
import ScriptsDebugger from './screens/ScriptsDebugger';

// 尝试导入 LocalWebServerDebugger，如果失败则使用占位符
let LocalWebServerDebugger: React.ComponentType<any>;
try {
  LocalWebServerDebugger = require('./screens/LocalWebServerDebugger').default;
  console.log('✅ LocalWebServerDebugger 导入成功');
} catch (error) {
  console.error('❌ LocalWebServerDebugger 导入失败:', error);
  LocalWebServerDebugger = () => (
    <View style={{ padding: 20 }}>
      <Text style={{ color: 'red', fontSize: 16 }}>
        LocalWebServerDebugger 加载失败: {String(error)}
      </Text>
    </View>
  );
}

type Screen =
  | 'menu'
  | 'externalCall'
  | 'logger'
  | 'systemStatus'
  | 'scripts'
  | 'localWebServer';

function DevApp(): React.JSX.Element {
  const [currentScreen, setCurrentScreen] = useState<Screen>('menu');

  // 添加日志
  console.log('🔍 DevApp 渲染, currentScreen:', currentScreen);

  // 渲染菜单
  const renderMenu = () => {
    console.log('📋 渲染菜单');
    return (
      <View style={styles.menuContainer}>
        <Text style={styles.title}>IMPos2 Adapter 开发调试</Text>
        <Text style={styles.subtitle}>选择要测试的功能模块</Text>

        <View style={styles.menuList}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              console.log('点击 ExternalCall');
              setCurrentScreen('externalCall');
            }}
          >
            <Text style={styles.menuItemTitle}>ExternalCall</Text>
            <Text style={styles.menuItemDesc}>外部调用适配器测试</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              console.log('点击 Logger');
              setCurrentScreen('logger');
            }}
          >
            <Text style={styles.menuItemTitle}>Logger</Text>
            <Text style={styles.menuItemDesc}>日志适配器测试</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              console.log('点击 SystemStatus');
              setCurrentScreen('systemStatus');
            }}
          >
            <Text style={styles.menuItemTitle}>SystemStatus</Text>
            <Text style={styles.menuItemDesc}>系统状态适配器测试</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              console.log('点击 Scripts');
              setCurrentScreen('scripts');
            }}
          >
            <Text style={styles.menuItemTitle}>Scripts</Text>
            <Text style={styles.menuItemDesc}>脚本执行适配器测试</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              console.log('✅ 点击 LocalWebServer');
              setCurrentScreen('localWebServer');
            }}
          >
            <Text style={styles.menuItemTitle}>LocalWebServer</Text>
            <Text style={styles.menuItemDesc}>本地 Web 服务器测试</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // 渲染当前屏幕
  const renderScreen = () => {
    console.log('🖥️ renderScreen, currentScreen:', currentScreen);

    if (currentScreen === 'menu') {
      return renderMenu();
    }

    return (
      <View style={styles.screenContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setCurrentScreen('menu')}
        >
          <Text style={styles.backButtonText}>← 返回菜单</Text>
        </TouchableOpacity>

        {currentScreen === 'externalCall' && <ExternalCallDebugger />}
        {currentScreen === 'logger' && <LoggerDebugger />}
        {currentScreen === 'systemStatus' && <SystemStatusDebugger />}
        {currentScreen === 'scripts' && <ScriptsDebugger />}
        {currentScreen === 'localWebServer' && (
          <>
            {console.log('🚀 渲染 LocalWebServerDebugger')}
            <LocalWebServerDebugger />
          </>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        {renderScreen()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  menuContainer: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  menuList: {
    gap: 12,
  },
  menuItem: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuItemTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  menuItemDesc: {
    fontSize: 14,
    color: '#666',
  },
  screenContainer: {
    flex: 1,
  },
  backButton: {
    backgroundColor: '#fff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
});

export default DevApp;
