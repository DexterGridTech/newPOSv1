import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { ScreenMode } from "@impos2/kernel-base";
import { ScreenPartRegistration } from "@impos2/kernel-base";
import { useLifecycle } from "@impos2/ui-core-base-2";
import { systemAdminVariable } from "../../ui-variables";
import { moduleName } from '../../moduleName';
import { useClearDataVersion } from "../../hooks";

/**
 * 清除数据版本页面
 *
 * 职责：
 * 1. 显示当前工作空间名称和数据版本
 * 2. 提供清除数据功能（需二次确认）
 * 3. 清除后自动重启应用
 */
export const ClearDataVersionScreen: React.FC = () => {
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    // 使用 hook 管理清除数据逻辑
    const {
        currentWorkspace,
        dataVersion,
        isLoading,
        handleClearData,
    } = useClearDataVersion();

    // 使用 useLifecycle hook 处理组件生命周期
    useLifecycle({
        isVisible: true,
        componentName: 'ClearDataVersionScreen',
        onInitiated: useCallback(() => {
            console.log(`[${moduleName}] ClearDataVersionScreen 初始化完成`);
        }, []),
        onClearance: useCallback(() => {
            console.log(`[${moduleName}] ClearDataVersionScreen 清理资源`);
        }, []),
    });

    // 显示确认对话框
    const handleShowConfirm = useCallback(() => {
        setShowConfirmModal(true);
    }, []);

    // 取消清除
    const handleCancel = useCallback(() => {
        setShowConfirmModal(false);
    }, []);

    // 确认清除
    const handleConfirm = useCallback(() => {
        setShowConfirmModal(false);
        handleClearData();
    }, [handleClearData]);

    return (
        <View style={styles.container}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
                {/* 标题区域 */}
                <View style={styles.header}>
                    <Text style={styles.title}>数据版本管理</Text>
                    <Text style={styles.description}>
                        查看当前数据版本信息，并可清除数据
                    </Text>
                </View>

                {/* 信息卡片 */}
                <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>当前工作空间</Text>
                        <Text style={styles.infoValue}>{currentWorkspace}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>数据版本</Text>
                        <Text style={styles.infoValueHighlight}>{dataVersion}</Text>
                    </View>
                </View>

                {/* 警告提示 */}
                <View style={styles.warningBox}>
                    <Text style={styles.warningIcon}>⚠️</Text>
                    <View style={styles.warningContent}>
                        <Text style={styles.warningTitle}>清除数据说明</Text>
                        <Text style={styles.warningText}>
                            • 清除数据将递增数据版本号{'\n'}
                            • 清除后应用将自动重启{'\n'}
                            • 此操作不可撤销，请谨慎操作
                        </Text>
                    </View>
                </View>
            </ScrollView>

            {/* 清除按钮 - 固定在底部 */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.clearButton}
                    onPress={handleShowConfirm}
                    disabled={isLoading}
                >
                    <Text style={styles.clearButtonText}>
                        {isLoading ? '正在清除...' : '清除数据'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* 确认对话框 */}
            <Modal
                visible={showConfirmModal}
                transparent={true}
                animationType="fade"
                onRequestClose={handleCancel}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>确认清除数据</Text>
                        <Text style={styles.modalMessage}>
                            确定要清除数据吗？{'\n'}
                            清除后应用将自动重启。
                        </Text>
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalButtonCancel]}
                                onPress={handleCancel}
                            >
                                <Text style={styles.modalButtonTextCancel}>取消</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalButtonConfirm]}
                                onPress={handleConfirm}
                            >
                                <Text style={styles.modalButtonTextConfirm}>确认清除</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    infoCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    divider: {
        height: 1,
        backgroundColor: '#E2E8F0',
    },
    infoLabel: {
        fontSize: 15,
        fontWeight: '500',
        color: '#64748B',
    },
    infoValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0F172A',
    },
    infoValueHighlight: {
        fontSize: 20,
        fontWeight: '700',
        color: '#3B82F6',
    },
    warningBox: {
        flexDirection: 'row',
        backgroundColor: '#FEF3C7',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#FDE68A',
        marginBottom: 24,
    },
    warningIcon: {
        fontSize: 24,
        marginRight: 12,
    },
    warningContent: {
        flex: 1,
    },
    warningTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#92400E',
        marginBottom: 8,
    },
    warningText: {
        fontSize: 13,
        color: '#78350F',
        lineHeight: 20,
    },
    footer: {
        padding: 24,
        paddingTop: 16,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
    },
    clearButton: {
        backgroundColor: '#EF4444',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
    },
    clearButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
        width: '80%',
        maxWidth: 400,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#0F172A',
        marginBottom: 12,
        textAlign: 'center',
    },
    modalMessage: {
        fontSize: 15,
        color: '#64748B',
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 24,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    modalButtonCancel: {
        backgroundColor: '#F1F5F9',
    },
    modalButtonConfirm: {
        backgroundColor: '#EF4444',
    },
    modalButtonTextCancel: {
        color: '#475569',
        fontSize: 15,
        fontWeight: '600',
    },
    modalButtonTextConfirm: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
});

export const clearDataVersionScreenPart: ScreenPartRegistration = {
    name: 'clearDataVersionScreen',
    title: '清除数据版本',
    description: '清除和管理数据版本',
    partKey: 'system-admin-clear-data-version',
    containerKey: systemAdminVariable.systemAdminPanel.key,
    screenMode: [ScreenMode.DESKTOP, ScreenMode.MOBILE],
    componentType: ClearDataVersionScreen,
    indexInContainer: 2,
};
