import { Command } from "./command";
import { AppError } from "./error";
/**
 * 命令生命周期监听器接口
 */
export interface CommandLifecycleListener {
    onCommandStart: (actor: Actor, command: Command<any>) => void;
    onCommandComplete: (actor: Actor, command: Command<any>, result?: Record<string, any>) => void;
    onCommandError: (actor: Actor, command: Command<any>, error: AppError) => void;
}
export interface CommandConverter {
    convertCommand: (command: Command<any>) => Command<any>;
}
export declare abstract class Actor {
    readonly actorName: string;
    readonly moduleName: string;
    private _handlers?;
    printName: () => string;
    constructor(actorName: string, moduleName: string);
    static defineCommandHandler<T>(commandFactory: (value: T) => Command<T>, handler: (command: ReturnType<typeof commandFactory>) => Promise<Record<string, any>>): {
        commandFactory: (value: T) => Command<T>;
        handler: (command: ReturnType<typeof commandFactory>) => Promise<Record<string, any>>;
        __isCommandHandler: boolean;
    };
    private getCommandHandlers;
    executeCommand: (command: Command<any>) => void;
    private normalizeError;
}
export declare class ActorSystem {
    private static instance;
    private actors;
    private lifecycleListeners;
    private commandConverters;
    static getInstance(): ActorSystem;
    registerLifecycleListener(listener: CommandLifecycleListener): void;
    registerCommandConverter(converter: CommandConverter): void;
    registerActor(actor: Actor): void;
    runCommand(command: Command<any>): void;
    commandStart(actor: Actor, command: Command<any>): void;
    commandComplete(actor: Actor, command: Command<any>, result?: Record<string, any>): void;
    commandError(actor: Actor, command: Command<any>, appError: AppError): void;
}
export declare function createActors<T extends Record<string, new (actorName: string, moduleName: string) => Actor>>(moduleName: string, actorClasses: T): {
    [K in keyof T]: InstanceType<T[K]>;
};
//# sourceMappingURL=actor.d.ts.map