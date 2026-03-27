/**
 * Command业务逻辑层
 */

import { CommandRepository } from '../repositories/CommandRepository';
import {
  CommandItem, Command, CommandRecord,
  CreateCommandItemRequest, UpdateCommandItemRequest,
  SendCommandRequest, CommandConfirmRequest
} from '../types';
import { validateRequired, validateJSON } from '../utils/validator';

export class CommandService {
  private commandRepository: CommandRepository;

  constructor() {
    this.commandRepository = new CommandRepository();
  }

  // ==================== CommandItem ====================

  createItem(data: CreateCommandItemRequest): CommandItem {
    const error = validateRequired(data, ['name', 'type']);
    if (error) throw new Error(error);

    if (data.defaultPayload) {
      const jsonError = validateJSON(data.defaultPayload, 'defaultPayload');
      if (jsonError) throw new Error(jsonError);
    }

    return this.commandRepository.createItem(data);
  }

  findItemById(id: string): CommandItem | null {
    return this.commandRepository.findItemById(id);
  }

  findAllItems(): CommandItem[] {
    return this.commandRepository.findAllItems();
  }

  updateItem(id: string, data: UpdateCommandItemRequest): CommandItem {
    const item = this.commandRepository.findItemById(id);
    if (!item) throw new Error('CommandItem not found');

    if (data.defaultPayload) {
      const jsonError = validateJSON(data.defaultPayload, 'defaultPayload');
      if (jsonError) throw new Error(jsonError);
    }

    return this.commandRepository.updateItem(id, data);
  }

  deleteItem(id: string): void {
    this.commandRepository.deleteItem(id);
  }

  // ==================== Command ====================

  /**
   * 创建并发送指令
   */
  createCommand(itemId: string, data: SendCommandRequest): Command {
    const error = validateRequired(data, ['commandItemId']);
    if (error) throw new Error(error);

    if (data.payload) {
      const jsonError = validateJSON(data.payload, 'payload');
      if (jsonError) throw new Error(jsonError);
    }

    return this.commandRepository.createCommand(itemId, data);
  }

  findCommandById(id: string): Command | null {
    return this.commandRepository.findCommandById(id);
  }

  // ==================== CommandRecord ====================

  createRecord(commandId: string, deviceId: string, sendResult: boolean): CommandRecord {
    return this.commandRepository.createRecord(commandId, deviceId, sendResult);
  }

  findRecordsByDeviceId(deviceId: string): CommandRecord[] {
    return this.commandRepository.findRecordsByDeviceId(deviceId);
  }

  /**
   * 确认指令接收
   */
  confirmCommand(data: CommandConfirmRequest): CommandRecord {
    const error = validateRequired(data, ['commandId']);
    if (error) throw new Error(error);

    return this.commandRepository.updateRecordReceiveResult(data.commandId, true);
  }

  /**
   * 删除指令记录
   */
  deleteRecord(id: string): void {
    this.commandRepository.deleteRecord(id);
  }
}
