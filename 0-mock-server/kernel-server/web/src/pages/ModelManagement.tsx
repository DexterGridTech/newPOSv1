import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { TreeView, TreeNode, Modal, StatusLight, JsonTooltip, DetailCard } from '../components/common';
import { Unit, UnitData } from '../types';

/**
 * 机型管理页面
 * 左侧:机型树形结构
 * 右侧:详情区 + 单元数据管理
 */
export function ModelManagement() {
  const [models, setModels] = useState<Unit[]>([]);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [selectedModel, setSelectedModel] = useState<Unit | null>(null);
  const [unitData, setUnitData] = useState<UnitData[]>([]);

  // Modal states
  const [showModelModal, setShowModelModal] = useState(false);
  const [showDataModal, setShowDataModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  useEffect(() => {
    loadModels();
  }, []);

  useEffect(() => {
    if (selectedModel) {
      loadUnitData(selectedModel.id);
    }
  }, [selectedModel]);

  const loadModels = async () => {
    try {
      const data = await api.getUnits('model');
      setModels(data);
    } catch (error) {
      console.error('加载机型失败:', error);
    }
  };

  const loadUnitData = async (unitId: string) => {
    try {
      const data = await api.getUnitData(unitId);
      setUnitData(data);
    } catch (error) {
      console.error('加载单元数据失败:', error);
    }
  };

  // 构建树形结构
  const buildTree = (items: Unit[], parentId: string | null = null): TreeNode[] => {
    return items
      .filter((item) => item.parentId === parentId)
      .map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        children: buildTree(items, item.id),
        data: item,
      }));
  };

  const modelTree = buildTree(models);

  const handleNodeSelect = (node: TreeNode) => {
    setSelectedNode(node);
    setSelectedModel(node.data);
  };

  // Model CRUD
  const handleCreateModel = () => {
    setEditingItem(null);
    setShowModelModal(true);
  };

  const handleEditModel = () => {
    if (selectedModel) {
      setEditingItem(selectedModel);
      setShowModelModal(true);
    }
  };

  const handleDeleteModel = async () => {
    if (!selectedModel || !confirm('确定要删除此机型吗?这将级联删除所有子机型及相关数据。')) return;
    try {
      await api.deleteUnit(selectedModel.id);
      setSelectedNode(null);
      setSelectedModel(null);
      loadModels();
    } catch (error: any) {
      alert(error.message || '删除失败');
    }
  };

  const handleSaveModel = async (formData: any) => {
    try {
      if (editingItem) {
        await api.updateUnit(editingItem.id, { ...formData, type: 'model' });
      } else {
        await api.createUnit({ ...formData, type: 'model' });
      }
      setShowModelModal(false);
      loadModels();
    } catch (error: any) {
      alert(error.message || '保存失败');
    }
  };

  // Template CRUD
  const handleCreateData = () => {
    setEditingItem(null);
    setShowDataModal(true);
  };

  const handleDeleteData = async (id: string) => {
    if (!confirm('确定要删除此数据吗?')) return;
    try {
      await api.deleteUnitData(id);
      if (selectedModel) {
        loadUnitData(selectedModel.id);
      }
    } catch (error: any) {
      alert(error.message || '删除失败');
    }
  };

  const handleSaveData = async (formData: any) => {
    if (!selectedModel) return;
    try {
      if (editingItem) {
        await api.updateUnitData(editingItem.id, formData);
      } else {
        await api.createUnitData(selectedModel.id, { ...formData, unitType: 'MODEL' });
      }
      setShowDataModal(false);
      loadUnitData(selectedModel.id);
    } catch (error: any) {
      alert(error.message || '保存失败');
    }
  };

  return (
    <div className="flex h-[calc(100vh-200px)] gap-4">
      {/* 左侧:机型树 */}
      <div className="w-1/3 bg-white border border-gray-200 rounded-lg p-4 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-900">机型树</h3>
          <button
            onClick={handleCreateModel}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            新建机型
          </button>
        </div>
        <TreeView data={modelTree} selectedId={selectedNode?.id} onSelect={handleNodeSelect} />
      </div>

      {/* 右侧:详情区 */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {selectedModel ? (
          <>
            {/* 机型详情 */}
            <DetailCard
              title="机型详情"
              icon={<span className="text-2xl">◆</span>}
              fields={[
                { label: 'ID', value: selectedModel.id, type: 'code', highlight: true },
                { label: '名称', value: selectedModel.name, highlight: true },
                { label: 'Key', value: selectedModel.key, type: 'code' },
                { label: '类型', value: selectedModel.type },
                {
                  label: '父级机型',
                  value: selectedModel.parentId
                    ? models.find((m) => m.id === selectedModel.parentId)?.name || selectedModel.parentId
                    : '无(顶级机型)',
                },
                {
                  label: 'Root Path',
                  value: selectedModel.rootPath,
                  type: 'array',
                },
                { label: '创建时间', value: selectedModel.createdAt, type: 'date' },
                { label: '更新时间', value: selectedModel.updatedAt, type: 'date' },
              ]}
              actions={
                <>
                  <button
                    onClick={handleEditModel}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    编辑
                  </button>
                  <button
                    onClick={handleDeleteModel}
                    className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                  >
                    删除
                  </button>
                </>
              }
            />

            {/* 单元数据区 */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-medium text-gray-900">单元数据</h4>
                <button
                  onClick={handleCreateData}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  新建数据
                </button>
              </div>

              <div className="space-y-2">
                {unitData.length > 0 ? (
                  unitData.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-200">
                      <div className="flex items-center gap-3 flex-1">
                        <span className="font-mono text-xs bg-gray-200 px-2 py-1 rounded">[{item.group}]</span>
                        <span className="font-medium">{item.name}</span>
                        <span className="text-sm text-gray-600">{item.path}</span>
                        <JsonTooltip data={item.value} />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setShowDataModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900 text-sm"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDeleteData(item.id)}
                          className="text-red-600 hover:text-red-900 text-sm"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 py-8">暂无数据</p>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
            <p>请从左侧选择一个机型</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showModelModal && <ModelModal onClose={() => setShowModelModal(false)} onSave={handleSaveModel} model={editingItem} models={models} defaultParentId={selectedModel?.id || null} />}
      {showDataModal && <UnitDataModal onClose={() => setShowDataModal(false)} onSave={handleSaveData} data={editingItem} unitId={selectedModel?.id} unitType="MODEL" />}
    </div>
  );
}

// Model Modal Component
function ModelModal({ onClose, onSave, model, models, defaultParentId }: any) {
  const [formData, setFormData] = useState({
    name: model?.name || '',
    key: model?.key || '',
    parentId: model?.parentId || defaultParentId || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      parentId: formData.parentId || null
    };
    onSave(submitData);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={model ? '编辑机型' : '新建机型'}>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">上级机型</label>
          <select
            value={formData.parentId}
            onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">无(顶级机型)</option>
            {models.filter((m: any) => m.id !== model?.id).map((mdl: any) => (
              <option key={mdl.id} value={mdl.id}>
                {mdl.name}
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

// UnitData Modal Component
function UnitDataModal({ onClose, onSave, data, unitId, unitType }: any) {
  const [formData, setFormData] = useState({
    name: data?.name || '',
    path: data?.path || '',
    group: data?.group || '',
    value: data?.value || '',
    unitType: unitType,
    extra: data?.extra || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={data ? '编辑数据' : '新建数据'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">名称</label>
          <input
            type="text"
            className="w-full px-3 py-2 border rounded"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">路径</label>
          <input
            type="text"
            className="w-full px-3 py-2 border rounded"
            value={formData.path}
            onChange={(e) => setFormData({ ...formData, path: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">分组</label>
          <input
            type="text"
            className="w-full px-3 py-2 border rounded"
            value={formData.group}
            onChange={(e) => setFormData({ ...formData, group: e.target.value })}
            required
            disabled={!!data}
          />
          {data && <p className="text-sm text-gray-500 mt-1">分组创建后不可修改</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">值</label>
          <textarea
            className="w-full px-3 py-2 border rounded"
            rows={3}
            value={formData.value}
            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">额外信息</label>
          <textarea
            className="w-full px-3 py-2 border rounded"
            rows={2}
            value={formData.extra}
            onChange={(e) => setFormData({ ...formData, extra: e.target.value })}
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            取消
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            保存
          </button>
        </div>
      </form>
    </Modal>
  );
}
