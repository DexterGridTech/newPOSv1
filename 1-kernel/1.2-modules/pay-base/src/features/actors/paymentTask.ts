import {moduleName} from "../../moduleName";
import {Actor, LOG_TAGS, logger} from "@impos2/kernel-core-base";
import {kernelPayBaseCommands} from "../commands";
import {kernelCoreTaskCommands} from "@impos2/kernel-core-task";

export class PaymentTaskActor extends Actor {
    executePaymentTask = Actor.defineCommandHandler(kernelPayBaseCommands.executePaymentTask,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "PaymentTaskActor"], 'execute Payment Task...', command.payload)
            kernelCoreTaskCommands.executeTask({
                taskDefinitionKey: command.payload.paymentFunction.definition.taskDefinitionKey,
                initContext: command.payload
            }).executeFromParent(command)
            return {};
        });
}

