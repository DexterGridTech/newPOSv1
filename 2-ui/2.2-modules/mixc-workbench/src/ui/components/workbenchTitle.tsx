import React, {useCallback, useState, useEffect, useMemo} from "react";
import {useLifecycle} from "@impos2/ui-core-base";
import {View, Text, TouchableOpacity, StyleSheet} from "react-native";
import {ServerConnectionStatus} from "@impos2/kernel-core-interconnection";

type TabType = "销售" | "店务" | "活动";

interface WorkbenchTitleProps {
    onTabChange?: (tab: TabType) => void;
    onMenuPress?: () => void;
    serverConnectionStatus?: ServerConnectionStatus;
}

const TabButton = React.memo<{
    tab: TabType;
    isActive: boolean;
    onPress: (tab: TabType) => void;
}>(({tab, isActive, onPress}) => {
    const handlePress = useCallback(() => {
        onPress(tab);
    }, [tab, onPress]);

    return (
        <TouchableOpacity
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={handlePress}
            activeOpacity={0.8}
        >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab}
            </Text>
        </TouchableOpacity>
    );
});

export const WorkbenchTitle: React.FC<WorkbenchTitleProps> = React.memo(({
    onTabChange,
    onMenuPress,
    serverConnectionStatus = ServerConnectionStatus.DISCONNECTED
}) => {
    const [activeTab, setActiveTab] = useState<TabType>("销售");
    const [currentTime, setCurrentTime] = useState("");

    useLifecycle({
        componentName: 'WorkbenchTitle',
        onInitiated: useCallback(() => {
            // 初始化逻辑
        }, []),
        onClearance: useCallback(() => {
            // 清理逻辑
        }, []),
    });

    // 更新时间 - 只更新分钟变化
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            const timeStr = `${hours}:${minutes}`;
            setCurrentTime(timeStr);
        };

        updateTime();
        const timer = setInterval(updateTime, 60000); // 每分钟更新一次
        return () => clearInterval(timer);
    }, []);

    const handleTabPress = useCallback((tab: TabType) => {
        setActiveTab(tab);
        onTabChange?.(tab);
    }, [onTabChange]);

    const handleMenuPressInternal = useCallback(() => {
        onMenuPress?.();
    }, [onMenuPress]);

    const networkIcon = useMemo(() => {
        const isConnected = serverConnectionStatus === ServerConnectionStatus.CONNECTED;
        return {
            symbol: "●",
            color: isConnected ? colors.success : colors.error
        };
    }, [serverConnectionStatus]);

    return (
        <View style={styles.container}>
            {/* 左侧 LOGO 区域 */}
            <View style={styles.leftSection}>
                <Text style={styles.logo}>IMPOS 2.0</Text>
            </View>

            {/* 中间 Tab 区域 */}
            <View style={styles.centerSection}>
                {(["收单", "店务", "活动"] as TabType[]).map((tab) => (
                    <TabButton
                        key={tab}
                        tab={tab}
                        isActive={activeTab === tab}
                        onPress={handleTabPress}
                    />
                ))}
            </View>

            {/* 右侧状态区域 */}
            <View style={styles.rightSection}>
                <Text style={styles.timeText}>{currentTime}</Text>

                <View style={styles.networkStatus}>
                    <Text style={[styles.iconText, {color: networkIcon.color}]}>
                        {networkIcon.symbol}
                    </Text>
                </View>

                <TouchableOpacity
                    style={styles.menuButton}
                    onPress={handleMenuPressInternal}
                    activeOpacity={0.7}
                >
                    <Text style={styles.menuIcon}>⋯</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
});

const colors = {
    // 基于 splashscreen 的颜色系统
    bgStart: "#E9D8C6",
    bgCenter: "#D9BEA4",
    bgEnd: "#C9A07F",
    primary: "#C08B5E",
    secondary: "#B9855E",
    textPrimary: "#5A4A3A",
    textSecondary: "#8B7355",
    textLight: "#FDF8F2",
    accent: "#F8E6CE",
    success: "#4CAF50",
    warning: "#FF9800",
    error: "#F44336",
    shadow: "rgba(90, 74, 58, 0.15)",
};

const styles = StyleSheet.create({
    container: {
        height: 77,
        flexDirection: "row",
        alignItems: "flex-end",
        backgroundColor: colors.bgStart,
        paddingHorizontal: 24,
        borderBottomWidth: 1,
        borderBottomColor: colors.bgCenter,
        shadowColor: colors.shadow,
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 1,
        shadowRadius: 4,
        elevation: 3,
    },
    leftSection: {
        flex: 1,
        justifyContent: "center",
    },
    logo: {
        fontSize: 36,
        fontWeight: "700",
        color: colors.primary,
        letterSpacing: 1.5,
    },
    centerSection: {
        flex: 2,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "flex-end",
        paddingBottom: 0,
    },
    tab: {
        paddingHorizontal: 56,
        paddingVertical: 10,
        backgroundColor: colors.bgCenter,
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        minWidth: 200,
        alignItems: "center",
        marginHorizontal: 4,
        shadowColor: colors.shadow,
        shadowOffset: {width: 0, height: -1},
        shadowOpacity: 0.5,
        shadowRadius: 2,
        elevation: 1,
    },
    tabActive: {
        backgroundColor: colors.accent,
        shadowOffset: {width: 0, height: -2},
        shadowOpacity: 0.8,
        shadowRadius: 4,
        elevation: 3,
        marginTop: -2,
    },
    tabText: {
        fontSize: 26,
        fontWeight: "500",
        color: colors.textSecondary,
    },
    tabTextActive: {
        fontSize: 30,
        fontWeight: "700",
        color: colors.primary,
    },
    rightSection: {
        flex: 1,
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "center",
    },
    timeText: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.textPrimary,
        letterSpacing: 0.5,
        marginRight: 16,
    },
    networkStatus: {
        width: 32,
        height: 32,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.accent,
        borderRadius: 16,
        marginRight: 16,
    },
    menuButton: {
        width: 36,
        height: 36,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.bgCenter,
        borderRadius: 8,
    },
    iconText: {
        fontSize: 18,
    },
    menuIcon: {
        fontSize: 24,
        color: colors.textPrimary,
        fontWeight: "700",
    },
});