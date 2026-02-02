import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Modal, Table, Column, StatusLight, JsonTooltip, SearchBar } from '../components/common';
import { CommandItem, Device, CommandRecord } from '../types';

/**
 * 指令管理页面
 * 包含指令项管理和指令发送功能
 */
export function CommandManagement() {
  const [commandItems, setCommandItems] = useState<CommandItem[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [commandRecords, setCommandRecords] = useState<CommandRecord[]>([]);
  const [searchText, setSearchText] = useState<string>('');

  // Modal states
  const [showItemModal, setShowItemModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CommandItem | null>(null);

  useEffect(() => {
    loadCommandItems();
    loadDevices();
  }, []);

  useEffect(() => {
    if (selectedDevice) {
      loadCommandRecords(selectedDevice.id);
    }
  }, [selectedDevice]);

  const loadCommandItems = async () => {
    try {
      const data = await api.getCommandItems();
      setCommandItems(data);
    } catch (error) {
      console.error('加载指令失败:', error);
    }
  };

  const loadDevices = async () => {
    try {
      const data = await api.getDevices();
      setDevices(data);
    } catch (error) {
      console.error('加载设备失败:', error);
    }
  };

  const loadCommandRecords = async (deviceId: string) => {
    try {
      const data = await api.getCommandRecords(deviceId);
      setCommandRecords(data);
    } catch (error) {
      console.error('加载指令记录失败:', error);
    }
  };

  // CommandItem CRUD
  const handleCreateItem = () => {
    setEditingItem(null);
    setShowItemModal(true);
  };

  const handleEditItem = (item: CommandItem) => {
    setEditingItem(item);
    setShowItemModal(true);
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('确定要删除此指令吗?')) return;
    try {
      await api.deleteCommandItem(id);
      loadCommandItems();
    } catch (error: any) {
      alert(error.message || '删除失败');
    }
  };

  const handleSaveItem = async (formData: any) => {
    try {
      if (editingItem) {
        await api.updateCommandItem(editingItem.id, formData);
      } else {
        await api.createCommandItem(formData);
      }
      setShowItemModal(false);
      loadCommandItems();
    } catch (error: any) {
      alert(error.message || '保存失败');
    }
  };

  // Send Command
  const handleOpenSendModal = (device: Device) => {
    setSelectedDevice(device);
    setShowSendModal(true);
  };

  const handleSendCommand = async (commandItemId: string, payload: string, requestId?: string, sessionId?: string) => {
    if (!selectedDevice) return;
    try {
      await api.sendCommand(selectedDevice.id, {
        commandItemId,
        payload: payload || undefined,
        requestId: requestId || undefined,
        sessionId: sessionId || undefined,
      });
      alert('指令发送成功!');
      setShowSendModal(false);
      loadCommandRecords(selectedDevice.id);
    } catch (error: any) {
      alert(error.message || '发送失败');
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!confirm('确定要删除此指令记录吗?')) return;
    try {
      await api.deleteCommandRecord(id);
      if (selectedDevice) {
        loadCommandRecords(selectedDevice.id);
      }
    } catch (error: any) {
      alert(error.message || '删除失败');
    }
  };

  const filteredItems = commandItems.filter((item) =>
    searchText ? item.name.toLowerCase().includes(searchText.toLowerCase()) || item.type.toLowerCase().includes(searchText.toLowerCase()) : true
  );

  // CommandItem table columns
  const itemColumns: Column<CommandItem>[] = [
    {
      key: 'name',
      header: '名称',
      render: (item) => <span className="font-medium text-gray-900">{item.name}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      render: (item) => <span className="font-mono text-sm text-gray-600">{item.type}</span>,
    },
    {
      key: 'defaultPayload',
      header: '默认Payload',
      render: (item) => <JsonTooltip data={item.defaultPayload} />,
    },
    {
      key: 'valid',
      header: '状态',
      align: 'center',
      render: (item) => <StatusLight status={item.valid} />,
    },
    {
      key: 'actions',
      header: '操作',
      align: 'right',
      render: (item) => (
        <div className="flex justify-end gap-2">
          <button onClick={() => handleEditItem(item)} className="text-blue-600 hover:text-blue-900">
            编辑
          </button>
          <button onClick={() => handleDeleteItem(item.id)} className="text-red-600 hover:text-red-900">
            删除
          </button>
        </div>
      ),
    },
  ];

  // Device table columns
  const deviceColumns: Column<Device>[] = [
    {
      key: 'id',
      header: '设备ID',
      render: (device) => <span className="font-mono text-xs">{device.id.slice(0, 12)}...</span>,
    },
    {
      key: 'manufacturer',
      header: '制造商',
      render: (device) => <span>{device.manufacturer}</span>,
    },
    {
      key: 'os',
      header: '操作系统',
      render: (device) => (
        <span>
          {device.os} {device.osVersion}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '操作',
      align: 'right',
      render: (device) => (
        <div className="flex justify-end gap-2">
          <button onClick={() => setSelectedDevice(device)} className="text-blue-600 hover:text-blue-900">
            查看记录
          </button>
          <button onClick={() => handleOpenSendModal(device)} className="text-green-600 hover:text-green-900">
            发送指令
          </button>
        </div>
      ),
    },
  ];

  // CommandRecord table columns
  const recordColumns: Column<CommandRecord>[] = [
    {
      key: 'commandId',
      header: '指令ID',
      render: (record) => <span className="font-mono text-xs">{record.commandId.slice(0, 8)}...</span>,
    },
    {
      key: 'type',
      header: '指令类型',
      render: (record) => <span className="font-mono text-sm text-gray-700">{record.type}</span>,
    },
    {
      key: 'requestId',
      header: 'RequestID',
      render: (record) => <span className="font-mono text-xs">{record.requestId || '-'}</span>,
    },
    {
      key: 'sessionId',
      header: 'SessionID',
      render: (record) => <span className="font-mono text-xs">{record.sessionId || '-'}</span>,
    },
    {
      key: 'sendAt',
      header: '发送时间',
      render: (record) => <span className="text-sm">{new Date(record.sendAt).toLocaleString()}</span>,
    },
    {
      key: 'sendResult',
      header: '发送',
      align: 'center',
      render: (record) => (record.sendResult ? <span className="text-green-600">✅</span> : <span className="text-red-600">❌</span>),
    },
    {
      key: 'receiveResult',
      header: '接收',
      align: 'center',
      render: (record) =>
        record.receiveResult === null ? (
          <span className="text-yellow-600">⏳ 等待</span>
        ) : record.receiveResult ? (
          <span className="text-green-600">✅</span>
        ) : (
          <span className="text-red-600">❌</span>
        ),
    },
    {
      key: 'actions',
      header: '操作',
      align: 'right',
      render: (record) => (
        <button onClick={() => handleDeleteRecord(record.id)} className="text-red-600 hover:text-red-900">
          删除
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">指令管理</h2>
      </div>

      {/* 指令项管理 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium text-gray-900">指令定义</h3>
          <div className="flex items-center gap-4">
            <div className="w-64">
              <SearchBar value={searchText} onChange={setSearchText} placeholder="搜索指令..." />
            </div>
            <button onClick={handleCreateItem} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              新建指令
            </button>
          </div>
        </div>
        <Table columns={itemColumns} data={filteredItems} getRowKey={(i) => i.id} emptyText="暂无指令数据" />
      </div>

      {/* 设备列表 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-4">设备列表</h3>
        <Table columns={deviceColumns} data={devices} getRowKey={(d) => d.id} emptyText="暂无设备" />
      </div>

      {/* 指令记录 */}
      {selectedDevice && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-gray-900">
              设备指令记录 - {selectedDevice.manufacturer} ({selectedDevice.id.slice(0, 12)}...)
            </h3>
            <button onClick={() => setSelectedDevice(null)} className="text-sm text-gray-600 hover:text-gray-900">
              关闭
            </button>
          </div>
          <Table columns={recordColumns} data={commandRecords} getRowKey={(r) => r.id} emptyText="暂无指令记录" />
        </div>
      )}

      {/* Modals */}
      {showItemModal && <ItemModal onClose={() => setShowItemModal(false)} onSave={handleSaveItem} item={editingItem} />}
      {showSendModal && selectedDevice && (
        <SendCommandModal onClose={() => setShowSendModal(false)} onSend={handleSendCommand} device={selectedDevice} commandItems={commandItems.filter((i) => i.valid)} />
      )}
    </div>
  );
}

// CommandItem Modal Component
function ItemModal({ onClose, onSave, item }: any) {
  const [formData, setFormData] = useState({
    name: item?.name || '',
    type: item?.type || '',
    defaultPayload: item?.defaultPayload || '',
    valid: item?.valid ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={item ? '编辑指令' : '新建指令'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">名称 *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">类型 *</label>
          <input
            type="text"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
            placeholder="例如: DEVICE_RESTART"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">默认Payload (JSON)</label>
          <textarea
            value={formData.defaultPayload}
            onChange={(e) => setFormData({ ...formData, defaultPayload: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
            rows={6}
            placeholder='例如: {"action": "restart", "delay": 0}'
          />
        </div>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="command-valid"
            checked={formData.valid}
            onChange={(e) => setFormData({ ...formData, valid: e.target.checked })}
            className="h-4 w-4 text-blue-600 rounded border-gray-300"
          />
          <label htmlFor="command-valid" className="ml-2 text-sm text-gray-700">
            启用此指令
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            取消
          </button>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            保存
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Send Command Modal Component
function SendCommandModal({ onClose, onSend, device, commandItems }: any) {
  const [selectedCommandId, setSelectedCommandId] = useState<string>('');
  const [payload, setPayload] = useState<string>('');
  const [requestId, setRequestId] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');

  const handleCommandSelect = (commandId: string) => {
    setSelectedCommandId(commandId);
    const item = commandItems.find((i: any) => i.id === commandId);
    setPayload(item?.defaultPayload || '');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSend(selectedCommandId, payload, requestId, sessionId);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="发送指令" maxWidth="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-sm text-gray-700">
            <div>
              <span className="font-medium">设备ID:</span> <span className="font-mono">{device.id}</span>
            </div>
            <div>
              <span className="font-medium">制造商:</span> {device.manufacturer}
            </div>
            <div>
              <span className="font-medium">系统:</span> {device.os} {device.osVersion}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">选择指令 *</label>
          <select
            value={selectedCommandId}
            onChange={(e) => handleCommandSelect(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          >
            <option value="">请选择</option>
            {commandItems.map((item: any) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.type})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payload (JSON)</label>
          <textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
            rows={8}
            placeholder='例如: {"action": "restart"}'
          />
          <p className="text-xs text-gray-500 mt-1">留空则使用指令的默认Payload</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Request ID (可选)</label>
            <input
              type="text"
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              placeholder="例如: req_123"
            />
            <p className="text-xs text-gray-500 mt-1">用于追踪请求</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Session ID (可选)</label>
            <input
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              placeholder="例如: session_456"
            />
            <p className="text-xs text-gray-500 mt-1">用于关联会话</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            取消
          </button>
          <button type="submit" disabled={!selectedCommandId} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed">
            发送指令
          </button>
        </div>
      </form>
    </Modal>
  );
}
