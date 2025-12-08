/**
 * ServiceProxy - 原生服务代理模块
 * 
 * 为 Cordova/PhoneGap 原生服务提供智能代理包装，处理 deviceready 事件，
 * 在设备未就绪时缓存方法调用，就绪后自动执行，并提供统一的 Promise 接口。
 * 
 * @module serviceProxy
 */

// 导出类型定义
export type { ProxyOptions, ProxiedService, QueuedCall } from './src/types'

// 导出工具函数
export { isThenable } from './src/utils'

// 导出 deviceReady 相关
export { deviceReadyPromise } from './src/deviceReady'

// 导出代理注册表函数
export { getRegisteredProxy, registerProxy } from './src/registry'

// 导出主要功能函数
export { createReadyProxy } from './src/createReadyProxy'

// 导出 createRnProxy（RN 环境专用）
// 使用延迟加载避免在非 RN 环境编译时引入 react-native
import type { ProxyOptions, ProxiedService } from './src/types'

/**
 * 创建 React Native 原生模块代理
 * 
 * ⚠️ 注意：此函数只能在 React Native 环境中使用
 * 非 RN 环境调用会抛出错误
 * 
 * @template T - 服务对象的类型
 * @param originalService - 原始服务对象
 * @param serviceName - 服务名称
 * @param options - 配置选项
 * @returns 代理后的服务对象
 */
export function createRnProxy<T extends Record<string, any>>(
  originalService: Partial<T> | ((service: T) => Partial<T>),
  serviceName: string,
  options?: ProxyOptions
): ProxiedService<T> {
  // 延迟加载 createRnProxy 实现，避免在非 RN 环境编译时导入
  try {
    // @ts-ignore - 动态导入
    const { createRnProxy: createRnProxyImpl } = require('./src/createRnProxy')
    return createRnProxyImpl(originalService, serviceName, options)
  } catch (error) {
    throw new Error(
      'createRnProxy can only be used in React Native environment. ' +
      'Make sure react-native is installed and you are running in RN environment. ' +
      `Original error: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

