import {SimplePathValue} from "../../core";
import {parameterCategory} from "./category";

export const TerminalParameters = {
    reconnectInterval: new SimplePathValue(
        parameterCategory,
        "kernel服务websocket重连间隔",
        "terminal.websocket.reconnect.interval",
        30000
    ),
    connectionTimeout: new SimplePathValue(
        parameterCategory,
        "kernel服务websocket连接超时时间",
        "terminal.websocket.connection.timeout",
        10000
    ),
    heartbeatInterval: new SimplePathValue(
        parameterCategory,
        "kernel服务websocket心跳间隔",
        "terminal.websocket.heartbeat.interval",
        30000
    ),
    heartbeatTimeout: new SimplePathValue(
        parameterCategory,
        "kernel服务websocket心跳超时时间",
        "terminal.websocket.heartbeat.timeout",
        60000
    )
} as const;