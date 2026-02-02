/**
 * 管理后台路由
 */

import { Router, Request, Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import { UnitService } from '../../services/UnitService';
import { DeviceService } from '../../services/DeviceService';
import { UnitDataService } from '../../services/UnitDataService';
import { CommandService } from '../../services/CommandService';
import { getWebSocketService } from '../../services/WebSocketService';
import { success, error, notFound } from '../../utils/response';

const router: ExpressRouter = Router();

// 初始化服务
const unitService = new UnitService();
const deviceService = new DeviceService();
const unitDataService = new UnitDataService();
const commandService = new CommandService();
const wsService = getWebSocketService();

// ==================== Unit Routes ====================

// 获取所有单元
router.get('/units', (req: Request, res: Response) => {
  try {
    const type = req.query.type as string | undefined;
    const units = unitService.findAll(type as any);
    res.json(success(units));
  } catch (err: any) {
    res.json(error('INTERNAL_ERROR', err.message));
  }
});

// 获取根单元
router.get('/units/roots', (req: Request, res: Response) => {
  try {
    const type = req.query.type as string | undefined;
    const units = unitService.findRoots(type as any);
    res.json(success(units));
  } catch (err: any) {
    res.json(error('INTERNAL_ERROR', err.message));
  }
});

// 获取单元详情
router.get('/units/:id', (req: Request, res: Response) => {
  try {
    const unit = unitService.findById(req.params.id);
    if (!unit) {
      res.json(notFound('Unit'));
      return;
    }
    res.json(success(unit));
  } catch (err: any) {
    res.json(error('INTERNAL_ERROR', err.message));
  }
});

// 获取单元树
router.get('/units/:id/tree', (req: Request, res: Response) => {
  try {
    const tree = unitService.findTree(req.params.id);
    res.json(success(tree));
  } catch (err: any) {
    res.json(error('INTERNAL_ERROR', err.message));
  }
});

// 创建单元
router.post('/units', (req: Request, res: Response) => {
  try {
    const unit = unitService.create(req.body);
    res.json(success(unit));
  } catch (err: any) {
    res.json(error('INVALID_REQUEST', err.message));
  }
});

// 更新单元
router.put('/units/:id', (req: Request, res: Response) => {
  try {
    const unit = unitService.update(req.params.id, req.body);
    res.json(success(unit));
  } catch (err: any) {
    res.json(error('INVALID_REQUEST', err.message));
  }
});

// 删除单元
router.delete('/units/:id', (req: Request, res: Response) => {
  try {
    unitService.delete(req.params.id);
    res.json(success());
  } catch (err: any) {
    res.json(error('INVALID_REQUEST', err.message));
  }
});

// ==================== Device Routes ====================

// 获取所有设备
router.get('/devices', (req: Request, res: Response) => {
  try {
    const devices = deviceService.findAll();
    res.json(success(devices));
  } catch (err: any) {
    res.json(error('INTERNAL_ERROR', err.message));
  }
});

// 获取设备详情
router.get('/devices/:id', (req: Request, res: Response) => {
  try {
    const device = deviceService.findById(req.params.id);
    if (!device) {
      res.json(notFound('Device'));
      return;
    }
    res.json(success(device));
  } catch (err: any) {
    res.json(error('INTERNAL_ERROR', err.message));
  }
});

// 获取所有在线设备
router.get('/devices/online/list', (req: Request, res: Response) => {
  try {
    const onlineDevices = wsService.getOnlineDevices();
    res.json(success(onlineDevices));
  } catch (err: any) {
    res.json(error('INTERNAL_ERROR', err.message));
  }
});

// 获取设备连接状态
router.get('/devices/:id/connection', (req: Request, res: Response) => {
  try {
    const connections = deviceService.findConnectionsByDeviceId(req.params.id);
    res.json(success(connections));
  } catch (err: any) {
    res.json(error('INTERNAL_ERROR', err.message));
  }
});

// 解绑设备
router.post('/devices/:id/deactivate', (req: Request, res: Response) => {
  try {
    const { deactiveCode } = req.body;
    if (!deactiveCode) {
      res.json(error('INVALID_REQUEST', 'deactiveCode is required'));
      return;
    }
    deviceService.deactivate({
      deviceId: req.params.id,
      deactiveCode
    });
    res.json(success());
  } catch (err: any) {
    res.json(error('INVALID_REQUEST', err.message));
  }
});

// 删除设备
router.delete('/devices/:id', (req: Request, res: Response) => {
  try {
    deviceService.delete(req.params.id);
    res.json(success());
  } catch (err: any) {
    res.json(error('INVALID_REQUEST', err.message));
  }
});

// ==================== UnitDataGroup Routes ====================

router.get('/unit-data-groups', (req: Request, res: Response) => {
  try {
    const groups = unitDataService.findAllGroups();
    res.json(success(groups));
  } catch (err: any) {
    res.json(error('INTERNAL_ERROR', err.message));
  }
});

router.post('/unit-data-groups', (req: Request, res: Response) => {
  try {
    const group = unitDataService.createGroup(req.body);
    res.json(success(group));
  } catch (err: any) {
    res.json(error('INVALID_REQUEST', err.message));
  }
});

router.put('/unit-data-groups/:key', (req: Request, res: Response) => {
  try {
    const group = unitDataService.updateGroup(req.params.key, req.body);
    res.json(success(group));
  } catch (err: any) {
    res.json(error('INVALID_REQUEST', err.message));
  }
});

router.delete('/unit-data-groups/:key', (req: Request, res: Response) => {
  try {
    unitDataService.deleteGroup(req.params.key);
    res.json(success());
  } catch (err: any) {
    res.json(error('INVALID_REQUEST', err.message));
  }
});

// ==================== UnitDataItem Routes ====================

router.get('/unit-data-items', (req: Request, res: Response) => {
  try {
    const group = req.query.group as string | undefined;
    const items = unitDataService.findAllItems(group);
    res.json(success(items));
  } catch (err: any) {
    res.json(error('INTERNAL_ERROR', err.message));
  }
});

router.post('/unit-data-items', (req: Request, res: Response) => {
  try {
    const item = unitDataService.createItem(req.body);
    res.json(success(item));
  } catch (err: any) {
    res.json(error('INVALID_REQUEST', err.message));
  }
});

router.put('/unit-data-items/:id', (req: Request, res: Response) => {
  try {
    const item = unitDataService.updateItem(req.params.id, req.body);
    res.json(success(item));
  } catch (err: any) {
    res.json(error('INVALID_REQUEST', err.message));
  }
});

router.delete('/unit-data-items/:id', (req: Request, res: Response) => {
  try {
    unitDataService.deleteItem(req.params.id);
    res.json(success());
  } catch (err: any) {
    res.json(error('INVALID_REQUEST', err.message));
  }
});

// ==================== Template Routes ====================

router.get('/units/:unitId/templates', (req: Request, res: Response) => {
  try {
    const templates = unitDataService.findTemplatesByUnitId(req.params.unitId);
    res.json(success(templates));
  } catch (err: any) {
    res.json(error('INTERNAL_ERROR', err.message));
  }
});

router.post('/units/:unitId/templates', (req: Request, res: Response) => {
  try {
    const data = { ...req.body, unitId: req.params.unitId };
    const template = unitDataService.createTemplate(data);
    res.json(success(template));
  } catch (err: any) {
    res.json(error('INVALID_REQUEST', err.message));
  }
});

router.put('/templates/:id', (req: Request, res: Response) => {
  try {
    const template = unitDataService.updateTemplate(req.params.id, req.body);
    res.json(success(template));
  } catch (err: any) {
    res.json(error('INVALID_REQUEST', err.message));
  }
});

router.delete('/templates/:id', (req: Request, res: Response) => {
  try {
    unitDataService.deleteTemplate(req.params.id);
    res.json(success());
  } catch (err: any) {
    res.json(error('INVALID_REQUEST', err.message));
  }
});

// ==================== UnitData Routes ====================

router.get('/templates/:templateId/data', (req: Request, res: Response) => {
  try {
    const data = unitDataService.findDataByTemplateId(req.params.templateId);
    res.json(success(data));
  } catch (err: any) {
    res.json(error('INTERNAL_ERROR', err.message));
  }
});

router.post('/templates/:templateId/data', (req: Request, res: Response) => {
  try {
    // 获取template信息,从中提取unitId和unitType
    const template = unitDataService.findTemplateById(req.params.templateId);
    if (!template) {
      return res.json(error('INVALID_REQUEST', 'Template not found'));
    }

    const data = {
      ...req.body,
      templateId: req.params.templateId,
      unitId: template.unitId,
      unitType: template.unitType,
    };
    const unitData = unitDataService.createData(data);
    res.json(success(unitData));
  } catch (err: any) {
    res.json(error('INVALID_REQUEST', err.message));
  }
});

router.put('/unit-data/:id', (req: Request, res: Response) => {
  try {
    const data = unitDataService.updateData(req.params.id, req.body);
    res.json(success(data));
  } catch (err: any) {
    res.json(error('INVALID_REQUEST', err.message));
  }
});

router.delete('/unit-data/:id', (req: Request, res: Response) => {
  try {
    unitDataService.deleteData(req.params.id);
    res.json(success());
  } catch (err: any) {
    res.json(error('INVALID_REQUEST', err.message));
  }
});

// ==================== CommandItem Routes ====================

router.get('/command-items', (req: Request, res: Response) => {
  try {
    const items = commandService.findAllItems();
    res.json(success(items));
  } catch (err: any) {
    res.json(error('INTERNAL_ERROR', err.message));
  }
});

router.post('/command-items', (req: Request, res: Response) => {
  try {
    const item = commandService.createItem(req.body);
    res.json(success(item));
  } catch (err: any) {
    res.json(error('INVALID_REQUEST', err.message));
  }
});

router.put('/command-items/:id', (req: Request, res: Response) => {
  try {
    const item = commandService.updateItem(req.params.id, req.body);
    res.json(success(item));
  } catch (err: any) {
    res.json(error('INVALID_REQUEST', err.message));
  }
});

router.delete('/command-items/:id', (req: Request, res: Response) => {
  try {
    commandService.deleteItem(req.params.id);
    res.json(success());
  } catch (err: any) {
    res.json(error('INVALID_REQUEST', err.message));
  }
});

// ==================== Command Routes ====================

router.post('/devices/:deviceId/commands', (req: Request, res: Response) => {
  try {
    const deviceId = req.params.deviceId;

    // 检查设备是否存在
    const device = deviceService.findById(deviceId);
    if (!device) {
      res.json(notFound('Device'));
      return;
    }

    // 检查设备是否在线
    if (!wsService.isConnected(deviceId)) {
      res.json(error('DEVICE_OFFLINE', 'Device is not connected'));
      return;
    }

    // 创建指令
    const command = commandService.createCommand(req.body.commandItemId, req.body);

    // 获取指令项信息
    const commandItem = commandService.findItemById(req.body.commandItemId);
    if (!commandItem) {
      res.json(error('NOT_FOUND', 'CommandItem not found'));
      return;
    }

    // 通过WebSocket发送指令（平铺commandItem属性，忽略defaultPayload）
    const sendSuccess = wsService.pushRemoteCommand(deviceId, {
      commandId: command.id,
      commandItemId: commandItem.id,
      commandItemName: commandItem.name,
      type: commandItem.type,
      valid: commandItem.valid,
      payload: command.payload ? JSON.parse(command.payload) : null,
      requestId: command.requestId,
      sessionId: command.sessionId,
      createdAt: commandItem.createdAt,
      updatedAt: commandItem.updatedAt
    });

    // 创建指令记录
    const record = commandService.createRecord(command.id, deviceId, sendSuccess);

    res.json(success({
      command,
      record,
      sent: sendSuccess
    }));
  } catch (err: any) {
    res.json(error('INVALID_REQUEST', err.message));
  }
});

router.get('/devices/:deviceId/command-records', (req: Request, res: Response) => {
  try {
    const records = commandService.findRecordsByDeviceId(req.params.deviceId);
    res.json(success(records));
  } catch (err: any) {
    res.json(error('INTERNAL_ERROR', err.message));
  }
});

// ==================== 删除指令记录 ====================
router.delete('/command-records/:id', (req: Request, res: Response) => {
  try {
    commandService.deleteRecord(req.params.id);
    res.json(success());
  } catch (err: any) {
    res.json(error('INVALID_REQUEST', err.message));
  }
});

export default router;
