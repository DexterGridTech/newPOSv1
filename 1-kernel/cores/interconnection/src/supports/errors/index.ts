import {DefinedErrorMessage, ErrorCategory, ErrorSeverity} from "@impos2/kernel-core-base";


export const kernelCoreInterconnectionErrorMessages = {
    masterConnectionPrecheckFailed: new DefinedErrorMessage(
        ErrorCategory.VALIDATION,
        ErrorSeverity.HIGH,
        "Master服务器启动未通过与校验",
        'master.server.precheck.failed',
        "Master服务器启动未通过与校验:${reasons.join(',')}"
    ),
    masterServerCannotStart: new DefinedErrorMessage(
        ErrorCategory.SYSTEM,
        ErrorSeverity.HIGH,
        "Master服务器无法启动",
        'master.server.cannot.start',
        "Master服务器无法启动:${message}"
    ),
    masterServerConnectionError: new DefinedErrorMessage(
        ErrorCategory.NETWORK,
        ErrorSeverity.HIGH,
        "Master服务器连接失败",
        'master.server.connection.error',
        "Master服务器连接失败:${message}"
    ),
    slaveConnectionPrecheckFailed: new DefinedErrorMessage(
        ErrorCategory.VALIDATION,
        ErrorSeverity.HIGH,
        "Slave服务器启动未通过与校验",
        'slave.server.precheck.failed',
        "Slave服务器启动未通过与校验:${reasons.join(',')}"
    ),
};