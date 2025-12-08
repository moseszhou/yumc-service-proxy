/**
 * 工具函数模块
 * 
 * 包含 ServiceProxy 使用的工具函数
 */

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
export function isThenable(value: any): value is PromiseLike<any> {
  return value != null && typeof value.then === 'function'
}
