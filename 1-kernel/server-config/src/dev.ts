import {SERVER_NAME_KERNEL_API, SERVER_NAME_KERNEL_WS} from "./serverName";
import {ServerSpace} from "@impos2/kernel-core-base";

export const devServerSpace :ServerSpace={
    selectedSpace:'演示环境',
    spaces:[
        {
            name:'演示环境',
            serverAddresses:[
                {
                    serverName: SERVER_NAME_KERNEL_API,
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
                    ],
                    retryCount: 3,
                    retryInterval: 1000,
                },
                {
                    serverName: SERVER_NAME_KERNEL_WS,
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
            ]
        },
        {
            name:'正式环境',
            serverAddresses:[
                {
                    serverName: SERVER_NAME_KERNEL_API,
                    addresses: [
                        {
                            addressName: "主线路1",
                            baseURL: "http://127.0.0.1:9999/kernel-server",
                            timeout: 3000
                        },
                        {
                            addressName: "主线路2",
                            baseURL: "http://192.168.0.172:9999/kernel-server",
                            timeout: 3000
                        },
                        {
                            addressName: "主线路3",
                            baseURL: "http://localhost:9999/kernel-server",
                            timeout: 3000
                        }
                    ],
                    retryCount: 3,
                    retryInterval: 1000,
                },
                {
                    serverName: SERVER_NAME_KERNEL_WS,
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
                            baseURL: "ws://192.168.0.172:9999/kernel-server",
                            timeout: 3000
                        }
                    ]
                }
            ]
        }
    ]
}