/**
 * 管理后台路由
 */
import { Router } from 'express';
import { UnitService } from '../../services/UnitService';
import { DeviceService } from '../../services/DeviceService';
import { UnitDataService } from '../../services/UnitDataService';
import { CommandService } from '../../services/CommandService';
import { getWebSocketService } from '../../services/WebSocketService';
import { success, error, notFound } from '../../utils/response';
const router = Router();
// 初始化服务
const unitService = new UnitService();
const deviceService = new DeviceService();
const unitDataService = new UnitDataService();
const commandService = new CommandService();
const wsService = getWebSocketService();
// ==================== Unit Routes ====================
// 获取所有单元
router.get('/units', (req, res) => {
    try {
        const type = req.query.type;
        const units = unitService.findAll(type);
        res.json(success(units));
    }
    catch (err) {
        res.json(error('INTERNAL_ERROR', err.message));
    }
});
// 获取根单元
router.get('/units/roots', (req, res) => {
    try {
        const type = req.query.type;
        const units = unitService.findRoots(type);
        res.json(success(units));
    }
    catch (err) {
        res.json(error('INTERNAL_ERROR', err.message));
    }
});
// 获取单元详情
router.get('/units/:id', (req, res) => {
    try {
        const unit = unitService.findById(req.params.id);
        if (!unit) {
            res.json(notFound('Unit'));
            return;
        }
        res.json(success(unit));
    }
    catch (err) {
        res.json(error('INTERNAL_ERROR', err.message));
    }
});
// 获取单元树
router.get('/units/:id/tree', (req, res) => {
    try {
        const tree = unitService.findTree(req.params.id);
        res.json(success(tree));
    }
    catch (err) {
        res.json(error('INTERNAL_ERROR', err.message));
    }
});
// 创建单元
router.post('/units', (req, res) => {
    try {
        const unit = unitService.create(req.body);
        res.json(success(unit));
    }
    catch (err) {
        res.json(error('INVALID_REQUEST', err.message));
    }
});
// 更新单元
router.put('/units/:id', (req, res) => {
    try {
        const unit = unitService.update(req.params.id, req.body);
        res.json(success(unit));
    }
    catch (err) {
        res.json(error('INVALID_REQUEST', err.message));
    }
});
// 删除单元
router.delete('/units/:id', (req, res) => {
    try {
        unitService.delete(req.params.id);
        res.json(success());
    }
    catch (err) {
        res.json(error('INVALID_REQUEST', err.message));
    }
});
// ==================== Device Routes ====================
// 获取所有设备
router.get('/devices', (req, res) => {
    try {
        const devices = deviceService.findAll();
        res.json(success(devices));
    }
    catch (err) {
        res.json(error('INTERNAL_ERROR', err.message));
    }
});
// 获取设备详情
router.get('/devices/:id', (req, res) => {
    try {
        const device = deviceService.findById(req.params.id);
        if (!device) {
            res.json(notFound('Device'));
            return;
        }
        res.json(success(device));
    }
    catch (err) {
        res.json(error('INTERNAL_ERROR', err.message));
    }
});
// 获取所有在线设备
router.get('/devices/online/list', (req, res) => {
    try {
        const onlineDevices = wsService.getOnlineDevices();
        res.json(success(onlineDevices));
    }
    catch (err) {
        res.json(error('INTERNAL_ERROR', err.message));
    }
});
// 获取设备连接状态
router.get('/devices/:id/connection', (req, res) => {
    try {
        const connections = deviceService.findConnectionsByDeviceId(req.params.id);
        res.json(success(connections));
    }
    catch (err) {
        res.json(error('INTERNAL_ERROR', err.message));
    }
});
// 解绑设备
router.post('/devices/:id/deactivate', (req, res) => {
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
    }
    catch (err) {
        res.json(error('INVALID_REQUEST', err.message));
    }
});
// 删除设备
router.delete('/devices/:id', (req, res) => {
    try {
        deviceService.delete(req.params.id);
        res.json(success());
    }
    catch (err) {
        res.json(error('INVALID_REQUEST', err.message));
    }
});
// ==================== UnitData Routes ====================
// 获取单元的所有数据
router.get('/units/:unitId/data', (req, res) => {
    try {
        const data = unitDataService.findDataByUnitId(req.params.unitId);
        res.json(success(data));
    }
    catch (err) {
        res.json(error('INTERNAL_ERROR', err.message));
    }
});
// 创建单元数据
router.post('/units/:unitId/data', (req, res) => {
    try {
        const unitData = unitDataService.createData({
            ...req.body,
            unitId: req.params.unitId
        });
        res.json(success(unitData));
    }
    catch (err) {
        res.json(error('INVALID_REQUEST', err.message));
    }
});
// 更新单元数据
router.put('/unit-data/:id', (req, res) => {
    try {
        const data = unitDataService.updateData(req.params.id, req.body);
        res.json(success(data));
    }
    catch (err) {
        res.json(error('INVALID_REQUEST', err.message));
    }
});
// 删除单元数据
router.delete('/unit-data/:id', (req, res) => {
    try {
        unitDataService.deleteData(req.params.id);
        res.json(success());
    }
    catch (err) {
        res.json(error('INVALID_REQUEST', err.message));
    }
});
// ==================== CommandItem Routes ====================
router.get('/command-items', (req, res) => {
    try {
        const items = commandService.findAllItems();
        res.json(success(items));
    }
    catch (err) {
        res.json(error('INTERNAL_ERROR', err.message));
    }
});
router.post('/command-items', (req, res) => {
    try {
        const item = commandService.createItem(req.body);
        res.json(success(item));
    }
    catch (err) {
        res.json(error('INVALID_REQUEST', err.message));
    }
});
router.put('/command-items/:id', (req, res) => {
    try {
        const item = commandService.updateItem(req.params.id, req.body);
        res.json(success(item));
    }
    catch (err) {
        res.json(error('INVALID_REQUEST', err.message));
    }
});
router.delete('/command-items/:id', (req, res) => {
    try {
        commandService.deleteItem(req.params.id);
        res.json(success());
    }
    catch (err) {
        res.json(error('INVALID_REQUEST', err.message));
    }
});
// ==================== Command Routes ====================
router.post('/devices/:deviceId/commands', async (req, res) => {
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
        const sendSuccess = await wsService.pushRemoteCommand(deviceId, {
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
    }
    catch (err) {
        res.json(error('INVALID_REQUEST', err.message));
    }
});
router.get('/devices/:deviceId/command-records', (req, res) => {
    try {
        const records = commandService.findRecordsByDeviceId(req.params.deviceId);
        res.json(success(records));
    }
    catch (err) {
        res.json(error('INTERNAL_ERROR', err.message));
    }
});
// ==================== 删除指令记录 ====================
router.delete('/command-records/:id', (req, res) => {
    try {
        commandService.deleteRecord(req.params.id);
        res.json(success());
    }
    catch (err) {
        res.json(error('INVALID_REQUEST', err.message));
    }
});
export default router;
//# sourceMappingURL=index.js.map