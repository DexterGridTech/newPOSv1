import {Actor, kernelCoreBaseCommands, LOG_TAGS, logger, storeEntry} from "@impos2/kernel-core-base-v1";
import {moduleName} from "../../moduleName";
import {kernelCoreInterconnectionParameters} from "../../supports";
import {InstanceMode, kernelCoreInterconnectionState} from "../../types";
import {kernelCoreInterconnectionCommands} from "../commands";
import {getInstanceMode} from "../../foundations/accessory";

export class InitializeActor extends Actor {
    initialize = Actor.defineCommandHandler(kernelCoreBaseCommands.initialize,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "InitializeActor"], 'Initializing kernel core interconnection...')
            const instanceInfo = storeEntry.getStateByKey(kernelCoreInterconnectionState.instanceInfo)
            if (getInstanceMode() === InstanceMode.MASTER
                && instanceInfo.enableSlave) {
                setTimeout(() => {
                    kernelCoreInterconnectionCommands.startMasterServer().executeInternally()
                }, kernelCoreInterconnectionParameters.masterServerBootstrapDelayAfterStartup.value)
            }
            if (getInstanceMode() === InstanceMode.SLAVE
                && instanceInfo.masterInfo) {
                setTimeout(() => {
                    kernelCoreInterconnectionCommands.connectMasterServer().executeInternally()
                }, kernelCoreInterconnectionParameters.slaveConnectDelayAfterStartup.value)
            }
            return Promise.resolve({});
        });
}

