/**
 * Command数据访问层
 */
import { CommandItem, Command, CommandRecord, CreateCommandItemRequest, UpdateCommandItemRequest, SendCommandRequest } from '../types';
export declare class CommandRepository {
    /**
     * 创建指令项
     */
    createItem(data: CreateCommandItemRequest): CommandItem;
    /**
     * 根据ID查找指令项
     */
    findItemById(id: string): CommandItem | null;
    /**
     * 查找所有指令项
     */
    findAllItems(): CommandItem[];
    /**
     * 更新指令项
     */
    updateItem(id: string, data: UpdateCommandItemRequest): CommandItem;
    /**
     * 删除指令项
     */
    deleteItem(id: string): void;
    /**
     * 创建指令
     */
    createCommand(itemId: string, data: SendCommandRequest): Command;
    /**
     * 根据ID查找指令
     */
    findCommandById(id: string): Command | null;
    /**
     * 创建指令记录
     */
    createRecord(commandId: string, deviceId: string, sendResult: boolean): CommandRecord;
    /**
     * 根据ID查找指令记录
     */
    findRecordById(id: string): CommandRecord | null;
    /**
     * 根据commandId查找指令记录
     */
    findRecordByCommandId(commandId: string): CommandRecord | null;
    /**
     * 根据deviceId查找指令记录
     */
    findRecordsByDeviceId(deviceId: string): CommandRecord[];
    /**
     * 更新指令接收结果
     */
    updateRecordReceiveResult(commandId: string, receiveResult: boolean): CommandRecord;
    /**
     * 删除指令记录
     */
    deleteRecord(id: string): void;
    private mapToItem;
    private mapToCommand;
    private mapToRecord;
}
//# sourceMappingURL=CommandRepository.d.ts.map