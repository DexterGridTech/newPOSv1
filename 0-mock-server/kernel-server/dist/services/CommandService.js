/**
 * Command业务逻辑层
 */
import { CommandRepository } from '../repositories/CommandRepository';
import { validateRequired, validateJSON } from '../utils/validator';
export class CommandService {
    commandRepository;
    constructor() {
        this.commandRepository = new CommandRepository();
    }
    // ==================== CommandItem ====================
    createItem(data) {
        const error = validateRequired(data, ['name', 'type']);
        if (error)
            throw new Error(error);
        if (data.defaultPayload) {
            const jsonError = validateJSON(data.defaultPayload, 'defaultPayload');
            if (jsonError)
                throw new Error(jsonError);
        }
        return this.commandRepository.createItem(data);
    }
    findItemById(id) {
        return this.commandRepository.findItemById(id);
    }
    findAllItems() {
        return this.commandRepository.findAllItems();
    }
    updateItem(id, data) {
        const item = this.commandRepository.findItemById(id);
        if (!item)
            throw new Error('CommandItem not found');
        if (data.defaultPayload) {
            const jsonError = validateJSON(data.defaultPayload, 'defaultPayload');
            if (jsonError)
                throw new Error(jsonError);
        }
        return this.commandRepository.updateItem(id, data);
    }
    deleteItem(id) {
        this.commandRepository.deleteItem(id);
    }
    // ==================== Command ====================
    /**
     * 创建并发送指令
     */
    createCommand(itemId, data) {
        const error = validateRequired(data, ['commandItemId']);
        if (error)
            throw new Error(error);
        if (data.payload) {
            const jsonError = validateJSON(data.payload, 'payload');
            if (jsonError)
                throw new Error(jsonError);
        }
        return this.commandRepository.createCommand(itemId, data);
    }
    findCommandById(id) {
        return this.commandRepository.findCommandById(id);
    }
    // ==================== CommandRecord ====================
    createRecord(commandId, deviceId, sendResult) {
        return this.commandRepository.createRecord(commandId, deviceId, sendResult);
    }
    findRecordsByDeviceId(deviceId) {
        return this.commandRepository.findRecordsByDeviceId(deviceId);
    }
    /**
     * 确认指令接收
     */
    confirmCommand(data) {
        const error = validateRequired(data, ['commandId']);
        if (error)
            throw new Error(error);
        return this.commandRepository.updateRecordReceiveResult(data.commandId, true);
    }
    /**
     * 删除指令记录
     */
    deleteRecord(id) {
        this.commandRepository.deleteRecord(id);
    }
}
//# sourceMappingURL=CommandService.js.map