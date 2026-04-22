/**
 * API请求响应类型定义
 */
/**
 * 错误代码
 */
export var ErrorCode;
(function (ErrorCode) {
    ErrorCode["SUCCESS"] = "SUCCESS";
    ErrorCode["INVALID_REQUEST"] = "INVALID_REQUEST";
    ErrorCode["NOT_FOUND"] = "NOT_FOUND";
    ErrorCode["DUPLICATE_KEY"] = "DUPLICATE_KEY";
    ErrorCode["DEVICE_NOT_FOUND"] = "DEVICE_NOT_FOUND";
    ErrorCode["TERMINAL_NOT_FOUND"] = "TERMINAL_NOT_FOUND";
    ErrorCode["INVALID_TOKEN"] = "INVALID_TOKEN";
    ErrorCode["INVALID_CODE"] = "INVALID_CODE";
    ErrorCode["TERMINAL_ALREADY_BOUND"] = "TERMINAL_ALREADY_BOUND";
    ErrorCode["DATABASE_ERROR"] = "DATABASE_ERROR";
    ErrorCode["INTERNAL_ERROR"] = "INTERNAL_ERROR";
    ErrorCode["UNAUTHORIZED"] = "UNAUTHORIZED";
})(ErrorCode || (ErrorCode = {}));
/**
 * 消息类型
 */
export var MessageType;
(function (MessageType) {
    MessageType["UNIT_DATA_CHANGED"] = "UNIT_DATA_CHANGED";
    MessageType["REMOTE_COMMAND"] = "REMOTE_COMMAND";
    MessageType["HEARTBEAT"] = "HEARTBEAT";
    MessageType["DEVICE_STATE_UPDATED"] = "DEVICE_STATE_UPDATED";
    MessageType["DEVICE_ONLINE_STATUS"] = "DEVICE_ONLINE_STATUS";
})(MessageType || (MessageType = {}));
//# sourceMappingURL=api.js.map