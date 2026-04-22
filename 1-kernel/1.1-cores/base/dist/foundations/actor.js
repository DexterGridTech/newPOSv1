import { moduleName } from "../moduleName";
import { commandBus } from "./command";
import { AppError } from "./error";
import { LOG_TAGS } from "../types";
import { logger } from "./adapters/logger";
import { DefinedErrorMessage, ErrorCategory, ErrorSeverity } from "./errorMessages";
export class Actor {
    actorName;
    moduleName;
    _handlers;
    printName = () => `${this.moduleName}.${this.actorName}`;
    constructor(actorName, moduleName) {
        this.actorName = actorName;
        this.moduleName = moduleName;
    }
    // 静态方法：创建命令处理器的辅助函数
    static defineCommandHandler(commandFactory, handler) {
        return {
            commandFactory,
            handler,
            // 用于识别
            __isCommandHandler: true
        };
    }
    // 自动扫描类的属性，查找通过 defineHandler 定义的处理器
    getCommandHandlers() {
        if (!this._handlers) {
            this._handlers = new Map();
            // 遍历实例的所有属性
            Object.keys(this).forEach(key => {
                const prop = this[key];
                // 检查是否是通过 defineHandler 创建的处理器
                if (prop && prop.__isCommandHandler) {
                    const tempCommand = prop.commandFactory(null);
                    const commandName = tempCommand.commandName;
                    // 检查是否已经存在该命令的处理器
                    if (this._handlers.has(commandName)) {
                        throw new Error(`Duplicate handler for command: ${commandName} in ${this.constructor.name}`);
                    }
                    this._handlers.set(commandName, prop.handler.bind(this));
                }
            });
        }
        return this._handlers;
    }
    executeCommand = (command) => {
        const handler = this.getCommandHandlers().get(command.commandName);
        if (handler) {
            const actorSystem = ActorSystem.getInstance();
            //发射后不管,不需要并发控制
            actorSystem.commandStart(this, command);
            handler(command).then((result) => {
                actorSystem.commandComplete(this, command, result);
            }).catch((error) => {
                // 标准化错误
                const appError = this.normalizeError(error, command);
                actorSystem.commandError(this, command, appError);
            });
        }
    };
    normalizeError(error, command) {
        if (error instanceof AppError) {
            return error;
        }
        const definedErrorMessage = new DefinedErrorMessage(ErrorCategory.SYSTEM, ErrorSeverity.MEDIUM, "COMMAND_EXECUTION_FAILED", 'ERR_COMMAND_EXECUTION_FAILED', error.message || '命令执行失败');
        // 将普通错误转换为 AppError
        return new AppError(definedErrorMessage, '', command);
    }
}
export class ActorSystem {
    static instance;
    actors = [];
    lifecycleListeners = [];
    commandConverters = [];
    static getInstance() {
        if (!ActorSystem.instance) {
            ActorSystem.instance = new ActorSystem();
            commandBus.subscribe(command => {
                ActorSystem.instance.runCommand(command);
            });
        }
        return ActorSystem.instance;
    }
    registerLifecycleListener(listener) {
        this.lifecycleListeners.push(listener);
    }
    registerCommandConverter(converter) {
        this.commandConverters.push(converter);
    }
    registerActor(actor) {
        this.actors.push(actor);
    }
    runCommand(command) {
        const commandToExecute = this.commandConverters.reduce((prev, converter) => converter.convertCommand(prev), command);
        logger.log([moduleName, LOG_TAGS.System, "ActorSystem"], `收到并准备执行命令${commandToExecute.commandName}`, commandToExecute);
        this.actors.forEach(actor => actor.executeCommand(commandToExecute));
    }
    commandStart(actor, command) {
        logger.log([moduleName, LOG_TAGS.System, "ActorSystem"], `命令开始=>${actor.printName()}执行${command.printId()}`);
        this.lifecycleListeners.forEach(listener => {
            if (listener.onCommandStart) {
                try {
                    listener.onCommandStart(actor, command);
                }
                catch (error) {
                    logger.error([moduleName, LOG_TAGS.System, "ActorSystem"], 'commandStart 监听器执行失败:', error);
                }
            }
        });
    }
    commandComplete(actor, command, result) {
        logger.log([moduleName, LOG_TAGS.System, "ActorSystem"], `命令结束=>${actor.printName()}结束执行${command.printId()}`);
        this.lifecycleListeners.forEach(listener => {
            if (listener.onCommandComplete) {
                try {
                    listener.onCommandComplete(actor, command, result);
                }
                catch (error) {
                    logger.error([moduleName, LOG_TAGS.System, "ActorSystem"], 'commandComplete 监听器执行失败:', error);
                }
            }
        });
    }
    commandError(actor, command, appError) {
        logger.error([moduleName, LOG_TAGS.System, "ActorSystem"], `命令错误=>${actor.printName()}执行错误${command.printId()},${appError.message}`);
        this.lifecycleListeners.forEach(listener => {
            if (listener.onCommandError) {
                try {
                    listener.onCommandError(actor, command, appError);
                }
                catch (err) {
                    logger.error([moduleName, LOG_TAGS.System, "ActorSystem"], 'commandError 监听器执行失败:', err);
                }
            }
        });
    }
}
export function createActors(moduleName, actorClasses) {
    const actors = {};
    for (const actorName in actorClasses) {
        const ActorClass = actorClasses[actorName];
        actors[actorName] = new ActorClass(actorName, moduleName);
    }
    return actors;
}
