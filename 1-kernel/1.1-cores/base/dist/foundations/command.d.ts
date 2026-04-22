import { Subject } from "rxjs";
export declare const commandBus: Subject<Command<any>>;
export declare const registerModuleCommands: (moduleName: string, commands: Record<string, (payload: any) => Command<any>>) => void;
export declare const getCommandByName: (commandName: string, payload: any) => Command<any>;
export declare abstract class Command<P> {
    abstract readonly commandName: string;
    id: string;
    readonly timestamp: number;
    readonly payload: P;
    requestId?: string;
    sessionId?: string;
    extra: Record<string, any>;
    private ancestors;
    printId(): string;
    protected constructor(payload: P);
    getCommandName(): string;
    withExtra(extra: Record<string, any>): Command<P>;
    execute(requestId: string, sessionId?: string): void;
    executeInternally(): void;
    executeFromParent(parent: Command<any>): void;
}
type CommandConfig<P> = {
    payloadType: P;
};
export declare function defineCommand<P>(): CommandConfig<P>;
export declare function createModuleCommands<T extends Record<string, {
    payloadType: any;
}>>(moduleName: string, config: T): {
    [K in keyof T]: (payload: T[K]['payloadType']) => Command<T[K]['payloadType']>;
};
export {};
//# sourceMappingURL=command.d.ts.map