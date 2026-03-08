import {addTaskDefinitionRegister,TaskDefinition, ApplicationConfig, AppModule, InitLogger} from "@impos2/kernel-core-base";
import {TaskSystem} from "../foundations";


export const kernelCoreTaskModulePreSetup = async (config: ApplicationConfig, allModules: AppModule[]) => {
    const initLogger = InitLogger.getInstance()
    initLogger.logNames(['add task definition Register'])
    addTaskDefinitionRegister({
        registerTaskDefinition: (taskDefinition: TaskDefinition) => {
            TaskSystem.getInstance().registerTask(taskDefinition)
        }
    })
}