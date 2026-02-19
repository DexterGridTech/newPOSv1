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
            const isMaster = getInstanceMode() === InstanceMode.MASTER
            const shouldConnect = isMaster ? instanceInfo.enableSlave : !!instanceInfo.masterInfo
            if (shouldConnect) {
                const delay = isMaster
                    ? kernelCoreInterconnectionParameters.masterServerBootstrapDelayAfterStartup.value
                    : kernelCoreInterconnectionParameters.slaveConnectDelayAfterStartup.value
                setTimeout(() => {
                    kernelCoreInterconnectionCommands.startConnection().executeInternally()
                }, delay)
            }
            return Promise.resolve({});
        });
}

