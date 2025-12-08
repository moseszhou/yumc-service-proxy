/**
 * CreateReadyProxy 模块
 * 
 * 为 Cordova/PhoneGap 原生服务提供智能代理包装，处理 deviceready 事件
 */

import type { ProxyOptions, ProxiedService, QueuedCall } from './types'
import { isThenable } from './utils'
import { deviceReadyPromise } from './deviceReady'
import { getRegisteredProxy, registerProxy } from './registry'

/**
 * 创建就绪代理
 * 
 * 为原生服务创建一个 Proxy 包装器，该包装器会：
 * - 拦截所有方法调用
 * - 在 deviceready 前将调用加入队列
 * - 在 deviceready 后直接执行调用或执行队列中的调用
 * - 动态绑定 window 对象上的原生方法（fallback）
 * - 提供超时保护、队列限制、调试日志等功能
 * 
 * @template T - 服务对象的类型，必须是对象类型
 * @param originalService - 原始服务对象（可以是空对象或部分实现，运行时会从 window[serviceName] 补全）
 * @param serviceName - 服务名称，用于从 window 对象获取原生实现
 * @param options - 代理配置选项
 * @returns 代理后的服务对象（完整的 T 类型）
 * 
 * @example
 * ```typescript
 * const navigatorService = createReadyProxy<NavigatorService>(
 *   {}, // 空对象，所有方法会从 window.navigatorService 获取
 *   'navigatorService',
 *   { debug: true, queueTimeout: 10000 }
 * )
 * 
 * // 即使在 deviceready 前调用，也会被加入队列并在就绪后执行
 * await navigatorService.push({ url: '/home' })
 * ```
 */
export function createReadyProxy<T extends Record<string, any>>(
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

  // 合并默认配置
  const config = {
    queueTimeout: options.queueTimeout ?? 30000,
    debug: options.debug ?? false,
    maxQueueSize: options.maxQueueSize ?? 300,
    ready: options.ready ?? deviceReadyPromise,
    version: options.version ?? ''
  }

  let isReady = false
  let queuedCalls: QueuedCall[] = []
  // 缓存包装后的方法，确保引用一致性并避免重复包装
  const methodCache = new Map<string | symbol, any>()

  /**
   * 调试日志输出
   */
  const log = (...args: any[]) => {
    if (config.debug) {
      console.log(`[ServiceProxy:${serviceName}]`, ...args)
    }
  }

  /**
   * 执行队列中的调用（带超时检测）
   */
  const executeQueuedCall = (call: QueuedCall) => {
    const { method, args, resolve, reject, timestamp } = call

    // 超时检测
    if (Date.now() - timestamp > config.queueTimeout) {
      const error = new Error(
        `Queued call timeout after ${config.queueTimeout}ms for service ${serviceName}`
      )
      log('Timeout:', error.message)
      reject(error)
      return
    }

    try {
      const result = method.apply(originalService, args)
      if (isThenable(result)) {
        // 使用两个参数的 .then() 来处理成功和错误
        // 因为 PromiseLike 不保证有 .catch()
        result.then(resolve, reject)
      } else {
        resolve(result)
      }
    } catch (error) {
      log('Execution error:', error)
      reject(error)
    }
  }

  /**
   * 刷新队列中的所有调用
   */
  const flushQueuedCalls = () => {
    log('Flushing queue, size:', queuedCalls.length)
    const callsToProcess = queuedCalls
    queuedCalls = []
    callsToProcess.forEach(executeQueuedCall)
  }

  // 监听就绪 Promise
  config.ready.then(() => {
    isReady = true
    flushQueuedCalls()
  })

  /**
   * 创建原生方法桥接包装器
   * 当 originalService 上不存在该方法时，尝试从 window[serviceName] 获取
   */
  const createNativeBridgeMethod = (property: string | symbol) => {
    return (...args: any[]) => {
      return new Promise<any>((resolve, reject) => {
        try {
          // 非浏览器环境检查
          if (typeof window === 'undefined') {
            reject(new Error(`Cannot call native service ${serviceName} in non-browser environment`))
            return
          }

          const nativeService = (window as any)[serviceName]
          if (typeof nativeService === 'undefined') {
            reject(new Error(`Native service ${serviceName} not found`))
            return
          }

          const nativeMethod = nativeService[property as keyof typeof nativeService]
          if (typeof nativeMethod !== 'function') {
            reject(new Error(`Method ${String(property)} is not a function in native service ${serviceName}`))
            return
          }

          log('Calling native method:', String(property))
          // Cordova 原生方法通常期望成功/失败回调作为最后两个参数
          nativeMethod.call(nativeService, ...args, resolve, reject)
        } catch (error) {
          reject(error)
        }
      })
    }
  }

  /**
   * 包装方法，处理排队逻辑
   */
  const wrapMethod = (method: Function): ((...args: any[]) => Promise<any>) => {
    return function (...args: any[]): Promise<any> {
      return new Promise((resolve, reject) => {
        if (isReady) {
          // 设备已就绪，直接执行
          try {
            const result = method.apply(originalService, args)
            if (isThenable(result)) {
              result.then(resolve, reject)
            } else {
              resolve(result)
            }
          } catch (error) {
            reject(error)
          }
          return
        }

        // 设备未就绪，加入队列
        if (queuedCalls.length >= config.maxQueueSize) {
          reject(new Error(
            `Queue size limit (${config.maxQueueSize}) reached for service ${serviceName}`
          ))
          return
        }

        log('Queueing call, new size:', queuedCalls.length + 1)
        queuedCalls.push({
          method,
          args,
          resolve,
          reject,
          timestamp: Date.now()
        })
      })
    }
  }

  /**
   * 创建 Proxy
   */
  // 将 originalService 作为内部对象，使用 Record<string, any> 类型避免与 Partial<T> 的冲突
  const internalService = originalService as Record<string, any>

  // 添加 name 和 version 字段
  const serviceVersion = config.version
  internalService.name = serviceName
  internalService.version = serviceVersion

  const proxy = new Proxy(internalService, {
    get: function (_target: Record<string, any>, property: string | symbol): any {
      // 处理 name 和 version 属性
      if (property === 'name') {
        return serviceName
      }
      if (property === 'version') {
        return serviceVersion
      }

      // 1. 先检查缓存
      if (methodCache.has(property)) {
        return methodCache.get(property)
      }

      // 2. 获取原始属性
      const value = Reflect.get(internalService, property)

      // 3. 如果是函数，包装它
      if (typeof value === 'function') {
        const wrapped = wrapMethod(value)
        methodCache.set(property, wrapped)
        return wrapped
      }

      // 4. 如果是 undefined 且属性是字符串，尝试桥接到原生
      if (typeof value === 'undefined' && typeof property === 'string') {
        log('Property not found in service, trying native bridge:', property)
        const nativeBridgeMethod = wrapMethod(createNativeBridgeMethod(property))
        methodCache.set(property, nativeBridgeMethod)
        return nativeBridgeMethod
      }

      // 5. 否则原样返回（属性、Symbol 等）
      return value
    }
  }) as ProxiedService<T>

  // 将代理注册到全局注册表
  registerProxy(serviceName, proxy)

  log('Service proxy created and registered:', serviceName, 'version:', serviceVersion)

  return proxy
}
