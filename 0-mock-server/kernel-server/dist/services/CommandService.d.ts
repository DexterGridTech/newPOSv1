/**
 * Command业务逻辑层
 */
import { CommandItem, Command, CommandRecord, CreateCommandItemRequest, UpdateCommandItemRequest, SendCommandRequest, CommandConfirmRequest } from '../types';
export declare class CommandService {
    private commandRepository;
    constructor();
    createItem(data: CreateCommandItemRequest): CommandItem;
    findItemById(id: string): CommandItem | null;
    findAllItems(): CommandItem[];
    updateItem(id: string, data: UpdateCommandItemRequest): CommandItem;
    deleteItem(id: string): void;
    /**
     * 创建并发送指令
     */
    createCommand(itemId: string, data: SendCommandRequest): Command;
    findCommandById(id: string): Command | null;
    createRecord(commandId: string, deviceId: string, sendResult: boolean): CommandRecord;
    findRecordsByDeviceId(deviceId: string): CommandRecord[];
    /**
     * 确认指令接收
     */
    confirmCommand(data: CommandConfirmRequest): CommandRecord;
    /**
     * 删除指令记录
     */
    deleteRecord(id: string): void;
}
//# sourceMappingURL=CommandService.d.ts.map