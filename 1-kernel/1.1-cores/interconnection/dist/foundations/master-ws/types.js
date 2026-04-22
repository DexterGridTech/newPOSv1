/** 系统通知类型（与服务端一致） */
export const SYSTEM_NOTIFICATION = {
    SLAVE_CONNECTED: '__system_slave_connected',
    SLAVE_DISCONNECTED: '__system_slave_disconnected',
    HEARTBEAT: '__system_heartbeat',
    HEARTBEAT_ACK: '__system_heartbeat_ack',
};
/** 连接状态 */
export var ConnectionState;
(function (ConnectionState) {
    ConnectionState["DISCONNECTED"] = "DISCONNECTED";
    ConnectionState["REGISTERING"] = "REGISTERING";
    ConnectionState["CONNECTING"] = "CONNECTING";
    ConnectionState["CONNECTED"] = "CONNECTED";
    ConnectionState["DISCONNECTING"] = "DISCONNECTING";
})(ConnectionState || (ConnectionState = {}));
/** 连接事件类型 */
export var ConnectionEventType;
(function (ConnectionEventType) {
    ConnectionEventType["STATE_CHANGE"] = "STATE_CHANGE";
    ConnectionEventType["CONNECTED"] = "CONNECTED";
    ConnectionEventType["CONNECT_FAILED"] = "CONNECT_FAILED";
    ConnectionEventType["DISCONNECTED"] = "DISCONNECTED";
    ConnectionEventType["MESSAGE"] = "MESSAGE";
    ConnectionEventType["ERROR"] = "ERROR";
    ConnectionEventType["HEARTBEAT_TIMEOUT"] = "HEARTBEAT_TIMEOUT";
})(ConnectionEventType || (ConnectionEventType = {}));
/** 连接错误类型 */
export var ConnectionErrorType;
(function (ConnectionErrorType) {
    ConnectionErrorType["REGISTRATION_FAILED"] = "REGISTRATION_FAILED";
    ConnectionErrorType["WEBSOCKET_FAILED"] = "WEBSOCKET_FAILED";
    ConnectionErrorType["ALL_SERVERS_FAILED"] = "ALL_SERVERS_FAILED";
    ConnectionErrorType["HEARTBEAT_TIMEOUT"] = "HEARTBEAT_TIMEOUT";
    ConnectionErrorType["CONNECTION_TIMEOUT"] = "CONNECTION_TIMEOUT";
    ConnectionErrorType["NETWORK_ERROR"] = "NETWORK_ERROR";
})(ConnectionErrorType || (ConnectionErrorType = {}));
