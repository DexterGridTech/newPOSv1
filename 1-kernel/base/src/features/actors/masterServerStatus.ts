import {
    AppError,
    CommandHandler,
    CommandRegistry,
    currentState,
    DisconnectedEvent,
    dispatchAction, getStatesToSync,
    IActor,
    ICommand,
    logger,
    masterServer,
    MasterWebSocketClient,
    WSMessageEvent
} from "../../core";
import {
    InitializeCommand,
    MasterDisconnectedFromMasterServerCommand,
    RestartMasterServerCommand,
    SlaveAddedCommand,
    SlaveConnectedCommand,
    SlaveDisconnectedCommand,
    StartMasterServerCommand,
    SynStateAtConnectedCommand
} from "../commands";
import {masterServerStatusActions, instanceInfoSlice, masterServerStatusSlice, deviceStatusSlice} from "../slices";
import {syncStateToSlave} from "../utils";
import {
    ConnectedEvent,
    ConnectionEventType,
    InstanceMode,
    MasterServerMessageType,
    RemoteCommandFromSlave,
    ServerConnectionStatus,
    SYSTEM_MESSAGE_TYPES
} from "../../types";
import type {RootState} from "../rootState";
import {MasterServerErrors} from "../errors";
import {SlaveErrors} from "../errors";
import {MasterParameters} from "../parameter";

class MasterServerStatusActor extends IActor {
    @CommandHandler(InitializeCommand)
    @CommandHandler(SlaveAddedCommand)
    @CommandHandler(StartMasterServerCommand)
    @CommandHandler(RestartMasterServerCommand)
    private async checkAndStartMasterServer(command: ICommand<any>) {
        const state = currentState<RootState>()

        // 细分条件检查
        const conditions = [
            {
                name: '实例模式为主机',
                passed: (state[instanceInfoSlice.name].instance.instanceMode ?? InstanceMode.SLAVE) === InstanceMode.MASTER,
                reason: `当前模式为 ${state[instanceInfoSlice.name].instance.instanceMode ?? InstanceMode.SLAVE}，非主机模式`
            },
            {
                name: 'Slave功能已启用',
                passed: (state[instanceInfoSlice.name].enableSlaves ?? false),
                reason: 'Slave功能(enableSlaves)未启用'
            },
            {
                name: '已配置Slave设备',
                passed: Object.keys(state[instanceInfoSlice.name].masterSlaves ?? {}).length > 0,
                reason: '没有配置的Slave设备(masterSlaves为空)'
            },
            {
                name: '服务器状态为断开',
                passed: (state[masterServerStatusSlice.name].serverConnectionStatus ?? ServerConnectionStatus.DISCONNECTED) === ServerConnectionStatus.DISCONNECTED,
                reason: `服务器状态为 ${state[masterServerStatusSlice.name].serverConnectionStatus}，非DISCONNECTED状态`
            }
        ]

        const failedConditions = conditions.filter(c => !c.passed)
        logger.log("--== check and start master server as master ==--")
        if (failedConditions.length === 0) {
            logger.log("具备Master Server启动条件，准备启动服务")
            logger.log("通过的条件:", conditions.map(c => c.name).join(', '))
        } else {
            logger.log("不具备Master Server启动条件，跳过启动")
            logger.log("未通过的条件:")
            failedConditions.forEach(c => {
                logger.log(`  - ${c.name}: ${c.reason}`)
            })
            throw new AppError(MasterServerErrors.START_CONDITION_NOT_FIT, failedConditions.map(c => c.reason).join(), command)
        }

        let addresses
        try {
            addresses = await masterServer.startServer()
        } catch (e: any) {
            throw new AppError(MasterServerErrors.MASTER_WEB_SERVER_START_FAILED, e, command)
        }
        dispatchAction(masterServerStatusActions.setMasterServerAddresses(addresses), command)
        await this.startMasterServerWebsocket(command);
    }

    @CommandHandler(MasterDisconnectedFromMasterServerCommand)
    private async handleMasterDisconnected(command: MasterDisconnectedFromMasterServerCommand) {
        dispatchAction(masterServerStatusActions.setMasterServerConnectionStatus(ServerConnectionStatus.DISCONNECTED))
        setTimeout(() => {
                new RestartMasterServerCommand(command.payload + "，重新连接").executeInternally()
            },
            MasterParameters.reconnectInterval.value()
        )
    }

    @CommandHandler(SlaveConnectedCommand)
    private async handleSlaveConnected(command: SlaveConnectedCommand) {
        dispatchAction(masterServerStatusActions.slaveConnected(command.payload), command)
    }

    @CommandHandler(SlaveDisconnectedCommand)
    private async handleSlaveDisconnected(command: SlaveDisconnectedCommand) {
        dispatchAction(masterServerStatusActions.slaveDisconnected(command.payload), command)
    }

    @CommandHandler(SynStateAtConnectedCommand)
    private async handleSyncState(command: SynStateAtConnectedCommand) {
        const slaveState = command.payload
        const state = currentState<RootState>()
        getStatesToSync().forEach(stateKey => {
            const masterState = state[stateKey as keyof RootState] as { updatedAt: number | null }
            if ((masterState.updatedAt ?? 1) > (slaveState[stateKey] ?? 0)) {
                syncStateToSlave(stateKey, masterState, command.slaveInfo?.slaveName ?? null)
            }
        })
    }

