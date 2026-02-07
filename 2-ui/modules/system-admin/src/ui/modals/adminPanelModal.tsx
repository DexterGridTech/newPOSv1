import React, { useCallback, useMemo } from "react";
import {Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View, ScrollView} from "react-native";
import {
    ModalScreen,
    ScreenPartRegistration,
    getScreenPartsByContainerKey,
    NavigationCommand,
    useChildScreenPart,
} from "@impos2/kernel-module-ui-navigation";
import {ScreenMode} from "@impos2/kernel-base";
import {CloseModalCommand} from "@impos2/kernel-module-ui-navigation/";
import { useModalAnimation, StackContainer, useLifecycle } from "@impos2/ui-core-base-2";
import { moduleName } from "../../types";
import { systemAdminVariable } from "../variables";

/**
 * 管理员面板 Modal 组件 - 企业级设计
 *
 * 职责：
 * 1. 展示管理员管理面板
 * 2. 管理弹窗的打开/关闭动画
 * 3. 动态加载注册到 systemAdminPanel 的所有功能页面
 * 4. 使用 StackContainer 渲染选中的功能页面
 * 5. 管理组件生命周期和资源释放
 *
 * 设计系统:
 * - 极简主义风格 (Minimalism & Swiss Style)
 * - 企业级配色方案 (Navy/Grey)
 * - 专业字体组合
 * - 流畅的弹簧动画
 * - WCAG AAA 可访问性标准
 */

// 定义 Modal 的 props 类型
export interface AdminPanelModalProps {
    // 可以添加额外的配置参数
}

