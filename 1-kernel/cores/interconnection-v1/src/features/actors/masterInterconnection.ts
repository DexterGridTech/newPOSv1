import {Actor, AppError, Command, getCommandByName, LOG_TAGS, logger, storeEntry} from "@impos2/kernel-core-base-v1";
import {kernelCoreInterconnectionCommands} from "../commands";
import {moduleName} from "../../moduleName";
import {
    InstanceMode,
    kernelCoreInterconnectionState,
    MasterServerMessageType,
    RemoteCommand,
    ServerConnectionStatus,
} from "../../types";
import {kernelCoreInterconnectionErrorMessages, kernelCoreInterconnectionParameters} from "../../supports";
import {defaultMasterInfo, masterServer} from "../../foundations/masterServer";
import {instanceInfoActions} from "../slices/instanceInfo";
import {getInstanceMode, getStandalone} from "../../foundations/accessory";
import {
    ConnectedEvent,
    ConnectionEventType,
    DisconnectedEvent,
    DualWebSocketClient,
    SYSTEM_NOTIFICATION,
    WSMessageEvent
} from "../../foundations";
import {Subject} from "rxjs";
import {nanoid} from "nanoid/non-secure";
import {statesToSyncFromMasterToSlave, statesToSyncFromSlaveToMaster} from "../../foundations/statesNeedToSync";
import {syncStateToRemote} from "../../foundations/syncStateToRemote";
import {instanceInterconnectionActions} from "../slices/instanceInterconnection";


export class MasterInterconnectionActor extends Actor {

