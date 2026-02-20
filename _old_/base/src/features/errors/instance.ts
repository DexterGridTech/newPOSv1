import {DefinedErrorInfo, ErrorCategory, ErrorSeverity} from "../../types";

export const InstanceErrors = {
    DEVICE_ID_IS_EMPTY: {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
        key: "device.id.empty",
        defaultMessage: "设备ID为空"
    },
    STORAGE_PROCESS_ERROR:{
        category: ErrorCategory.DATABASE,
        severity: ErrorSeverity.HIGH,
        key: "storage.process.error",
        defaultMessage: "本地存储失败"
    }
} as const;

