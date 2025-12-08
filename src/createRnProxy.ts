/**
 * CreateRnProxy 模块
 * 
 * 为 React Native 原生模块提供代理包装
 */

import type { ProxyOptions, ProxiedService } from './types'
import { getRegisteredProxy, registerProxy } from './registry'

/**
 * 获取 React Native NativeModules
 * 使用动态导入避免在非 RN 环境下的构建错误
 */
function getNativeModules(): any {
  try {
    // @ts-ignore - 动态导入 react-native
    const RN = require('react-native')
    return RN.NativeModules
  } catch (error) {
    throw new Error(
      'react-native is not available. ' +
      'Make sure you are running in a React Native environment and react-native is installed.'
    )
  }
}

/**
 * 创建 React Native 原生模块代理
 * 
 * 为 React Native 原生模块创建一个 Proxy 包装器，该包装器会：
 * - 从 NativeModules[serviceName] 获取原生模块
 * - 允许覆盖部分方法实现
 * - 添加 name 和 version 字段
 * - 防止重复创建同一服务的代理
 * 
 * @template T - 服务对象的类型，必须是对象类型
 * @param originalService - 原始服务对象（可以是空对象或部分方法覆盖）
 * @param serviceName - 服务名称，用于从 NativeModules 获取原生模块
 * @param options - 代理配置选项
 * @returns 代理后的服务对象（完整的 T 类型）
 * 
 * @example
 * ```typescript
 * // 覆盖部分方法
 * const navigatorService = createRnProxy<NavigatorService>({
 *   pushUri: (action, opt) => {
 *     if (typeof opt !== 'object') {
 *       opt = { _value: opt }
 *     }
 *     // 需要手动调用原生方法
 *     const { NativeModules } = require('react-native')
 *     NativeModules.NavigatorService.pushUri(action, opt)
 *   }
 * }, 'NavigatorService', { version: '1.0.0' })
 * 
 * // 使用空对象，所有方法从原生模块获取
 * const storageService = createRnProxy<StorageService>(
 *   {}, 
 *   'StorageService'
 * )
 * ```
 */
export function createRnProxy<T extends Record<string, any>>(
  originalService: Partial<T>,
  serviceName: string,
  options: ProxyOptions = {}
): ProxiedService<T> {
  // 检查是否已创建过该服务的代理
  const existingProxyRef = getRegisteredProxy(serviceName)
  if (existingProxyRef) {
    console.warn(
      `[ServiceProxy] Service "${serviceName}" has already been proxied. ` +
      `Returning existing proxy instance to avoid duplicate creation.`
    )
    return existingProxyRef
  }

  // 从 NativeModules 获取原生模块
  const NativeModules = getNativeModules()
  const nativeModule = NativeModules[serviceName]
  if (!nativeModule) {
    throw new Error(`Native module "${serviceName}" not found in NativeModules`)
  }

  // 合并原生模块和用户提供的方法
  // 用户提供的方法会覆盖原生模块的同名方法
  const mergedService = {
    ...nativeModule,
    ...originalService
  } as Record<string, any>

  // 添加 name 和 version 字段
  const serviceVersion = options.version ?? ''
  mergedService.name = serviceName
  mergedService.version = serviceVersion

  // 创建 Proxy
  const proxy = new Proxy(mergedService, {
    get: function (_target: Record<string, any>, property: string | symbol): any {
      // 处理 name 和 version 属性
      if (property === 'name') {
        return serviceName
      }
      if (property === 'version') {
        return serviceVersion
      }

      // 返回合并后的属性
      return Reflect.get(mergedService, property)
    }
  }) as ProxiedService<T>

  // 将代理注册到全局注册表
  registerProxy(serviceName, proxy)

  if (options.debug) {
    console.log(`[ServiceProxy:${serviceName}] RN proxy created and registered, version:`, serviceVersion)
  }

  return proxy
}

