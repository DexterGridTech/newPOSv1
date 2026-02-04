/**
 * IMPos2 Desktop V1 - 整合层应用入口
 * @format
 */

import React from 'react';
import TestScreen from './TestScreen';

// 定义 Props 接口
interface AppProps {
  screenType?: string;
  displayId?: number;
  displayName?: string;
}

function App(props: AppProps): React.JSX.Element {
  // 加载测试界面
  return <TestScreen {...props} />;
}

export default App;
