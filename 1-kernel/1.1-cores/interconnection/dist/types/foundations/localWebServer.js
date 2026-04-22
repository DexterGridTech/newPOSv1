/**
 * 服务器状态
 */
export var LocalWebServerStatus;
(function (LocalWebServerStatus) {
    /** 未启动 */
    LocalWebServerStatus["STOPPED"] = "STOPPED";
    /** 启动中 */
    LocalWebServerStatus["STARTING"] = "STARTING";
    /** 运行中 */
    LocalWebServerStatus["RUNNING"] = "RUNNING";
    /** 停止中 */
    LocalWebServerStatus["STOPPING"] = "STOPPING";
    /** 错误 */
    LocalWebServerStatus["ERROR"] = "ERROR";
})(LocalWebServerStatus || (LocalWebServerStatus = {}));
