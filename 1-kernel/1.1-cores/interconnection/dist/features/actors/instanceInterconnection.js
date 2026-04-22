import { Actor, AppError, getCommandByName, LOG_TAGS, logger, storeEntry } from "@impos2/kernel-core-base";
import { kernelCoreInterconnectionCommands } from "../commands";
import { moduleName } from "../../moduleName";
import { InstanceMode, kernelCoreInterconnectionState, MasterServerMessageType, ServerConnectionStatus, } from "../../types";
import { kernelCoreInterconnectionErrorMessages, kernelCoreInterconnectionParameters } from "../../supports";
import { defaultMasterInfo, defaultSlaveInfo } from "../../foundations/masterServer";
import { instanceInfoActions } from "../slices/instanceInfo";
import { getInstanceMode, getStandalone } from "../../foundations/accessory";
import { ConnectionEventType, DualWebSocketClient, localWebServer, SYSTEM_NOTIFICATION } from "../../foundations";
import { Subject } from "rxjs";
import { statesToSyncFromMasterToSlave, statesToSyncFromSlaveToMaster } from "../../foundations/statesNeedToSync";
import { syncStateToRemote } from "../../foundations/syncStateToRemote";
import { instanceInterconnectionActions } from "../slices/instanceInterconnection";
const isMaster = () => getInstanceMode() === InstanceMode.MASTER;
/** 收集本地需要同步的状态摘要（仅含 updatedAt） */
const collectLocalStateSummary = (stateKeys) => {
    const result = {};
    stateKeys.forEach(stateKey => {
        const state = storeEntry.getStateByKey(stateKey);
        const summary = {};
        Object.keys(state).forEach(key => {
            const prop = state[key];
            if (prop?.updatedAt)
                summary[key] = { updatedAt: prop.updatedAt };
        });
        result[stateKey] = summary;
    });
    return result;
};
export class InstanceInterconnectionActor extends Actor {
    connectCount = 0;
    remoteCommandResponse = new Subject();
    websocketInitiated = false;
    // ==================== 连接生命周期 ====================
    startConnection = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.startConnection, async (command) => {
        await this.connectToServer(command);
        return {};
    });
    connectedToServer = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.connectedToServer, async () => {
        storeEntry.dispatchAction(instanceInterconnectionActions.connected());
        if (!isMaster()) {
            // slave 连接成功后，收集本地状态摘要发给 master 做差异比对
            const summary = collectLocalStateSummary(statesToSyncFromMasterToSlave);
            kernelCoreInterconnectionCommands.synStateAtConnected(summary)
                .withExtra({ instanceMode: InstanceMode.MASTER })
                .executeInternally();
        }
        return {};
    });
    disconnectedFromServer = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.disconnectedFromServer, async (command) => {
        storeEntry.dispatchAction(instanceInterconnectionActions.disconnected({ connectionError: command.payload }));
        if (isMaster()) {
            storeEntry.dispatchAction(instanceInterconnectionActions.slaveDisconnected());
        }
        const interval = kernelCoreInterconnectionParameters.masterServerReconnectInterval.value;
        logger.log([moduleName, LOG_TAGS.Actor, getInstanceMode()], `与服务器已断开,${interval}毫秒后重连`);
        setTimeout(() => {
            kernelCoreInterconnectionCommands.startConnection().executeInternally();
        }, interval);
        return {};
    });
    // ==================== 对端上下线（master 独有） ====================
    peerConnected = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.peerConnected, async (command) => {
        storeEntry.dispatchAction(instanceInterconnectionActions.slaveConnected(command.payload));
        logger.log([moduleName, LOG_TAGS.Actor, getInstanceMode()], `对端已连接: ${command.payload}`);
        const summary = collectLocalStateSummary(statesToSyncFromSlaveToMaster);
        kernelCoreInterconnectionCommands.synStateAtConnected(summary)
            .withExtra({ instanceMode: InstanceMode.SLAVE })
            .executeInternally();
        return {};
    });
    peerDisconnected = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.peerDisconnected, async () => {
        storeEntry.dispatchAction(instanceInterconnectionActions.slaveDisconnected());
        logger.log([moduleName, LOG_TAGS.Actor, getInstanceMode()], `对端已断开`);
        return {};
    });
    // ==================== 状态同步（双向） ====================
    synStateAtConnected = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.synStateAtConnected, async (command) => {
        const wsClient = this.getWsClient();
        if (!wsClient.isConnected())
            return {};
        // master 端额外检查 slave 是否在线
        if (isMaster()) {
            const interconnection = storeEntry.getStateByKey(kernelCoreInterconnectionState.instanceInterconnection);
            if (interconnection.master.slaveConnection?.disconnectedAt)
                return {};
        }
        // 根据当前角色选择需要同步的状态集
        const statesNeedToSync = isMaster() ? statesToSyncFromMasterToSlave : statesToSyncFromSlaveToMaster;
        const remoteState = command.payload;
        const localFullState = storeEntry.getState();
        const diff = {};
        statesNeedToSync.forEach(stateKey => {
            const remote = remoteState[stateKey];
            const local = localFullState[stateKey];
            if (!remote)
                return;
            const stateKeyStr = stateKey;
            if (!local) {
                diff[stateKeyStr] = {};
                Object.keys(remote).forEach(k => {
                    diff[stateKeyStr][k] = null;
                });
                return;
            }
            // remote 有的 key：比较 updatedAt
            Object.keys(remote).forEach(k => {
                const localProp = local[k];
                if (!localProp?.updatedAt) {
                    (diff[stateKeyStr] ??= {})[k] = null;
                }
                else if (localProp.updatedAt > remote[k].updatedAt) {
                    (diff[stateKeyStr] ??= {})[k] = localProp;
                }
            });
            // local 有但 remote 没有的 key
            Object.keys(local).forEach(k => {
                if (!remote[k]) {
                    const localProp = local[k];
                    if (localProp?.updatedAt) {
                        (diff[stateKeyStr] ??= {})[k] = localProp;
                    }
                }
            });
        });
        // logger.log([moduleName, LOG_TAGS.Actor,getInstanceMode()], `状态同步差异数据:`, diff)
        await Promise.all(Object.keys(diff).map(key => syncStateToRemote(key, diff[key])));
        storeEntry.dispatchAction(instanceInterconnectionActions.startToSync());
        return {};
    });
    // ==================== 远程命令 ====================
    sendToRemoteExecute = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.sendToRemoteExecute, async (command) => {
        const remoteCommand = {
            commandId: command.payload.id,
            commandName: command.payload.commandName,
            payload: command.payload.payload,
            requestId: command.payload.requestId ?? 'unknown',
            sessionId: command.payload.sessionId ?? 'unknown',
            extra: command.payload.extra ?? {},
        };
        const wsClient = this.getWsClient();
        // master 额外检查 slave 是否在线
        if (isMaster()) {
            const interconnection = storeEntry.getStateByKey(kernelCoreInterconnectionState.instanceInterconnection);
            if (!wsClient.isConnected() || interconnection.master.slaveConnection?.disconnectedAt) {
                throw new AppError(kernelCoreInterconnectionErrorMessages.slaveNotConnected, null, command);
            }
        }
        else if (!wsClient.isConnected()) {
            throw new AppError(kernelCoreInterconnectionErrorMessages.remoteNotConnected, null, command);
        }
        try {
            wsClient.sendMessage(MasterServerMessageType.REMOTE_COMMAND, remoteCommand);
        }
        catch (error) {
            throw new AppError(kernelCoreInterconnectionErrorMessages.remoteCommandSendError, { message: error.message }, command);
        }
        const timeout = kernelCoreInterconnectionParameters.remoteCommandResponseTimeout.value;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                sub.unsubscribe();
                reject(new AppError(kernelCoreInterconnectionErrorMessages.remoteCommandResponseTimeout, {
                    message: remoteCommand.commandName, timeout
                }, command));
            }, timeout);
            const sub = this.remoteCommandResponse.subscribe({
                next: (id) => {
                    if (id === command.payload.id) {
                        clearTimeout(timer);
                        sub.unsubscribe();
                        resolve({});
                    }
                },
                error: (err) => {
                    clearTimeout(timer);
                    sub.unsubscribe();
                    reject(err);
                }
            });
        });
    });
    // ==================== 私有方法 ====================
    async connectToServer(command) {
        const tag = isMaster() ? 'master' : 'slave';
        logger.log([moduleName, LOG_TAGS.Actor, tag], `准备连接服务器:第${++this.connectCount}次`);
        const instanceInfo = storeEntry.getStateByKey(kernelCoreInterconnectionState.instanceInfo);
        const interconnection = storeEntry.getStateByKey(kernelCoreInterconnectionState.instanceInterconnection);
        // 前置检查
        if (isMaster()) {
            this.precheckMaster(instanceInfo, interconnection, command);
        }
        else {
            this.precheckSlave(instanceInfo, interconnection, command);
        }
        // master 需要先启动本地 server
        if (isMaster()) {
            let addresses;
            try {
                addresses = await localWebServer.startLocalWebServer({
                    port: 8888,
                    basePath: '/localServer',
                    heartbeatInterval: 30000,
                    heartbeatTimeout: 60000,
                });
            }
            catch (error) {
                storeEntry.dispatchAction(instanceInfoActions.setMasterInfo(null));
                throw new AppError(kernelCoreInterconnectionErrorMessages.masterServerCannotStart, { message: error.message }, command);
            }
            defaultMasterInfo.serverAddress = addresses;
            defaultMasterInfo.addedAt = Date.now();
            storeEntry.dispatchAction(instanceInfoActions.setMasterInfo({ ...defaultMasterInfo }));
        }
        storeEntry.dispatchAction(instanceInterconnectionActions.connecting());
        // 构建连接参数
        const wsClient = this.getWsClient();
        const registration = isMaster()
            ? { type: InstanceMode.MASTER, deviceId: defaultMasterInfo.deviceId }
            : {
                type: InstanceMode.SLAVE,
                deviceId: defaultSlaveInfo.deviceId,
                masterDeviceId: instanceInfo.masterInfo.deviceId
            };
        //本机要通过localhost连接
        const serverUrls = isMaster()
            ? [...defaultMasterInfo.serverAddress.map(s => s.address), "http://localhost:8888/localServer"]
            : [...instanceInfo.masterInfo.serverAddress.map(s => s.address), "http://localhost:8888/localServer"];
        try {
            const connectConfig = {
                deviceRegistration: registration,
                serverUrls,
                connectionTimeout: kernelCoreInterconnectionParameters.masterServerConnectionTimeout.value,
                heartbeatTimeout: kernelCoreInterconnectionParameters.masterServerHeartbeatTimeout.value,
            };
            logger.log([moduleName, LOG_TAGS.Actor, tag], "连接参数:", connectConfig);
            await wsClient.connect(connectConfig);
        }
        catch (error) {
            throw new AppError(kernelCoreInterconnectionErrorMessages.masterServerConnectionError, { message: error.message }, command);
        }
    }
    precheckMaster(instanceInfo, interconnection, command) {
        const reasons = [];
        if (!getStandalone())
            reasons.push('非独立运行模式');
        if (!isMaster())
            reasons.push(`当前实例模式为${getInstanceMode()},非MASTER`);
        if (!instanceInfo.enableSlave)
            reasons.push('未启用Slave功能');
        if (interconnection.serverConnectionStatus !== ServerConnectionStatus.DISCONNECTED)
            reasons.push(`当前连接状态为${interconnection.serverConnectionStatus},非DISCONNECTED`);
        if (reasons.length > 0) {
            storeEntry.dispatchAction(instanceInfoActions.setMasterInfo(null));
            throw new AppError(kernelCoreInterconnectionErrorMessages.masterConnectionPrecheckFailed, { reasons }, command);
        }
    }
    precheckSlave(instanceInfo, interconnection, command) {
        const reasons = [];
        if (isMaster())
            reasons.push(`当前实例模式为${getInstanceMode()},非SLAVE`);
        if (!instanceInfo.masterInfo)
            reasons.push('Master目标不存在');
        if (instanceInfo.masterInfo?.serverAddress.length === 0)
            reasons.push('Master服务地址不存在');
        if (interconnection.serverConnectionStatus !== ServerConnectionStatus.DISCONNECTED)
            reasons.push(`当前连接状态为${interconnection.serverConnectionStatus},非DISCONNECTED`);
        if (reasons.length > 0) {
            throw new AppError(kernelCoreInterconnectionErrorMessages.slaveConnectionPrecheckFailed, { reasons }, command);
        }
    }
    getWsClient() {
        if (!this.websocketInitiated) {
            this.initializeWebsocket();
            this.websocketInitiated = true;
        }
        return DualWebSocketClient.getInstance();
    }
    initializeWebsocket() {
        const wsClient = DualWebSocketClient.getInstance();
        wsClient.on(ConnectionEventType.CONNECTED, (_) => {
            kernelCoreInterconnectionCommands.connectedToServer().executeInternally();
        });
        wsClient.on(ConnectionEventType.DISCONNECTED, (_) => {
            kernelCoreInterconnectionCommands.disconnectedFromServer("连接断开").executeInternally();
        });
        wsClient.on(ConnectionEventType.MESSAGE, (event) => {
            logger.log([moduleName, LOG_TAGS.System, "websocketMessage"], `==收到消息==: ${event.message.type}`);
            const { type, data } = event.message;
            // 系统通知（仅 master 收到）
            if (type === SYSTEM_NOTIFICATION.SLAVE_CONNECTED) {
                kernelCoreInterconnectionCommands.peerConnected(data.deviceId).executeInternally();
                return;
            }
            if (type === SYSTEM_NOTIFICATION.SLAVE_DISCONNECTED) {
                kernelCoreInterconnectionCommands.peerDisconnected().executeInternally();
                return;
            }
            // 业务消息（双向通用）
            if (type === MasterServerMessageType.REMOTE_COMMAND) {
                this.executeRemoteCommand(data);
            }
            else if (type === MasterServerMessageType.SYNC_STATE) {
                this.syncStateFromRemote(data.key, data.stateChanged);
            }
            else if (type === MasterServerMessageType.REMOTE_COMMAND_EXECUTED) {
                this.remoteCommandResponse.next(data);
            }
        });
    }
    syncStateFromRemote(key, stateChanged) {
        try {
            const actionType = key + '/batchUpdateState';
            storeEntry.dispatchAction({ type: actionType, payload: stateChanged });
            logger.log([moduleName, LOG_TAGS.Actor, getInstanceMode()], '状态同步完成:', actionType);
        }
        catch (e) {
            logger.error([moduleName, LOG_TAGS.Actor, getInstanceMode()], `状态同步错误:${e.message} with key ${key}`, stateChanged);
        }
    }
    executeRemoteCommand(remoteCommand) {
        const command = getCommandByName(remoteCommand.commandName, remoteCommand.payload);
        command.id = remoteCommand.commandId;
        logger.log([moduleName, LOG_TAGS.Actor, getInstanceMode()], `执行远程方法${remoteCommand.commandName}`);
        command.withExtra(remoteCommand.extra).execute(remoteCommand.requestId, remoteCommand.sessionId);
        this.remoteCommandExecuted(command.id);
    }
    remoteCommandExecuted(commandId) {
        const wsClient = this.getWsClient();
        if (wsClient.isConnected()) {
            try {
                wsClient.sendMessage(MasterServerMessageType.REMOTE_COMMAND_EXECUTED, commandId);
            }
            catch (error) {
                logger.error([moduleName, LOG_TAGS.Actor, getInstanceMode()], `send remoteCommandExecuted error:${error.message}`);
            }
        }
    }
}
