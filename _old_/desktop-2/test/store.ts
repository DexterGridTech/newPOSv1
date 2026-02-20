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
} from "_old_/base";
import {uiIntegrateDesktop2Module} from "../src";
import {workspace} from "@impos2/workspace-dev";

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
    standAlone:true,
    workspace: workspace,
    preInitiatedState: preInitiatedState,
    kernelModules: [uiIntegrateDesktop2Module]
}

// 导出 Promise 供 App 组件等待
export const storePromise = generateStore(storeConfig).then(result => {
    console.log("生成devStore");
    return result;
});