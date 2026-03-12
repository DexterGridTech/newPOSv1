import {useCallback, useMemo, useState} from "react";
import {useSelector} from "react-redux";
import {RootState} from "@impos2/kernel-core-base";
import {kernelCoreTerminalState, TerminalConnectionState} from "@impos2/kernel-core-terminal";
import {
    getInstanceMode,
    InstanceInterconnectionState,
    InstanceMode,
    kernelCoreInterconnectionState,
    ServerConnectionStatus
} from "@impos2/kernel-core-interconnection";

type TabType = "销售" | "店务" | "活动";

type S = RootState & {
    [kernelCoreTerminalState.terminalConnection]: TerminalConnectionState
    [kernelCoreInterconnectionState.instanceInterconnection]: InstanceInterconnectionState
}

export const useWorkbenchTitle = () => {
    const [activeTab, setActiveTab] = useState<TabType>("销售");

    const terminalConnectionStatus = useSelector((state: RootState) =>
        (state as S)[kernelCoreTerminalState.terminalConnection]?.serverConnectionStatus?.value
    );

    const instanceInterconnectionStatus = useSelector((state: RootState) =>
        (state as S)[kernelCoreInterconnectionState.instanceInterconnection]?.serverConnectionStatus
    );

    const serverConnectionStatus = useMemo(() => {
        const instanceMode = getInstanceMode();

        if (instanceMode === InstanceMode.MASTER) {
            // MASTER 模式：只判断 terminalConnection 的状态
            return terminalConnectionStatus;
        } else {
            // SLAVE 模式：需要同时判断 terminalConnection 和 instanceInterconnection 的状态
            // 只有两者都是 CONNECTED 时，才返回 CONNECTED
            if (
                terminalConnectionStatus === ServerConnectionStatus.CONNECTED &&
                instanceInterconnectionStatus === ServerConnectionStatus.CONNECTED
            ) {
                return ServerConnectionStatus.CONNECTED;
            }
            // 如果任意一个是 CONNECTING，返回 CONNECTING
            if (
                terminalConnectionStatus === ServerConnectionStatus.CONNECTING ||
                instanceInterconnectionStatus === ServerConnectionStatus.CONNECTING
            ) {
                return ServerConnectionStatus.CONNECTING;
            }
            // 其他情况返回 DISCONNECTED
            return ServerConnectionStatus.DISCONNECTED;
        }
    }, [terminalConnectionStatus, instanceInterconnectionStatus]);

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
