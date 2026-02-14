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
    ServerConnectionStatus
} from "../../types";
import {kernelCoreInterconnectionErrorMessages, kernelCoreInterconnectionParameters} from "../../supports";
import {defaultSlaveInfo} from "../../foundations/masterServer";
import {MasterWebSocketClient, WSMessageEvent} from "../../foundations";
import {dispatchAction} from "@impos2/kernel-base";
import {slaveInterconnectionActions} from "../slices/slaveInterconnection";


export class SlaveInterconnectionActor extends Actor {
    connectMasterServer = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.connectMasterServer,
        async (command): Promise<Record<string, any>> => {
            await this.connectToMasterServer(command)
            return Promise.resolve({});
        })
    slaveConnectedToServer = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.slaveConnectedToServer,
        async (command): Promise<Record<string, any>> => {
            storeEntry.dispatchAction(slaveInterconnectionActions.connected())
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

    private connectCount = 0;

    private async connectToMasterServer(command: Command<any>) {
        logger.log([moduleName, LOG_TAGS.Actor, "slave"], `Slave准备开始连接服务器:第${++this.connectCount}次`)
        const instanceInfo = storeEntry.state(kernelCoreInterconnectionState.instanceInfo)
        const slaveInterconnection = storeEntry.state(kernelCoreInterconnectionState.slaveInterconnection)

        const reasons: string[] = []
        if (instanceInfo.instanceMode !== InstanceMode.SLAVE) reasons.push(`当前实例模式为${instanceInfo.instanceMode},非SLAVE`)
        if (!instanceInfo.masterInfo) reasons.push('Master目标不存在')
        if (instanceInfo.masterInfo!.serverAddress.length === 0) reasons.push('Master服务地址不存在')
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
                    masterDeviceId:instanceInfo.masterInfo!.deviceId
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
        });
        wsClient.on(ConnectionEventType.MESSAGE, (event: WSMessageEvent) => {
            logger.log([moduleName, LOG_TAGS.Actor, "slave"], '收到Master Server消息:', event.message);
            if (event.message.type === MasterServerMessageType.SYNC_STATE) {
                try {
                    const {key, state} = event.message.data
                    const actionType = key + '/batchUpdateState'
                    dispatchAction({
                        type: actionType,
                        payload: state
                    })
                    logger.log([moduleName, LOG_TAGS.Actor, "slave"], '状态同步完成:', actionType)
                } catch (e: any) {
                    logger.error([moduleName, LOG_TAGS.Actor, "slave"], '状态同步错误:' + e + ' ' + +event.message.data)
                }
            } else if (event.message.type === MasterServerMessageType.REMOTE_COMMAND_EXECUTED) {
                // this.remoteCommandExecuted.add(event.message.data);
            }
        });
        wsClient.on(ConnectionEventType.DISCONNECTED, (event: DisconnectedEvent) => {
            kernelCoreInterconnectionCommands.slaveDisconnectedFromServer("连接断开").executeInternally()
        });
    }
}