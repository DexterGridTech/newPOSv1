import {
    AppError,
    CommandHandler,
    CommandRegistry,
    currentState,
    dispatchAction,
    IActor,
    ICommand,
    KernelWebSocketClient,
    logger
} from "../../core";
import {
    ChangeUnitDataCommand,
    DisconnectedFromKernelWSServerCommand,
    GetDeviceStateCommand,
    InitializeCommand,
    KernelWebSocketConnectedCommand,
    ReconnectKernelWSServerCommand,
    SetOperatingEntityCompleteCommand,
    StartToConnectKernelWSServerCommand
} from "../commands";
import {RootState} from "../rootState";
import {kernelDeviceAPI, kernelDeviceWS, RemoteCommandConfirmRequest, SendDeviceStateRequest} from "../../api/device";
import {
    KernelConnectedEvent,
    KernelConnectionEventType,
    KernelConnectionState,
    KernelDisconnectedEvent,
    KernelMessageEvent,
    KernelMessageType,
    RemoteCommandFromKernel,
    ServerConnectionStatus,
} from "../../types";
import {terminalConnectionStatusActions, deviceStatusSlice, terminalInfoSlice} from "../slices";
import {SlaveErrors, TerminalErrors} from "../errors";
import {TerminalParameters} from "../parameter";
import { LOG_TAGS } from '../../types/core/logTags';
import { moduleName } from '../../types';

class TerminalStatusActor extends IActor {
    @CommandHandler(GetDeviceStateCommand)
    private async handleGetDeviceState(command: GetDeviceStateCommand) {
        const state = currentState<RootState>()
        const deviceId = state[deviceStatusSlice.name].deviceInfo?.id!
        const request: SendDeviceStateRequest = {deviceId, state}
        kernelDeviceAPI.sendDeviceState.run({request: request}).then(result => {
            logger.log([moduleName, LOG_TAGS.Actor, "terminalStatus"], "发送设备state成功")
        }).catch(err => {
            logger.error([moduleName, LOG_TAGS.Actor, "terminalStatus"], "发送设备state失败", err.stack)
        })
    }

    @CommandHandler(SetOperatingEntityCompleteCommand)
    private async handleSetOperatingEntityComplete(command: SetOperatingEntityCompleteCommand) {
        new StartToConnectKernelWSServerCommand().executeInternally()
    }

    @CommandHandler(DisconnectedFromKernelWSServerCommand)
    private async handleDisconnected(command: DisconnectedFromKernelWSServerCommand) {
        dispatchAction(terminalConnectionStatusActions.setTerminalConnectionStatus(ServerConnectionStatus.DISCONNECTED))
        setTimeout(
            () => new ReconnectKernelWSServerCommand(command.payload + "，重新连接").executeInternally(),
            TerminalParameters.reconnectInterval.value()
        )
    }

    @CommandHandler(InitializeCommand)
    @CommandHandler(StartToConnectKernelWSServerCommand)
    @CommandHandler(ReconnectKernelWSServerCommand)
    private async checkAndConnectSSEServer(command: ICommand<any>) {
        const state = currentState<RootState>()

        // 细分条件检查
        const conditions = [
            {
                name: '终端Token已获取',
                passed: !!state[terminalInfoSlice.name].token,
                reason: '终端Token(token)未获取，设备可能未激活'
            },
            {
                name: '操作实体已设置',
                passed: !!state[terminalInfoSlice.name].operatingEntity,
                reason: '操作实体(operatingEntity)未设置'
            }
        ]

        const failedConditions = conditions.filter(c => !c.passed)
        logger.log([moduleName, LOG_TAGS.Actor, "terminalStatus"], "--== check and connect kernel websocket as master ==--")
        if (failedConditions.length === 0) {
            logger.log([moduleName, LOG_TAGS.Actor, "terminalStatus"], "具备websocket连接条件，准备kernel websocket连接")
            logger.log([moduleName, LOG_TAGS.Actor, "terminalStatus"], "通过的条件:", conditions.map(c => c.name).join(', '))
        } else {
            logger.log([moduleName, LOG_TAGS.Actor, "terminalStatus"], "不具备websocket连接条件，跳过kernel websocket连接")
            logger.log([moduleName, LOG_TAGS.Actor, "terminalStatus"], "未通过的条件:")
            failedConditions.forEach(c => {
                logger.log([moduleName, LOG_TAGS.Actor, "terminalStatus"], `  - ${c.name}: ${c.reason}`)
            })
            return
        }

        //先关闭，再开启
        const wsClient = KernelWebSocketClient.getInstance();
        if (wsClient.getState() != KernelConnectionState.DISCONNECTED) {
            logger.log([moduleName, LOG_TAGS.Actor, "terminalStatus"], "连接前先关闭原有websocket")
            wsClient.disconnect("重启前关闭")
        }
        await this.startConnectWSEServer(command)
    }

