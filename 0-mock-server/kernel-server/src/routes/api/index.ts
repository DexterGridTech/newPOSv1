/**
 * 设备API路由
 */

import { Router, Request, Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import { DeviceService } from '../../services/DeviceService';
import { CommandService } from '../../services/CommandService';
import { DataSyncService } from '../../services/DataSyncService';
import { tokenAuth } from '../../middlewares/tokenAuth';
import { success, error } from '../../utils/response';

const router: ExpressRouter = Router();

const deviceService = new DeviceService();
const commandService = new CommandService();
const dataSyncService = new DataSyncService();

// ==================== 设备激活 ====================
router.post('/device/activate', (req: Request, res: Response) => {
  try {
    console.log('[API] Device activation request:', {
      activeCode: req.body.activeCode,
      deviceInfo: req.body.deviceInfo
    });

    const result = deviceService.activate(req.body);

    console.log('[API] Device activated successfully');
    res.json(success(result));
  } catch (err: any) {
    console.error('[API] Device activation failed:', err.message);
    res.json(error('ACTIVATION_FAILED', err.message));
  }
});

// ==================== 设置操作实体 ====================
router.post('/device/operating-entity', tokenAuth, (req: Request, res: Response) => {
  try {
    console.log('[API] Set operating entity request:', {
      deviceId: req.body.deviceId,
      entityId: req.body.entityId
    });

    const device = deviceService.setOperatingEntity(req.body);

    console.log('[API] Operating entity set successfully');
    res.json(success(device));
  } catch (err: any) {
    console.error('[API] Set operating entity failed:', err.message);
    res.json(error('INVALID_REQUEST', err.message));
  }
});

// ==================== 解绑设备 ====================
router.post('/device/deactivate', (req: Request, res: Response) => {
  try {
    console.log('[API] Device deactivation request:', {
      deviceId: req.body.deviceId,
      deactiveCode: req.body.deactiveCode
    });

    deviceService.deactivate(req.body);

    console.log('[API] Device deactivated successfully');
    res.json(success());
  } catch (err: any) {
    console.error('[API] Device deactivation failed:', err.message);
    res.json(error('DEACTIVATION_FAILED', err.message));
  }
});

// ==================== 确认指令接收 ====================
router.post('/command/confirm', tokenAuth, (req: Request, res: Response) => {
  try {
    console.log('[API] Command confirmation request:', req.body.commandId);

    const record = commandService.confirmCommand(req.body);

    console.log('[API] Command confirmed successfully');
    res.json(success(record));
  } catch (err: any) {
    console.error('[API] Command confirmation failed:', err.message);
    res.json(error('INVALID_REQUEST', err.message));
  }
});

// ==================== 获取单元数据 ====================
router.post('/unit-data/by-group', tokenAuth, (req: Request, res: Response) => {
  try {
    console.log('[API] Get unit data request:', {
      deviceId: req.body.deviceId,
      group: req.body.group,
      clientDataCount: req.body.data?.length || 0
    });

    const result = dataSyncService.getUnitDataByGroup(req.body);

    console.log('[API] Unit data retrieved successfully:', {
      updated: result.updated.length,
      deleted: result.deleted.length
    });

    res.json(success(result));
  } catch (err: any) {
    console.error('[API] Get unit data failed:', err.message);
    res.json(error('INVALID_REQUEST', err.message));
  }
});

// ==================== 发送设备状态 ====================
router.post('/device/state', tokenAuth, async (req: Request, res: Response) => {
  try {
    console.log('[API] Send device state request:', {
      deviceId: req.body.deviceId,
      stateSize: JSON.stringify(req.body.state || {}).length
    });

    const { deviceId, state } = req.body;

    if (!deviceId) {
      throw new Error('deviceId is required');
    }

    if (!state) {
      throw new Error('state is required');
    }

    // 通过WebSocket广播设备状态更新事件
    const { getWebSocketService } = await import('../../services/WebSocketService.js');
    const wsService = getWebSocketService();
    wsService.broadcastDeviceState(deviceId, state);

    console.log('[API] Device state sent successfully');
    res.json(success({ deviceId, receivedAt: Date.now() }));
  } catch (err: any) {
    console.error('[API] Send device state failed:', err.message);
    res.json(error('INVALID_REQUEST', err.message));
  }
});

export default router;
