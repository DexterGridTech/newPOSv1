import {nanoid} from "nanoid/non-secure";
import {ExecutePath, ExecutionType, INTERNAL, SlaveInfo} from "../types";
import {AppError} from "./error";
import {Subject} from "rxjs";

export const commandBus = new Subject<ICommand<any>>();
/**
 * 命令生命周期回调类型定义
 */
export type CommandStartCallback = (actorName: string, command: ICommand<any>) => void;
export type CommandCompleteCallback = (actorName: string, command: ICommand<any>,result?:Record<string, any>) => void;
export type CommandErrorCallback = (actorName: string, command: ICommand<any>, error: AppError) => void;

/**
 * 命令生命周期监听器接口
 */
export interface CommandLifecycleListener {
    onCommandStart?: CommandStartCallback;
    onCommandComplete?: CommandCompleteCallback;
    onCommandError?: CommandErrorCallback;
}

/**
 * 命令基类
 */
export abstract class ICommand<P> {
    abstract readonly commandName: string;
    id = nanoid(8);
    readonly timestamp = Date.now();
    abstract readonly executionType: ExecutionType
    readonly payload: P;
    requestId?: string;
    sessionId?: string;
    executePath: ExecutePath[] = [{id: this.id, type: this.getCommandName()}];
    slaveInfo?: SlaveInfo;

    constructor(payload: P) {
        this.payload = payload;
    }

    getCommandName(): string {
        return this.commandName;
    }

    executeFromRequest(requestId: string, sessionId?: string): void {
        this.requestId = requestId;
        this.sessionId = sessionId;
        commandBus.next(this);
    }

    executeInternally(): void {
        return this.executeFromRequest(INTERNAL, INTERNAL)
    }

    executeFromParent(parent?: ICommand<any>): void {
        if (parent) {
            this.executePath.push(...parent.executePath);
            parent.executePath.forEach(parentNode => {
                if (parentNode.type === this.getCommandName()) {
                    throw new Error("command in circle: " + this.executePath);
                }
            })
            this.requestId = parent.requestId;
            this.sessionId = parent.sessionId;
        }
        commandBus.next(this);
    }
}

/**
 * 命令注册表
 */
export class CommandRegistry {
    private static registry = new Map<string, new (args: any) => ICommand<any>>();

    static register<A, T extends ICommand<A>>(name: string, constructor: new (args: A) => T) {
        if (this.registry.has(name)) {
            throw new Error(`Command ${name} has been registered`);
        }
        this.registry.set(name, constructor);
    }

    static create<A, T extends ICommand<A>>(name: string, args: A): T | null {
        const Constructor = this.registry.get(name);
        if (!Constructor) {
            return null;
        }
        return new Constructor(args) as T;
    }
}

/**
 * 命令定义工厂函数
 * 用于简化命令类的定义,消除重复代码
 */
export function defineCommand<P>(
    name: string,
    executionType: ExecutionType
) {
    class Command extends ICommand<P> {
        commandName = name;
        executionType = executionType;
    }

    CommandRegistry.register(name, Command);
    // 返回类本身和命令名称
    return Command;
}

/**
 * 发送到主设备的命令
 */
export class SendToMasterCommand extends defineCommand<ICommand<any>>(
    "SendToMasterCommand",
    ExecutionType.ONLY_SEND_AND_EXECUTE_ON_SLAVE
) {
}