import {ErrorCategory, ErrorSeverity} from "../../types";

export const SlaveErrors = {
    SLAVE_NOT_CONNECTED: {
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.MEDIUM,
        type: "slave.is.not.connected.to.master",
        defaultMessage: "副设备未与主设备连接",
    },
    MASTER_SERVER_CONNECTION_ERROR: {
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        type: "master.server.connection.error",
        defaultMessage: "主设备连接错误",
    },
    SLAVE_SYNC_STATE_ERROR: {
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.HIGH,
        type: "slave.sync.state.error",
        defaultMessage: "副设备状态同步错误",
    },
    REMOTE_COMMAND_SEND_FAILED: {
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.HIGH,
        type: "remote.command.send.failed",
        defaultMessage: "远程方法发送失败",
    },
    REMOTE_COMMAND_FEEDBACK_TIMEOUT: {
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.HIGH,
        type: "remote.command.feedback.timeout",
        defaultMessage: "远程方法反馈超时",
    },
    REMOTE_COMMAND_EXECUTION_ERROR: {
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.HIGH,
        type: "remote.command.execution.error",
        defaultMessage: "远程方法执行错误",
    }
} as const;