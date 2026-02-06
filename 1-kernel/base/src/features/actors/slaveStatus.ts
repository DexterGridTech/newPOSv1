import {
    ActorSystem,
    AppError,
    CommandHandler,
    currentState,
    dispatchAction, getStatesToSync,
    IActor,
    ICommand,
    logger,
    MasterWebSocketClient,
    SendToMasterCommand,
    WSMessageEvent
} from "../../core";
import {
    ConnectedToMasterCommand,
    InitializeCommand,
    ReconnectMasterServerCommand,
    SlaveDisconnectedFromMasterServerCommand,
    StartToConnectMasterServerCommand,
    SynStateAtConnectedCommand
} from "../commands";
import {instanceInfoSlice, slaveConnectionStatusActions, deviceStatusSlice} from "../slices";
import {delay, Subject} from "rxjs";
import {
    ConnectedEvent,
    ConnectionEventType,
    DisconnectedEvent,
    InstanceMode,
    MasterServerMessageType,
    RemoteCommandFromSlave,
    ServerConnectionStatus
} from "../../types";
import type {RootState} from "../rootState";
import {InstanceErrors, MasterServerErrors, SlaveErrors} from "../errors";
import {SlaveParameters} from "../parameter";
import { LOG_TAGS } from '../../types/core/logTags';
import { moduleName } from '../../module';


class SlaveStatusActor extends IActor {
    @CommandHandler(InitializeCommand)
    @CommandHandler(StartToConnectMasterServerCommand)
    @CommandHandler(ReconnectMasterServerCommand)
    private async checkAndConnectMasterServer(command: ICommand<any>) {
        const state = currentState<RootState>()
        const slaveConnectionInfo = state[instanceInfoSlice.name].slaveConnectionInfo

        // 细分条件检查
        const conditions = [
            {
                name: '实例模式为从机',
                passed: (state[instanceInfoSlice.name].instance.instanceMode ?? InstanceMode.MASTER) === InstanceMode.SLAVE,
                reason: `当前模式为 ${state[instanceInfoSlice.name].instance.instanceMode ?? InstanceMode.MASTER}，非从机模式`
            },
            {
                name: '从机名称已配置',
                passed: slaveConnectionInfo.slaveName !== undefined,
                reason: '从机名称(slaveName)未配置'
            },
            {
                name: '主机设备ID已配置',
                passed: slaveConnectionInfo.masterDeviceId !== undefined,
                reason: '主机设备ID(masterDeviceId)未配置'
            },
            {
                name: '主机名称已配置',
                passed: slaveConnectionInfo.masterName !== undefined,
                reason: '主机名称(masterName)未配置'
            },
            {
                name: '主机服务器地址已配置',
                passed: (slaveConnectionInfo.masterServerAddress ?? []).length > 0,
                reason: '主机服务器地址(masterServerAddress)为空'
            }
        ]

        const failedConditions = conditions.filter(c => !c.passed)
        logger.log([moduleName, LOG_TAGS.Actor, "slaveStatus"], "--== check and connect master server as slave ==--")
        if (failedConditions.length === 0) {
            logger.log([moduleName, LOG_TAGS.Actor, "slaveStatus"], "具备websocket连接条件，准备对master server 进行连接")
            logger.log([moduleName, LOG_TAGS.Actor, "slaveStatus"], "通过的条件:", conditions.map(c => c.name).join(', '))
            await this.connectMasterServerWebsocket(command)
        } else {
            logger.log([moduleName, LOG_TAGS.Actor, "slaveStatus"], "不具备websocket连接条件，跳过对master server 进行连接")
            logger.log([moduleName, LOG_TAGS.Actor, "slaveStatus"], "未通过的条件:")
            failedConditions.forEach(c => {
                logger.log([moduleName, LOG_TAGS.Actor, "slaveStatus"], `  - ${c.name}: ${c.reason}`)
            })
        }
    }

    @CommandHandler(SlaveDisconnectedFromMasterServerCommand)
    private async handleSlaveDisconnected(command: SlaveDisconnectedFromMasterServerCommand) {
        dispatchAction(slaveConnectionStatusActions.setMasterServerConnectionStatus(ServerConnectionStatus.DISCONNECTED))
        setTimeout(() => {
                new ReconnectMasterServerCommand(command.payload + "，重新连接").executeInternally()
            },
            SlaveParameters.reconnectInterval.value()
        )
    }

    @CommandHandler(ConnectedToMasterCommand)
    private async handleConnectedToMaster(command: ConnectedToMasterCommand) {
        const state = currentState<RootState>()
        const stateToSync: { [stateKey: string]: number | null } = {}
        getStatesToSync().forEach(stateKey => {
            stateToSync[stateKey] = ((state[stateKey as keyof RootState] as {
                updatedAt: number | null
            }).updatedAt) ?? 0
        })
        new SynStateAtConnectedCommand(stateToSync).executeFromParent(command)
    }

