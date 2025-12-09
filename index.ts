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

// 导出主要功能函数
export { createReadyProxy } from './src/createReadyProxy'
export { createRnProxy } from './src/createRnProxy'