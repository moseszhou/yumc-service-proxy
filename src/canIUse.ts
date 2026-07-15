/**
 * 获取当前用于 canIUse 检查的服务对象。
 *
 * @returns 当前服务对象；服务不存在时返回 null 或 undefined。
 */
export type CanIUseServiceResolver = () => object | null | undefined

/**
 * canIUse 检查器配置。
 */
export interface CanIUseOptions {
  /**
   * 检查前需要等待的平台就绪 Promise。
   */
  ready?: Promise<void>
  /**
   * 判断方法名是否允许暴露。
   *
   * @param functionName - 要检查的方法名。
   * @returns 如果方法名允许暴露则返回 true，否则返回 false。
   */
  isAllowed?: (functionName: string) => boolean
}

/**
 * canIUse 挂载配置。
 */
export interface AttachCanIUseOptions extends CanIUseOptions {
  /**
   * 获取实际用于 canIUse 检查的服务对象。
   *
   * @returns 当前服务对象；服务不存在时返回 null 或 undefined。
   */
  resolveService?: CanIUseServiceResolver
}

/**
 * 创建服务方法可用性检查器。
 *
 * @param resolveService - 获取当前服务对象的方法。
 * @param options - canIUse 检查器配置。
 * @returns 异步检查指定方法名是否为可调用函数的方法。
 */
export function createCanIUse(resolveService: CanIUseServiceResolver, options: CanIUseOptions = {}): (functionName: string) => Promise<boolean> {
  return async (functionName: string): Promise<boolean> => {
    // Step 1: 无效方法名和 canIUse 自身不作为业务能力暴露。
    if (!functionName || functionName === 'canIUse') {
      return false
    }

    // Step 2: 如果调用方提供了白名单判断，先确认该方法允许被代理暴露。
    if (options.isAllowed && !options.isAllowed(functionName)) {
      return false
    }

    try {
      // Step 3: H5 需要等待 ready；RN 不传 ready，会立即继续检查。
      if (options.ready) {
        await options.ready
      }

      // Step 4: 动态获取当前平台真实服务对象，H5 ready 前可能还不存在。
      const service = resolveService()
      if (!service) {
        return false
      }

      // Step 5: 只有真实服务对象上存在同名函数时，才认为该能力可用。
      return typeof Reflect.get(service, functionName) === 'function'
    } catch {
      return false
    }
  }
}

/**
 * 将 canIUse 方法挂载到服务对象上。
 *
 * @param service - 需要挂载 canIUse 方法的服务对象。
 * @param options - canIUse 挂载配置。
 * @returns 已挂载到服务对象上的 canIUse 方法。
 */
export function attachCanIUse(service: object, options: AttachCanIUseOptions = {}): (functionName: string) => Promise<boolean> {
  const canIUse = createCanIUse(options.resolveService ?? (() => service), options)

  Object.defineProperty(service, 'canIUse', {
    value: canIUse,
    enumerable: false,
    configurable: false,
    writable: false,
  })

  return canIUse
}
