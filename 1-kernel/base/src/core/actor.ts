import {logger} from "./nativeAdapter";
import {DisplayMode, ErrorCategory, ErrorSeverity, ExecutionType} from "../types";
import {AppError} from "./error";
import {commandBus, CommandLifecycleListener, ICommand, SendToMasterCommand} from "./command";
import {getCommandHandlers} from "./decorators";
import { LOG_TAGS } from '../types/core/logTags';
import { moduleName } from '../moduleName';

/**
 * 状态选择器类型定义
 */
type SlaveNameSelector = () => string | null;
type DisplayModeSelector = () => DisplayMode | null;

/**
 * Actor 系统 - 命令总线
 */
export class ActorSystem {
    private static instance: ActorSystem;
    private actors: IActor[] = [];
    /**
     * 命令生命周期监听器列表
     * 使用回调模式解耦,避免直接覆盖方法
     */
    private lifecycleListeners: CommandLifecycleListener[] = [];

    /**
     * 状态选择器函数 - 通过依赖注入方式设置
     */
    private slaveNameSelector: SlaveNameSelector = () => null;
    private displayModeSelector: DisplayModeSelector = () => null;

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

    /**
     * 移除所有生命周期监听器
     */
    clearLifecycleListeners(): void {
        this.lifecycleListeners = [];
    }

    register(actor: IActor): void {
        actor.buildMethodMap();
        this.actors.push(actor)
    }

    /**
     * 设置状态选择器 - 由store模块在初始化时调用
     * 使用依赖注入模式,避免循环依赖
     */
    setStateSelectors(selectors: {
        slaveNameSelector: SlaveNameSelector;
        displayModeSelector: DisplayModeSelector;
    }): void {
        this.slaveNameSelector = selectors.slaveNameSelector;
        this.displayModeSelector = selectors.displayModeSelector;
    }

    runCommand(command: ICommand<any>): void {
        let commandToExecute = command
        const slaveName = this.slaveNameSelector();
        const displayMode = this.displayModeSelector();

        if (slaveName &&
            commandToExecute.executionType === ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER) {
            this.commandError(
                this.constructor.name,
                commandToExecute,
                new AppError(SystemCommandErrors.COMMAND_FORBIDDEN_ON_SLAVE, command.commandName, command))
            return
        }
        if (!slaveName &&
            commandToExecute.executionType === ExecutionType.ONLY_SEND_AND_EXECUTE_ON_SLAVE) {
            this.commandError(
                this.constructor.name,
                commandToExecute,
                new AppError(SystemCommandErrors.COMMAND_FORBIDDEN_ON_MASTER, command.commandName, command))
            return
        }
        if (slaveName &&
            displayMode &&
            commandToExecute.executionType === ExecutionType.SLAVE_SEND_MASTER_EXECUTE) {
            commandToExecute.slaveInfo = {slaveName, displayMode}
            commandToExecute = new SendToMasterCommand(commandToExecute)
        }
        logger.log([moduleName, LOG_TAGS.Actor, "actor"], "send command->", commandToExecute.commandName)
        this.actors.forEach(actor => actor.executeCommand(commandToExecute))
    }

    /**
     * 命令开始执行时调用
     * 通知所有注册的监听器
     */
    commandStart(actorName: string, command: ICommand<any>): void {
        logger.log([moduleName, LOG_TAGS.Actor, "actor"], `命令开始=>${actorName} ${command.commandName} [CID:${command.id}][RID:${command.requestId}][SID:${command.sessionId}]`)
        this.lifecycleListeners.forEach(listener => {
            if (listener.onCommandStart) {
                try {
                    listener.onCommandStart(actorName, command);
                } catch (error) {
                    logger.error([moduleName, LOG_TAGS.Actor, "actor"], 'commandStart 监听器执行失败:', error);
                }
            }
        });
    }

    /**
     * 命令执行完成时调用
     * 通知所有注册的监听器
     */
    commandComplete(actorName: string, command: ICommand<any>,result?:Record<string, any>): void {
        logger.log([moduleName, LOG_TAGS.Actor, "actor"], `命令结束=>${actorName} ${command.commandName} [CID:${command.id}][RID:${command.requestId}][SID:${command.sessionId}]`)
        this.lifecycleListeners.forEach(listener => {
            if (listener.onCommandComplete) {
                try {
                    listener.onCommandComplete(actorName, command,result);
                } catch (error) {
                    logger.error([moduleName, LOG_TAGS.Actor, "actor"], 'commandComplete 监听器执行失败:', error);
                }
            }
        });
    }

    /**
     * 命令执行出错时调用
     * 通知所有注册的监听器
     */
    commandError(actorName: string, command: ICommand<any>, appError: AppError): void {
        logger.log([moduleName, LOG_TAGS.Actor, "actor"], `命令错误=>${actorName} ${command.commandName} [CID:${command.id}][RID:${command.requestId}][SID:${command.sessionId}] Error:${appError.message}`)
        this.lifecycleListeners.forEach(listener => {
            if (listener.onCommandError) {
                try {
                    listener.onCommandError(actorName, command, appError);
                } catch (err) {
                    logger.error([moduleName, LOG_TAGS.Actor, "actor"], 'commandError 监听器执行失败:', err);
                }
            }
        });
    }
}

/**
 * Actor 基类
 */
export abstract class IActor {
    // 缓存 methodMap，避免重复构建
    private methodMap?: Map<new (...args: any[]) => ICommand<any>, Function>;

    /**
     * 构建 methodMap：从装饰器中获取命令处理器
     */
    public buildMethodMap() {
        if (this.methodMap) return;

        // 从装饰器中获取处理器
        const decoratorHandlers = getCommandHandlers(this);
        if (decoratorHandlers && decoratorHandlers.size > 0) {
            this.methodMap = decoratorHandlers;
        }
    }

    /**
     * 统一的命令执行逻辑
     * 使用 async/await 替代 .then()/.catch()
     */
    public executeCommand(command: ICommand<any>): void {
        const handler = this.findHandler(command);
        if (!handler) {
            return;
        }

        const actorName = this.constructor.name;
        const actorSystem = ActorSystem.getInstance();

        //发射后不管,不需要并发控制
        actorSystem.commandStart(actorName, command);
        handler(command).then((result) => {
            actorSystem.commandComplete(actorName, command,result);
        }).catch((error: any) => {
            // 标准化错误
            const appError = this.normalizeError(error, command);
            actorSystem.commandError(actorName, command, appError);
        })
    }

    /**
     * 查找命令处理器
     */
    private findHandler(command: ICommand<any>): ((cmd: ICommand<any>) => Promise<Record<string, any>>) | null {
        for (const [clazz, method] of this.methodMap!) {
            if (command.commandName === clazz.name) {
                return method as (cmd: ICommand<any>) => Promise<Record<string, any>>;
            }
        }
        return null;
    }

    /**
     * 错误标准化
     * 将所有错误转换为 AppError
     */
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

/**
 * 系统命令错误定义
 */
export const SystemCommandErrors = {
    COMMAND_FORBIDDEN_ON_MASTER: {
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.HIGH,
        key: "command.forbidden.master.execute.slave.only",
        defaultMessage: "该命令只能在副设备上执行"
    },
    COMMAND_FORBIDDEN_ON_SLAVE: {
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.HIGH,
        key: "command.forbidden.slave.execute.master.only",
        defaultMessage: "该命令只能在主设备上执行"
    }
} as const;
