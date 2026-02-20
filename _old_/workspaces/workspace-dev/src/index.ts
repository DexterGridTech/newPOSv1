import {ApiServerAddress, KERNEL_API_SERVER_NAME, KERNEL_WS_SERVER_NAME, Workspace} from "_old_/base";


const kernelApiServerAddress_1: ApiServerAddress = {
    serverName: KERNEL_API_SERVER_NAME,
    retryCount: 3,
    retryInterval: 1000,
    addresses: [
        {
            addressName: "主线路1",
            baseURL: "http://127.0.0.1:9999/kernel-server",
            timeout: 3000
        },
        {
            addressName: "主线路2",
            baseURL: "http://172.20.10.2:9999/kernel-server",
            timeout: 3000
        },
        {
            addressName: "主线路3",
            baseURL: "http://localhost:9999/kernel-server",
            timeout: 3000
        }
    ]
}
const kernelWSServerAddress_1: ApiServerAddress = {
    serverName: KERNEL_WS_SERVER_NAME,
    retryCount: 3,
    retryInterval: 1000,
    addresses: [
        {
            addressName: "主线路1",
            baseURL: "ws://127.0.0.1:9999/kernel-server",
            timeout: 3000
        },
        {
            addressName: "主线路2",
            baseURL: "ws://localhost:9999/kernel-server",
            timeout: 3000
        },
        {
            addressName: "主线路2",
            baseURL: "ws://172.20.10.2:9999/kernel-server",
            timeout: 3000
        }
    ]
}
const kernelApiServerAddress_2: ApiServerAddress = {
    serverName: KERNEL_API_SERVER_NAME,
    retryCount: 3,
    retryInterval: 1000,
    addresses: [
        {
            addressName: "主线路1",
            baseURL: "http://10.0.0.2:999/kernel-server",
            timeout: 3000
        },
        {
            addressName: "主线路2",
            baseURL: "http://localhost:9999/kernel-server",
            timeout: 3000
        }
    ]
}
const kernelWSServerAddress_2: ApiServerAddress = {
    serverName: KERNEL_WS_SERVER_NAME,
    retryCount: 3,
    retryInterval: 1000,
    addresses: [
        {
            addressName: "主线路1",
            baseURL: "ws://10.0.0.2:999/kernel-server",
            timeout: 3000
        },
        {
            addressName: "主线路2",
            baseURL: "ws://localhost:9999/kernel-server",
            timeout: 3000
        }
    ]
}
export const workspace: Workspace = {
    selectedWorkspace: "生产环境",
    workspaces: [
        {
            workspaceName: "生产环境",
            apiServerAddresses: [
                kernelApiServerAddress_1,
                kernelWSServerAddress_1
            ]
        },
        {
            workspaceName: "演示环境",
            apiServerAddresses: [
                kernelApiServerAddress_2,
                kernelWSServerAddress_2
            ]
        }
    ]
}