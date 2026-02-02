import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Modal, Table, Column, StatusLight, SearchBar } from '../components/common';
import { UnitDataGroup, UnitDataItem } from '../types';

/**
 * 单元数据管理页面
 * Tab 1: 数据分组管理
 * Tab 2: 数据项管理
 */
export function UnitDataManagement() {
  const [activeTab, setActiveTab] = useState<'group' | 'item'>('group');
  const [groups, setGroups] = useState<UnitDataGroup[]>([]);
  const [items, setItems] = useState<UnitDataItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<UnitDataItem[]>([]);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');

  // Modal states
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<UnitDataGroup | null>(null);
  const [editingItem, setEditingItem] = useState<UnitDataItem | null>(null);

  useEffect(() => {
    loadGroups();
    loadItems();
  }, []);

  useEffect(() => {
    filterItems();
  }, [items, selectedGroupFilter, searchText]);

  const loadGroups = async () => {
    try {
      const data = await api.getUnitDataGroups();
      setGroups(data);
    } catch (error) {
      console.error('加载分组失败:', error);
    }
  };

  const loadItems = async () => {
    try {
      const data = await api.getUnitDataItems();
      setItems(data);
    } catch (error) {
      console.error('加载数据项失败:', error);
    }
  };

  const filterItems = () => {
    let result = items;

    if (selectedGroupFilter) {
      result = result.filter((item) => item.groupKey === selectedGroupFilter);
    }

    if (searchText) {
      const search = searchText.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(search) ||
          item.path.toLowerCase().includes(search)
      );
    }

    setFilteredItems(result);
  };

  // Group CRUD
  const handleCreateGroup = () => {
    setEditingGroup(null);
    setShowGroupModal(true);
  };

  const handleEditGroup = (group: UnitDataGroup) => {
    setEditingGroup(group);
    setShowGroupModal(true);
  };

  const handleDeleteGroup = async (key: string) => {
    if (!confirm('确定要删除此分组吗?这将级联删除所有相关数据项。')) return;
    try {
      await api.deleteUnitDataGroup(key);
      loadGroups();
      loadItems();
    } catch (error: any) {
      alert(error.message || '删除失败');
    }
  };

  const handleSaveGroup = async (formData: any) => {
    try {
      if (editingGroup) {
        await api.updateUnitDataGroup(editingGroup.key, { name: formData.name, description: formData.description });
      } else {
        await api.createUnitDataGroup(formData);
      }
      setShowGroupModal(false);
      loadGroups();
    } catch (error: any) {
      alert(error.message || '保存失败');
    }
  };

  // Item CRUD
  const handleCreateItem = () => {
    setEditingItem(null);
    setShowItemModal(true);
  };

  const handleEditItem = (item: UnitDataItem) => {
    setEditingItem(item);
    setShowItemModal(true);
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('确定要删除此数据项吗?')) return;
    try {
      await api.deleteUnitDataItem(id);
      loadItems();
    } catch (error: any) {
      alert(error.message || '删除失败');
    }
  };

  const handleSaveItem = async (formData: any) => {
    try {
      if (editingItem) {
        await api.updateUnitDataItem(editingItem.id, formData);
      } else {
        await api.createUnitDataItem(formData);
      }
      setShowItemModal(false);
      loadItems();
    } catch (error: any) {
      alert(error.message || '保存失败');
    }
  };

  const getGroupName = (key: string) => {
    return groups.find((g) => g.key === key)?.name || key;
  };

  const getGroupValid = (key: string) => {
    return groups.find((g) => g.key === key)?.valid ?? true;
  };

  // Group table columns
  const groupColumns: Column<UnitDataGroup>[] = [
    {
      key: 'key',
      header: 'Key',
      render: (group) => <span className="font-mono text-sm">{group.key}</span>,
    },
    {
      key: 'name',
      header: '名称',
      render: (group) => <span className="font-medium text-gray-900">{group.name}</span>,
    },
    {
      key: 'description',
      header: '描述',
      render: (group) => <span className="text-gray-600">{group.description || '-'}</span>,
    },
    {
      key: 'valid',
      header: '状态',
      align: 'center',
      render: (group) => <StatusLight status={group.valid} />,
    },
    {
      key: 'actions',
      header: '操作',
      align: 'right',
      render: (group) => (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => handleEditGroup(group)}
            className="text-blue-600 hover:text-blue-900"
          >
            编辑
          </button>
          <button
            onClick={() => handleDeleteGroup(group.key)}
            className="text-red-600 hover:text-red-900"
          >
            删除
          </button>
        </div>
      ),
    },
  ];

  // Item table columns
  const itemColumns: Column<UnitDataItem>[] = [
    {
      key: 'name',
      header: '名称',
      render: (item) => <span className="font-medium text-gray-900">{item.name}</span>,
    },
    {
      key: 'path',
      header: 'Path',
      render: (item) => <span className="font-mono text-sm text-gray-600">{item.path}</span>,
    },
    {
      key: 'groupKey',
      header: '分组',
      render: (item) => (
        <div className="flex items-center gap-2">
          <span className="text-gray-900">{getGroupName(item.groupKey)}</span>
        </div>
      ),
    },
    {
      key: 'groupValid',
      header: '分组状态',
      align: 'center',
      render: (item) => <StatusLight status={getGroupValid(item.groupKey)} />,
    },
    {
      key: 'valid',
      header: '项状态',
      align: 'center',
      render: (item) => <StatusLight status={item.valid} />,
    },
    {
      key: 'actions',
      header: '操作',
      align: 'right',
      render: (item) => (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => handleEditItem(item)}
            className="text-blue-600 hover:text-blue-900"
          >
            编辑
          </button>
          <button
            onClick={() => handleDeleteItem(item.id)}
            className="text-red-600 hover:text-red-900"
          >
            删除
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">单元数据管理</h2>
      </div>

      {/* 切换按钮 */}
      <div className="flex space-x-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('group')}
          className={`px-4 py-2 -mb-px ${
            activeTab === 'group'
              ? 'border-b-2 border-blue-600 text-blue-600 font-medium'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          数据分组管理
        </button>
        <button
          onClick={() => setActiveTab('item')}
          className={`px-4 py-2 -mb-px ${
            activeTab === 'item'
              ? 'border-b-2 border-blue-600 text-blue-600 font-medium'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          数据项管理
        </button>
      </div>

      {/* 数据分组管理 */}
      {activeTab === 'group' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium text-gray-900">数据分组列表</h3>
            <button
              onClick={handleCreateGroup}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              新建分组
            </button>
          </div>
          <Table columns={groupColumns} data={groups} getRowKey={(g) => g.key} emptyText="暂无分组数据" />
        </div>
      )}

      {/* 数据项管理 */}
      {activeTab === 'item' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-64">
                <SearchBar value={searchText} onChange={setSearchText} placeholder="搜索名称或路径..." />
              </div>
              <div>
                <select
                  value={selectedGroupFilter}
                  onChange={(e) => setSelectedGroupFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">全部分组</option>
                  {groups.map((group) => (
                    <option key={group.key} value={group.key}>
                      {group.name} ({group.key})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={handleCreateItem}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              新建数据项
            </button>
          </div>
          <Table columns={itemColumns} data={filteredItems} getRowKey={(i) => i.id} emptyText="暂无数据项" />
        </div>
      )}

      {/* Modals */}
      {showGroupModal && <GroupModal onClose={() => setShowGroupModal(false)} onSave={handleSaveGroup} group={editingGroup} />}
      {showItemModal && <ItemModal onClose={() => setShowItemModal(false)} onSave={handleSaveItem} item={editingItem} groups={groups} />}
    </div>
  );
}

// Group Modal Component
function GroupModal({ onClose, onSave, group }: any) {
  const [formData, setFormData] = useState({
    key: group?.key || '',
    name: group?.name || '',
    description: group?.description || '',
    valid: group?.valid ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={group ? '编辑数据分组' : '新建数据分组'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {!group && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Key *</label>
            <input
              type="text"
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
              placeholder="例如: SystemParameter"
              required
            />
            <p className="text-xs text-gray-500 mt-1">创建后不可修改</p>
          </div>
        )}
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
          <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            rows={3}
          />
        </div>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="group-valid"
            checked={formData.valid}
            onChange={(e) => setFormData({ ...formData, valid: e.target.checked })}
            className="h-4 w-4 text-blue-600 rounded border-gray-300"
          />
          <label htmlFor="group-valid" className="ml-2 text-sm text-gray-700">
            启用此分组
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

// Item Modal Component
function ItemModal({ onClose, onSave, item, groups }: any) {
  const [formData, setFormData] = useState({
    name: item?.name || '',
    path: item?.path || '',
    groupKey: item?.groupKey || '',
    defaultValue: item?.defaultValue || '',
    valid: item?.valid ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={item ? '编辑数据项' : '新建数据项'}>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Path *</label>
          <input
            type="text"
            value={formData.path}
            onChange={(e) => setFormData({ ...formData, path: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
            placeholder="例如: app.theme.color"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">分组 *</label>
          <select
            value={formData.groupKey}
            onChange={(e) => setFormData({ ...formData, groupKey: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          >
            <option value="">请选择</option>
            {groups.map((group: any) => (
              <option key={group.key} value={group.key}>
                {group.name} ({group.key})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">默认值 (JSON)</label>
          <textarea
            value={formData.defaultValue}
            onChange={(e) => setFormData({ ...formData, defaultValue: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
            rows={4}
            placeholder='例如: {"color": "blue"}'
          />
        </div>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="item-valid"
            checked={formData.valid}
            onChange={(e) => setFormData({ ...formData, valid: e.target.checked })}
            className="h-4 w-4 text-blue-600 rounded border-gray-300"
          />
          <label htmlFor="item-valid" className="ml-2 text-sm text-gray-700">
            启用此数据项
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
