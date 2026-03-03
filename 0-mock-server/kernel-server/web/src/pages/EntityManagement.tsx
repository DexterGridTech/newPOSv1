import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { TreeView, TreeNode, Modal, StatusLight, JsonTooltip, DetailCard, JsonViewer } from '../components/common';
import { Unit, Device, UnitDataTemplate, UnitData, UnitDataItem } from '../types';

/**
 * 业务主体管理页面
 * 左侧:业务主体树形结构(包含终端和设备)
 * 右侧:详情区 + 单元数据管理
 */
export function EntityManagement() {
  const [entities, setEntities] = useState<Unit[]>([]);
  const [terminals, setTerminals] = useState<Unit[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [selectedItem, setSelectedItem] = useState<{ type: 'entity' | 'terminal' | 'device'; data: any } | null>(null);
  const [templates, setTemplates] = useState<UnitDataTemplate[]>([]);
  const [templateData, setTemplateData] = useState<Record<string, UnitData[]>>({});
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());

  // Modal states
  const [showEntityModal, setShowEntityModal] = useState(false);
  const [showTerminalModal, setShowTerminalModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showDataModal, setShowDataModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [currentTemplateId, setCurrentTemplateId] = useState<string>('');

  // 设备状态相关
  const [showDeviceStateModal, setShowDeviceStateModal] = useState(false);
  const [deviceState, setDeviceState] = useState<any>(null);
  const [deviceStateLoading, setDeviceStateLoading] = useState(false);
  const [onlineDevices, setOnlineDevices] = useState<Set<string>>(new Set());

  // 设备解绑相关
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivateCode, setDeactivateCode] = useState('');

  useEffect(() => {
    loadEntities();
    loadTerminals();
    loadDevices();

    // 使用 ref 来跟踪 WebSocket 实例
    const ws = connectWebSocket();

    return () => {
      // 清理WebSocket连接
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  useEffect(() => {
    if (selectedItem && (selectedItem.type === 'entity' || selectedItem.type === 'terminal')) {
      loadTemplates(selectedItem.data.id);
    } else {
      setTemplates([]);
    }
  }, [selectedItem]);

  const loadEntities = async () => {
    try {
      const data = await api.getUnits('entity');
      setEntities(data);
    } catch (error) {
      console.error('加载业务主体失败:', error);
    }
  };

  const loadTerminals = async () => {
    try {
      const data = await api.getUnits('terminal');
      setTerminals(data);
    } catch (error) {
      console.error('加载终端失败:', error);
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

  const loadTemplates = async (unitId: string) => {
    try {
      const data = await api.getUnitTemplates(unitId);
      setTemplates(data);
      for (const template of data) {
        loadTemplateData(template.id);
      }
    } catch (error) {
      console.error('加载模板失败:', error);
    }
  };

  const loadTemplateData = async (templateId: string) => {
    try {
      const data = await api.getTemplateData(templateId);
      setTemplateData((prev) => ({ ...prev, [templateId]: data }));
    } catch (error) {
      console.error('加载模板数据失败:', error);
    }
  };

  // 同步在线设备状态
  const syncOnlineDevices = async () => {
    try {
      const onlineDeviceIds = await api.getOnlineDevices();
      console.log('同步在线设备列表:', onlineDeviceIds);
      setOnlineDevices(new Set(onlineDeviceIds));
    } catch (error) {
      console.error('获取在线设备列表失败:', error);
    }
  };

  // WebSocket连接
  const connectWebSocket = () => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/kernel-server/ws/connect`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = async () => {
        console.log('WebSocket连接已建立');
        // 连接建立后立即获取当前在线设备列表
        await syncOnlineDevices();
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'DEVICE_STATE_UPDATED') {
            const { deviceId, state } = message.data;
            console.log('收到设备状态更新:', deviceId);
            setDeviceState(state);
            setDeviceStateLoading(false);
          } else if (message.type === 'DEVICE_ONLINE_STATUS') {
            const { deviceId, online } = message.data;
            console.log('收到设备在线状态变化:', deviceId, online);
            setOnlineDevices((prev) => {
              const newSet = new Set(prev);
              if (online) {
                newSet.add(deviceId);
              } else {
                newSet.delete(deviceId);
              }
              return newSet;
            });
          }
        } catch (error) {
          console.error('解析WebSocket消息失败:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket错误:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket连接已关闭');
      };

      return ws;
    } catch (error) {
      console.error('WebSocket连接失败:', error);
      return null;
    }
  };

  // 获取设备当前数据
  const handleGetDeviceState = async () => {
    if (!selectedItem || selectedItem.type !== 'device') return;

    setDeviceState(null);
    setDeviceStateLoading(true);
    setShowDeviceStateModal(true);

    try {
      // 发送远程指令
      await api.sendCommand(selectedItem.data.id, {
        commandItemId: 'sendStateToServer',
        type: 'kernel.terminal.sendStateToServer',
        payload: '{}'  // 修改为JSON字符串
      });
    } catch (error: any) {
      console.error('发送指令失败:', error);
      alert(error.message || '发送指令失败');
      setDeviceStateLoading(false);
    }
  };

  // 关闭设备状态弹窗
  const handleCloseDeviceStateModal = () => {
    setShowDeviceStateModal(false);
    setDeviceState(null);
    setDeviceStateLoading(false);
  };

  // 打开解绑设备弹窗
  const handleOpenDeactivateModal = () => {
    setDeactivateCode('');
    setShowDeactivateModal(true);
  };

  // 关闭解绑设备弹窗
  const handleCloseDeactivateModal = () => {
    setShowDeactivateModal(false);
    setDeactivateCode('');
  };

  // 执行解绑设备
  const handleDeactivateDevice = async () => {
    if (!selectedItem || selectedItem.type !== 'device') return;
    if (!deactivateCode.trim()) {
      alert('请输入解绑码');
      return;
    }

    try {
      await api.deactivateDevice(selectedItem.data.id, deactivateCode);
      alert('设备解绑成功');
      setShowDeactivateModal(false);
      setDeactivateCode('');
      setSelectedNode(null);
      setSelectedItem(null);
      loadDevices();
    } catch (error: any) {
      alert(error.message || '解绑失败');
    }
  };

  // 构建包含终端和设备的树形结构
  const buildTree = (items: Unit[], parentId: string | null = null): TreeNode[] => {
    return items
      .filter((item) => item.parentId === parentId)
      .map((item) => {
        // 获取该实体下的终端
        const entityTerminals = terminals.filter((t) => t.entityUnitId === item.id);

        // 为每个终端构建节点,包含其绑定的设备
        const terminalNodes: TreeNode[] = entityTerminals.map((terminal) => {
          const device = devices.find((d) => d.terminalId === terminal.id);
          const deviceNodes: TreeNode[] = device
            ? [
                {
                  id: `device-${device.id}`,
                  name: `设备: ${device.manufacturer} ${device.os}`,
                  type: 'device',
                  data: device,
                  online: onlineDevices.has(device.id),
                },
              ]
            : [];

          return {
            id: `terminal-${terminal.id}`,
            name: terminal.name,
            type: 'terminal',
            children: deviceNodes,
            data: terminal,
          };
        });

        return {
          id: item.id,
          name: item.name,
          type: item.type,
          children: [...buildTree(items, item.id), ...terminalNodes],
          data: item,
        };
      });
  };

  const entityTree = buildTree(entities);

  // 处理节点选择
  const handleNodeSelect = (node: TreeNode) => {
    setSelectedNode(node);

    if (node.type === 'entity') {
      setSelectedItem({ type: 'entity', data: node.data });
    } else if (node.type === 'terminal') {
      setSelectedItem({ type: 'terminal', data: node.data });
    } else if (node.type === 'device') {
      setSelectedItem({ type: 'device', data: node.data });
    }
  };

  // 实体CRUD
  const handleCreateEntity = () => {
    setEditingItem(null);
    setShowEntityModal(true);
  };

  const handleEditEntity = () => {
    if (selectedItem?.type === 'entity') {
      setEditingItem(selectedItem.data);
      setShowEntityModal(true);
    }
  };

  const handleDeleteEntity = async () => {
    if (!selectedItem || selectedItem.type !== 'entity') return;
    if (!confirm('确定要删除此业务主体吗?这将级联删除所有子主体及相关数据。')) return;
    try {
      await api.deleteUnit(selectedItem.data.id);
      setSelectedNode(null);
      setSelectedItem(null);
      loadEntities();
    } catch (error: any) {
      alert(error.message || '删除失败');
    }
  };

  const handleSaveEntity = async (formData: any) => {
    try {
      if (editingItem) {
        await api.updateUnit(editingItem.id, { ...formData, type: 'entity' });
      } else {
        await api.createUnit({ ...formData, type: 'entity' });
      }
      setShowEntityModal(false);
      loadEntities();
    } catch (error: any) {
      alert(error.message || '保存失败');
    }
  };

  // 终端CRUD
  const handleCreateTerminal = () => {
    setEditingItem(null);
    setShowTerminalModal(true);
  };

  const handleEditTerminal = () => {
    if (selectedItem?.type === 'terminal') {
      setEditingItem(selectedItem.data);
      setShowTerminalModal(true);
    }
  };

  const handleDeleteTerminal = async () => {
    if (!selectedItem || selectedItem.type !== 'terminal') return;
    if (!confirm('确定要删除此终端吗?')) return;
    try {
      await api.deleteUnit(selectedItem.data.id);
      loadTerminals();
      setSelectedNode(null);
      setSelectedItem(null);
    } catch (error: any) {
      alert(error.message || '删除失败');
    }
  };

  const handleSaveTerminal = async (formData: any) => {
    try {
      if (editingItem) {
        await api.updateUnit(editingItem.id, formData);
      } else {
        await api.createUnit(formData);
      }
      setShowTerminalModal(false);
      loadTerminals();
    } catch (error: any) {
      alert(error.message || '保存失败');
    }
  };

  // 模板CRUD
  const handleCreateTemplate = () => {
    setEditingItem(null);
    setShowTemplateModal(true);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('确定要删除此模板吗?这将删除模板下的所有数据。')) return;
    try {
      await api.deleteUnitTemplate(id);
      if (selectedItem) {
        loadTemplates(selectedItem.data.id);
      }
    } catch (error: any) {
      alert(error.message || '删除失败');
    }
  };

  const handleSaveTemplate = async (formData: any) => {
    if (!selectedItem) return;
    try {
      if (editingItem) {
        await api.updateUnitTemplate(editingItem.id, formData);
      } else {
        // 添加unitType字段
        const unitType = selectedItem.type === 'entity' ? 'entity' : 'terminal';
        await api.createUnitTemplate(selectedItem.data.id, { ...formData, unitType });
      }
      setShowTemplateModal(false);
      loadTemplates(selectedItem.data.id);
    } catch (error: any) {
      alert(error.message || '保存失败');
    }
  };

  // 单元数据CRUD
  const handleCreateData = (templateId: string) => {
    setCurrentTemplateId(templateId);
    setEditingItem(null);
    setShowDataModal(true);
  };

  const handleEditData = (data: UnitData, templateId: string) => {
    setCurrentTemplateId(templateId);
    setEditingItem(data);
    setShowDataModal(true);
  };

  const handleDeleteData = async (id: string, templateId: string) => {
    if (!confirm('确定要删除此数据吗?')) return;
    try {
      await api.deleteUnitData(id);
      loadTemplateData(templateId);
    } catch (error: any) {
      alert(error.message || '删除失败');
    }
  };

  const handleSaveData = async (formData: any) => {
    try {
      if (editingItem) {
        await api.updateUnitData(editingItem.id, formData);
      } else {
        await api.createUnitData(currentTemplateId, formData);
      }
      setShowDataModal(false);
      loadTemplateData(currentTemplateId);
    } catch (error: any) {
      alert(error.message || '保存失败');
    }
  };

  const toggleTemplate = (templateId: string) => {
    setExpandedTemplates((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(templateId)) {
        newSet.delete(templateId);
      } else {
        newSet.add(templateId);
      }
      return newSet;
    });
  };

  // 自定义树节点渲染
  const renderTreeNode = (node: TreeNode) => {
    let icon = '●'; // 业务主体
    if (node.type === 'terminal') {
      icon = '○'; // 终端
    } else if (node.type === 'device') {
      icon = '└'; // 设备
    }

    return (
      <div className="flex items-center gap-2">
        <span className="text-gray-500">{icon}</span>
        {node.type === 'device' && node.online !== undefined && (
          <span className={`inline-block w-2 h-2 rounded-full ${node.online ? 'bg-green-500' : 'bg-red-500'}`} title={node.online ? '在线' : '离线'} />
        )}
        <span className="flex-1">{node.name}</span>
        {node.type === 'terminal' && node.data?.activeCode && (
          <code className="text-xs bg-gray-100 px-1 rounded">{node.data.activeCode}</code>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-200px)] gap-4">
      {/* 左侧:业务主体树(包含终端和设备) */}
      <div className="w-1/3 bg-white border border-gray-200 rounded-lg p-4 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-900">业务主体树</h3>
          <button
            onClick={handleCreateEntity}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            新建主体
          </button>
        </div>
        <TreeView
          data={entityTree}
          selectedId={selectedNode?.id}
          onSelect={handleNodeSelect}
          renderNode={renderTreeNode}
        />
      </div>

      {/* 右侧:详情区 */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {selectedItem ? (
          <>
            {/* 业务主体详情 */}
            {selectedItem.type === 'entity' && (
              <DetailCard
                title="业务主体详情"
                icon={<span className="text-2xl">●</span>}
                fields={[
                  { label: 'ID', value: selectedItem.data.id, type: 'code', highlight: true },
                  { label: '名称', value: selectedItem.data.name, highlight: true },
                  { label: 'Key', value: selectedItem.data.key, type: 'code' },
                  { label: '类型', value: selectedItem.data.type },
                  {
                    label: '父级主体',
                    value: selectedItem.data.parentId
                      ? entities.find((e) => e.id === selectedItem.data.parentId)?.name || selectedItem.data.parentId
                      : '无(顶级主体)',
                  },
                  {
                    label: 'Root Path',
                    value: selectedItem.data.rootPath,
                    type: 'array',
                  },
                  { label: '创建时间', value: selectedItem.data.createdAt, type: 'date' },
                  { label: '更新时间', value: selectedItem.data.updatedAt, type: 'date' },
                ]}
                actions={
                  <>
                    <button
                      onClick={handleCreateEntity}
                      className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
                    >
                      新建子主体
                    </button>
                    <button
                      onClick={handleCreateTerminal}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                    >
                      新建终端
                    </button>
                    <button
                      onClick={handleEditEntity}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                    >
                      编辑
                    </button>
                    <button
                      onClick={handleDeleteEntity}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                    >
                      删除
                    </button>
                  </>
                }
              />
            )}

            {/* 终端详情 */}
            {selectedItem.type === 'terminal' && (
              <DetailCard
                title="终端详情"
                icon={<span className="text-2xl">○</span>}
                fields={[
                  { label: 'ID', value: selectedItem.data.id, type: 'code', highlight: true },
                  { label: '名称', value: selectedItem.data.name, highlight: true },
                  { label: 'Key', value: selectedItem.data.key, type: 'code' },
                  { label: '类型', value: selectedItem.data.type },
                  {
                    label: '关联业务主体',
                    value: selectedItem.data.entityUnitId
                      ? entities.find((e) => e.id === selectedItem.data.entityUnitId)?.name || selectedItem.data.entityUnitId
                      : '未关联',
                  },
                  {
                    label: '关联机型',
                    value: selectedItem.data.modelUnitId || '未关联',
                  },
                  { label: '激活码', value: selectedItem.data.activeCode, type: 'code' },
                  { label: '解绑码', value: selectedItem.data.deactiveCode, type: 'code' },
                  { label: '创建时间', value: selectedItem.data.createdAt, type: 'date' },
                  { label: '更新时间', value: selectedItem.data.updatedAt, type: 'date' },
                ]}
                actions={
                  <>
                    <button
                      onClick={handleEditTerminal}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                    >
                      编辑
                    </button>
                    <button
                      onClick={handleDeleteTerminal}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                    >
                      删除
                    </button>
                  </>
                }
              />
            )}

            {/* 设备详情 */}
            {selectedItem.type === 'device' && (
              <DetailCard
                title="设备详情"
                icon={<span className="text-2xl">└</span>}
                fields={[
                  { label: 'ID', value: selectedItem.data.id, type: 'code', highlight: true },
                  { label: '制造商', value: selectedItem.data.manufacturer },
                  { label: '操作系统', value: selectedItem.data.os },
                  { label: '系统版本', value: selectedItem.data.osVersion },
                  { label: 'CPU', value: selectedItem.data.cpu },
                  { label: '内存', value: selectedItem.data.memory },
                  { label: '磁盘', value: selectedItem.data.disk },
                  { label: '网络', value: selectedItem.data.network },
                  {
                    label: '绑定终端',
                    value: selectedItem.data.terminalId,
                    type: 'code',
                  },
                  {
                    label: '操作实体',
                    value: selectedItem.data.operatingEntityId
                      ? entities.find((e) => e.id === selectedItem.data.operatingEntityId)?.name || selectedItem.data.operatingEntityId
                      : '未设置',
                  },
                  { label: 'Token', value: selectedItem.data.token ? '********' : '未生成' },
                  { label: '创建时间', value: selectedItem.data.createdAt, type: 'date' },
                  { label: '更新时间', value: selectedItem.data.updatedAt, type: 'date' },
                ]}
                actions={
                  <>
                    {onlineDevices.has(selectedItem.data.id) && (
                      <button
                        onClick={handleGetDeviceState}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                      >
                        获取当前数据
                      </button>
                    )}
                    <button
                      onClick={handleOpenDeactivateModal}
                      className="px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700"
                    >
                      解除绑定
                    </button>
                  </>
                }
              />
            )}

            {/* 单元数据区 - 仅对entity和terminal显示 */}
            {(selectedItem.type === 'entity' || selectedItem.type === 'terminal') && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-medium text-gray-900">单元数据</h4>
                  <button
                    onClick={handleCreateTemplate}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    新建模板
                  </button>
                </div>

                <div className="space-y-2">
                  {templates.map((template) => {
                    const isExpanded = expandedTemplates.has(template.id);
                    const data = templateData[template.id] || [];
                    return (
                      <div key={template.id} className="border border-gray-200 rounded">
                        <div
                          className="flex justify-between items-center p-3 cursor-pointer hover:bg-gray-50"
                          onClick={() => toggleTemplate(template.id)}
                        >
                          <div className="flex items-center gap-2">
                            <svg
                              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <span className="font-medium">模板: {template.name}</span>
                            <StatusLight status={template.valid} size="sm" />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCreateData(template.id);
                              }}
                              className="text-blue-600 text-sm hover:text-blue-900"
                            >
                              添加数据
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTemplate(template.id);
                              }}
                              className="text-red-600 text-sm hover:text-red-900"
                            >
                              删除模板
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-gray-200 p-3 bg-gray-50">
                            {data.length > 0 ? (
                              <div className="space-y-2">
                                {data.map((item) => (
                                  <div key={item.id} className="flex justify-between items-center p-2 bg-white rounded text-sm">
                                    <div className="flex items-center gap-3 flex-1">
                                      <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">[{item.groupKey}]</span>
                                      <span className="font-medium">{item.name}</span>
                                      <StatusLight status={true} size="sm" />
                                      <JsonTooltip data={item.value} />
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleEditData(item, template.id)}
                                        className="text-blue-600 hover:text-blue-900"
                                      >
                                        编辑
                                      </button>
                                      <button
                                        onClick={() => handleDeleteData(item.id, template.id)}
                                        className="text-red-600 hover:text-red-900"
                                      >
                                        删除
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-center text-gray-500 py-4">暂无数据</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {templates.length === 0 && <p className="text-center text-gray-500 py-8">暂无模板</p>}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
            <p>请从左侧选择一个业务主体、终端或设备</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showEntityModal && <EntityModal onClose={() => setShowEntityModal(false)} onSave={handleSaveEntity} entity={editingItem} entities={entities} />}
      {showTerminalModal && <TerminalModal onClose={() => setShowTerminalModal(false)} onSave={handleSaveTerminal} terminal={editingItem} selectedEntityId={selectedItem?.type === 'entity' ? selectedItem.data.id : undefined} />}
      {showTemplateModal && <TemplateModal onClose={() => setShowTemplateModal(false)} onSave={handleSaveTemplate} template={editingItem} />}
      {showDataModal && <UnitDataModal onClose={() => setShowDataModal(false)} onSave={handleSaveData} data={editingItem} />}
      {showDeviceStateModal && <DeviceStateModal onClose={handleCloseDeviceStateModal} loading={deviceStateLoading} state={deviceState} />}
      {showDeactivateModal && <DeactivateDeviceModal onClose={handleCloseDeactivateModal} onConfirm={handleDeactivateDevice} deactivateCode={deactivateCode} setDeactivateCode={setDeactivateCode} />}
    </div>
  );
}

// Entity Modal Component
function EntityModal({ onClose, onSave, entity, entities }: any) {
  const [formData, setFormData] = useState({
    name: entity?.name || '',
    key: entity?.key || '',
    parentId: entity?.parentId || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={entity ? '编辑业务主体' : '新建业务主体'}>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">标识 (Key) *</label>
          <input
            type="text"
            value={formData.key}
            onChange={(e) => setFormData({ ...formData, key: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">上级主体</label>
          <select
            value={formData.parentId}
            onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">无(顶级主体)</option>
            {entities.filter((e: any) => e.id !== entity?.id).map((ent: any) => (
              <option key={ent.id} value={ent.id}>
                {ent.name}
              </option>
            ))}
          </select>
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

// Terminal Modal Component
function TerminalModal({ onClose, onSave, terminal, selectedEntityId }: any) {
  const [models, setModels] = useState<Unit[]>([]);
  const [entities, setEntities] = useState<Unit[]>([]);
  const [formData, setFormData] = useState({
    name: terminal?.name || '',
    key: terminal?.key || '',
    type: 'terminal',
    entityUnitId: terminal?.entityUnitId || selectedEntityId || '',
    modelUnitId: terminal?.modelUnitId || '',
    activeCode: terminal?.activeCode || '',
    deactiveCode: terminal?.deactiveCode || '',
  });

  useEffect(() => {
    loadModels();
    loadEntities();
  }, []);

  const loadModels = async () => {
    try {
      const data = await api.getUnits('model');
      setModels(data);
    } catch (error) {
      console.error('加载机型失败:', error);
    }
  };

  const loadEntities = async () => {
    try {
      const data = await api.getUnits('entity');
      setEntities(data);
    } catch (error) {
      console.error('加载业务主体失败:', error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={terminal ? '编辑终端' : '新建终端'}>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">标识 (Key) *</label>
          <input
            type="text"
            value={formData.key}
            onChange={(e) => setFormData({ ...formData, key: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">业务主体 *</label>
          <select
            value={formData.entityUnitId}
            onChange={(e) => setFormData({ ...formData, entityUnitId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          >
            <option value="">请选择</option>
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">机型 *</label>
          <select
            value={formData.modelUnitId}
            onChange={(e) => setFormData({ ...formData, modelUnitId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          >
            <option value="">请选择</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">激活码</label>
          <input
            type="text"
            value={formData.activeCode}
            onChange={(e) => setFormData({ ...formData, activeCode: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="留空自动生成"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">解绑码</label>
          <input
            type="text"
            value={formData.deactiveCode}
            onChange={(e) => setFormData({ ...formData, deactiveCode: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="留空自动生成"
          />
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

// Template Modal Component
function TemplateModal({ onClose, onSave, template }: any) {
  const [formData, setFormData] = useState({
    name: template?.name || '',
    valid: template?.valid ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={template ? '编辑模板' : '新建模板'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">模板名称 *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
        </div>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="template-valid"
            checked={formData.valid}
            onChange={(e) => setFormData({ ...formData, valid: e.target.checked })}
            className="h-4 w-4 text-blue-600 rounded border-gray-300"
          />
          <label htmlFor="template-valid" className="ml-2 text-sm text-gray-700">
            启用此模板
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

// UnitData Modal Component
function UnitDataModal({ onClose, onSave, data }: any) {
  const [dataItems, setDataItems] = useState<UnitDataItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>(data?.unitDataItemId || '');
  const [formData, setFormData] = useState({
    name: data?.name || '',
    path: data?.path || '',
    key: data?.key || '',
    value: data?.value || '',
    groupKey: data?.groupKey || '',
  });

  useEffect(() => {
    loadDataItems();
  }, []);

  const loadDataItems = async () => {
    try {
      const items = await api.getUnitDataItems();
      setDataItems(items.filter((item: UnitDataItem) => item.valid));
    } catch (error) {
      console.error('加载数据项失败:', error);
    }
  };

  // 当选择数据项时,自动填充字段
  const handleSelectDataItem = (itemId: string) => {
    setSelectedItemId(itemId);
    const item = dataItems.find(i => i.id === itemId);
    if (item) {
      setFormData({
        name: item.name,
        path: item.path,
        key: formData.key, // key可选,保留原值或为空
        value: item.defaultValue || '',
        groupKey: item.groupKey,
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={data ? '编辑单元数据' : '新建单元数据'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {!data && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">选择数据项 *</label>
            <select
              value={selectedItemId}
              onChange={(e) => handleSelectDataItem(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            >
              <option value="">请选择数据项</option>
              {dataItems.map((item) => (
                <option key={item.id} value={item.id}>
                  [{item.groupKey}] {item.name} ({item.path})
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">名称</label>
          <input
            type="text"
            value={formData.name}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
            disabled
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">分组</label>
          <input
            type="text"
            value={formData.groupKey}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
            disabled
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Path</label>
          <input
            type="text"
            value={formData.path}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
            disabled
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Key (可选)</label>
          <input
            type="text"
            value={formData.key}
            onChange={(e) => setFormData({ ...formData, key: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="留空使用默认值"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">值 (JSON)</label>
          <textarea
            value={formData.value}
            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
            rows={4}
            placeholder='例如: {"color": "blue"}'
          />
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

// Device State Modal Component
function DeviceStateModal({ onClose, loading, state }: any) {
  return (
    <Modal isOpen={true} title="设备当前数据" onClose={onClose} maxWidth="4xl">
      <div className="space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">数据获取中...</span>
          </div>
        )}

        {!loading && !state && (
          <div className="text-center py-8 text-gray-500">
            等待设备响应...
          </div>
        )}

        {!loading && state && (
          <div className="bg-gray-50 rounded-lg p-4 max-h-[600px] overflow-auto">
            <JsonViewer data={state} defaultExpanded={true} />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            关闭
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Deactivate Device Modal Component
function DeactivateDeviceModal({ onClose, onConfirm, deactivateCode, setDeactivateCode }: any) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm();
  };

  return (
    <Modal isOpen={true} title="解除设备绑定" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-yellow-800 mb-1">警告</h4>
              <p className="text-sm text-yellow-700">
                解除绑定后,设备将与终端解除关联,所有设备数据将被删除。此操作不可恢复,请谨慎操作。
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">请输入解绑码 *</label>
          <input
            type="text"
            value={deactivateCode}
            onChange={(e) => setDeactivateCode(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            placeholder="请输入终端的解绑码"
            required
            autoFocus
          />
          <p className="mt-1 text-xs text-gray-500">
            提示: 解绑码可在终端详情页面查看
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            确认解绑
          </button>
        </div>
      </form>
    </Modal>
  );
}