    private async startConnectWSEServer(command: ICommand<any>) {
        const state = currentState<RootState>()
        const deviceId = state[deviceStatusSlice.name].deviceInfo?.id!
        const token = state[terminalInfoSlice.name].token!
        const wsAPI = kernelDeviceWS.connectKernelWS
        try {
            dispatchAction(terminalConnectionStatusActions.setTerminalConnectionStatus(ServerConnectionStatus.CONNECTING))
            await this.getWSClient().connect({
                deviceId: deviceId,
                token: token,
                api: wsAPI, // Api类型，HttpMethod必须是WS
                connectionTimeout: TerminalParameters.connectionTimeout.value(),
                heartbeatInterval: TerminalParameters.heartbeatInterval.value(),
                heartbeatTimeout: TerminalParameters.heartbeatTimeout.value(),
                autoHeartbeatResponse: true,
            });
        } catch (error: any) {
            throw new AppError(TerminalErrors.KERNAL_WS_SERVER_CONNECTION_ERROR, error.message, command)
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
            dispatchAction(terminalConnectionStatusActions.setTerminalConnectionStatus(ServerConnectionStatus.CONNECTED))
            new KernelWebSocketConnectedCommand().executeInternally()
        });

        wsClient.on(KernelConnectionEventType.MESSAGE, (event: KernelMessageEvent) => {
            logger.log([moduleName, LOG_TAGS.Actor, "terminalStatus"], '收到Kernel消息:', JSON.stringify(event.message));
            if (event.message.type === KernelMessageType.UNIT_DATA_CHANGED) {
                new ChangeUnitDataCommand({
                    changeSet: event.message.data
                }).executeInternally()
            }
            if (event.message.type === KernelMessageType.REMOTE_COMMAND) {
                try {
                    const remoteCommandFromKernel = event.message.data as RemoteCommandFromKernel;
                    const remote = CommandRegistry.create(remoteCommandFromKernel.type, remoteCommandFromKernel.payload)
                    if (remote) {
                        remote.id = remoteCommandFromKernel.commandId
                        logger.log([moduleName, LOG_TAGS.Actor, "terminalStatus"], '执行Kernel远程方法:', remote)
                        remote.executeFromRequest(remoteCommandFromKernel.requestId, remoteCommandFromKernel.sessionId)

                        const request: RemoteCommandConfirmRequest = {commandId: remote.id}
                        kernelDeviceAPI.remoteCommandConfirm.run({request: request}).then(() => {
                            logger.log([moduleName, LOG_TAGS.Actor, 'terminalStatus'], '反馈Kernel', { type: remoteCommandFromKernel.type, message: '远程方法已执行', id: remote.id })
                        })
                    } else {
                        logger.error([moduleName, LOG_TAGS.Actor, "terminalStatus"], 'Kernel远程方法初始化失败' + event.message.data)
                    }
                } catch (e: any) {
                    logger.error([moduleName, LOG_TAGS.Actor, "terminalStatus"], '执行远程方法错误:' + e + ' ' + event.message.data)
                    throw new AppError(SlaveErrors.REMOTE_COMMAND_EXECUTION_ERROR, e.toString() + event.message.data)
                }
            }
        });
        wsClient.on(KernelConnectionEventType.DISCONNECTED, (event: KernelDisconnectedEvent) => {
            new DisconnectedFromKernelWSServerCommand("断开连接").executeInternally()
        });
        this.wsInitiated = true
    }
}

export const terminalStatusActor = new TerminalStatusActor();
