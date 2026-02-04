/**
 * IMPos2 Desktop V1 - 整合层应用入口
 * @format
 */

import React from 'react';
import {AppProps} from "./types/AppProps.ts";
import RootApplication from "./RootApplication.tsx";
import TestScreen from "./TestScreen.tsx";

// 定义 Props 接口

function App(props: AppProps): React.JSX.Element {
    // // 加载应用界面
    return <RootApplication {...props} />;
    //加载测试界面
    // return <TestScreen {...props} />;
}

export default App;
