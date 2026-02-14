import {DefinedSystemParameter} from "@impos2/kernel-core-base";


export const kernelCoreInterconnectionParameters = {
    masterServerBootstrapDelayAfterStartup: new DefinedSystemParameter(
        'Master服务启动推迟',
        "master.server.bootstrap.delay",
        2000
    ),
    slaveConnectDelayAfterStartup: new DefinedSystemParameter(
        'Master服务启动推迟',
        "slave.connect.delay",
        4000
    )
};