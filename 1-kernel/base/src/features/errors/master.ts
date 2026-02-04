import {ErrorCategory, ErrorSeverity} from "../../types";

export const MasterServerErrors = {
    MASTER_WEB_SERVER_START_FAILED: {
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.HIGH,
        key: "master.web.server.start.failed",
        defaultMessage: "主设备WEB服务开启失败"
    },
    START_CONDITION_NOT_FIT: {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
        key: "master.server.start.condition.not.fit",
        defaultMessage: "主设备服务不满足启动条件"
    },
    DEVICE_ID_IS_EMPTY: {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
        key: "device.id.empty",
        defaultMessage: "设备ID为空"
    },
    MASTER_SERVER_ADDRESS_IS_EMPTY: {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
        key: "master.server.address.empty",
        defaultMessage: "主设备服务地址为空",
    },
    MASTER_SERVER_STATUS_IS_NOT_STOPPED: {
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.MEDIUM,
        key: "master.server.status.not.stopped",
        defaultMessage: "主设备服务未关闭",
    }
} as const;
export const ModifySlaveErrors = {
    SLAVE_EXISTED: {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
        key: "slave.existed",
        defaultMessage: "副设备已存在",
    },
    SLAVE_NOT_EXISTED: {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
        key: "slave.not.existed",
        defaultMessage: "副设备不存在",
    },

    SLAVE_IS_EMBEDDED: {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.MEDIUM,
        key: "slave.is.embedded",
        defaultMessage: "副设备是内置的",
    },
    SLAVE_IS_REGISTERED: {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
        key: "slave.is.registered",
        defaultMessage: "副设备已注册",
    }
} as const;