    private websocketInitiated: boolean = false

    private remoteCommandExecuted = (remoteCommand: ICommand<any>) => {
        const wsClient = this.getWsClient();
        if (wsClient.isConnected()) {
            wsClient.sendMessage(MasterServerMessageType.REMOTE_COMMAND_EXECUTED,
                remoteCommand.id,
                remoteCommand.slaveInfo?.slaveName ?? null)
                .catch(error => {
                    logger.error("send remoteCommandExecuted error--> ", error)
                })
        }
    }

    private initializeWebsocket() {
        const wsClient = MasterWebSocketClient.getInstance();
        wsClient.on(ConnectionEventType.CONNECTED, (event: ConnectedEvent) => {
            dispatchAction(masterServerStatusActions.setMasterServerConnectionStatus(ServerConnectionStatus.CONNECTED))
        });
        wsClient.on(ConnectionEventType.MESSAGE, (event: WSMessageEvent) => {
            logger.log('收到Master Server消息:', event.message);
            if (event.message.type === SYSTEM_MESSAGE_TYPES.SLAVE_CONNECTED) {
                const {deviceId, deviceName} = event.message.data
                new SlaveConnectedCommand({
                    deviceId: deviceId,
                    slaveName: deviceName
                }).executeFromParent()
            }
            if (event.message.type === SYSTEM_MESSAGE_TYPES.SLAVE_DISCONNECTED) {
                const {deviceId, deviceName} = event.message.data
                new SlaveDisconnectedCommand({
                    deviceId: deviceId,
                    slaveName: deviceName
                }).executeFromParent()
            }
            if (event.message.type === MasterServerMessageType.REMOTE_COMMAND) {
                try {
                    const remoteCommand = event.message.data as RemoteCommandFromSlave;
                    const remote = CommandRegistry.create(remoteCommand.commandName, remoteCommand.payload)
                    if (remote) {
                        remote.id = remoteCommand.commandId
                        remote.slaveInfo = remoteCommand.slaveInfo
                        logger.log('执行远程方法:', remote.id)
                        remote.executeFromRequest(remoteCommand.requestId, remoteCommand.sessionId)
                        this.remoteCommandExecuted(remote)
                        logger.log('反馈Slave:', remote.slaveInfo, "远程方法已执行", remote.id)
                    } else {
                        logger.error('远程方法初始化失败' + event.message.data)
                    }
                } catch (e: any) {
                    logger.error('执行远程方法错误:' + e + ' ' + event.message.data)
                    throw new AppError(SlaveErrors.REMOTE_COMMAND_EXECUTION_ERROR, e.toString() + event.message.data)
                }
            }
        });
        wsClient.on(ConnectionEventType.DISCONNECTED, (event: DisconnectedEvent) => {
            new MasterDisconnectedFromMasterServerCommand("连接断开").executeInternally()
        });
    }

    private getWsClient() {
        if (!this.websocketInitiated) {
            this.initializeWebsocket();
            this.websocketInitiated = true;
        }
        return MasterWebSocketClient.getInstance()
    }

    private async startMasterServerWebsocket(command: ICommand<any>) {
        const state = currentState<RootState>()
        const serverAddresses = state[masterServerStatusSlice.name].serverAddresses ?? []
        const deviceId = state[deviceStatusSlice.name].deviceInfo?.id ?? ''
        const masterServerStatus = state[masterServerStatusSlice.name].serverConnectionStatus ?? ServerConnectionStatus.DISCONNECTED
        const wsClient = this.getWsClient();
        if (serverAddresses.length === 0) {
            throw new AppError(MasterServerErrors.MASTER_SERVER_ADDRESS_IS_EMPTY, "", command)
        }
        if (deviceId.length === 0) {
            throw new AppError(MasterServerErrors.DEVICE_ID_IS_EMPTY, "", command)
        }
        if (masterServerStatus != ServerConnectionStatus.DISCONNECTED) {
            throw new AppError(MasterServerErrors.MASTER_SERVER_STATUS_IS_NOT_STOPPED, "", command)
        }
        try {
            dispatchAction(masterServerStatusActions.setMasterServerConnectionStatus(ServerConnectionStatus.CONNECTING), command)
            await wsClient.connect({
                deviceRegistration: {
                    type: InstanceMode.MASTER,
                    deviceId: 'master-' + deviceId,
                    deviceName: 'master',
                },
                serverUrls: serverAddresses.map((serverAddress: any) => serverAddress.address),
                connectionTimeout: MasterParameters.connectionTimeout.value(),
                heartbeatInterval: MasterParameters.heartbeatInterval.value(),
                heartbeatTimeout: MasterParameters.heartbeatTimeout.value(),
                autoHeartbeatResponse: true,
            })
        } catch (error: any) {
            throw new AppError(SlaveErrors.MASTER_SERVER_CONNECTION_ERROR, error.message, command)
        }
    }
}

export const masterServerStatusActor = new MasterServerStatusActor();