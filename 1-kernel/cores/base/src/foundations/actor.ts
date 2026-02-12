import {moduleName} from "../moduleName";
import {commandBus, ICommand} from "./command";
import {AppError} from "./error";
import {LOG_TAGS} from "../types";
import {logger} from "./logger";
import {DefinedErrorMessage, ErrorCategory, ErrorSeverity} from "./errorMessage";


/**
 * 命令生命周期监听器接口
 */
export interface CommandLifecycleListener {
    onCommandStart: (actorName: string, command: ICommand<any>) => void;
    onCommandComplete: (actorName: string, command: ICommand<any>, result?: Record<string, any>) => void;
    onCommandError: (actorName: string, command: ICommand<any>, error: AppError) => void;
}

export interface CommandConverter {
    convertCommand: (command: ICommand<any>) => ICommand<any>;
}

export abstract class IActor {
    readonly actorName: string;
    readonly moduleName: string;
    private _handlers?: Map<string, (command: ICommand<any>) => Promise<Record<string, any>>>;

    constructor(actorName: string, moduleName: string) {
        this.actorName = actorName;
        this.moduleName = moduleName;
    }

    // 静态方法：创建命令处理器的辅助函数
    static defineCommandHandler<T>(
        commandFactory: (value: T) => ICommand<T>,
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
    private getCommandHandlers(): Map<string, (command: ICommand<any>) => Promise<Record<string, any>>> {
        if (!this._handlers) {
            this._handlers = new Map();

            // 遍历实例的所有属性
            Object.keys(this).forEach(key => {
                const prop = (this as any)[key];
                // 检查是否是通过 defineHandler 创建的处理器
                if (prop && prop.__isCommandHandler) {
                    const tempCommand = prop.commandFactory(null as any);
                    const commandName = tempCommand.name;

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

    executeCommand = (command: ICommand<any>) => {
        const handler = this.getCommandHandlers().get(command.commandName);
        if (handler) {
            const actorName = this.constructor.name;
            const actorSystem = ActorSystem.getInstance();
            //发射后不管,不需要并发控制
            actorSystem.commandStart(actorName, command);
            handler(command).then((result) => {
                actorSystem.commandComplete(actorName, command, result);
            }).catch((error: any) => {
                // 标准化错误
                const appError = this.normalizeError(error, command);
                actorSystem.commandError(actorName, command, appError);
            })
        }
    }

    private normalizeError(error: any, command: ICommand<any>): AppError {
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
    private actors: IActor[] = [];
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

    registerActor(actor: IActor): void {
        this.actors.push(actor)
    }

    runCommand(command: ICommand<any>): void {
        let commandToExecute =
            this.commandConverters.reduce((prev, converter) =>
                converter.convertCommand(prev), command)
        logger.log([moduleName, LOG_TAGS.System, "ActorSystem"], `发出命令->${commandToExecute.commandName}`, commandToExecute)
        this.actors.forEach(actor => actor.executeCommand(commandToExecute))
    }

    commandStart(actorName: string, command: ICommand<any>): void {
        logger.log([moduleName, LOG_TAGS.System, "ActorSystem"], `命令开始=>${actorName} ${command.commandName} [RID:${command.requestId}][CID:${command.id}][SID:${command.sessionId}]`)
        this.lifecycleListeners.forEach(listener => {
            if (listener.onCommandStart) {
                try {
                    listener.onCommandStart(actorName, command);
                } catch (error) {
                    logger.error([moduleName, LOG_TAGS.System, "ActorSystem"], 'commandStart 监听器执行失败:', error);
                }
            }
        });
    }

    commandComplete(actorName: string, command: ICommand<any>, result?: Record<string, any>): void {
        logger.log([moduleName, LOG_TAGS.System, "ActorSystem"], `命令结束=>${actorName} ${command.commandName} [RID:${command.requestId}][CID:${command.id}][SID:${command.sessionId}]`)
        this.lifecycleListeners.forEach(listener => {
            if (listener.onCommandComplete) {
                try {
                    listener.onCommandComplete(actorName, command, result);
                } catch (error) {
                    logger.error([moduleName, LOG_TAGS.System, "ActorSystem"], 'commandComplete 监听器执行失败:', error);
                }
            }
        });
    }

    commandError(actorName: string, command: ICommand<any>, appError: AppError): void {
        logger.log([moduleName, LOG_TAGS.System, "ActorSystem"], `命令错误=>${actorName} ${command.commandName} [RID:${command.requestId}][CID:${command.id}][SID:${command.sessionId}] Error:${appError.message}`)
        this.lifecycleListeners.forEach(listener => {
            if (listener.onCommandError) {
                try {
                    listener.onCommandError(actorName, command, appError);
                } catch (err) {
                    logger.error([moduleName, LOG_TAGS.System, "ActorSystem"], 'commandError 监听器执行失败:', err);
                }
            }
        });
    }
}

export function createActors<T extends Record<string, new (actorName: string, moduleName: string) => IActor>>(
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