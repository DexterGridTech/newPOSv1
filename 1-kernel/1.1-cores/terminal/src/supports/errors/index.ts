import {DefinedErrorMessage, ErrorCategory, ErrorSeverity} from "@impos2/kernel-core-base";


export const kernelTerminalErrorMessages = {
    kernelWSServerConnectionError: new DefinedErrorMessage(
        ErrorCategory.NETWORK,
        ErrorSeverity.HIGH,
        "Kernel Websocket 连接错误",
        'kernel.ws.server.connection.error',
        "Kernel Websocket 连接错误"
    ),
    remoteCommandExecutionError: new DefinedErrorMessage(
        ErrorCategory.SYSTEM,
        ErrorSeverity.HIGH,
        "远程方法执行错误",
        "remote.command.execution.error",
        "远程方法执行错误"
    )
};