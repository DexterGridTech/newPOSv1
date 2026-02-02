import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { TreeView, TreeNode, Modal, StatusLight, JsonTooltip, DetailCard } from '../components/common';
import { Unit, UnitDataTemplate, UnitData, UnitDataItem } from '../types';

/**
 * 机型管理页面
 * 左侧:机型树形结构
 * 右侧:详情区 + 单元数据管理
 */
export function ModelManagement() {
  const [models, setModels] = useState<Unit[]>([]);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [selectedModel, setSelectedModel] = useState<Unit | null>(null);
  const [templates, setTemplates] = useState<UnitDataTemplate[]>([]);
  const [templateData, setTemplateData] = useState<Record<string, UnitData[]>>({});
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());

  // Modal states
  const [showModelModal, setShowModelModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showDataModal, setShowDataModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [currentTemplateId, setCurrentTemplateId] = useState<string>('');

  useEffect(() => {
    loadModels();
  }, []);

  useEffect(() => {
    if (selectedModel) {
      loadTemplates(selectedModel.id);
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
  const handleCreateTemplate = () => {
    setEditingItem(null);
    setShowTemplateModal(true);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('确定要删除此模板吗?这将删除模板下的所有数据。')) return;
    try {
      await api.deleteUnitTemplate(id);
      if (selectedModel) {
        loadTemplates(selectedModel.id);
      }
    } catch (error: any) {
      alert(error.message || '删除失败');
    }
  };

  const handleSaveTemplate = async (formData: any) => {
    if (!selectedModel) return;
    try {
      if (editingItem) {
        await api.updateUnitTemplate(editingItem.id, formData);
      } else {
        // 添加unitType字段,机型的unitType为'model'
        await api.createUnitTemplate(selectedModel.id, { ...formData, unitType: 'model' });
      }
      setShowTemplateModal(false);
      loadTemplates(selectedModel.id);
    } catch (error: any) {
      alert(error.message || '保存失败');
    }
  };

  // UnitData CRUD
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
                          <span className="font-medium">{template.name}</span>
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
          </>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
            <p>请从左侧选择一个机型</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showModelModal && <ModelModal onClose={() => setShowModelModal(false)} onSave={handleSaveModel} model={editingItem} models={models} />}
      {showTemplateModal && <TemplateModal onClose={() => setShowTemplateModal(false)} onSave={handleSaveTemplate} template={editingItem} />}
      {showDataModal && <UnitDataModal onClose={() => setShowDataModal(false)} onSave={handleSaveData} data={editingItem} />}
    </div>
  );
}

// Model Modal Component
function ModelModal({ onClose, onSave, model, models }: any) {
  const [formData, setFormData] = useState({
    name: model?.name || '',
    key: model?.key || '',
    parentId: model?.parentId || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
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
            id="model-template-valid"
            checked={formData.valid}
            onChange={(e) => setFormData({ ...formData, valid: e.target.checked })}
            className="h-4 w-4 text-blue-600 rounded border-gray-300"
          />
          <label htmlFor="model-template-valid" className="ml-2 text-sm text-gray-700">
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

// UnitData Modal Component (reused from EntityManagement)
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
