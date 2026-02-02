/**
 * Axios 配置
 * 确保在所有环境(Node.js, Browser, React Native)中使用正确的适配器
 */

import axios from 'axios';

// 检测运行环境
const isReactNative =
  typeof navigator !== 'undefined' &&
  (navigator as any).product === 'ReactNative';

const isBrowser =
  typeof globalThis !== 'undefined' &&
  (globalThis as any).window !== undefined &&
  (globalThis as any).window.document !== undefined;

// 配置 axios 默认适配器
if (isReactNative || isBrowser) {
  // 在 React Native 和浏览器环境中,强制使用 xhr 适配器
  // 这样可以避免 axios 尝试引入 Node.js 的 http/https/http2 模块
  (axios.defaults as any).adapter = 'xhr';
}

export { axios };
