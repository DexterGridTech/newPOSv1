import {moduleName} from "../moduleName";
import {commandBus, ICommand} from "./command";
import {AppError} from "./error";
import {LOG_TAGS} from "../types";
import {logger} from "./logger";
import {ErrorCategory, ErrorSeverity} from "./definedErrorMessages";


export type CommandStartCallback = (actorName: string, command: ICommand<any>) => void;
export type CommandCompleteCallback = (actorName: string, command: ICommand<any>, result?: Record<string, any>) => void;
export type CommandErrorCallback = (actorName: string, command: ICommand<any>, error: AppError) => void;

/**
 * 命令生命周期监听器接口
 */
export interface CommandLifecycleListener {
    onCommandStart?: CommandStartCallback;
    onCommandComplete?: CommandCompleteCallback;
    onCommandError?: CommandErrorCallback;
}

abstract class IActor {
    private _handlers?: Map<string, (command: ICommand<any>) => Promise<Record<string, any>>>;

    // 静态方法：创建命令处理器的辅助函数
    static defineHandler<T>(
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
        if (!handler) {
            return;
        }
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

    private normalizeError(error: any, command: ICommand<any>): AppError {
        if (error instanceof AppError) {
            return error;
        }
        // 将普通错误转换为 AppError
        return new AppError({
            category: ErrorCategory.SYSTEM,
            severity: ErrorSeverity.MEDIUM,
            key: 'ERR_COMMAND_EXECUTION_FAILED',
            defaultMessage: error.message || '命令执行失败'
        }, '', command);
    }
}

export class ActorSystem {
    private static instance: ActorSystem;
    private actors: IActor[] = [];
    /**
     * 命令生命周期监听器列表
     * 使用回调模式解耦,避免直接覆盖方法
     */
    private lifecycleListeners: CommandLifecycleListener[] = [];

    static getInstance(): ActorSystem {
        if (!ActorSystem.instance) {
            ActorSystem.instance = new ActorSystem();
            commandBus.subscribe(command => {
                ActorSystem.instance.runCommand(command)
            })
        }
        return ActorSystem.instance;
    }

    /**
     * 注册命令生命周期监听器
     * @param listener 监听器对象
     * @returns 取消注册的函数
     */
    registerLifecycleListener(listener: CommandLifecycleListener): () => void {
        this.lifecycleListeners.push(listener);
        // 返回取消注册的函数
        return () => {
            const index = this.lifecycleListeners.indexOf(listener);
            if (index > -1) {
                this.lifecycleListeners.splice(index, 1);
            }
        };
    }

    register(actor: IActor): void {
        this.actors.push(actor)
    }

    runCommand(command: ICommand<any>): void {
        let commandToExecute = command
        //todo

        // const slaveName = storeEntry.getSlaveName();
        // const displayMode = storeEntry.getDisplayMode();
        //
        // if (slaveName &&
        //     commandToExecute.executionType === ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER) {
        //     this.commandError(
        //         this.constructor.name,
        //         commandToExecute,
        //         new AppError(SystemCommandErrors.COMMAND_FORBIDDEN_ON_SLAVE, command.commandName, command))
        //     return
        // }
        // if (!slaveName &&
        //     commandToExecute.executionType === ExecutionType.ONLY_SEND_AND_EXECUTE_ON_SLAVE) {
        //     this.commandError(
        //         this.constructor.name,
        //         commandToExecute,
        //         new AppError(SystemCommandErrors.COMMAND_FORBIDDEN_ON_MASTER, command.commandName, command))
        //     return
        // }
        // if (slaveName &&
        //     displayMode &&
        //     commandToExecute.executionType === ExecutionType.SLAVE_SEND_MASTER_EXECUTE) {
        //     commandToExecute.slaveInfo = {slaveName, displayMode}
        //     commandToExecute = new SendToMasterCommand(commandToExecute)
        // }
        // logger.log([moduleName, LOG_TAGS.System, "ActorSystem"], `发出命令->${commandToExecute.commandName}`, commandToExecute)
        this.actors.forEach(actor => actor.executeCommand(commandToExecute))
    }

    /**
     * 命令开始执行时调用
     * 通知所有注册的监听器
     */
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

    /**
     * 命令执行完成时调用
     * 通知所有注册的监听器
     */
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

    /**
     * 命令执行出错时调用
     * 通知所有注册的监听器
     */
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