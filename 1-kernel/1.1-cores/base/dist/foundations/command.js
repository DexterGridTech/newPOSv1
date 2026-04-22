import { Subject } from "rxjs";
import { shortId } from "./idGenerator";
import { INTERNAL } from "../types/shared/command";
export const commandBus = new Subject();
const allCommands = {};
export const registerModuleCommands = (moduleName, commands) => {
    Object.keys(commands).forEach(commandName => {
        const fullCommandName = `${moduleName}.${commandName}`;
        if (allCommands.hasOwnProperty(fullCommandName)) {
            throw new Error(`Command ${fullCommandName} has been registered`);
        }
        allCommands[fullCommandName] = commands[commandName];
    });
};
export const getCommandByName = (commandName, payload) => {
    const factory = allCommands[commandName];
    if (!factory) {
        throw new Error(`Command not found: ${commandName}`);
    }
    return factory(payload);
};
export class Command {
    id = shortId();
    timestamp = Date.now();
    payload;
    requestId;
    sessionId;
    extra = {};
    ancestors = new Map();
    printId() {
        return `${this.commandName}[CID:${this.id},RID:${this.requestId},SID:${this.sessionId}]`;
    }
    constructor(payload) {
        this.payload = payload;
    }
    getCommandName() {
        return this.commandName;
    }
    withExtra(extra) {
        this.extra = { ...this.extra, ...extra };
        return this;
    }
    execute(requestId, sessionId) {
        this.requestId = requestId;
        this.sessionId = sessionId;
        commandBus.next(this);
    }
    executeInternally() {
        return this.execute(INTERNAL, INTERNAL);
    }
    executeFromParent(parent) {
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
        this.extra = { ...parent.extra };
        commandBus.next(this);
    }
}
// 类型推断辅助函数
export function defineCommand() {
    return { payloadType: undefined };
}
// 通用的命令区域生成器
export function createModuleCommands(moduleName, config) {
    function createCommandClass(key, moduleName) {
        const fullCommandName = `${moduleName}.${key}`;
        return class extends Command {
            commandName = fullCommandName;
            constructor(payload) {
                super(payload);
            }
        };
    }
    const result = {};
    const classCache = {};
    for (const [key, commandConfig] of Object.entries(config)) {
        // 缓存命令类
        classCache[key] = createCommandClass(key, moduleName);
        // 创建工厂函数
        result[key] = (payload) => new classCache[key](payload);
    }
    return result;
}
