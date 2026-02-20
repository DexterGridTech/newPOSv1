import {ErrorCategory, ErrorSeverity} from "../../types";

export const TerminalErrors = {
    KERNAL_WS_SERVER_CONNECTION_ERROR: {
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        key: "kernel.ws.server.connection.error",
        defaultMessage: "Kernel Websocket 连接错误",
    },
} as const;