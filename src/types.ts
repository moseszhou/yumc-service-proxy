/**
 * 类型定义模块
 * 
 * 包含 ServiceProxy 所有的类型定义和接口
 */

/**
 * 队列调用项接口
 * 用于存储在 deviceready 前被调用的方法信息
 */
export interface QueuedCall {
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
  /** 服务版本号 */
  version?: string
  /** 服务函数列表  对外暴露属性列表(接口或者属性) */
  properties?: string[]
  /** 是否强制执行方法过滤（只暴露 functions 中指定的方法），默认 false */
  enforceMethodFilter?: boolean
  /** 是否从全局 NativeModules 中移除该模块（仅 createRnProxy），默认与 enforceMethodFilter 保持一致 */
  removeFromGlobal?: boolean
}

/**
 * 代理服务返回类型
 * 在原始服务类型基础上添加 name 和 version 字段
 */
export type ProxiedService<T> = T & {
  /** 服务名称 */
  name: string
  /** 服务版本 */
  version: string
}
