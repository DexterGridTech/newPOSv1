import {Actor, AppError, Command, LOG_TAGS, logger, storeEntry} from "@impos2/kernel-core-base";
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
    ServerConnectionStatus
} from "../../types";
import {kernelCoreInterconnectionErrorMessages, kernelCoreInterconnectionParameters} from "../../supports";
import {defaultSlaveInfo} from "../../foundations/masterServer";
import {MasterWebSocketClient, WSMessageEvent} from "../../foundations";
import {slaveInterconnectionActions} from "../slices/slaveInterconnection";
import {Subject} from "rxjs";
import {statesNeedToSync} from "../../foundations/statesNeedToSync";
import {nanoid} from "nanoid/non-secure";
import {getInstanceMode} from "../../foundations/accessory";


export class SlaveInterconnectionActor extends Actor {
    connectMasterServer = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.connectMasterServer,
        async (command): Promise<Record<string, any>> => {
            await this.connectToMasterServer(command)
            return Promise.resolve({});
        })
    slaveConnectedToServer = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.slaveConnectedToServer,
        async (command): Promise<Record<string, any>> => {
            storeEntry.dispatchAction(slaveInterconnectionActions.connected())

            const localStateToSync: Record<string, Record<string, { updateAt: number }>> = {}
            statesNeedToSync.forEach(stateKey => {
                const state = storeEntry.getStateByKey(stateKey) as Record<string, any>
                localStateToSync[stateKey] = {}
                Object.keys(state).forEach((key) => {
                    const property = state[key] as { updateAt?: number }
                    if (property && property.updateAt) {
                        localStateToSync[stateKey][key] = {updateAt: property.updateAt}
                    }
                })
            })
            kernelCoreInterconnectionCommands.synStateAtConnected(localStateToSync).execute(nanoid(8))
            return Promise.resolve({});
        })
    slaveDisconnectedFromServer = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.slaveDisconnectedFromServer,
        async (command): Promise<Record<string, any>> => {
            storeEntry.dispatchAction(slaveInterconnectionActions.disconnected({connectionError: command.payload}))
            const slaveReconnectInterval = kernelCoreInterconnectionParameters.slaveReconnectInterval.value
            logger.log([moduleName, LOG_TAGS.Actor, "slave"], `Slave与服务器已断开,${slaveReconnectInterval}毫秒后重连`)

            setTimeout(() => {
                    kernelCoreInterconnectionCommands.connectMasterServer().executeInternally()
                },
                slaveReconnectInterval)
            return Promise.resolve({});
        })


    slaveSendMasterExecute = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.slaveSendMasterExecute,
        async (command): Promise<Record<string, any>> => {
            const remoteCommand: RemoteCommandFromSlave = {
                commandId: command.payload.id,
                commandName: command.payload.commandName,
                payload: command.payload.payload,
                requestId: command.payload.requestId ?? 'unknown',
                sessionId: command.payload.sessionId ?? 'unknown',
            }
            const slaveInterconnection = storeEntry.getStateByKey(kernelCoreInterconnectionState.slaveInterconnection)
            const wsClient = this.getWsClient();
            if (slaveInterconnection.serverConnectionStatus === ServerConnectionStatus.CONNECTED && wsClient.isConnected()) {
                await wsClient.sendMessage(MasterServerMessageType.REMOTE_COMMAND, remoteCommand, null)
                    .catch((error: Error | any) => {
                        throw new AppError(kernelCoreInterconnectionErrorMessages.remoteCommandSendError, {message: error.message}, command)
                    })
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
        logger.log([moduleName, LOG_TAGS.Actor, "slave"], `Slave准备开始连接服务器:第${++this.connectCount}次`)
        const instanceInfo = storeEntry.getStateByKey(kernelCoreInterconnectionState.instanceInfo)
        const slaveInterconnection = storeEntry.getStateByKey(kernelCoreInterconnectionState.slaveInterconnection)

        const reasons: string[] = []
        if (getInstanceMode() !== InstanceMode.SLAVE) reasons.push(`当前实例模式为${getInstanceMode()},非SLAVE`)
        if (!instanceInfo.masterInfo) reasons.push('Master目标不存在')
        if (instanceInfo.masterInfo && instanceInfo.masterInfo.serverAddress.length === 0) reasons.push('Master服务地址不存在')
        if (slaveInterconnection.serverConnectionStatus !== ServerConnectionStatus.DISCONNECTED) reasons.push(`当前连接状态为${slaveInterconnection.serverConnectionStatus},非DISCONNECTED`)
        if (reasons.length > 0) {
            throw new AppError(kernelCoreInterconnectionErrorMessages.slaveConnectionPrecheckFailed, {reasons}, command)
        }

        storeEntry.dispatchAction(slaveInterconnectionActions.connecting())

        const wsClient = this.getWsClient();
        try {
            await wsClient.connect({
                deviceRegistration: {
                    type: InstanceMode.SLAVE,
                    deviceId: defaultSlaveInfo.deviceId,
                    deviceName: defaultSlaveInfo.name,
                    masterDeviceId: instanceInfo.masterInfo!.deviceId
                },
                serverUrls: instanceInfo.masterInfo!.serverAddress.map((serverAddress) => serverAddress.address),
                connectionTimeout: kernelCoreInterconnectionParameters.slaveConnectionTimeout.value,
                heartbeatInterval: kernelCoreInterconnectionParameters.slaveHeartbeatInterval.value,
                heartbeatTimeout: kernelCoreInterconnectionParameters.slaveHeartbeatTimeout.value,
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
            logger.log([moduleName, LOG_TAGS.Actor, "slave"], 'Master Server连接成功', event);
            kernelCoreInterconnectionCommands.slaveConnectedToServer().executeInternally()
        });
        wsClient.on(ConnectionEventType.MESSAGE, (event: WSMessageEvent) => {
            logger.log([moduleName, LOG_TAGS.Actor, "slave"], '收到Master Server消息:', event.message);
            if (event.message.type === MasterServerMessageType.SYNC_STATE) {
                try {
                    const {key, stateChanged} = event.message.data
                    const actionType = key + '/batchUpdateState'
                    storeEntry.dispatchAction({
                        type: actionType,
                        payload: stateChanged
                    })
                    logger.log([moduleName, LOG_TAGS.Actor, "slave"], '状态同步完成:', actionType)
                } catch (e: any) {
                    logger.error([moduleName, LOG_TAGS.Actor, "slave"], '状态同步错误:' + e + ' ' + JSON.stringify(event.message.data))
                }
            } else if (event.message.type === MasterServerMessageType.REMOTE_COMMAND_EXECUTED) {
                this.remoteCommandResponse.next(event.message.data)
            }
        });
        wsClient.on(ConnectionEventType.DISCONNECTED, (event: DisconnectedEvent) => {
            kernelCoreInterconnectionCommands.slaveDisconnectedFromServer("连接断开").executeInternally()
        });
    }
}