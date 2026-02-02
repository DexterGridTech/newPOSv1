import {ICommand} from "./command";

/**
 * 命令处理器装饰器的元数据键
 */
const COMMAND_HANDLERS_KEY = Symbol('commandHandlers');

/**
 * 命令处理器装饰器
 *
 * 用于标记 Actor 中的命令处理方法，自动注册到命令处理器映射中
 *
 * @example
 * ```typescript
 * class MyActor extends IActor {
 *     @CommandHandler(InitializeCommand)
 *     @CommandHandler(StartCommand)
 *     private async handleInit(command: ICommand<any>) {
 *         // 处理逻辑
 *     }
 * }
 * ```
 *
 * @param commandClass 命令类构造函数
 */
export function CommandHandler<T extends ICommand<any>>(
    commandClass: new (...args: any[]) => T
) {
    return function (
        target: any,
        propertyKey: string,
        descriptor?: PropertyDescriptor
    ): any {
        // 获取或创建命令处理器映射
        if (!target[COMMAND_HANDLERS_KEY]) {
            target[COMMAND_HANDLERS_KEY] = new Map();
        }

        // 注册命令处理器
        const handlers = target[COMMAND_HANDLERS_KEY] as Map<
            new (...args: any[]) => ICommand<any>,
            string
        >;

        handlers.set(commandClass, propertyKey);

        // 返回 descriptor 以兼容 TypeScript 5.x
        return descriptor;
    };
}

/**
 * 获取类实例上注册的所有命令处理器
 *
 * @param instance Actor 实例
 * @returns 命令处理器映射
 */
export function getCommandHandlers(
    instance: any
): Map<new (...args: any[]) => ICommand<any>, Function> | null {
    const prototype = Object.getPrototypeOf(instance);
    const handlerMap = prototype[COMMAND_HANDLERS_KEY];

    if (!handlerMap) {
        return null;
    }

    // 将方法名映射转换为实际的方法引用
    const handlers = new Map<new (...args: any[]) => ICommand<any>, Function>();

    for (const [commandClass, methodName] of handlerMap.entries()) {
        const method = instance[methodName];
        if (method && typeof method === 'function') {
            // 绑定 this 上下文
            handlers.set(commandClass, method.bind(instance));
        }
    }

    return handlers;
}
