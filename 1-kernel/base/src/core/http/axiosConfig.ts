/**
 * Axios 配置
 * 确保在所有环境(Node.js, Browser, React Native)中使用正确的适配器
 */

// 在 React Native 环境中，直接导入 axios 的浏览器版本
// 这样可以避免 axios 尝试引入 Node.js 的 http/https/crypto 等模块
import axios from 'axios/dist/browser/axios.cjs';

export { axios };
