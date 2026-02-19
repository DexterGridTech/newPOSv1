import {moduleName} from "../moduleName";
import {commandBus, Command} from "./command";
import {AppError} from "./error";
import {LOG_TAGS} from "../types";
import {logger} from "./logger";
import {DefinedErrorMessage, ErrorCategory, ErrorSeverity} from "./errorMessage";


/**
 * 命令生命周期监听器接口
 */
export interface CommandLifecycleListener {
    onCommandStart: (actor:Actor, command: Command<any>) => void;
    onCommandComplete: (actor:Actor, command: Command<any>, result?: Record<string, any>) => void;
    onCommandError: (actor:Actor, command: Command<any>, error: AppError) => void;
}

export interface CommandConverter {
    convertCommand: (command: Command<any>) => Command<any>;
}

export abstract class Actor {
    readonly actorName: string;
    readonly moduleName: string;
    private _handlers?: Map<string, (command: Command<any>) => Promise<Record<string, any>>>;

    printName = () => `${this.moduleName}.${this.actorName}`;
    constructor(actorName: string, moduleName: string) {
        this.actorName = actorName;
        this.moduleName = moduleName;
    }

    // 静态方法：创建命令处理器的辅助函数
    static defineCommandHandler<T>(
        commandFactory: (value: T) => Command<T>,
        handler: (command: ReturnType<typeof commandFactory>) => Promise<Record<string, any>>
    ) {
        return {
            commandFactory,
            handler,
            // 用于识别
            __isCommandHandler: true
        };
    }

    // 自动扫描类的属性，查找通过 defineHandler 定义的处理器
    private getCommandHandlers(): Map<string, (command: Command<any>) => Promise<Record<string, any>>> {
        if (!this._handlers) {
            this._handlers = new Map();

            // 遍历实例的所有属性
            Object.keys(this).forEach(key => {
                const prop = (this as any)[key];
                // 检查是否是通过 defineHandler 创建的处理器
                if (prop && prop.__isCommandHandler) {
                    const tempCommand = prop.commandFactory(null as any);
                    const commandName = tempCommand.commandName;

                    // 检查是否已经存在该命令的处理器
                    if (this._handlers!.has(commandName)) {
                        throw new Error(`Duplicate handler for command: ${commandName} in ${this.constructor.name}`);
                    }

                    this._handlers!.set(commandName, prop.handler.bind(this));
                }
            });
        }
        return this._handlers;
    }

    executeCommand = (command: Command<any>) => {
        const handler = this.getCommandHandlers().get(command.commandName);
        if (handler) {
            const actorSystem = ActorSystem.getInstance();
            //发射后不管,不需要并发控制
            actorSystem.commandStart(this, command);
            handler(command).then((result) => {
                actorSystem.commandComplete(this, command, result);
            }).catch((error: any) => {
                // 标准化错误
                const appError = this.normalizeError(error, command);
                actorSystem.commandError(this, command, appError);
            })
        }
    }

    private normalizeError(error: any, command: Command<any>): AppError {
        if (error instanceof AppError) {
            return error;
        }
        const definedErrorMessage = new DefinedErrorMessage(ErrorCategory.SYSTEM,
            ErrorSeverity.MEDIUM,
            "COMMAND_EXECUTION_FAILED",
            'ERR_COMMAND_EXECUTION_FAILED',
            error.message || '命令执行失败')
        // 将普通错误转换为 AppError
        return new AppError(definedErrorMessage, '', command);
    }
}

export class ActorSystem {
    private static instance: ActorSystem;
    private actors: Actor[] = [];
    private lifecycleListeners: CommandLifecycleListener[] = [];
    private commandConverters: CommandConverter[] = [];

    static getInstance(): ActorSystem {
        if (!ActorSystem.instance) {
            ActorSystem.instance = new ActorSystem();
            commandBus.subscribe(command => {
                ActorSystem.instance.runCommand(command)
            })
        }
        return ActorSystem.instance;
    }

    registerLifecycleListener(listener: CommandLifecycleListener) {
        this.lifecycleListeners.push(listener);
    }

    registerCommandConverter(converter: CommandConverter) {
        this.commandConverters.push(converter);
    }

    registerActor(actor: Actor): void {
        this.actors.push(actor)
    }

    runCommand(command: Command<any>): void {
        const commandToExecute =
            this.commandConverters.reduce((prev, converter) =>
                converter.convertCommand(prev), command)
        logger.log([moduleName, LOG_TAGS.System, "ActorSystem"], `收到并准备执行命令${commandToExecute.commandName}`, commandToExecute)
        this.actors.forEach(actor => actor.executeCommand(commandToExecute))
    }

    commandStart(actor:Actor, command: Command<any>): void {
        logger.log([moduleName, LOG_TAGS.System, "ActorSystem"], `命令开始=>${actor.printName()}执行${command.printId()}`)
        this.lifecycleListeners.forEach(listener => {
            if (listener.onCommandStart) {
                try {
                    listener.onCommandStart(actor, command);
                } catch (error) {
                    logger.error([moduleName, LOG_TAGS.System, "ActorSystem"], 'commandStart 监听器执行失败:', error);
                }
            }
        });
    }

    commandComplete(actor:Actor, command: Command<any>, result?: Record<string, any>): void {
        logger.log([moduleName, LOG_TAGS.System, "ActorSystem"], `命令结束=>${actor.printName()}结束执行${command.printId()}`)
        this.lifecycleListeners.forEach(listener => {
            if (listener.onCommandComplete) {
                try {
                    listener.onCommandComplete(actor, command, result);
                } catch (error) {
                    logger.error([moduleName, LOG_TAGS.System, "ActorSystem"], 'commandComplete 监听器执行失败:', error);
                }
            }
        });
    }

    commandError(actor:Actor, command: Command<any>, appError: AppError): void {
        logger.log([moduleName, LOG_TAGS.System, "ActorSystem"], `命令错误=>${actor.printName()}执行错误${command.printId()},${appError.message}`)
        this.lifecycleListeners.forEach(listener => {
            if (listener.onCommandError) {
                try {
                    listener.onCommandError(actor, command, appError);
                } catch (err) {
                    logger.error([moduleName, LOG_TAGS.System, "ActorSystem"], 'commandError 监听器执行失败:', err);
                }
            }
        });
    }
}

export function createActors<T extends Record<string, new (actorName: string, moduleName: string) => Actor>>(
    moduleName: string,
    actorClasses: T
): { [K in keyof T]: InstanceType<T[K]> } {
    const actors = {} as { [K in keyof T]: InstanceType<T[K]> };

    for (const actorName in actorClasses) {
        const ActorClass = actorClasses[actorName];
        actors[actorName] = new ActorClass(actorName, moduleName) as InstanceType<T[typeof actorName]>;
    }

    return actors;
}