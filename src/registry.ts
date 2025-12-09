/**
 * 代理注册表模块
 * 
 * 管理已创建的服务代理实例，防止重复创建
 */

/**
 * 全局代理注册表，用于追踪已创建的服务代理
 * 键为 serviceName，值为代理实例
 */
const proxyRegistry = new Map<string, any>()

/**
 * 获取已注册的代理实例
 * 
 * @param serviceName - 服务名称
 * @returns 如果存在则返回代理实例，否则返回 undefined
 */
export function getRegisteredProxy(serviceName: string): any | undefined {
  return proxyRegistry.get(serviceName)
}

/**
 * 注册新的代理实例
 * 
 * @param serviceName - 服务名称
 * @param proxy - 代理实例
 */
export function registerProxy(serviceName: string, proxy: any): void {
  proxyRegistry.set(serviceName, proxy)
}

/**
 * 清空代理注册表（主要用于测试）
 */
export function clearRegistry(): void {
  proxyRegistry.clear()
}
