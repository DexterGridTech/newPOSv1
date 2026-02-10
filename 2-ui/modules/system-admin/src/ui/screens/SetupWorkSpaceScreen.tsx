import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { ScreenMode } from "@impos2/kernel-base";
import { ScreenPartRegistration } from "@impos2/kernel-base";
import { useLifecycle } from "@impos2/ui-core-base-2";
import { moduleName } from '../../moduleName';
import { useSetupWorkspace } from "../../hooks";
import {systemAdminVariable} from "../systemAdminVariables";

/**
 * 工作空间设置页面
 *
 * 职责：
 * 1. 显示当前工作空间配置
 * 2. 允许切换选中的工作空间
 * 3. 保存后自动重启应用
 */
export const SetupWorkSpaceScreen: React.FC = () => {

    // 使用 hook 管理工作空间逻辑
    const {
        currentWorkspace,
        selectedWorkspace,
        hasChanges,
        updateStatus,
        handleWorkspaceChange,
        handleSubmit,
    } = useSetupWorkspace();

    // 使用 useLifecycle hook 处理组件生命周期
    useLifecycle({
        componentName: 'SetupWorkSpaceScreen',
        onInitiated: useCallback(() => {
            console.log(`[${moduleName}] SetupWorkSpaceScreen 初始化完成`);
        }, []),
        onClearance: useCallback(() => {
            console.log(`[${moduleName}] SetupWorkSpaceScreen 清理资源`);
        }, []),
    });

    const isLoading = updateStatus?.status === 'started';
    const canSubmit = hasChanges && !isLoading;

    return (
        <View style={styles.container}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
                {/* 标题区域 */}
                <View style={styles.header}>
                    <Text style={styles.title}>工作空间设置</Text>
                    <Text style={styles.description}>
                        选择要使用的工作空间，切换后将自动重启应用
                    </Text>
                </View>

                {/* 工作空间列表 */}
                <View style={styles.workspaceList}>
                {currentWorkspace.workspaces.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>暂无可用的工作空间</Text>
                    </View>
                ) : (
                    currentWorkspace.workspaces.map((workspace) => (
                        <TouchableOpacity
                            key={workspace.workspaceName}
                            style={[
                                styles.workspaceItem,
                                selectedWorkspace === workspace.workspaceName && styles.workspaceItemSelected
                            ]}
                            onPress={() => handleWorkspaceChange(workspace.workspaceName)}
                            disabled={isLoading}
                        >
                            <View style={styles.workspaceInfo}>
                                {/* 工作空间名称 */}
                                <View style={styles.workspaceHeader}>
                                    <Text style={[
                                        styles.workspaceName,
                                        selectedWorkspace === workspace.workspaceName && styles.workspaceNameSelected
                                    ]}>
                                        {workspace.workspaceName}
                                    </Text>
                                    {selectedWorkspace === workspace.workspaceName && (
                                        <View style={styles.checkmark}>
                                            <Text style={styles.checkmarkText}>✓</Text>
                                        </View>
                                    )}
                                </View>

                                {/* API服务器列表 */}
                                <View style={styles.serverList}>
                                    <Text style={styles.serverListTitle}>
                                        API服务器 ({workspace.apiServerAddresses.length})
                                    </Text>
                                    {workspace.apiServerAddresses.map((server, serverIndex) => (
                                        <View key={serverIndex} style={styles.serverItem}>
                                            {/* 服务器名称和配置 */}
                                            <View style={styles.serverHeader}>
                                                <Text style={styles.serverName}>
                                                    📡 {server.serverName}
                                                </Text>
                                                <Text style={styles.serverConfig}>
                                                    重试: {server.retryCount}次 | 间隔: {server.retryInterval}ms
                                                </Text>
                                            </View>

                                            {/* 地址列表 */}
                                            <View style={styles.addressList}>
                                                {server.addresses.map((address, addressIndex) => (
                                                    <View key={addressIndex} style={styles.addressItem}>
                                                        <View style={styles.addressHeader}>
                                                            <Text style={styles.addressName}>
                                                                • {address.addressName}
                                                            </Text>
                                                            <Text style={styles.addressTimeout}>
                                                                超时: {address.timeout}ms
                                                            </Text>
                                                        </View>
                                                        <Text style={styles.addressUrl}>
                                                            {address.baseURL}
                                                        </Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
            </View>
            </ScrollView>

            {/* 确认按钮 - 固定在底部 */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[
                        styles.submitButton,
                        !canSubmit && styles.submitButtonDisabled
                    ]}
                    onPress={handleSubmit}
                    disabled={!canSubmit}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                        <>
                            <Text style={styles.submitButtonText}>
                                确认切换到
                            </Text>
                            <Text style={styles.submitButtonWorkspace}>
                                {selectedWorkspace}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>

                {hasChanges && (
                    <Text style={styles.warningText}>
                        ⚠️ 切换工作空间后将自动重启应用
                    </Text>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    scrollView: {
        flex: 1,
    },
    contentContainer: {
        padding: 24,
    },
    header: {
        marginBottom: 32,
    },
    title: {
        fontSize: 24,
        fontWeight: '600',
        color: '#0F172A',
        marginBottom: 8,
    },
    description: {
        fontSize: 14,
        color: '#64748B',
        lineHeight: 20,
    },
    workspaceList: {
        marginBottom: 32,
    },
    emptyState: {
        padding: 48,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    emptyText: {
        fontSize: 14,
        color: '#94A3B8',
    },
    workspaceItem: {
        padding: 16,
        marginBottom: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#E2E8F0',
    },
    workspaceItemSelected: {
        borderColor: '#3B82F6',
        backgroundColor: '#EFF6FF',
    },
    workspaceInfo: {
        flex: 1,
    },
    workspaceHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    workspaceName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#0F172A',
    },
    workspaceNameSelected: {
        color: '#3B82F6',
    },
    serverList: {
        marginTop: 12,
    },
    serverListTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
        marginBottom: 8,
    },
    serverItem: {
        marginBottom: 12,
        padding: 12,
        backgroundColor: '#F8FAFC',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    serverHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    serverName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
        flex: 1,
    },
    serverConfig: {
        fontSize: 11,
        color: '#64748B',
    },
    addressList: {
        marginTop: 8,
        paddingLeft: 8,
    },
    addressItem: {
        marginBottom: 8,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    addressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    addressName: {
        fontSize: 13,
        fontWeight: '500',
        color: '#475569',
    },
    addressTimeout: {
        fontSize: 11,
        color: '#94A3B8',
    },
    addressUrl: {
        fontSize: 12,
        color: '#64748B',
        paddingLeft: 12,
    },
    checkmark: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#3B82F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkmarkText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    footer: {
        padding: 24,
        paddingTop: 16,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
    },
    submitButton: {
        backgroundColor: '#3B82F6',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
    },
    submitButtonDisabled: {
        backgroundColor: '#CBD5E1',
    },
    submitButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    submitButtonWorkspace: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        marginTop: 4,
    },
    warningText: {
        marginTop: 12,
        fontSize: 13,
        color: '#F59E0B',
        textAlign: 'center',
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
