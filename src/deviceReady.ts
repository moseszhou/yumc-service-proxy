/**
 * DeviceReady 模块
 * 
 * 处理 Cordova/PhoneGap 的 deviceready 事件
 */

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
export const deviceReadyPromise = (() => {
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
