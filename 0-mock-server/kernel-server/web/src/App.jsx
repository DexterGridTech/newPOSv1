import { useState } from 'react';
import { EntityManagement } from './pages/EntityManagement';
import { ModelManagement } from './pages/ModelManagement';
import { UnitDataManagement } from './pages/UnitDataManagement';
import { CommandManagement } from './pages/CommandManagement';
/**
 * 主应用组件
 */
function App() {
    const [activeTab, setActiveTab] = useState(0);
    const tabs = [
        { id: 0, label: '业务主体管理' },
        { id: 1, label: '机型管理' },
        { id: 2, label: '单元数据管理' },
        { id: 3, label: '指令管理' }
    ];
    return (<div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            IMPOS2 Kernel Server 管理后台
          </h1>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-success"></div>
            <span className="text-sm text-gray-600">服务运行中</span>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (<button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === tab.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                `}>
                {tab.label}
              </button>))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="p-6">
        <div className="bg-white rounded-lg shadow p-6">
          {activeTab === 0 && <EntityManagement />}
          {activeTab === 1 && <ModelManagement />}
          {activeTab === 2 && <UnitDataManagement />}
          {activeTab === 3 && <CommandManagement />}
        </div>
      </main>
    </div>);
}
export default App;
//# sourceMappingURL=App.js.map