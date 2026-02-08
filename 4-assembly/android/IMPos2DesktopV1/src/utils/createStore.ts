console.log('[createStore] 开始导入依赖');
import {
    DisplayMode,
    generateStore,
    InstanceMode,
    IPosAdapter,
    ScreenMode,
    Slave,
    StoreConfig
} from "@impos2/kernel-base";
console.log('[createStore] kernel-base 导入成功');
import {AppProps} from "../types/AppProps.ts";
import reactotron from "./ReactotronConfig.ts";
import {assemblyModule} from "../module.ts";
import {workspace} from "@impos2/workspace-dev";
console.log('[createStore] 所有依赖导入完成');

async function createStore(props: AppProps, posAdapter: IPosAdapter) {


    const deviceInfo = await posAdapter.deviceInfo.getDeviceInfo()
    console.log("获取deviceInfo成功")
    const displays = deviceInfo.displays;

    const standAlone = props.displayId === 0
    const instanceMode: InstanceMode = standAlone ? InstanceMode.MASTER : InstanceMode.SLAVE
    const displayMode: DisplayMode = standAlone ? DisplayMode.PRIMARY : DisplayMode.SECONDARY;
    const screenMode = displays[0].isMobile ? ScreenMode.MOBILE : ScreenMode.DESKTOP

    const enableSlaves = standAlone && (displays.length > 1)

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
            enableSlaves: enableSlaves,
            masterSlaves: enableSlaves ? {
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

    const storeConfig: StoreConfig = {
        standAlone: standAlone,
        workspace: workspace,
        nativeAdapter: posAdapter,
        preInitiatedState: preInitiatedState,
        kernelModules: [assemblyModule],
        // 在开发环境下启用 Reactotron
        reactotronEnhancer: __DEV__ ? reactotron.createEnhancer!() : undefined,
    };

    return await generateStore(storeConfig);
}

export default createStore;
