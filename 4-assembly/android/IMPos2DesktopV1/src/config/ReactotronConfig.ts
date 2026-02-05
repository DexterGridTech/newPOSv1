/**
 * Reactotron 配置
 * 用于 React Native 应用的调试工具，可以查看 Redux state、action、网络请求等
 */
import Reactotron from 'reactotron-react-native';
import { reactotronRedux } from 'reactotron-redux';
import { Platform } from 'react-native';

/**
 * 配置 Reactotron
 * 注意：只在开发环境下启用
 *
 * Android 设备需要使用 adb reverse 转发端口：
 * /Users/dexter/Library/Android/sdk/platform-tools/adb reverse tcp:9090 tcp:9090
 */
const reactotron = Reactotron
  .configure({
    name: 'IMPos2 Desktop V1', // 应用名称
    host: 'localhost', // 使用 localhost，需要 adb reverse 转发端口
  })
  .useReactNative({
    asyncStorage: false, // 如果使用 AsyncStorage，设为 true
    networking: {
      ignoreUrls: /symbolicate/, // 忽略 symbolicate 请求
    },
    editor: false, // 设为 true 可以在 Reactotron 中打开文件
    errors: { veto: (stackFrame) => false }, // 控制错误显示
    overlay: false, // 在 RN 应用上显示 overlay
  })
  .use(reactotronRedux()) // Redux 插件
  .connect(); // 连接到 Reactotron 应用

// 在开发环境下暴露到全局，方便调试
if (__DEV__) {
  console.tron = reactotron;
  console.log('Reactotron 已配置并连接');
}

export default reactotron;
