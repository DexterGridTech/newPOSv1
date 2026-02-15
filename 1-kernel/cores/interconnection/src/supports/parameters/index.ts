import {DefinedSystemParameter} from "@impos2/kernel-core-base";


export const kernelCoreInterconnectionParameters = {
    masterServerBootstrapDelayAfterStartup: new DefinedSystemParameter(
        'Master服务启动推迟',
        "master.server.bootstrap.delay",
        2000
    ),
    masterReconnectInterval: new DefinedSystemParameter(
        'Master重连间隔',
        "master.reconnect.interval",
        20000
    ),
    masterConnectionTimeout: new DefinedSystemParameter(
        'Master连接超时',
        "master.connection.timeout",
        10000
    ),
    masterHeartbeatInterval: new DefinedSystemParameter(
        'Master连接心跳间隔',
        "master.heartbeat.interval",
        30000
    ),
    masterHeartbeatTimeout: new DefinedSystemParameter(
        'Master连接心跳超时',
        "master.heartbeat.timeout",
        60000
    ),
    slaveConnectDelayAfterStartup: new DefinedSystemParameter(
        'Slave连接服务启动推迟',
        "slave.connect.delay",
        4000
    ),
    slaveReconnectInterval: new DefinedSystemParameter(
        'Slave重连间隔',
        "slave.reconnect.interval",
        20000
    ),
    slaveConnectionTimeout: new DefinedSystemParameter(
        'Slave连接超时',
        "slave.connection.timeout",
        10000
    ),
    slaveHeartbeatInterval: new DefinedSystemParameter(
        'Slave连接心跳间隔',
        "slave.heartbeat.interval",
        30000
    ),
    slaveHeartbeatTimeout: new DefinedSystemParameter(
        'Slave连接心跳超时',
        "slave.heartbeat.timeout",
        60000
    ),
    remoteCommandResponseTimeout: new DefinedSystemParameter(
        '远程命令响应超时',
        "remote.command.response.timeout",
        6000
    )
};