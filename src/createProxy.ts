import type { ProxiedService, ProxyOptions } from './types'
import { attachCanIUse } from './canIUse'

type FallbackTarget = {
  name: string
  version: string
}

/**
 * 创建小程序/其它非 Native 环境的降级代理。
 *
 * 小程序环境不存在 H5 的 window native service，也不存在 RN 的 NativeModules。
 * 因此所有能力检查都返回 false，所有业务方法都降级为空函数，避免运行期抛错。
 *
 * @template T - 服务对象的类型。
 * @param originalService - 原始服务对象；小程序降级实现不会调用其中的方法。
 * @param serviceName - 服务名称。
 * @param options - 代理配置选项。
 * @returns 小程序/其它平台使用的降级代理对象。
 */
export function createReadyProxy<T extends object>(
  originalService: Partial<T> | (({ service }: { service: T }) => Partial<T>),
  serviceName: string,
  options: ProxyOptions = {}
): ProxiedService<T> {
  void originalService

  const noop = () => undefined
  const target: FallbackTarget = {
    name: serviceName,
    version: options.version ?? ''
  }
  const canIUse = attachCanIUse(target, {
    // 小程序端没有 native service；所有能力检查固定不可用。
    isAllowed: () => false
  })

  return new Proxy(target, {
    get(currentTarget, property) {
      // Step 1: 保留代理内置属性，保证跨端 API 形态一致。
      if (property === 'name') {
        return serviceName
      }
      if (property === 'version') {
        return target.version
      }
      if (property === 'canIUse') {
        return canIUse
      }

      // Step 2: 小程序端没有 native 方法，其它所有方法统一降级为空函数。
      if (typeof property === 'string') {
        return noop
      }

      return Reflect.get(currentTarget, property)
    }
  }) as ProxiedService<T>
}
