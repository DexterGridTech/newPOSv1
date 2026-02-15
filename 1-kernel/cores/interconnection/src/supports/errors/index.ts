import {DefinedErrorMessage, ErrorCategory, ErrorSeverity} from "@impos2/kernel-core-base";


export const kernelCoreInterconnectionErrorMessages = {
    masterConnectionPrecheckFailed: new DefinedErrorMessage(
        ErrorCategory.VALIDATION,
        ErrorSeverity.HIGH,
        "Master服务器启动未通过与校验",
        'master.server.precheck.failed',
        "主设备服务器启动未通过与校验:${reasons.join(',')}"
    ),
    masterServerCannotStart: new DefinedErrorMessage(
        ErrorCategory.SYSTEM,
        ErrorSeverity.HIGH,
        "Master服务器无法启动",
        'master.server.cannot.start',
        "主设备服务器无法启动:${message}"
    ),
    masterServerConnectionError: new DefinedErrorMessage(
        ErrorCategory.NETWORK,
        ErrorSeverity.HIGH,
        "Master服务器连接失败",
        'master.server.connection.error',
        "主设备服务器连接失败:${message}"
    ),
    slaveConnectionPrecheckFailed: new DefinedErrorMessage(
        ErrorCategory.VALIDATION,
        ErrorSeverity.HIGH,
        "Slave服务器启动未通过与校验",
        'slave.server.precheck.failed',
        "副设备连接服务器未通过与校验:${reasons.join(',')}"
    ),
    slaveNotConnected: new DefinedErrorMessage(
        ErrorCategory.VALIDATION,
        ErrorSeverity.HIGH,
        "Slave设备未与服务器连接",
        'slave.not.connected',
        "副设备未与服务器连接"
    ),
    remoteCommandSendError: new DefinedErrorMessage(
        ErrorCategory.VALIDATION,
        ErrorSeverity.HIGH,
        "远程命令发送失败",
        'remote.command.send.error',
        "远程命令发送失败:${message}"
    ),
    remoteCommandResponseTimeout: new DefinedErrorMessage(
        ErrorCategory.VALIDATION,
        ErrorSeverity.HIGH,
        "远程命令响应超时",
        'remote.command.response.timeout',
        "远程命令响应超时:${message}"
    ),
};