    startMasterServer = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.startMasterServer,
        async (command): Promise<Record<string, any>> => {
            await this.connectToMasterServer(command)
            return Promise.resolve({});
        })
    masterConnectedToServer = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.masterConnectedToServer,
        async (command): Promise<Record<string, any>> => {
            storeEntry.dispatchAction(instanceInterconnectionActions.connected())
            return Promise.resolve({});
        })
    masterDisconnectedFromServer = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.masterDisconnectedFromServer,
        async (command): Promise<Record<string, any>> => {
            storeEntry.dispatchAction(instanceInterconnectionActions.disconnected({connectionError: command.payload}))
            storeEntry.dispatchAction(instanceInterconnectionActions.slaveDisconnected())
            const masterReconnectInterval = kernelCoreInterconnectionParameters.masterServerReconnectInterval.value
            logger.log([moduleName, LOG_TAGS.Actor, "master"], `Master与服务器已断开,${masterReconnectInterval}毫秒后重连`)
            setTimeout(() => {
                    kernelCoreInterconnectionCommands.startMasterServer().executeInternally()
                },
                masterReconnectInterval)
            return Promise.resolve({});
        })
    slaveConnected = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.slaveConnected,
        async (command): Promise<Record<string, any>> => {
            storeEntry.dispatchAction(instanceInterconnectionActions.slaveConnected(command.payload))
            logger.log([moduleName, LOG_TAGS.Actor, "master"], `Slave已连接: ${command.payload}`)


            const localStateToSync: Record<string, Record<string, { updateAt: number }>> = {}
            statesToSyncFromSlaveToMaster.forEach(stateKey => {
                const state = storeEntry.getStateByKey(stateKey) as Record<string, any>
                localStateToSync[stateKey] = {}
                Object.keys(state).forEach((key) => {
                    const property = state[key] as { updateAt?: number }
                    if (property && property.updateAt) {
                        localStateToSync[stateKey][key] = {updateAt: property.updateAt}
                    }
                })
            })
            kernelCoreInterconnectionCommands.synStateAtConnected(localStateToSync)
                .withExtra({instanceMode: InstanceMode.SLAVE})
                .execute(nanoid(8))
            return Promise.resolve({});
        })
    slaveDisconnected = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.slaveDisconnected,
        async (command): Promise<Record<string, any>> => {
            storeEntry.dispatchAction(instanceInterconnectionActions.slaveDisconnected())
            logger.log([moduleName, LOG_TAGS.Actor, "master"], `Slave已断开`)
            return Promise.resolve({});
        })

    synStateAtConnected = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.synStateAtConnected,
        async (command): Promise<Record<string, any>> => {
            const wsClient = this.getWsClient();
            const instanceInterconnection = storeEntry.getStateByKey(kernelCoreInterconnectionState.instanceInterconnection)
            const slaveConnection = instanceInterconnection.master.slaveConnection
            if (wsClient.isConnected() && !slaveConnection?.disconnectedAt) {
                const stateFromSlave = command.payload as Record<string, Record<string, { updateAt: number }>>
                const stateAtLocal = storeEntry.getState()
                // 构建需要同步回 slave 的差异数据
                const result: Record<string, Record<string, any>> = {}

                statesToSyncFromMasterToSlave.forEach(stateKey => {
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
                    syncStateToRemote(stateKey, result[stateKey])
                )
                await Promise.all(syncPromises)

                // 初始同步完成后才开启增量同步，避免竞态条件
                storeEntry.dispatchAction(instanceInterconnectionActions.startToSync())
            }
            return Promise.resolve({});
        })
    sendToRemoteExecute = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.sendToRemoteExecute,
        async (command): Promise<Record<string, any>> => {
            const remoteCommand: RemoteCommand = {
                commandId: command.payload.id,
                commandName: command.payload.commandName,
                payload: command.payload.payload,
                requestId: command.payload.requestId ?? 'unknown',
                sessionId: command.payload.sessionId ?? 'unknown',
                extra: command.payload.extra ?? {},
            }
            const wsClient = this.getWsClient();
            const instanceInterconnection = storeEntry.getStateByKey(kernelCoreInterconnectionState.instanceInterconnection)
            const slaveConnection = instanceInterconnection.master.slaveConnection
            if (wsClient.isConnected() && !slaveConnection?.disconnectedAt) {
                try {
                    wsClient.sendMessage(MasterServerMessageType.REMOTE_COMMAND, remoteCommand)
                } catch (error: Error | any) {
                    throw new AppError(kernelCoreInterconnectionErrorMessages.remoteCommandSendError, {message: error.message}, command)
                }
            } else {
                throw new AppError(kernelCoreInterconnectionErrorMessages.slaveNotConnected, null, command)
            }
            const remoteCommandId = command.payload.id
            const remoteCommandResponseTimeout = kernelCoreInterconnectionParameters.remoteCommandResponseTimeout.value

            // 监听 remoteCommandResponse，等待包含 remoteCommandId 的响应
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    subscription.unsubscribe()
                    reject(new AppError(kernelCoreInterconnectionErrorMessages.remoteCommandResponseTimeout, {
                        message: remoteCommand.commandName,
                        timeout: remoteCommandResponseTimeout
                    }, command))
                }, remoteCommandResponseTimeout)

                const subscription = this.remoteCommandResponse.subscribe({
                    next: (responseId) => {
                        if (responseId === remoteCommandId) {
                            clearTimeout(timeout)
                            subscription.unsubscribe()
                            resolve({})
                        }
                    },
                    error: (err) => {
                        clearTimeout(timeout)
                        subscription.unsubscribe()
                        reject(err)
                    }
                })
            })
        })
    private connectCount = 0;
    private remoteCommandResponse = new Subject<string>()

    private async connectToMasterServer(command: Command<any>) {
        logger.log([moduleName, LOG_TAGS.Actor, "master"], `Master准备开始连接服务器:第${++this.connectCount}次`)
        const instanceInfo = storeEntry.getStateByKey(kernelCoreInterconnectionState.instanceInfo)
        const instanceInterconnection = storeEntry.getStateByKey(kernelCoreInterconnectionState.instanceInterconnection)

        const reasons: string[] = []
        if (!getStandalone()) reasons.push('非独立运行模式')
        if (getInstanceMode() !== InstanceMode.MASTER) reasons.push(`当前实例模式为${getInstanceMode()},非MASTER`)
        if (!instanceInfo.enableSlave) reasons.push('未启用Slave功能')
        if (instanceInterconnection.serverConnectionStatus !== ServerConnectionStatus.DISCONNECTED) reasons.push(`当前连接状态为${instanceInterconnection.serverConnectionStatus},非DISCONNECTED`)
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
        storeEntry.dispatchAction(instanceInterconnectionActions.connecting())

        const wsClient = this.getWsClient();
        try {
            await wsClient.connect({
                deviceRegistration: {
                    type: InstanceMode.MASTER,
                    deviceId: defaultMasterInfo.deviceId,
                },
                serverUrls: defaultMasterInfo.serverAddress.map((serverAddress) => serverAddress.address),
                connectionTimeout: kernelCoreInterconnectionParameters.masterServerConnectionTimeout.value,
                heartbeatTimeout: kernelCoreInterconnectionParameters.masterServerHeartbeatTimeout.value,
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
        return DualWebSocketClient.getInstance()
    }

    private initializeWebsocket() {
        const wsClient = DualWebSocketClient.getInstance();
        wsClient.on(ConnectionEventType.CONNECTED, (event: ConnectedEvent) => {
            logger.log([moduleName, LOG_TAGS.Actor, "master"], 'Master Server连接成功', event);
            kernelCoreInterconnectionCommands.masterConnectedToServer().executeInternally()
        });
        wsClient.on(ConnectionEventType.MESSAGE, (event: WSMessageEvent) => {
            logger.log([moduleName, LOG_TAGS.Actor, "master"], '收到Master Server消息:', event.message);
            if (event.message.type === SYSTEM_NOTIFICATION.SLAVE_CONNECTED) {
                const {deviceId} = event.message.data
                kernelCoreInterconnectionCommands.slaveConnected(deviceId).executeInternally()
            }
            if (event.message.type === SYSTEM_NOTIFICATION.SLAVE_DISCONNECTED) {
                kernelCoreInterconnectionCommands.slaveDisconnected().executeInternally()
            }
            if (event.message.type === MasterServerMessageType.REMOTE_COMMAND) {
                const remoteCommand = event.message.data as RemoteCommand;
                this.executeRemoteCommand(remoteCommand)
            }
            if (event.message.type === MasterServerMessageType.SYNC_STATE) {
                const {key, stateChanged} = event.message.data
                this.syncStateFromRemote(key, stateChanged)
            }
            if (event.message.type === MasterServerMessageType.REMOTE_COMMAND_EXECUTED) {
                this.remoteCommandResponse.next(event.message.data)
            }
        });
        wsClient.on(ConnectionEventType.DISCONNECTED, (event: DisconnectedEvent) => {
            kernelCoreInterconnectionCommands.masterDisconnectedFromServer("连接断开").executeInternally()
        });
    }

    private syncStateFromRemote = (key: string, stateChanged: any) => {
        try {
            const actionType = key + '/batchUpdateState'
            storeEntry.dispatchAction({
                type: actionType,
                payload: stateChanged
            })
            logger.log([moduleName, LOG_TAGS.Actor, "master"], '状态同步完成:', actionType)
        } catch (e: Error | any) {
            logger.error([moduleName, LOG_TAGS.Actor, "master"], `状态同步错误:${e.message} with key ${key}`, stateChanged)
        }
    }

    private executeRemoteCommand = (remoteCommand: RemoteCommand) => {
        const command = getCommandByName(remoteCommand.commandName, remoteCommand.payload)
        command.id = remoteCommand.commandId
        logger.log([moduleName, LOG_TAGS.Actor, "master"], `执行远程方法${remoteCommand.commandName}`)
        command.withExtra(remoteCommand.extra).execute(remoteCommand.requestId, remoteCommand.sessionId)
        this.remoteCommandExecuted(command.id)
    }

    private remoteCommandExecuted = (commandId: string) => {
        const wsClient = this.getWsClient();
        const instanceInterconnection = storeEntry.getStateByKey(kernelCoreInterconnectionState.instanceInterconnection)
        if (wsClient.isConnected() && instanceInterconnection.master.slaveConnection) {
            try {
                wsClient.sendMessage(MasterServerMessageType.REMOTE_COMMAND_EXECUTED, commandId)
            } catch (error: Error | any) {
                logger.error([moduleName, LOG_TAGS.Actor, "master"], `send remoteCommandExecuted error:${error.message}`)
            }
        }
    }
}