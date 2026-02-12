import {IActor} from "../../foundations";
import {kernelCoreBaseCommands} from "../commands";

export class InitializeActor extends IActor {
    initialize =
        IActor.defineCommandHandler(kernelCoreBaseCommands.initialize,
            (command): Promise<Record<string, any>> => {
                console.log('Initializing kernel core base...');
                return Promise.resolve({});
            });
}

