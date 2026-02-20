import {DefinedSystemParameter} from "@impos2/kernel-core-base";


export const kernelCoreInterconnectionParameters = {
    masterServerBootstrapDelayAfterStartup: new DefinedSystemParameter(
        'Master服务启动推迟',
        "master.server.bootstrap.delay",
        2000
    ),
    slaveConnectDelayAfterStartup: new DefinedSystemParameter(
        'Slave连接服务启动推迟',
        "slave.connect.delay",
        4000
    ),
    masterServerReconnectInterval: new DefinedSystemParameter(
        'Master Server重连间隔',
        "master.server.reconnect.interval",
        20000
    ),
    masterServerConnectionTimeout: new DefinedSystemParameter(
        'Master Server连接超时',
        "master.server.connection.timeout",
        10000
    ),
    masterServerHeartbeatTimeout: new DefinedSystemParameter(
        'Master Server连接心跳超时',
        "master.server.heartbeat.timeout",
        60000
    ),
    remoteCommandResponseTimeout: new DefinedSystemParameter(
        '远程命令响应超时',
        "remote.command.response.timeout",
        6000
    )
};