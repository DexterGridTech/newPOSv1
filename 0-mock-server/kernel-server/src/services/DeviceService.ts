/**
 * Device业务逻辑层
 */

import { DeviceRepository } from '../repositories/DeviceRepository';
import { UnitRepository } from '../repositories/UnitRepository';
import {
  Device, DeviceInfo, ActivateDeviceRequest, ActivateDeviceResponse,
  SetOperatingEntityRequest, DeactivateDeviceRequest
} from '../types';
import { validateRequired } from '../utils/validator';

export class DeviceService {
  private deviceRepository: DeviceRepository;
  private unitRepository: UnitRepository;

  constructor() {
    this.deviceRepository = new DeviceRepository();
    this.unitRepository = new UnitRepository();
  }

  /**
   * 激活设备
   */
  activate(data: ActivateDeviceRequest): ActivateDeviceResponse {
    // 参数校验
    const error = validateRequired(data, ['activeCode', 'device']);
    if (error) {
      throw new Error(error);
    }

    const deviceError = validateRequired(data.device, ['id', 'manufacturer', 'os', 'osVersion']);
    if (deviceError) {
      throw new Error(`device.${deviceError}`);
    }

    // 查找终端
    const terminal = this.unitRepository.findByActiveCode(data.activeCode);
    if (!terminal) {
      throw new Error('Invalid active code');
    }

    // 检查终端是否已绑定设备
    const existingDevice = this.deviceRepository.findByTerminalId(terminal.id);
    let device: Device;

    if (existingDevice) {
      // 终端已绑定设备，检查是否为同一设备
      if (existingDevice.id === data.device.id) {
        // 同一设备重复激活，返回原有信息
        device = existingDevice;
      } else {
        // 不同设备尝试绑定同一终端，拒绝
        throw new Error('Terminal already bound to another device');
      }
    } else {
      // 终端未绑定，创建新设备
      device = this.deviceRepository.create(data.device, terminal.id);
    }

    // 获取相关单元信息
    const model = this.unitRepository.findById(terminal.modelUnitId!)!;
    const hostEntity = this.unitRepository.findById(terminal.entityUnitId!)!;

    return {
      terminal: {
        id: terminal.id,
        name: terminal.name,
        key: terminal.key,
        type: terminal.type
      },
      model: {
        id: model.id,
        name: model.name,
        key: model.key,
        type: model.type
      },
      hostEntity: {
        id: hostEntity.id,
        name: hostEntity.name,
        key: hostEntity.key,
        type: hostEntity.type
      },
      token: device.token
    };
  }

  /**
   * 设置操作实体
   */
  setOperatingEntity(data: SetOperatingEntityRequest): Device {
    // 参数校验
    const error = validateRequired(data, ['deviceId', 'operatingEntityId']);
    if (error) {
      throw new Error(error);
    }

    // 验证设备存在
    const device = this.deviceRepository.findById(data.deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    // 验证操作实体存在
    const entity = this.unitRepository.findById(data.operatingEntityId);
    if (!entity) {
      throw new Error('Operating entity not found');
    }

    return this.deviceRepository.updateOperatingEntity(data.deviceId, data.operatingEntityId);
  }

  /**
   * 解绑设备
   */
  deactivate(data: DeactivateDeviceRequest): void {
    // 参数校验
    const error = validateRequired(data, ['deviceId', 'deactiveCode']);
    if (error) {
      throw new Error(error);
    }

    // 验证设备存在
    const device = this.deviceRepository.findById(data.deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    // 获取终端
    const terminal = this.unitRepository.findById(device.terminalId);
    if (!terminal) {
      throw new Error('Terminal not found');
    }

    // 验证解绑码
    if (terminal.deactiveCode !== data.deactiveCode) {
      throw new Error('Invalid deactive code');
    }

    // 删除设备
    this.deviceRepository.delete(data.deviceId);
  }

  /**
   * 根据ID查找设备
   */
  findById(id: string): Device | null {
    return this.deviceRepository.findById(id);
  }

  /**
   * 根据token查找设备
   */
  findByToken(token: string): Device | null {
    return this.deviceRepository.findByToken(token);
  }

  /**
   * 查找所有设备
   */
  findAll(): Device[] {
    return this.deviceRepository.findAll();
  }

  /**
   * 删除设备(管理后台使用)
   */
  delete(id: string): void {
    const device = this.deviceRepository.findById(id);
    if (!device) {
      throw new Error('Device not found');
    }

    this.deviceRepository.delete(id);
  }

  /**
   * 查找设备连接记录
   */
  findConnectionsByDeviceId(deviceId: string) {
    return this.deviceRepository.findConnectionsByDeviceId(deviceId);
  }

  /**
   * 检查设备是否在线
   */
  isDeviceOnline(deviceId: string): boolean {
    return this.deviceRepository.isDeviceOnline(deviceId);
  }
}
