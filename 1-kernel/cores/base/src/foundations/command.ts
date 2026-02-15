import {Subject} from "rxjs";
import {nanoid} from "nanoid";
import {ExecutePath, ExecutionType, INTERNAL} from "../types/shared/command";

export const commandBus = new Subject<Command<any>>();

const allCommands: Record<string, (payload: any) => Command<any>> = {}

export const registerModuleCommands = (moduleName: string, commands: Record<string, (payload: any) => Command<any>>) => {
    Object.keys(commands).forEach(commandName => {
        const fullCommandName = `${moduleName}.${commandName}`;
        if (allCommands.hasOwnProperty(fullCommandName)) {
            throw new Error(`Command ${fullCommandName} has been registered`);
        }
        allCommands[fullCommandName] = commands[commandName];
    })
}

export const getCommandByName = (commandName: string,payload:any) => {
    return allCommands[commandName](payload);
}

export abstract class Command<P> {
    abstract readonly commandName: string;
    id = nanoid(8);
    readonly timestamp = Date.now();
    abstract readonly executionType: ExecutionType
    readonly payload: P;
    requestId?: string;
    sessionId?: string;
    private _executePath: ExecutePath[] | null = null;

    printId() {
        return `${this.commandName}[CID:${this.id},RID:${this.requestId},SID:${this.sessionId}]`
    }

    get executePath(): ExecutePath[] {
        if (!this._executePath) {
            this._executePath = [{name: this.commandName, id: this.id}]
        }
        return this._executePath;
    }

    protected constructor(payload: P) {
        this.payload = payload;
    }

    getCommandName(): string {
        return this.commandName;
    }

    execute(requestId: string, sessionId?: string): void {
        this.requestId = requestId;
        this.sessionId = sessionId;
        commandBus.next(this);
    }

    executeInternally(): void {
        return this.execute(INTERNAL, INTERNAL)
    }

    executeFromParent(parent?: Command<any>): void {
        if (parent) {
            this.executePath.push(...parent.executePath);
            parent.executePath.forEach(parentNode => {
                if (parentNode.name === this.getCommandName()) {
                    throw new Error("command in circle: " + this.executePath.map(pathNode => `${pathNode.name}(${pathNode.id})`).join(" <- "));
                }
            })
            this.requestId = parent.requestId;
            this.sessionId = parent.sessionId;
            commandBus.next(this);
        } else {
            throw new Error("parent command is null")
        }
    }
}

// 辅助类型：用于定义命令配置
type CommandConfig<P> = {
    payloadType: P;
    executionType: ExecutionType;
}

// 类型推断辅助函数
export function defineCommand<P>(executionType: ExecutionType): CommandConfig<P> {
    return {payloadType: undefined as any as P, executionType};
}

// 通用的命令区域生成器
export function createModuleCommands<T extends Record<string, {
    payloadType: any;
    executionType: ExecutionType;
}>>(
    moduleName: string,
    config: T
): { [K in keyof T]: (payload: T[K]['payloadType']) => Command<T[K]['payloadType']> } {
    // 创建命令类的工厂函数
    function createCommandClass<P>(key: string, executionType: ExecutionType, moduleName: string) {
        const fullCommandName = `${moduleName}.${key}`;
        return class extends Command<P> {
            readonly commandName = fullCommandName;
            readonly executionType = executionType;

            constructor(payload: P) {
                super(payload);
            }
        };
    }

    const result: any = {};
    const classCache: any = {};

    for (const [key, commandConfig] of Object.entries(config)) {
        // 缓存命令类
        classCache[key] = createCommandClass(key, commandConfig.executionType, moduleName);
        // 创建工厂函数
        result[key] = (payload: any) => new classCache[key](payload);
    }

    return result;
}