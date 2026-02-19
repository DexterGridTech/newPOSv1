import {ActorSystem, ApplicationConfig, AppModule, InitLogger} from "@impos2/kernel-core-base-v1";
import {setStateNeedToSync} from "../foundations/statesNeedToSync";
import {registerActorLifecycleListener} from "../foundations/registerActorSystem";
import {commandWithExtra, remoteCommandConverter} from "../foundations/commandConverter";
import {preInitiateInstanceInfo} from "../foundations/preInitiateInstanceInfo";


export const kernelCoreInterconnectionModulePreSetup = async (config: ApplicationConfig, allModules: AppModule[]) => {
    const initLogger = InitLogger.getInstance()

    registerActorLifecycleListener()
    initLogger.logNames(['registerActorLifecycleListener'])

    preInitiateInstanceInfo(config)
    initLogger.logNames(['preInitiateInstanceInfo'])

    ActorSystem.getInstance().registerCommandConverter(commandWithExtra)
    ActorSystem.getInstance().registerCommandConverter(remoteCommandConverter)
    initLogger.logNames(['commandWithExtra', 'remoteCommandConverter'])

    setStateNeedToSync(allModules)
}


