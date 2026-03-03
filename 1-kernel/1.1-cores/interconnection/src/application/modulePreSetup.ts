import {ActorSystem, ApplicationConfig, AppModule, InitLogger} from "@impos2/kernel-core-base";
import {setStateNeedToSync} from "../foundations/statesNeedToSync";
import {registerActorLifecycleListener} from "../foundations/registerActorSystem";
import {commandWithExtra, remoteCommandConverter} from "../foundations/commandConverter";
import {preInitiateInstanceInfo} from "../foundations/preInitiateInstanceInfo";


export const kernelCoreInterconnectionModulePreSetup = async (config: ApplicationConfig, allModules: AppModule[]) => {
    const initLogger = InitLogger.getInstance()

    initLogger.logNames(['register ActorLifecycleListener'])
    registerActorLifecycleListener()

    initLogger.logNames(['preInitiate InstanceInfo'])
    preInitiateInstanceInfo(config)

    initLogger.logNames(['ActorSystem registerCommandConverter commandWithExtra'])
    ActorSystem.getInstance().registerCommandConverter(commandWithExtra)

    initLogger.logNames(['ActorSystem registerCommandConverter remoteCommandConverter'])
    ActorSystem.getInstance().registerCommandConverter(remoteCommandConverter)

    initLogger.logNames(['register states synchronization'])
    setStateNeedToSync(allModules)
}


