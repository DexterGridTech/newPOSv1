import {Actor, AppError, getCommandByName, LOG_TAGS, logger, storeEntry} from "@impos2/kernel-core-base";
import {kernelTerminalCommands} from "../commands";
import {moduleName} from "../../moduleName";
import {
    KernelConnectedEvent,
    KernelConnectionEventType,
    KernelConnectionState,
    KernelDisconnectedEvent,
    KernelMessageEvent,
    KernelMessageType,
    kernelTerminalState,
    RemoteCommandConfirmRequest
} from "../../types";
import {getInstanceMode, InstanceMode} from "@impos2/kernel-core-interconnection";
import {KernelWebSocketClient} from "../../foundations/kernelWS";
import {
    kernelDeviceWS,
    kernelTerminalApis,
    kernelTerminalErrorMessages,
    kernelTerminalParameters
} from "../../supports";
import {terminalConnectionActions} from "../slices/terminalConnection";
import {RemoteCommandFromKernel} from "../../types/shared/remoteCommand";

export class TerminalConnectionActor extends Actor {
    private connectCount = 0

    setOperatingEntitySuccess = Actor.defineCommandHandler(kernelTerminalCommands.setOperatingEntitySuccess,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "TerminalConnectionActor"], 'setOperatingEntitySuccess', command.payload)
            kernelTerminalCommands.connectKernelWS().executeInternally()
            return {};
        });
    connectKernelWS = Actor.defineCommandHandler(kernelTerminalCommands.connectKernelWS,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "TerminalConnectionActor"], 'connectKernelWS', command.payload)
            await this.checkAndConnectKernelWS()
            return {};
        });
    kernelWSDisconnected = Actor.defineCommandHandler(kernelTerminalCommands.kernelWSDisconnected,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "TerminalConnectionActor"], 'kernelWSDisconnected')
            storeEntry.dispatchAction(terminalConnectionActions.disconnected({connectionError: command.payload}))

            const interval = kernelTerminalParameters.reconnectInterval.value
            logger.log([moduleName, LOG_TAGS.Actor, getInstanceMode()], `与服务器已断开,${interval}毫秒后重连`)
            setTimeout(() => {
                kernelTerminalCommands.connectKernelWS().executeInternally()
            }, interval)
            return {};
        });

    async checkAndConnectKernelWS() {
        const terminalState = storeEntry.getStateByKey(kernelTerminalState.terminal)
        if (!terminalState.operatingEntity?.value || !terminalState.token?.value || getInstanceMode() != InstanceMode.MASTER)
            return
        logger.log([moduleName, LOG_TAGS.Actor, "TerminalConnectionActor"], `准备连接kernel WS Server:第${++this.connectCount}次`)
        const wsClient = KernelWebSocketClient.getInstance();
        if (wsClient.getState() != KernelConnectionState.DISCONNECTED) {
            logger.log([moduleName, LOG_TAGS.Actor, "terminalStatus"], "连接前先关闭原有websocket")
            wsClient.disconnect("重启前关闭")
        }
        const deviceId = terminalState.deviceInfo!.value.id
        const token = terminalState.token.value
        const wsAPI = kernelDeviceWS.connectKernelWS
        storeEntry.dispatchAction(terminalConnectionActions.connecting())
        try {
            await this.getWSClient().connect({
                deviceId: deviceId,
                token: token,
                api: wsAPI, // Api类型，HttpMethod必须是WS
                connectionTimeout: kernelTerminalParameters.connectionTimeout.value,
                heartbeatInterval: kernelTerminalParameters.heartbeatInterval.value,
                heartbeatTimeout: kernelTerminalParameters.heartbeatTimeout.value,
                autoHeartbeatResponse: true,
            });
        } catch (error: any) {
            throw new AppError(kernelTerminalErrorMessages.kernelWSServerConnectionError, error.message)
        }
    }

    private wsInitiated: boolean = false

    private getWSClient() {
        if (!this.wsInitiated) {
            this.initializeWSClient();
            this.wsInitiated = true;
        }
        return KernelWebSocketClient.getInstance()
    }

    private initializeWSClient() {
        const wsClient = KernelWebSocketClient.getInstance();
        // 注册事件监听
        wsClient.on(KernelConnectionEventType.CONNECTED, (event: KernelConnectedEvent) => {
            storeEntry.dispatchAction(terminalConnectionActions.connected())
            kernelTerminalCommands.kernelWSConnected().executeInternally()
        });

        wsClient.on(KernelConnectionEventType.MESSAGE, (event: KernelMessageEvent) => {
            logger.log([moduleName, LOG_TAGS.Actor, "terminalStatus"], '收到Kernel消息:', JSON.stringify(event.message));
            if (event.message.type === KernelMessageType.UNIT_DATA_CHANGED) {
                kernelTerminalCommands.changeUnitData({
                    changeSet: event.message.data
                }).executeInternally()
            }
            if (event.message.type === KernelMessageType.REMOTE_COMMAND) {
                try {
                    const remoteCommandFromKernel = event.message.data as RemoteCommandFromKernel;
                    const remoteCommand = getCommandByName(remoteCommandFromKernel.type, remoteCommandFromKernel.payload)
                    if (remoteCommand) {
                        remoteCommand.id = remoteCommandFromKernel.commandId
                        logger.log([moduleName, LOG_TAGS.Actor, "TerminalConnectionActor"], '执行Kernel远程方法:', remoteCommand)
                        remoteCommand.execute(remoteCommandFromKernel.requestId, remoteCommandFromKernel.sessionId)
                        const request: RemoteCommandConfirmRequest = {commandId: remoteCommand.id}
                        kernelTerminalApis.remoteCommandConfirm.run({request: request}).then(() => {
                            logger.log([moduleName, LOG_TAGS.Actor, 'terminalStatus'], '反馈Kernel', {
                                type: remoteCommandFromKernel.type,
                                message: '远程方法已执行',
                                id: remoteCommand.id
                            })
                        })
                    } else {
                        logger.error([moduleName, LOG_TAGS.Actor, "TerminalConnectionActor"], 'Kernel远程方法初始化失败', event.message.data)
                    }
                } catch (error: Error | any) {
                    logger.error([moduleName, LOG_TAGS.Actor, "terminalStatus"], '执行远程方法错误', error.message)
                    throw new AppError(kernelTerminalErrorMessages.remoteCommandExecutionError, error.message)
                }
            }
        });
        wsClient.on(KernelConnectionEventType.DISCONNECTED, (event: KernelDisconnectedEvent) => {
            kernelTerminalCommands.kernelWSDisconnected(event.reason || "异常关闭").executeInternally()
        });
        this.wsInitiated = true
    }
}

