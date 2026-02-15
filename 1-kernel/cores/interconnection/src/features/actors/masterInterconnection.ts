import {Actor, AppError, Command, getCommandByName, LOG_TAGS, logger, storeEntry} from "@impos2/kernel-core-base";
import {kernelCoreInterconnectionCommands} from "../commands";
import {moduleName} from "../../moduleName";
import {
    ConnectedEvent,
    ConnectionEventType,
    DisconnectedEvent,
    InstanceMode,
    kernelCoreInterconnectionState,
    MasterServerMessageType,
    RemoteCommandFromSlave,
    ServerConnectionStatus,
    SYSTEM_MESSAGE_TYPES
} from "../../types";
import {kernelCoreInterconnectionErrorMessages, kernelCoreInterconnectionParameters} from "../../supports";
import {defaultMasterInfo, masterServer} from "../../foundations/masterServer";
import {instanceInfoActions} from "../slices/instanceInfo";
import {masterInterconnectionActions} from "../slices/masterInterconnection";
import {MasterWebSocketClient, WSMessageEvent} from "../../foundations";
import {statesNeedToSync} from "../../foundations/statesNeedToSync";
import {syncStateToSlave} from "../../types/foundations/syncStateToSlave";


export class MasterInterconnectionActor extends Actor {

    startMasterServer = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.startMasterServer,
        async (command): Promise<Record<string, any>> => {
            await this.connectToMasterServer(command)
            return Promise.resolve({});
        })
    masterConnectedToServer = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.masterConnectedToServer,
        async (command): Promise<Record<string, any>> => {
            storeEntry.dispatchAction(masterInterconnectionActions.connected())
            return Promise.resolve({});
        })
    masterDisconnectedFromServer = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.masterDisconnectedFromServer,
        async (command): Promise<Record<string, any>> => {
            storeEntry.dispatchAction(masterInterconnectionActions.disconnected({connectionError: command.payload}))
            storeEntry.dispatchAction(masterInterconnectionActions.slaveDisconnected())
            const masterReconnectInterval = kernelCoreInterconnectionParameters.masterReconnectInterval.value
            logger.log([moduleName, LOG_TAGS.Actor, "master"], `Master与服务器已断开,${masterReconnectInterval}毫秒后重连`)

            setTimeout(() => {
                    kernelCoreInterconnectionCommands.startMasterServer().executeInternally()
                },
                masterReconnectInterval)

            return Promise.resolve({});
        })
    slaveConnected = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.slaveConnected,
        async (command): Promise<Record<string, any>> => {
            storeEntry.dispatchAction(masterInterconnectionActions.slaveConnected(command.payload))
            logger.log([moduleName, LOG_TAGS.Actor, "master"], `Slave已连接: ${command.payload.name}`)
            return Promise.resolve({});
        })
    slaveDisconnected = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.slaveDisconnected,
        async (command): Promise<Record<string, any>> => {
            storeEntry.dispatchAction(masterInterconnectionActions.slaveDisconnected())
            logger.log([moduleName, LOG_TAGS.Actor, "master"], `Slave已断开`)
            return Promise.resolve({});
        })

    synStateAtConnected = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.synStateAtConnected,
        async (command): Promise<Record<string, any>> => {

            const masterInterconnection = storeEntry.state(kernelCoreInterconnectionState.masterInterconnection)
            const slaveConnection = masterInterconnection.slaveConnection
            if (!slaveConnection?.disconnectedAt && slaveConnection?.name) {
                const stateFromSlave = command.payload as Record<string, Record<string, { updateAt: number }>>
                const stateAtLocal = storeEntry.wholeState()
                // 构建需要同步回 slave 的差异数据
                const result: Record<string, Record<string, any>> = {}

                statesNeedToSync.forEach(stateKey => {
                    const slaveState = stateFromSlave[stateKey]
                    const localState = stateAtLocal[stateKey] as Record<string, any>

                    if (!slaveState) {
                        // slave 没有这个状态，跳过
                        return
                    }

                    if (!localState) {
                        // local 没有这个状态，但 slave 有，标记所有属性为 null
                        result[stateKey] = {}
                        Object.keys(slaveState).forEach(key => {
                            result[stateKey][key] = null
                        })
                        return
                    }

                    // 比较 slave 和 local 的每个属性
                    Object.keys(slaveState).forEach(key => {
                        const slaveProperty = slaveState[key]
                        const localProperty = localState[key] as { updateAt?: number }

                        if (!localProperty || typeof localProperty !== 'object' || !localProperty.updateAt) {
                            // local 没有这个属性，或者不是带 updateAt 的对象，标记为 null
                            if (!result[stateKey]) {
                                result[stateKey] = {}
                            }
                            result[stateKey][key] = null
                        } else if (localProperty.updateAt > slaveProperty.updateAt) {
                            // local 的数据更新，需要同步给 slave
                            if (!result[stateKey]) {
                                result[stateKey] = {}
                            }
                            result[stateKey][key] = localProperty
                        }
                        // 如果 slave 的数据更新或相同，不需要同步
                    })

                    // 检查 local 是否有 slave 没有的属性（这些属性也需要同步）
                    Object.keys(localState).forEach(key => {
                        if (!slaveState[key]) {
                            const localProperty = localState[key]
                            // 只同步带 updateAt 的对象
                            if (localProperty && typeof localProperty === 'object' && localProperty.updateAt) {
                                if (!result[stateKey]) {
                                    result[stateKey] = {}
                                }
                                result[stateKey][key] = localProperty
                            }
                        }
                    })
                })

                // 将 result 发送回 slave，等待所有同步操作完成
                logger.log([moduleName, LOG_TAGS.Actor, "master"], `状态同步差异数据:`, result)
                const syncPromises = Object.keys(result).map(stateKey =>
                    syncStateToSlave(stateKey, result[stateKey], slaveConnection.name)
                )
                await Promise.all(syncPromises)

                // 初始同步完成后才开启增量同步，避免竞态条件
                storeEntry.dispatchAction(masterInterconnectionActions.startToSync())
            }
            return Promise.resolve({});
        })

    private connectCount = 0;

    private async connectToMasterServer(command: Command<any>) {
        logger.log([moduleName, LOG_TAGS.Actor, "master"], `Master准备开始连接服务器:第${++this.connectCount}次`)
        const instanceInfo = storeEntry.state(kernelCoreInterconnectionState.instanceInfo)
        const masterInterconnection = storeEntry.state(kernelCoreInterconnectionState.masterInterconnection)

        const reasons: string[] = []
        if (!instanceInfo.standalone) reasons.push('非独立运行模式')
        if (instanceInfo.instanceMode !== InstanceMode.MASTER) reasons.push(`当前实例模式为${instanceInfo.instanceMode},非MASTER`)
        if (!instanceInfo.enableSlave) reasons.push('未启用Slave功能')
        if (masterInterconnection.serverConnectionStatus !== ServerConnectionStatus.DISCONNECTED) reasons.push(`当前连接状态为${masterInterconnection.serverConnectionStatus},非DISCONNECTED`)
        if (reasons.length > 0) {
            storeEntry.dispatchAction(instanceInfoActions.setMasterInfo(null))
            throw new AppError(kernelCoreInterconnectionErrorMessages.masterConnectionPrecheckFailed, {reasons}, command)
        }

        let addresses
        try {
            addresses = await masterServer.startServer()
        } catch (error: Error | any) {
            storeEntry.dispatchAction(instanceInfoActions.setMasterInfo(null))
            throw new AppError(kernelCoreInterconnectionErrorMessages.masterServerCannotStart, {message: error.message}, command)
        }
        defaultMasterInfo.serverAddress = addresses
        defaultMasterInfo.addedAt = Date.now()
        storeEntry.dispatchAction(instanceInfoActions.setMasterInfo({...defaultMasterInfo}))
        storeEntry.dispatchAction(masterInterconnectionActions.connecting())

        const wsClient = this.getWsClient();
        try {
            await wsClient.connect({
                deviceRegistration: {
                    type: InstanceMode.MASTER,
                    deviceId: defaultMasterInfo.deviceId,
                    deviceName: defaultMasterInfo.name,
                },
                serverUrls: defaultMasterInfo.serverAddress.map((serverAddress) => serverAddress.address),
                connectionTimeout: kernelCoreInterconnectionParameters.masterConnectionTimeout.value,
                heartbeatInterval: kernelCoreInterconnectionParameters.masterHeartbeatInterval.value,
                heartbeatTimeout: kernelCoreInterconnectionParameters.masterHeartbeatTimeout.value,
                autoHeartbeatResponse: true,
            })
        } catch (error: Error | any) {
            throw new AppError(kernelCoreInterconnectionErrorMessages.masterServerConnectionError, {message: error.message}, command)
        }
    }

    private websocketInitiated: boolean = false

    private getWsClient() {
        if (!this.websocketInitiated) {
            this.initializeWebsocket();
            this.websocketInitiated = true;
        }
        return MasterWebSocketClient.getInstance()
    }

    private initializeWebsocket() {
        const wsClient = MasterWebSocketClient.getInstance();
        wsClient.on(ConnectionEventType.CONNECTED, (event: ConnectedEvent) => {
            logger.log([moduleName, LOG_TAGS.Actor, "master"], 'Master Server连接成功', event);
            kernelCoreInterconnectionCommands.masterConnectedToServer().executeInternally()
        });
        wsClient.on(ConnectionEventType.MESSAGE, (event: WSMessageEvent) => {
            logger.log([moduleName, LOG_TAGS.Actor, "master"], '收到Master Server消息:', event.message);
            if (event.message.type === SYSTEM_MESSAGE_TYPES.SLAVE_CONNECTED) {
                const {deviceId, deviceName} = event.message.data
                kernelCoreInterconnectionCommands.slaveConnected({
                    name: deviceName,
                    deviceId: deviceId
                }).executeInternally()
            }
            if (event.message.type === SYSTEM_MESSAGE_TYPES.SLAVE_DISCONNECTED) {
                kernelCoreInterconnectionCommands.slaveDisconnected().executeInternally()
            }
            if (event.message.type === MasterServerMessageType.REMOTE_COMMAND) {
                try {
                    const remoteCommand = event.message.data as RemoteCommandFromSlave;
                    const localCommand = getCommandByName(remoteCommand.commandName, remoteCommand.payload)
                    if (localCommand) {
                        localCommand.id = remoteCommand.commandId
                        logger.log([moduleName, LOG_TAGS.Actor, "master"], `执行远程方法${localCommand.commandName}`)
                        localCommand.execute(remoteCommand.requestId, remoteCommand.sessionId)
                        this.remoteCommandExecuted(remoteCommand.commandId)
                    } else {
                        logger.error([moduleName, LOG_TAGS.Actor, "master"], '远程方法初始化失败' + event.message.data)
                    }
                } catch (error: Error | any) {
                    logger.error([moduleName, LOG_TAGS.Actor, "master"], `执行远程方法错误:${error.message}`, event.message.data)
                }
            }
        });
        wsClient.on(ConnectionEventType.DISCONNECTED, (event: DisconnectedEvent) => {
            kernelCoreInterconnectionCommands.masterDisconnectedFromServer("连接断开").executeInternally()
        });
    }

    private remoteCommandExecuted = (commandId: string) => {
        const masterInterconnection = storeEntry.state(kernelCoreInterconnectionState.masterInterconnection)
        const wsClient = this.getWsClient();
        if (masterInterconnection.slaveConnection
            && masterInterconnection.serverConnectionStatus === ServerConnectionStatus.CONNECTED
            && wsClient.isConnected()) {
            wsClient.sendMessage(MasterServerMessageType.REMOTE_COMMAND_EXECUTED,
                commandId,
                masterInterconnection.slaveConnection.name ?? null)
                .catch((error: Error | any) => {
                    logger.error([moduleName, LOG_TAGS.Actor, "master"], `send remoteCommandExecuted error:${error.message}`)
                })
        }
    }
}