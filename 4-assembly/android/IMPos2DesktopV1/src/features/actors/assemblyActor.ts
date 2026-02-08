import {CommandHandler, IActor, InitializeCommand, RestartApplicationCommand} from "@impos2/kernel-base";
import MultiDisplayManager from "../../utils/MultiDisplayManager.ts";

class AssemblyActor extends IActor {
    @CommandHandler(InitializeCommand)
    private async handleInitialize(command: InitializeCommand) {
    }

    @CommandHandler(RestartApplicationCommand)
    private async handleRestartApplication(command: RestartApplicationCommand) {
        await MultiDisplayManager.restartApplication();
    }

}

export const assemblyActor = new AssemblyActor()