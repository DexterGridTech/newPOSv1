import React, { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ScreenMode } from "@impos2/kernel-base";
import { ScreenPartRegistration } from "@impos2/kernel-module-ui-navigation";
import { useClearance } from "@impos2/ui-core-base-2";
import { systemAdminVariable } from "../../variables";
import { moduleName } from "../../types";

/**
 * 工作空间设置页面
 *
 * 职责：
 * 1. 提供工作空间配置功能
 * 2. 管理工作空间相关设置
 * 3. 组件卸载时清理资源
 */
export const SetupWorkSpaceScreen: React.FC = () => {
    // 使用 useClearance hook 处理组件卸载时的清理
    // Screen 组件始终可见，所以 isVisible 设为 true，只在卸载时触发清理
    useClearance({
        isVisible: true,
        onClearance: useCallback(() => {
            console.log(`[${moduleName}] SetupWorkSpaceScreen 清理资源`);
            // 可以在这里添加其他清理逻辑
        }, []),
    });

    return (
        <View style={styles.container}>
            <Text style={styles.title}>工作空间设置</Text>
            <Text style={styles.description}>
                此页面用于配置和管理工作空间设置
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
        backgroundColor: '#FFFFFF',
    },
    title: {
        fontSize: 24,
        fontWeight: '600',
        color: '#0F172A',
        marginBottom: 16,
    },
    description: {
        fontSize: 16,
        color: '#64748B',
        lineHeight: 24,
    },
});

export const setupWorkSpaceScreenPart: ScreenPartRegistration = {
    name: 'setupWorkSpaceScreen',
    title: '工作空间设置',
    description: '配置和管理工作空间设置',
    partKey: 'system-admin-setup-workspace',
    containerKey: systemAdminVariable.systemAdminPanel.key,
    screenMode: [ScreenMode.DESKTOP, ScreenMode.MOBILE],
    componentType: SetupWorkSpaceScreen,
    indexInContainer: 1,
};