    @CommandHandler(SendToMasterCommand)
    private async handleSendToMaster(command: SendToMasterCommand) {
        const remoteCommand: RemoteCommandFromSlave = {
            commandId: command.payload.id,
            commandName: command.payload.commandName,
            payload: command.payload.payload,
            requestId: command.payload.requestId ?? 'unknown',
            sessionId: command.payload.sessionId ?? 'unknown',
            slaveInfo: command.payload.slaveInfo!
        }
        const wsClient = this.getWsClient();
        if (wsClient.isConnected()) {
            logger.log([moduleName, LOG_TAGS.Actor, "slaveStatus"], "remote command send--> ", remoteCommand)
            wsClient.sendMessage(MasterServerMessageType.REMOTE_COMMAND, remoteCommand, null)
                .catch((error: any) => {
                    throw new AppError(SlaveErrors.REMOTE_COMMAND_SEND_FAILED, error, command)
                })
            this.remoteCommandSubject.next(command.payload)
        } else {
            throw new AppError(SlaveErrors.SLAVE_NOT_CONNECTED, "", command)
        }
    }

    private remoteCommandExecuted = new Set<string>();
    private remoteCommandSubject = new Subject<ICommand<any>>()
    private remoteCommandObservable = this.remoteCommandSubject.pipe(
        delay(3000)
    ).subscribe(command => {
        if (this.remoteCommandExecuted.has(command.id)) {
            logger.log([moduleName, LOG_TAGS.Actor, "slaveStatus"], '远程方法已经执行', command.id);
            this.remoteCommandExecuted.delete(command.id)
        } else {
            if (this.remoteCommandExecuted.size > 1000) {
                const oldestIds = Array.from(this.remoteCommandExecuted).slice(0, 500);
                oldestIds.forEach(id => this.remoteCommandExecuted.delete(id));
            }
            ActorSystem.getInstance().commandError(this.constructor.name, command,
                new AppError(SlaveErrors.REMOTE_COMMAND_FEEDBACK_TIMEOUT, command.commandName, command))
        }
    })

    private websocketInitiated: boolean = false

    private initializeWebsocket() {
        const wsClient = MasterWebSocketClient.getInstance();
        // 注册事件回调
        wsClient.on(ConnectionEventType.CONNECTED, (event: ConnectedEvent) => {
            dispatchAction(slaveConnectionStatusActions.setMasterServerConnectionStatus(ServerConnectionStatus.CONNECTED))
            new ConnectedToMasterCommand().executeInternally()
        });
        wsClient.on(ConnectionEventType.MESSAGE, (event: WSMessageEvent) => {
            logger.log([moduleName, LOG_TAGS.Actor, "slaveStatus"], '收到消息:', event.message);
            if (event.message.type === MasterServerMessageType.SYNC_STATE) {
                try {
                    const {key, state} = event.message.data
                    const actionType = key + '/syncState'
                    dispatchAction({
                        type: actionType,
                        payload: state
                    })
                    logger.log([moduleName, LOG_TAGS.Actor, "slaveStatus"], '状态同步完成:', actionType)
                } catch (e: any) {
                    logger.error([moduleName, LOG_TAGS.Actor, "slaveStatus"], '状态同步错误:' + e + ' ' + +event.message.data)
                }
            } else if (event.message.type === MasterServerMessageType.REMOTE_COMMAND_EXECUTED) {
                this.remoteCommandExecuted.add(event.message.data);
            }
        });
        wsClient.on(ConnectionEventType.DISCONNECTED, (event: DisconnectedEvent) => {
            new SlaveDisconnectedFromMasterServerCommand("断开连接").executeInternally()
        });
    }

    private getWsClient() {
        if (!this.websocketInitiated) {
            this.initializeWebsocket();
            this.websocketInitiated = true;
        }
        return MasterWebSocketClient.getInstance()
    }

    private async connectMasterServerWebsocket(command: ICommand<any>) {
        const state = currentState<RootState>()
        const masterDeviceId = state[instanceInfoSlice.name].slaveConnectionInfo.masterDeviceId
        const serverAddresses = state[instanceInfoSlice.name].slaveConnectionInfo.masterServerAddress ?? []
        const deviceId = state[deviceStatusSlice.name].deviceInfo?.id ?? ''
        const wsClient = this.getWsClient();
        if (!masterDeviceId && serverAddresses.length === 0) {
            throw new AppError(MasterServerErrors.MASTER_SERVER_ADDRESS_IS_EMPTY, "", command)
        }
        if (deviceId.length === 0) {
            throw new AppError(InstanceErrors.DEVICE_ID_IS_EMPTY, "", command)
        }
        try {
            dispatchAction(slaveConnectionStatusActions.setMasterServerConnectionStatus(ServerConnectionStatus.CONNECTING), command)
            await wsClient.connect({
                deviceRegistration: {
                    type: InstanceMode.SLAVE,
                    deviceId: 'slave-' + deviceId,
                    deviceName: state[instanceInfoSlice.name].slaveConnectionInfo.slaveName!,
                    masterDeviceId: 'master-' + masterDeviceId
                },
                serverUrls: serverAddresses.map((serverAddress: any) => serverAddress.address),
                connectionTimeout: SlaveParameters.connectionTimeout.value(),
                heartbeatInterval: SlaveParameters.heartbeatInterval.value(),
                heartbeatTimeout: SlaveParameters.heartbeatTimeout.value(),
                autoHeartbeatResponse: true,
            })
        } catch (error: any) {
            throw new AppError(SlaveErrors.MASTER_SERVER_CONNECTION_ERROR, error.message, command)
        }
    }

}

export const slaveStatusActor = new SlaveStatusActor()