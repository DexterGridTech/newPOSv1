import React from 'react';
import {SafeAreaView, StyleSheet, Text, View} from 'react-native';

/**
 * 开发调试主页
 * 在此处添加各 TurboModule 的调试入口
 */
const DevHome = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Assembly Android Desktop</Text>
        <Text style={styles.subtitle}>在此处添加调试模块入口</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F5F5'},
  content: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  title: {fontSize: 20, fontWeight: 'bold', color: '#333'},
  subtitle: {fontSize: 13, color: '#888', marginTop: 8},
});

export default DevHome;
