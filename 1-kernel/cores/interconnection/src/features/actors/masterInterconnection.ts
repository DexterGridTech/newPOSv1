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
            storeEntry.dispatchAction(masterInterconnectionActions.disconnected({connectionError:command.payload}))
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
        storeEntry.dispatchAction(instanceInfoActions.setMasterInfo({ ...defaultMasterInfo }))
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
                        logger.log([moduleName, LOG_TAGS.Actor, "master"], `执行远程方法`, localCommand)
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