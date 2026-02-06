import React from 'react';
import {View, Text, StyleSheet, ScrollView} from 'react-native';
import {ScreenPartRegistration} from "@impos2/kernel-module-ui-navigation";
import {ScreenMode} from "@impos2/kernel-base";
import {useSystemAdmin} from "../../hooks";

/**
 * 系统管理桌面页面 - 企业级设计
 *
 * 职责：
 * 1. 展示系统管理主界面
 * 2. 提供系统管理相关的功能入口
 * 3. 管理系统管理相关的状态
 *
 * 设计系统:
 * - 极简主义风格 (Minimalism)
 * - 企业级配色方案 (Navy/Grey)
 * - 清晰的视觉层次
 * - 响应式布局
 */
export const SystemAdminDesktopScreen: React.FC = React.memo(() => {
    const {
        adminName,
        handleAdminNameChange,
    } = useSystemAdmin({
        lifecycle: {
            onMount: () => {
                console.log('SystemAdminDesktopScreen mounted');
            },
            onUnmount: () => {
                console.log('SystemAdminDesktopScreen unmounted');
            }
        }
    });

    return (
        <ScrollView style={styles.container}>
            <View style={styles.content}>
                {/* 页面标题 */}
                <View style={styles.header}>
                    <Text style={styles.title}>系统管理</Text>
                    <Text style={styles.subtitle}>System Administration</Text>
                </View>

                {/* 欢迎区域 */}
                <View style={styles.welcomeCard}>
                    <View style={styles.iconContainer}>
                        <Text style={styles.iconText}>⚙️</Text>
                    </View>
                    <Text style={styles.welcomeTitle}>欢迎使用系统管理</Text>
                    <Text style={styles.welcomeDescription}>
                        在这里您可以管理系统设置、用户权限、数据配置等功能
                    </Text>
                </View>

                {/* 功能区域 - 待添加 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>快速功能</Text>
                    <View style={styles.placeholder}>
                        <Text style={styles.placeholderText}>
                            功能模块待添加...
                        </Text>
                    </View>
                </View>
            </View>
        </ScrollView>
    );
});

// 设计系统常量
const COLORS = {
    primary: '#0F172A',        // Navy 900
    surface: '#FFFFFF',        // White
    background: '#F8FAFC',     // Slate 50
    text: '#020617',           // Slate 950
    textSecondary: '#64748B',  // Slate 500
    border: '#E2E8F0',         // Slate 200
    accent: '#0369A1',         // Sky 700
    accentBg: '#F0F9FF',       // Sky 50
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        padding: 24,
        maxWidth: 1200,
        width: '100%',
        alignSelf: 'center',
    },
    header: {
        marginBottom: 32,
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        color: COLORS.text,
        letterSpacing: -0.5,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        fontWeight: '400',
        color: COLORS.textSecondary,
        letterSpacing: 0.5,
    },
    welcomeCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 32,
        alignItems: 'center',
        marginBottom: 32,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: COLORS.primary,
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    iconContainer: {
        marginBottom: 16,
    },
    iconText: {
        fontSize: 48,
    },
    welcomeTitle: {
        fontSize: 24,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 12,
        letterSpacing: -0.3,
    },
    welcomeDescription: {
        fontSize: 15,
        lineHeight: 22,
        color: COLORS.textSecondary,
        textAlign: 'center',
        maxWidth: 480,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 16,
        letterSpacing: -0.3,
    },
    placeholder: {
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        padding: 48,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderStyle: 'dashed',
    },
    placeholderText: {
        fontSize: 15,
        color: COLORS.textSecondary,
        fontWeight: '400',
    },
});

export const systemAdminDesktopScreenPart: ScreenPartRegistration = {
    partKey: 'systemAdminDesktop',
    containerKey: '',
    screenMode: [ScreenMode.DESKTOP],
    componentType: SystemAdminDesktopScreen
};
