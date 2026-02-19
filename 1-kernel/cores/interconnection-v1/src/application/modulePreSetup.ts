import {ActorSystem, ApplicationConfig, AppModule} from "@impos2/kernel-core-base-v1";
import {setStateNeedToSync} from "../foundations/statesNeedToSync";
import {registerActorSystem} from "../foundations/registerActorSystem";
import {commandWithExtra, remoteCommandConverter} from "../foundations/commandConverter";
import {preInitiateInstanceInfo} from "../foundations/preInitiateInstanceInfo";


export const kernelCoreInterconnectionModulePreSetup = async (config: ApplicationConfig, allModules: AppModule[]) => {
    registerActorSystem()
    preInitiateInstanceInfo(config)

    ActorSystem.getInstance().registerCommandConverter(commandWithExtra)
    ActorSystem.getInstance().registerCommandConverter(remoteCommandConverter)

    setStateNeedToSync(allModules)
}


