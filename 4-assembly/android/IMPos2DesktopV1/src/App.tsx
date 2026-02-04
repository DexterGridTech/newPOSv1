/**
 * IMPos2 Desktop V1 - 整合层应用入口
 * @format
 */

console.log('========== App.tsx 开始加载 ==========');

import React from 'react';
import TestScreen from './TestScreen';

console.log('========== App.tsx 导入完成 ==========');

// 定义 Props 接口
interface AppProps {
  screenType?: string;
  displayId?: number;
  displayName?: string;
}

function App(props: AppProps): React.JSX.Element {
  console.log('========== App 组件函数被调用 ==========');
  console.log('接收到的 props:', props);
  console.log('App 组件准备渲染');

  // 加载测试界面
  return <TestScreen {...props} />;
}

export default App;
