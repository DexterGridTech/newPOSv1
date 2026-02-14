import {Actor, kernelCoreBaseCommands, LOG_TAGS, logger, storeEntry} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";
import {kernelCoreInterconnectionParameters} from "../../supports";
import {InstanceMode, kernelCoreInterconnectionState} from "../../types";
import {kernelCoreInterconnectionCommands} from "../commands";

export class InitializeActor extends Actor {
    initialize = Actor.defineCommandHandler(kernelCoreBaseCommands.initialize,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "InitializeActor"], 'Initializing kernel core interconnection...')
            const instanceInfo = storeEntry.state(kernelCoreInterconnectionState.instanceInfo)
            if (instanceInfo.instanceMode === InstanceMode.MASTER
                && instanceInfo.enableSlave) {
                setTimeout(() => {
                    kernelCoreInterconnectionCommands.startMasterServer().executeInternally()
                }, kernelCoreInterconnectionParameters.masterServerBootstrapDelayAfterStartup.value)
            }
            if (instanceInfo.instanceMode === InstanceMode.SLAVE
                && instanceInfo.masterInfo) {
                setTimeout(() => {
                    kernelCoreInterconnectionCommands.connectMasterServer().executeInternally()
                }, kernelCoreInterconnectionParameters.slaveConnectDelayAfterStartup.value)
            }
            return Promise.resolve({});
        });
}

