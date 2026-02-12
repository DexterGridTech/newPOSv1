import {RootState} from "../state/moduleState";
import {storeEntry} from "./storeEntry";
import {ValueWithUpdate} from "../shared/valueWithUpdate";

export abstract class KeyValue<T> {
    readonly stateName: keyof RootState;
    readonly key: string;
    readonly name: string;
    readonly defaultValue: T;

    protected constructor(stateName: keyof RootState, name: string, key: string, defaultValue: T) {
        this.stateName = stateName;
        this.name = name;
        this.key = key;
        this.defaultValue = defaultValue;
    }

    get value(): T {
        const state = storeEntry.state(this.stateName) as { [key: string]: ValueWithUpdate<T> };
        return (state[this.key]?.value) ?? this.defaultValue;
    }
}

enum CommandType {
    LowLevel = "LowLevel",
    HighLevel = "HighLevel"
}

abstract class Command<T> {
    readonly name: string
    readonly value: T
    readonly type: CommandType

    protected constructor(name: string, value: T, type: CommandType) {
        this.name = name;
        this.value = value;
        this.type = type;
    }

    run = (target: any): void => {
        // 实现具体的命令逻辑
    }
}

// 命令配置定义

// 创建命令类的工厂函数
// 通用的命令区域生成器
function createCommandZone<T extends Record<string, { valueType: any; commandType: CommandType }>>(
    config: T
): { [K in keyof T]: (value: T[K]['valueType']) => Command<T[K]['valueType']> } {
    // 创建命令类的工厂函数
    function createCommandClass<V>(name: string, type: CommandType) {
        return class extends Command<V> {
            constructor(value: V) {
                super(name, value, type);
            }
        };
    }

    const result: any = {};
    const classCache: any = {};

    for (const [name, commandConfig] of Object.entries(config)) {
        // 缓存命令类
        classCache[name] = createCommandClass(name, commandConfig.commandType);
        // 创建工厂函数
        result[name] = (value: any) => new classCache[name](value);
    }

    return result;
}

// 辅助类型：用于定义命令配置
type CommandConfig<T> = {
    valueType: T;
    commandType: CommandType;
}

// 类型推断辅助函数
function defineCommand<T>(commandType: CommandType): CommandConfig<T> {
    return {valueType: undefined as any as T, commandType};
}

// 使用配置对象生成 zone1Commands
const zone1Commands = createCommandZone({
    ACommand: defineCommand<string>(CommandType.LowLevel),
    BCommand: defineCommand<number>(CommandType.HighLevel),
});

// 使用示例
zone1Commands.ACommand("hello").run(""); // 自动创建 ACommand 实例

// 使用配置对象生成 zone2Commands
const zone2Commands = createCommandZone({
    CCommand: defineCommand<string>(CommandType.LowLevel),
    DCommand: defineCommand<number>(CommandType.HighLevel),
});

// 使用示例
zone2Commands.CCommand("hello").run(""); // 自动创建 ACommand 实例


const allZoneCommands = {...zone1Commands, ...zone2Commands}

const runFromOutside = (commandName: string, value: any, runArgs: any): void => {
    const commandFactory = allZoneCommands[commandName as keyof typeof allZoneCommands];
    if (!commandFactory) {
        console.error(`Command not found: ${commandName}`);
        return;
    }
    (commandFactory as any)(value).run(runArgs);
}

abstract class Actor {
    private _handlers?: Map<string, (command: Command<any>) => Promise<any>>;

    // 静态方法：创建命令处理器的辅助函数
    static defineHandler<T>(
        commandFactory: (value: T) => Command<T>,
        handler: (command: ReturnType<typeof commandFactory>) => Promise<any>
    ) {
        return {
            commandFactory,
            handler,
            // 用于识别
            __isCommandHandler: true
        };
    }

    // 自动扫描类的属性，查找通过 defineHandler 定义的处理器
    private getCommandHandlers(): Map<string, (command: Command<any>) => Promise<any>> {
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

    commandCome = async (command: Command<any>): Promise<void> => {
        const handlers = this.getCommandHandlers();
        const handler = handlers.get(command.name);

        if (handler) {
            await handler.call(this, command);
        } else {
            console.warn(`No handler found for command: ${command.name}`);
        }
    }
}

class ActorA extends Actor {
    handleACommand = Actor.defineHandler(zone1Commands.ACommand, (command): Promise<any> => {
        console.log(command.name);
        console.log(command.value.toUpperCase()); // 自动推断为 string
        return Promise.resolve();
    });

    processDCommand = Actor.defineHandler(zone2Commands.DCommand, (command): Promise<any> => {
        console.log(command.name);
        console.log(command.value.toFixed(2)); // 自动推断为 number
        return Promise.resolve();
    });

    anotherDCommand = Actor.defineHandler(zone2Commands.DCommand, (command): Promise<any> => {
        console.log('Another handler:', command.name);
        console.log(command.value.toFixed(2)); // 自动推断为 number
        return Promise.resolve();
    });
}

class ActorB extends Actor {
    onACommand = Actor.defineHandler(zone1Commands.ACommand, (command): Promise<any> => {
        console.log(command.name);
        console.log(command.value.toUpperCase()); // 自动推断为 string
        return Promise.resolve();
    });

    onBCommand = Actor.defineHandler(zone1Commands.BCommand, (command): Promise<any> => {
        console.log(command.name);
        console.log(command.value.toFixed(2)); // 自动推断为 number
        return Promise.resolve();
    });

    onCCommand = Actor.defineHandler(zone2Commands.CCommand, (command): Promise<any> => {
        console.log(command.name);
        console.log(command.value.toUpperCase()); // 自动推断为 string
        return Promise.resolve();
    });
}






