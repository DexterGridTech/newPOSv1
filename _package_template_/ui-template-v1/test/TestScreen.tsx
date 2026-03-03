import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * 测试屏幕组件
 *
 * 用于开发调试时测试模块功能
 */
export const TestScreen: React.FC = () => {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>{{displayName}} 模块</Text>
            <Text style={styles.description}>
                开发调试页面
            </Text>
            <Text style={styles.hint}>
                在这里添加你的测试代码
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        padding: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: '600',
        color: '#0F172A',
        marginBottom: 8,
    },
    description: {
        fontSize: 16,
        color: '#64748B',
        marginBottom: 16,
    },
    hint: {
        fontSize: 14,
        color: '#94A3B8',
        fontStyle: 'italic',
    },
});
