import {
    ApiServerAddress,
    DeviceInfo,
    DisplayMode,
    generateStore,
    InstanceMode,
    KERNEL_API_SERVER_NAME,
    KERNEL_WS_SERVER_NAME,
    ScreenMode,
    StoreConfig,
    Workspace
} from "@impos2/kernel-base";
import {uiDeviceActivateModule} from "../src";

//待从原生层获取
const deviceInfo: DeviceInfo = {
    id: "123",
    manufacturer: "intel",
    os: "android",
    osVersion: "12.0",
    cpu: "1.4hz",
    memory: "4gb",
    disk: "64gb",
    network: "Lan",
    displays: [{
        id: "1",
        displayType: "LCD",
        refreshRate: 60,
        width: 1920,
        height: 1080,
        physicalWidth: 150,
        physicalHeight: 84,
        orientation: "portrait",
        isMobile: false
    }]
}


const kernelApiServerAddress: ApiServerAddress = {
    serverName: KERNEL_API_SERVER_NAME,
    retryCount: 3,
    retryInterval: 1000,
    addresses: [
        {
            addressName: "主线路1",
            baseURL: "http://127.0.0.1:999/kernel-server",
            timeout: 3000
        },
        {
            addressName: "主线路2",
            baseURL: "http://localhost:9999/kernel-server",
            timeout: 3000
        }
    ]
}
const kernelWSServerAddress: ApiServerAddress = {
    serverName: KERNEL_WS_SERVER_NAME,
    retryCount: 3,
    retryInterval: 1000,
    addresses: [
        {
            addressName: "主线路1",
            baseURL: "ws://127.0.0.1:999/kernel-server",
            timeout: 3000
        },
        {
            addressName: "主线路2",
            baseURL: "ws://localhost:9999/kernel-server",
            timeout: 3000
        }
    ]
}
const workspace: Workspace = {
    selectedWorkspace: "test",
    workspaces: [
        {
            workspaceName: "test",
            apiServerAddresses: [
                kernelApiServerAddress,
                kernelWSServerAddress
            ]
        }
    ]
}
const preInitiatedState = {
    deviceStatus: {
        deviceInfo: deviceInfo
    },
    instanceInfo: {
        instance: {
            instanceMode: InstanceMode.MASTER,
            displayMode: DisplayMode.PRIMARY,
            screenMode: ScreenMode.DESKTOP
        },
        workspace: workspace,
        standAlone: true,
        enableSlaves: true,
        masterSlaves: {},
        slaveConnectionInfo: {},
    },
}

const storeConfig: StoreConfig = {
    workspace: workspace,
    devTools: true,
    nativeAdapter: null,
    preInitiatedState: preInitiatedState,
    kernelModules: [uiDeviceActivateModule]
}

export const {store,persistor} = generateStore(storeConfig)
console.log("生成devStore")