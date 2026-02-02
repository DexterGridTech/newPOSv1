import {SimplePathValue} from "../../core";
import {parameterCategory} from "./category";

export const SlaveParameters = {
    reconnectInterval: new SimplePathValue(
        parameterCategory,
        "Master服务(slave连接)websocket重连间隔",
        "slave.websocket.reconnect.interval",
        30000
    ),
    connectionTimeout: new SimplePathValue(
        parameterCategory,
        "Master服务(slave连接)websocket连接超时时间",
        "slave.websocket.connection.timeout",
        10000
    ),
    heartbeatInterval: new SimplePathValue(
        parameterCategory,
        "Master服务(slave连接)websocket心跳间隔",
        "slave.websocket.heartbeat.interval",
        30000
    ),
    heartbeatTimeout: new SimplePathValue(
        parameterCategory,
        "Master服务(slave连接)websocket心跳超时时间",
        "slave.websocket.heartbeat.timeout",
        60000
    )
} as const;