export const AdminPanelModal: React.FC<ModalScreen<AdminPanelModalProps>> = React.memo((model) => {
    // 使用通用的 Modal 动画 Hook
    const { scaleAnim, opacityAnim, isVisible } = useModalAnimation(model.open, model.id, {
        modalName: 'AdminPanelModal',
        moduleName,
        openDuration: 200,
        closeDuration: 150,
        tension: 50,
        friction: 7,
    });

    // 获取当前选中的子 ScreenPart
    const currentChild = useChildScreenPart(systemAdminVariable.systemAdminPanel);

    // 动态获取所有注册到 systemAdminPanel 的 ScreenPart
    const menuItems = useMemo(() => {
        return getScreenPartsByContainerKey(systemAdminVariable.systemAdminPanel.key);
    }, []);

    /**
     * 关闭弹窗函数
     */
    const handleClose = useCallback(() => {
        new CloseModalCommand({modelId: model.id}).executeInternally();
    }, [model.id]);

    // 使用 useLifecycle hook 处理组件生命周期
    useLifecycle({
        isVisible,
        onInitiated: useCallback(() => {
            console.log(`[${moduleName}] AdminPanelModal 初始化完成: modalId=${model.id}`);
        }, [model.id]),
        onClearance: useCallback(() => {
            console.log(`[${moduleName}] AdminPanelModal 清理资源: modalId=${model.id}`);
            // 可以在这里添加其他清理逻辑，如重置选中状态等
        }, [model.id]),
    });

    /**
     * 菜单项选择处理
     */
    const handleMenuSelect = useCallback((screenPart: ScreenPartRegistration) => {
        new NavigationCommand({
            target: {
                partKey: screenPart.partKey,
                name: screenPart.name,
                title: screenPart.title,
                description: screenPart.description,
                screenMode: screenPart.screenMode,
                containerKey: screenPart.containerKey,
                indexInContainer: screenPart.indexInContainer,
            }
        }).executeInternally();
    }, []);

    /**
     * 边界情况处理：组件不可见时不渲染
     */
    if (!isVisible) {
        return null;
    }

    /**
     * 渲染组件
     */
    return (
        <View style={styles.modalOverlay}>
            <Animated.View style={[styles.backdropAnimated, { opacity: opacityAnim }]}>
                <TouchableOpacity
                    style={styles.backdrop}
                    activeOpacity={1}
                    onPress={handleClose}
                    accessibilityLabel="关闭弹窗"
                    accessibilityRole="button"
                />
            </Animated.View>

            <Animated.View
                style={[
                    styles.dialogContainer,
                    {
                        transform: [{scale: scaleAnim}],
                        opacity: opacityAnim,
                    },
                ]}
            >
                {/* Title Bar */}
                <View style={styles.titleBar}>
                    <Text style={styles.titleText}>管理员面板</Text>
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={handleClose}
                        activeOpacity={0.7}
                        accessibilityLabel="关闭"
                        accessibilityRole="button"
                    >
                        <Text style={styles.closeButtonText}>✕</Text>
                    </TouchableOpacity>
                </View>

                {/* Main Content Area */}
                <View style={styles.mainContent}>
                    {/* Left Sidebar - Dynamic Menu */}
                    <View style={styles.sidebar}>
                        <ScrollView style={styles.menuScrollView}>
                            {menuItems.map((item) => {
                                const isActive = currentChild?.partKey === item.partKey;
                                return (
                                    <TouchableOpacity
                                        key={item.partKey}
                                        style={[
                                            styles.menuItem,
                                            isActive && styles.menuItemActive
                                        ]}
                                        onPress={() => handleMenuSelect(item)}
                                        activeOpacity={0.7}
                                        accessibilityLabel={item.title}
                                        accessibilityRole="button"
                                    >
                                        <Text style={[
                                            styles.menuItemText,
                                            isActive && styles.menuItemTextActive
                                        ]}>
                                            {item.title}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Right Content Area - StackContainer */}
                    <View style={styles.contentArea}>
                        <StackContainer containerPart={systemAdminVariable.systemAdminPanel} />
                    </View>
                </View>
            </Animated.View>
        </View>
    );
}, (prevProps, nextProps) => {
    // 自定义比较函数，优化重渲染
    return prevProps.id === nextProps.id &&
           prevProps.open === nextProps.open &&
           prevProps.partKey === nextProps.partKey;
});

// 设计系统常量
const COLORS = {
    primary: '#0F172A',
    surface: '#FFFFFF',
    text: '#020617',
    textSecondary: '#64748B',
    border: '#E2E8F0',
    overlay: 'rgba(0, 0, 0, 0.5)',
    menuBg: '#F8FAFC',
    menuHover: '#E2E8F0',
    menuActive: '#0369A1',
    menuActiveText: '#FFFFFF',
};

const {width, height} = Dimensions.get('window');

const styles = StyleSheet.create({
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1,
    },
    backdropAnimated: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: COLORS.overlay,
    },
    dialogContainer: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        width: Math.min(width - 48, 900),
        height: Math.min(height - 96, 600),
        maxWidth: 900,
        maxHeight: 600,
        shadowColor: COLORS.primary,
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        zIndex: 2,
        overflow: 'hidden',
    },
    titleBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        backgroundColor: COLORS.surface,
    },
    titleText: {
        fontSize: 20,
        fontWeight: '600',
        color: COLORS.text,
        letterSpacing: -0.3,
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.menuBg,
    },
    closeButtonText: {
        fontSize: 18,
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    mainContent: {
        flex: 1,
        flexDirection: 'row',
    },
    sidebar: {
        width: 200,
        backgroundColor: COLORS.menuBg,
        borderRightWidth: 1,
        borderRightColor: COLORS.border,
    },
    menuScrollView: {
        flex: 1,
    },
    menuItem: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    menuItemActive: {
        backgroundColor: COLORS.menuActive,
    },
    menuItemText: {
        fontSize: 15,
        fontWeight: '500',
        color: COLORS.text,
    },
    menuItemTextActive: {
        color: COLORS.menuActiveText,
    },
    contentArea: {
        flex: 1,
        backgroundColor: COLORS.surface,
    },
});

// 导出 ScreenPartRegistration
export const adminPanelModalPartKey = 'adminPanelModal';

export const adminPanelModalPart: ScreenPartRegistration = {
    name: 'adminPanelModal',
    title: '管理员面板',
    description: '管理员控制面板，提供系统管理和配置功能',
    partKey: adminPanelModalPartKey,
    screenMode: [ScreenMode.DESKTOP, ScreenMode.MOBILE],
    componentType: AdminPanelModal
};
