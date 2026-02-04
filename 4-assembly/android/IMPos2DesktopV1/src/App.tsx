/**
 * IMPos2 Desktop V1 - 整合层应用入口
 * @format
 */

console.log('========== App.tsx 开始加载 ==========');

import React, { useState, useEffect } from 'react';
import TestScreen from './TestScreen';

// 尝试导入 SplashScreen，如果不存在则使用 null（副屏模式）
let SplashScreen: any = null;
try {
  SplashScreen = require('react-native-splash-screen').default;
  console.log('========== SplashScreen 模块加载成功 ==========');
} catch (e) {
  console.log('========== SplashScreen 模块不存在（副屏模式）==========');
}

console.log('========== App.tsx 导入完成 ==========');
console.log('SplashScreen 模块是否存在:', !!SplashScreen);
console.log('SplashScreen.hide 方法是否存在:', !!(SplashScreen && SplashScreen.hide));

// 定义 Props 接口
interface AppProps {
  screenType?: string;
  displayId?: number;
  displayName?: string;
}

function App(props: AppProps): React.JSX.Element {
  console.log('========== App 组件函数被调用 ==========');
  console.log('接收到的 props:', props);


  useEffect(() => {
    console.log('========== App useEffect 执行 ==========');
    console.log('当前屏幕类型:', props.screenType);

    // 简单的初始化逻辑
    const initializeApp = async () => {
      try {
        console.log('开始初始化应用...');

        // 延迟一小段时间确保所有资源加载完成
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('应用初始化完成');

        // 只在主屏模式下隐藏原生启动屏
        // 副屏不需要处理启动屏，因为副屏的 ReactInstanceManager 中没有 SplashScreenReactPackage
        if (props.screenType === 'primary' || !props.screenType) {
          console.log('主屏模式，准备隐藏启动屏');
          if (SplashScreen && typeof SplashScreen.hide === 'function') {
            SplashScreen.hide();
            console.log('主屏启动屏已隐藏');
          } else {
            console.warn('SplashScreen 模块未正确加载');
          }
        } else {
          console.log('副屏模式，无需处理启动屏');
        }
      } catch (err) {
        console.error('应用初始化失败:', err);
        // 确保主屏的启动屏被隐藏
        if ((props.screenType === 'primary' || !props.screenType) &&
            SplashScreen && typeof SplashScreen.hide === 'function') {
          SplashScreen.hide();
        }
      }
    };

    initializeApp();
  }, []);

  console.log('App 组件准备渲染');


  // 加载测试界面
  return <TestScreen {...props} />;
}

export default App;
