import {useCallback, useState} from "react";
import {useSelector} from "react-redux";
import {RootState} from "@impos2/kernel-core-base";
import {kernelCoreTerminalState, TerminalConnectionState} from "@impos2/kernel-core-terminal";

type TabType = "收单" | "店务" | "活动";

type S = RootState & {
    [kernelCoreTerminalState.terminalConnection]: TerminalConnectionState
}

export const useWorkbenchTitle = () => {
    const [activeTab, setActiveTab] = useState<TabType>("收单");

    const serverConnectionStatus = useSelector((state: RootState) =>
        (state as S)[kernelCoreTerminalState.terminalConnection]?.serverConnectionStatus?.value
    );

    // Tab 切换处理
    const handleTabChange = useCallback((tab: TabType) => {
        setActiveTab(tab);
        // TODO: 实现 Tab 切换的业务逻辑
        // 例如: dispatch(navigateToTab(tab))
        console.log(`切换到 Tab: ${tab}`);
    }, []);

    // 菜单按钮点击处理
    const handleMenuPress = useCallback(() => {
        // TODO: 实现菜单打开逻辑
        // 例如: dispatch(openMenu())
        console.log("打开菜单");
    }, []);

    // 获取当前时间
    const getCurrentTime = useCallback(() => {
        return new Date();
    }, []);

    return {
        activeTab,
        serverConnectionStatus,
        handleTabChange,
        handleMenuPress,
        getCurrentTime,
    };
};
