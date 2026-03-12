import {useCallback, useMemo} from "react";
import {useSelector} from "react-redux";
import {RootState, ScreenPart} from "@impos2/kernel-core-base";
import {kernelCoreTerminalState, TerminalConnectionState} from "@impos2/kernel-core-terminal";
import {
    getInstanceMode,
    InstanceInterconnectionState,
    InstanceMode,
    kernelCoreInterconnectionState,
    ServerConnectionStatus
} from "@impos2/kernel-core-interconnection";
import {getScreenPartsByContainerKey} from "@impos2/kernel-core-navigation";
import {kernelCoreNavigationCommands} from "@impos2/kernel-core-navigation";
import {uiMixcWorkbenchVariables} from "../ui/variables";
import {useChildScreenPart} from "@impos2/kernel-core-navigation";

type S = RootState & {
    [kernelCoreTerminalState.terminalConnection]: TerminalConnectionState
    [kernelCoreInterconnectionState.instanceInterconnection]: InstanceInterconnectionState
}

export interface TabItem {
    partKey: string;
    title: string;
    screenPart: ScreenPart<any>;
}

export const useWorkbenchTitle = () => {
    // 获取当前激活的 ScreenPart
    const currentScreenPart = useChildScreenPart(uiMixcWorkbenchVariables.workbenchMainContainer);

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

    // 动态获取所有 tab
    const tabs = useMemo<TabItem[]>(() => {
        const screenParts = getScreenPartsByContainerKey(uiMixcWorkbenchVariables.workbenchMainContainer.key);
        return screenParts.map(registration => {
            const {componentType, ...screenPart} = registration;
            return {
                partKey: registration.partKey,
                title: registration.title,
                screenPart: screenPart
            };
        });
    }, []);

    // Tab 切换处理
    const handleTabChange = useCallback((tab: TabItem) => {
        kernelCoreNavigationCommands.navigateTo({target: tab.screenPart}).executeInternally();
    }, []);

    // 菜单按钮点击处理
    const handleMenuPress = useCallback(() => {
        // TODO: 实现菜单打开逻辑
        console.log("打开菜单");
    }, []);

    return {
        tabs,
        currentScreenPart,
        serverConnectionStatus,
        handleTabChange,
        handleMenuPress,
    };
};
