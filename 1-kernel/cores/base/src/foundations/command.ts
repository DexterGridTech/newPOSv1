import {Subject} from "rxjs";
import {nanoid} from "nanoid";
import {ExecutePath, ExecutionType, INTERNAL} from "../types/shared/command";
import {LOG_TAGS} from "../types/shared/logTags";
import {logger} from "./logger";
import {moduleName} from "../moduleName";

export const commandBus = new Subject<Command<any>>();

const allCommands: Record<string, new (args: any) => Command<any>> = {}

export const registerModuleCommands = (_moduleName: string, commands: Record<string, new (args: any) => Command<any>>) => {
    Object.keys(commands).forEach(commandName => {
        logger.log([moduleName, LOG_TAGS.System, "registerModuleCommands"], `${_moduleName}.${commandName}`)
        if (allCommands.hasOwnProperty(commandName)) {
            throw new Error(`Command ${commandName} has been registered`);
        }
        allCommands[commandName] = commands[commandName];
    })
}

export const getCommandByName = (commandName: string) => {
    return allCommands[commandName];
}

export abstract class Command<P> {
    abstract readonly commandName: string;
    abstract readonly moduleName: string;
    id = nanoid(8);
    readonly timestamp = Date.now();
    abstract readonly executionType: ExecutionType
    readonly payload: P;
    requestId?: string;
    sessionId?: string;
    private _executePath: ExecutePath[] | null = null;

    printId(){
        return `${this.moduleName}.${this.commandName}[CID:${this.id},RID:${this.requestId},SID:${this.sessionId}]`
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
    moduleName: string;
    payloadType: P;
    executionType: ExecutionType;
}

// 类型推断辅助函数
export function defineCommand<P>(executionType: ExecutionType, moduleName: string): CommandConfig<P> {
    return {payloadType: undefined as any as P, executionType, moduleName};
}

// 通用的命令区域生成器
export function createModuleCommands<T extends Record<string, {
    payloadType: any;
    executionType: ExecutionType;
    moduleName: string
}>>(
    config: T
): { [K in keyof T]: (payload: T[K]['payloadType']) => Command<T[K]['payloadType']> } {
    // 创建命令类的工厂函数
    function createCommandClass<P>(name: string, executionType: ExecutionType, moduleName: string) {
        return class extends Command<P> {
            readonly moduleName = moduleName;
            readonly commandName = name;
            readonly executionType = executionType;

            constructor(payload: P) {
                super(payload);
            }
        };
    }

    const result: any = {};
    const classCache: any = {};

    for (const [name, commandConfig] of Object.entries(config)) {
        // 缓存命令类
        classCache[name] = createCommandClass(name, commandConfig.executionType, commandConfig.moduleName);
        // 创建工厂函数
        result[name] = (payload: any) => new classCache[name](payload);
    }

    return result;
}