import {
    ApiServerAddress,
    DisplayMode,
    generateStore,
    InstanceMode,
    IPosAdapter,
    KERNEL_API_SERVER_NAME,
    KERNEL_WS_SERVER_NAME,
    ScreenMode,
    Slave,
    StoreConfig,
    Workspace
} from "@impos2/kernel-base";
import {AppProps} from "../types/AppProps.ts";
import {uiIntegrateDesktop2Module} from "@impos2/integrate-desktop-2";
import reactotron from "../config/ReactotronConfig";

async function createStore(props: AppProps, posAdapter: IPosAdapter) {
    const kernelApiServerAddress: ApiServerAddress = {
        serverName: KERNEL_API_SERVER_NAME,
        retryCount: 3,
        retryInterval: 1000,
        addresses: [
            {
                addressName: "主线路1",
                baseURL: "http://169.254.237.142:9999/kernel-server",
                timeout: 3000,
            },
            {
                addressName: "主线路2",
                baseURL: "http://localhost:9999/kernel-server",
                timeout: 3000,
            },
        ],
    };
    // 配置 WebSocket 服务器地址
    const kernelWSServerAddress: ApiServerAddress = {
        serverName: KERNEL_WS_SERVER_NAME,
        retryCount: 3,
        retryInterval: 1000,
        addresses: [
            {
                addressName: "主线路1",
                baseURL: "ws://169.254.237.142:9999/kernel-server",
                timeout: 3000,
            },
            {
                addressName: "主线路2",
                baseURL: "ws://localhost:9999/kernel-server",
                timeout: 3000,
            },
        ],
    };

    // 配置工作空间
    const workspace: Workspace = {
        selectedWorkspace: "mixcDesktop",
        workspaces: [
            {
                workspaceName: "mixcDesktop",
                apiServerAddresses: [kernelApiServerAddress, kernelWSServerAddress],
            },
        ],
    };


    const deviceInfo = await posAdapter.deviceInfo.getDeviceInfo()
    console.log("获取deviceInfo成功")
    const displays = deviceInfo.displays;

    const standAlone = props.displayId === 0
    const instanceMode: InstanceMode = standAlone ? InstanceMode.MASTER : InstanceMode.SLAVE
    const displayMode: DisplayMode = standAlone ? DisplayMode.PRIMARY : DisplayMode.SECONDARY;
    const screenMode = displays[0].isMobile ? ScreenMode.MOBILE : ScreenMode.DESKTOP


    if (displays.length > 1) {

    }
    const preInitiatedState = {
        deviceStatus: {
            deviceInfo: deviceInfo,
        },
        instanceInfo: {
            instance: {
                instanceMode: instanceMode,
                displayMode: displayMode,
                screenMode: screenMode,
            },
            workspace: workspace,
            standAlone: standAlone,
            enableSlaves: standAlone && (displays.length > 1),
            masterSlaves: (standAlone && (displays.length > 1)) ? {
                ['embeddedDisplay']: {
                    name: "embeddedDisplay",
                    addedAt: 0,
                    embedded: true,
                    deviceId: "slave-embeddedDisplay"
                }
            } : {} as { [name: string]: Slave },
            slaveConnectionInfo: (!standAlone) ? {
                slaveName: "embeddedDisplay",
                masterName: "master",
                masterDeviceId: "embeddedDisplay",
                masterServerAddress: [
                    {
                        name: "address1",
                        address: "http://localhost:8888/mockMasterServer",
                    },
                    {
                        name: "address2",
                        address: "http://localhost:9999/mockMasterServer",
                    }
                ]
            } : {},
        },
    };
    const rootModule = uiIntegrateDesktop2Module
    console.log("rootModule", rootModule)
    if (!rootModule) {
        throw new Error("rootModule is null or undefined")
    }
    console.log("rootModule.name", rootModule.name)

    const storeConfig: StoreConfig = {
        workspace: workspace,
        nativeAdapter: null,
        preInitiatedState: preInitiatedState,
        kernelModules: [rootModule],
        // 在开发环境下启用 Reactotron
        reactotronEnhancer: __DEV__ ? reactotron.createEnhancer!() : undefined,
    };

    return generateStore(storeConfig);
}

export default createStore;