import {DefinedErrorInfo, ErrorCategory, ErrorSeverity} from "../../types";

export const InstanceErrors = {
    DEVICE_ID_IS_EMPTY: {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
        type: "device.id.empty",
        defaultMessage: "设备ID为空"
    },
} as const;

