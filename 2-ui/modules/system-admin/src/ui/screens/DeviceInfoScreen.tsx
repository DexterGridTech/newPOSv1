import React, {useCallback} from 'react';
import {View, Text, StyleSheet, ScrollView} from 'react-native';
import {ScreenMode, ScreenPartRegistration} from "@impos2/kernel-base";
import {useLifecycle} from "@impos2/ui-core-base-2";
import {systemAdminVariable} from "../systemAdminVariables";
import {useDeviceInfo} from "../../hooks/useDeviceInfo";

/**
 * 设备信息展示页面
 *
 * 职责：
 * 1. 展示设备基础信息（制造商、操作系统、CPU、内存等）
 * 2. 展示显示器信息（分辨率、刷新率、物理尺寸等）
 * 3. 科学美观的卡片式布局
 */
export const DeviceInfoScreen: React.FC = () => {
    const {deviceInfo} = useDeviceInfo()

    // 使用 useLifecycle hook 处理组件生命周期
    useLifecycle({
        componentName: 'DeviceInfoScreen',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });

    // 如果设备信息为空，显示加载状态
    if (!deviceInfo) {
        return (
            <View style={styles.container}>
                <Text style={styles.emptyText}>设备信息加载中...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            {/* 设备基础信息卡片 */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>设备基础信息</Text>
                <View style={styles.divider} />

                <InfoRow label="设备 ID" value={deviceInfo.id} />
                <InfoRow label="制造商" value={deviceInfo.manufacturer} />
                <InfoRow label="操作系统" value={deviceInfo.os} />
                <InfoRow label="系统版本" value={deviceInfo.osVersion} />
                <InfoRow label="CPU" value={deviceInfo.cpu} />
                <InfoRow label="内存" value={deviceInfo.memory} />
                <InfoRow label="磁盘" value={deviceInfo.disk} />
                <InfoRow label="网络" value={deviceInfo.network} />
            </View>

            {/* 显示器信息卡片 */}
            {deviceInfo.displays && deviceInfo.displays.length > 0 && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>显示器信息</Text>
                    <View style={styles.divider} />

                    {deviceInfo.displays.map((display, index) => (
                        <View key={display.id} style={styles.displaySection}>
                            {index > 0 && <View style={styles.displayDivider} />}
                            <Text style={styles.displayTitle}>显示器 {index + 1}</Text>

                            <InfoRow label="显示器 ID" value={display.id} />
                            <InfoRow label="类型" value={display.displayType} />
                            <InfoRow
                                label="分辨率"
                                value={`${display.width} × ${display.height}`}
                            />
                            <InfoRow
                                label="物理尺寸"
                                value={`${display.physicalWidth} × ${display.physicalHeight} mm`}
                            />
                            <InfoRow
                                label="刷新率"
                                value={`${display.refreshRate} Hz`}
                            />
                            <InfoRow label="方向" value={display.orientation} />
                            <InfoRow
                                label="设备类型"
                                value={display.isMobile ? '移动设备' : '桌面设备'}
                            />
                        </View>
                    ))}
                </View>
            )}
        </ScrollView>
    );
};

/**
 * 信息行组件
 */
const InfoRow: React.FC<{label: string; value: string}> = ({label, value}) => (
    <View style={styles.infoRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
    </View>
);

/**
 * 样式定义
 */
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    contentContainer: {
        padding: 16,
    },
    emptyText: {
        fontSize: 16,
        color: '#999',
        textAlign: 'center',
        marginTop: 40,
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 12,
    },
    divider: {
        height: 1,
        backgroundColor: '#e0e0e0',
        marginBottom: 16,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    label: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
        flex: 1,
    },
    value: {
        fontSize: 14,
        color: '#333',
        fontWeight: '400',
        flex: 2,
        textAlign: 'right',
    },
    displaySection: {
        marginTop: 8,
    },
    displayDivider: {
        height: 1,
        backgroundColor: '#e0e0e0',
        marginVertical: 16,
    },
    displayTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#555',
        marginBottom: 12,
    },
});

export const deviceInfoScreenPart: ScreenPartRegistration = {
    name: 'deviceInfoScreen',
    title: '设备基础信息',
    description: '设备硬件基础信息',
    partKey: 'system-admin-device-info',
    containerKey: systemAdminVariable.systemAdminPanel.key,
    screenMode: [ScreenMode.DESKTOP, ScreenMode.MOBILE],
    componentType: DeviceInfoScreen,
    indexInContainer: 2,
};
