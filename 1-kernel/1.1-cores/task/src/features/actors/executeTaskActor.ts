import {moduleName} from "../../moduleName";
import {Actor, AppError, LOG_TAGS, logger} from "@impos2/kernel-core-base";
import {kernelCoreTaskCommands} from "../commands";
import {TaskSystem} from "../../foundations";
import {kernelCoreTaskErrorMessages} from "../../supports";
import {dispatchInstanceModeAction, requestStatusActions} from "@impos2/kernel-core-interconnection";

export class ExecuteTaskActor extends Actor {
    executeTask = Actor.defineCommandHandler(kernelCoreTaskCommands.executeTask,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "ExecuteTaskActor"], `execute task ${command.payload.taskDefinitionKey}`, command)
            return new Promise((resolve, reject) => {
                TaskSystem.getInstance().task(command.payload.taskDefinitionKey).run(command.id, command.payload.initContext, false).subscribe({
                    next: (result) => {
                        dispatchInstanceModeAction(requestStatusActions.updateRequestResult({
                            actor: this.printName(),
                            command:command,
                            result:result
                        }),command)
                        if (result.type === 'TASK_CANCEL') {
                            reject(new AppError(kernelCoreTaskErrorMessages.taskExecutionCancelled, 'Task cancelled', command))
                        }
                    },
                    error: (error) => {
                        reject(new AppError(kernelCoreTaskErrorMessages.taskExecutionError, {error}, command))
                    },
                    complete: () => {
                        resolve({})
                    },
                })
            })
        });
}

