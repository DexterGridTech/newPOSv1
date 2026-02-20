import { NativeModules } from 'react-native';
import type {
  IExternalCallAdapter,
  ExternalCallRequest,
  ExternalCallResponse,
  CallType,
} from '@impos2/kernel-base';

const { ExternalCallTurboModule } = NativeModules;

/**
 * ExternalCall 适配器实现
 * 封装 TurboModule 调用，提供标准化的外部调用接口
 *
 * 优化点:
 * 1. 支持多 ReactInstanceManager 场景
 * 2. 增强错误处理
 * 3. 参数验证
 */
export class ExternalCallAdapter implements IExternalCallAdapter {
  /**
   * 执行外部调用
   */
  async call<T = any>(request: ExternalCallRequest): Promise<ExternalCallResponse<T>> {
    try {
      // 参数验证
      this.validateRequest(request);

      // 将请求对象序列化为 JSON 字符串
      const requestJson = JSON.stringify(request);

      // 调用 TurboModule
      const response = await ExternalCallTurboModule.call(requestJson);

      return response as ExternalCallResponse<T>;
    } catch (error: any) {
      throw new Error(`ExternalCall failed: ${error.message || error}`);
    }
  }

  /**
   * 检查目标是否可用
   */
  async isAvailable(type: CallType, target: string): Promise<boolean> {
    try {
      return await ExternalCallTurboModule.isAvailable(type, target);
    } catch (error: any) {
      console.error('Failed to check availability:', error);
      return false;
    }
  }

  /**
   * 获取可用目标列表
   */
  async getAvailableTargets(type: CallType): Promise<string[]> {
    try {
      return await ExternalCallTurboModule.getAvailableTargets(type);
    } catch (error: any) {
      console.error('Failed to get available targets:', error);
      return [];
    }
  }

  /**
   * 取消调用
   */
  async cancel(requestId?: string): Promise<void> {
    try {
      await ExternalCallTurboModule.cancel(requestId || null);
    } catch (error: any) {
      console.error('Failed to cancel call:', error);
    }
  }

  /**
   * 验证请求参数
   */
  private validateRequest(request: ExternalCallRequest): void {
    if (!request.type) {
      throw new Error('Request type is required');
    }
    if (!request.method) {
      throw new Error('Request method is required');
    }
    if (!request.target) {
      throw new Error('Request target is required');
    }
    if (!request.action) {
      throw new Error('Request action is required');
    }
  }
}

/**
 * 导出单例实例
 */
export const externalCallAdapter = new ExternalCallAdapter();
