/**
 * ServiceProxy - 原生服务代理模块
 * 
 * 为 Cordova/PhoneGap 原生服务提供智能代理包装，处理 deviceready 事件，
 * 在设备未就绪时缓存方法调用，就绪后自动执行，并提供统一的 Promise 接口。
 * 
 * @module serviceProxy
 */

/**
 * 队列调用项接口
 * 用于存储在 deviceready 前被调用的方法信息
 */
interface QueuedCall {
  /** 要执行的方法 */
  method: Function
  /** 方法参数 */
  args: any[]
  /** Promise 的 resolve 回调 */
  resolve: (value?: any) => void
  /** Promise 的 reject 回调 */
  reject: (reason?: any) => void
  /** 调用时间戳，用于超时检测 */
  timestamp: number
}

/**
 * 代理配置选项
 */
export interface ProxyOptions {
  /** 队列调用的超时时间（毫秒），默认 30000ms */
  queueTimeout?: number
  /** 是否启用调试日志，默认 false */
  debug?: boolean
  /** 最大队列大小，防止内存泄漏，默认 300 */
  maxQueueSize?: number
  /** 自定义就绪 Promise（主要用于测试），默认为 deviceReadyPromise */
  ready?: Promise<void>
}

/**
 * 类型守卫：判断一个值是否为 Promise-like 对象（具有 `then` 方法）
 * 
 * 相比 `instanceof Promise`，此方法兼容性更好，可以处理：
 * - 原生 Promise
 * - Thenable 对象（实现了 then 方法的对象）
 * - 跨 realm/iframe 的 Promise
 * 
 * @param value - 要检查的值
 * @returns 如果值是 thenable 则返回 true，否则返回 false
 */
function isThenable(value: any): value is PromiseLike<any> {
  return value != null && typeof value.then === 'function'
}

/**
 * 共享的 deviceready Promise 单例
 * 
 * 优点：
 * - 整个应用只创建一次，避免重复的事件监听器
 * - 支持 SSR 环境（检查 document 是否存在）
 * - 支持 Cordova 已就绪场景（检查 fired 状态）
 * - 所有代理实例共享同一个就绪状态
 * 
 * 实现细节：
 * - 使用 IIFE 立即执行，创建单例
 * - 检查 window.cordova.channels.deviceReady.fired 处理已触发场景
 * - 使用 once: true 确保事件监听器只执行一次
 */
const deviceReadyPromise = (() => {
  // SSR 环境检查
  if (typeof document === 'undefined') {
    return Promise.resolve()
  }

  let resolved = false
  let resolveReady!: () => void

  const promise = new Promise<void>(resolve => {
    resolveReady = () => {
      if (!resolved) {
        resolved = true
        resolve()
      }
    }
  })

  // 检查 Cordova deviceready 是否已经触发
  if (typeof window !== 'undefined' && (window as any).cordova?.channels?.deviceReady?.fired) {
    resolveReady()
  } else {
    document.addEventListener('deviceready', resolveReady, { once: true })
  }

  return promise
})()

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
): T {
  // 合并默认配置
  const config: Required<ProxyOptions> = {
    queueTimeout: options.queueTimeout ?? 30000,
    debug: options.debug ?? false,
    maxQueueSize: options.maxQueueSize ?? 300,
    ready: options.ready ?? deviceReadyPromise
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

  return new Proxy(internalService, {
    get: function (_target: Record<string, any>, property: string | symbol): any {
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
  }) as T
}
