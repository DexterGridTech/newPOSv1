export var DeviceType;
(function (DeviceType) {
    DeviceType["MASTER"] = "master";
    DeviceType["SLAVE"] = "slave";
})(DeviceType || (DeviceType = {}));
export const SYSTEM_NOTIFICATION = {
    SLAVE_CONNECTED: '__system_slave_connected',
    SLAVE_DISCONNECTED: '__system_slave_disconnected',
    HEARTBEAT: '__system_heartbeat',
    HEARTBEAT_ACK: '__system_heartbeat_ack',
};
//# sourceMappingURL=types.js.map