import {Subject} from "rxjs";
import {nanoid} from "nanoid";
import {INTERNAL} from "../types/shared/command";

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

export const getCommandByName = (commandName: string, payload: any) => {
    const factory = allCommands[commandName];
    if (!factory) {
        throw new Error(`Command not found: ${commandName}`);
    }
    return factory(payload);
}

export abstract class Command<P> {
    abstract readonly commandName: string;
    id = nanoid(8);
    readonly timestamp = Date.now();
    readonly payload: P;
    requestId?: string;
    sessionId?: string;
    extra: Record<string, any> = {};
    private ancestors = new Map<string, string>();

    printId() {
        return `${this.commandName}[CID:${this.id},RID:${this.requestId},SID:${this.sessionId}]`
    }

    protected constructor(payload: P) {
        this.payload = payload;
    }

    getCommandName(): string {
        return this.commandName;
    }

    withExtra(extra: Record<string, any>): Command<P> {
        this.extra = {...this.extra, ...extra};
        return this;
    }

    execute(requestId: string, sessionId?: string): void {
        this.requestId = requestId;
        this.sessionId = sessionId;
        commandBus.next(this);
    }

    executeInternally(): void {
        return this.execute(INTERNAL, INTERNAL)
    }

    executeFromParent(parent: Command<any>): void {
        if (parent.ancestors.has(this.commandName)) {
            const path = [...parent.ancestors.entries()]
                .map(([name, id]) => `${name}(${id})`)
                .join(" -> ");
            throw new Error(`command in circle: ${path} -> ${this.commandName}(${this.id})`);
        }
        this.ancestors = new Map(parent.ancestors);
        this.ancestors.set(parent.commandName, parent.id);
        this.requestId = parent.requestId;
        this.sessionId = parent.sessionId;
        this.extra = {...parent.extra};
        commandBus.next(this);
    }
}

// 辅助类型：用于定义命令配置
type CommandConfig<P> = {
    payloadType: P;
}

// 类型推断辅助函数
export function defineCommand<P>(): CommandConfig<P> {
    return {payloadType: undefined as any as P};
}

// 通用的命令区域生成器
export function createModuleCommands<T extends Record<string, {
    payloadType: any;
}>>(
    moduleName: string,
    config: T
): { [K in keyof T]: (payload: T[K]['payloadType']) => Command<T[K]['payloadType']> } {
    function createCommandClass<P>(key: string, moduleName: string) {
        const fullCommandName = `${moduleName}.${key}`;
        return class extends Command<P> {
            readonly commandName = fullCommandName;

            constructor(payload: P) {
                super(payload);
            }
        };
    }

    const result: any = {};
    const classCache: any = {};

    for (const [key, commandConfig] of Object.entries(config)) {
        // 缓存命令类
        classCache[key] = createCommandClass(key, moduleName);
        // 创建工厂函数
        result[key] = (payload: any) => new classCache[key](payload);
    }

    return result;
}