import {IActor} from "../../foundations";
import {kernelCoreBaseCommands} from "../commands";

export class InitActor extends IActor {
    initialize =
        IActor.defineHandler(kernelCoreBaseCommands.initialize,
            (command): Promise<Record<string, any>> => {
                console.log('Initializing kernel core base...');
                return Promise.resolve({});
            });

}

