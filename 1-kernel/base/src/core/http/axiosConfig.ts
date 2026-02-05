/**
 * Axios 配置
 * 确保在所有环境(Node.js, Browser, React Native)中使用正确的适配器
 */

// 在 React Native 环境中，使用标准的 axios 导入
// axios 会自动选择合适的适配器（XMLHttpRequest for RN）
import axios from 'axios';

export { axios };
