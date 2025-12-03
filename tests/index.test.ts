import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'

type Listener = { cb: (event?: any) => void; once: boolean }

/**
 * 创建 document 的模拟对象，支持事件监听和触发
 */
const createDocumentStub = () => {
  const listeners = new Map<string, Listener[]>()

  return {
    addEventListener: (type: string, cb: (event?: any) => void, options?: { once?: boolean } | boolean) => {
      const once = typeof options === 'boolean' ? options : Boolean(options?.once)
      const list = listeners.get(type) ?? []
      list.push({ cb, once })
      listeners.set(type, list)
    },
    dispatchEvent: (event: any) => {
      const type = typeof event === 'string' ? event : event?.type
      if (!type) return
      const list = listeners.get(type)
      if (!list) return
      list.slice().forEach((listener, index) => {
        listener.cb(event)
        if (listener.once) {
          list.splice(index, 1)
        }
      })
    }
  }
}

/**
 * 设置全局对象（document 和 window）
 */
const setGlobals = (doc: any, win: any) => {
  ; (global as any).document = doc
    ; (global as any).window = win
}

/**
 * 清除全局对象
 */
const clearGlobals = (doc: any, win: any) => {
  if (doc === undefined) {
    delete (global as any).document
  } else {
    ; (global as any).document = doc
  }
  if (win === undefined) {
    delete (global as any).window
  } else {
    ; (global as any).window = win
  }
}

/**
 * 动态导入 serviceProxyBest 模块
 */
const importProxy = async () => {
  jest.resetModules()
  return import('../index')
}

let originalDocument: any
let originalWindow: any

beforeEach(() => {
  originalDocument = (global as any).document
  originalWindow = (global as any).window
})

afterEach(() => {
  clearGlobals(originalDocument, originalWindow)
})

describe('createReadyProxy - Basic Functionality', () => {
  it('queues calls until deviceready then flushes', async () => {
    const documentStub = createDocumentStub()
    setGlobals(documentStub, {})
    const { createReadyProxy } = await importProxy()

    const service: { foo: (...args: any[]) => Promise<string> } = {
      foo: jest.fn(async (_arg?: any) => 'ok')
    }
    const proxy = createReadyProxy(service, 'svc')

    const promise = proxy.foo('bar')
    let settled = false
    promise.then(() => {
      settled = true
    })

    await Promise.resolve()
    expect(settled).toBe(false)

    documentStub.dispatchEvent({ type: 'deviceready' })
    const result = await promise

    expect(settled).toBe(true)
    expect(result).toBe('ok')
    expect(service.foo).toHaveBeenCalledWith('bar')
  })

  it('runs immediately if device already ready (cordova.fired)', async () => {
    const documentStub = createDocumentStub()
    const windowStub = { cordova: { channels: { deviceReady: { fired: true } } } }
    setGlobals(documentStub, windowStub)
    const { createReadyProxy } = await importProxy()

    const service: { foo: (...args: any[]) => Promise<string> } = {
      foo: jest.fn(async (_arg?: any) => 'ok')
    }
    const proxy = createReadyProxy(service, 'svc')

    const result = await proxy.foo('now')
    expect(result).toBe('ok')
    expect(service.foo).toHaveBeenCalledWith('now')
  })

  it('runs immediately if custom ready promise provided', async () => {
    const documentStub = createDocumentStub()
    setGlobals(documentStub, {})
    const { createReadyProxy } = await importProxy()

    const service: { foo: (...args: any[]) => Promise<string> } = {
      foo: jest.fn(async (_arg?: any) => 'ok')
    }
    const proxy = createReadyProxy(service, 'svc', { ready: Promise.resolve() })

    const result = await proxy.foo('immediately')
    expect(result).toBe('ok')
    expect(service.foo).toHaveBeenCalledWith('immediately')
  })

  it('bridges to native service methods when not on original object', async () => {
    const documentStub = createDocumentStub()
    const windowStub: any = {}
    windowStub.nativeService = {
      hello: jest.fn((name: string, resolve: (value: any) => void) => resolve(`hi ${name}`))
    }
    setGlobals(documentStub, windowStub)
    const { createReadyProxy } = await importProxy()

    const proxy = createReadyProxy<Record<string, any>>({}, 'nativeService', { ready: Promise.resolve() })
    const result = await proxy.hello('bob')

    expect(result).toBe('hi bob')
    expect(windowStub.nativeService.hello).toHaveBeenCalled()
  })

  it('rejects when native service missing', async () => {
    const documentStub = createDocumentStub()
    setGlobals(documentStub, {})
    const { createReadyProxy } = await importProxy()

    const proxy = createReadyProxy<Record<string, any>>({}, 'missingService', { ready: Promise.resolve() })
    await expect(proxy.someMethod()).rejects.toThrow(/missingService|not found/i)
  })

  it('awaits thenable results', async () => {
    const documentStub = createDocumentStub()
    setGlobals(documentStub, {})
    const { createReadyProxy } = await importProxy()

    const thenableService = {
      foo: () => ({
        then: (resolve: (value: any) => void) => resolve('thenable')
      })
    }
    const proxy = createReadyProxy(thenableService, 'svc', { ready: Promise.resolve() })
    await expect(proxy.foo()).resolves.toBe('thenable')
  })

  it('supports empty object with type annotation', async () => {
    const documentStub = createDocumentStub()
    const windowStub: any = {}
    windowStub.MyService = {
      doSomething: jest.fn((arg: string, resolve: (value: any) => void) => resolve(`done ${arg}`))
    }
    setGlobals(documentStub, windowStub)
    const { createReadyProxy } = await importProxy()

    interface MyService {
      doSomething: (arg: string) => Promise<string>
    }

    // 空对象，但类型为 MyService
    const proxy = createReadyProxy<MyService>({}, 'MyService', { ready: Promise.resolve() })
    const result = await proxy.doSomething('test')

    expect(result).toBe('done test')
  })
})

describe('createReadyProxy - Timeout Protection', () => {
  it('rejects queued calls that exceed timeout', async () => {
    const documentStub = createDocumentStub()
    setGlobals(documentStub, {})
    const { createReadyProxy } = await importProxy()

    const service = {
      foo: jest.fn(async () => 'ok')
    }

    // 设置超时为 100ms
    const proxy = createReadyProxy(service, 'svc', { queueTimeout: 100 })

    const promise = proxy.foo()

    // 等待超过超时时间
    await new Promise(resolve => setTimeout(resolve, 150))

    // 现在触发 deviceready
    documentStub.dispatchEvent({ type: 'deviceready' })

    // 应该被拒绝并提示超时
    await expect(promise).rejects.toThrow(/timeout/i)
  })

  it('does not timeout if deviceready fires in time', async () => {
    const documentStub = createDocumentStub()
    setGlobals(documentStub, {})
    const { createReadyProxy } = await importProxy()

    const service = {
      foo: jest.fn(async () => 'ok')
    }

    const proxy = createReadyProxy(service, 'svc', { queueTimeout: 1000 })

    const promise = proxy.foo()

    // 在超时前触发
    await new Promise(resolve => setTimeout(resolve, 50))
    documentStub.dispatchEvent({ type: 'deviceready' })

    await expect(promise).resolves.toBe('ok')
  })
})

describe('createReadyProxy - Queue Size Limit', () => {
  it('rejects new calls when queue is full', async () => {
    const documentStub = createDocumentStub()
    setGlobals(documentStub, {})
    const { createReadyProxy } = await importProxy()

    const service = {
      foo: jest.fn(async () => 'ok')
    }

    // 设置最大队列大小为 3
    const proxy = createReadyProxy(service, 'svc', { maxQueueSize: 3 })

    // 添加 3 个调用（达到上限）
    const promise1 = proxy.foo()
    const promise2 = proxy.foo()
    const promise3 = proxy.foo()

    // 第 4 个调用应该被拒绝
    await expect(proxy.foo()).rejects.toThrow(/queue size limit/i)

    // 前 3 个应该成功
    documentStub.dispatchEvent({ type: 'deviceready' })
    await expect(promise1).resolves.toBe('ok')
    await expect(promise2).resolves.toBe('ok')
    await expect(promise3).resolves.toBe('ok')
  })
})

describe('createReadyProxy - Debug Mode', () => {
  it('logs debug messages when debug=true', async () => {
    const documentStub = createDocumentStub()
    setGlobals(documentStub, {})
    const { createReadyProxy } = await importProxy()

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { })

    const service = {
      foo: jest.fn(async () => 'ok')
    }

    const proxy = createReadyProxy(service, 'svc', { debug: true })

    proxy.foo()
    documentStub.dispatchEvent({ type: 'deviceready' })
    await new Promise(resolve => setTimeout(resolve, 10))

    // 应该有日志输出
    expect(consoleSpy).toHaveBeenCalled()
    const calls = consoleSpy.mock.calls
    const hasServiceProxyLog = calls.some(call =>
      call.some(arg => typeof arg === 'string' && arg.includes('ServiceProxy'))
    )
    expect(hasServiceProxyLog).toBe(true)

    consoleSpy.mockRestore()
  })

  it('does not log when debug=false (default)', async () => {
    const documentStub = createDocumentStub()
    setGlobals(documentStub, {})
    const { createReadyProxy } = await importProxy()

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { })

    const service = {
      foo: jest.fn(async () => 'ok')
    }

    const proxy = createReadyProxy(service, 'svc') // debug 默认为 false

    proxy.foo()
    documentStub.dispatchEvent({ type: 'deviceready' })
    await new Promise(resolve => setTimeout(resolve, 10))

    // 不应该有 ServiceProxy 的日志
    const calls = consoleSpy.mock.calls
    const hasServiceProxyLog = calls.some(call =>
      call.some(arg => typeof arg === 'string' && arg.includes('ServiceProxy'))
    )
    expect(hasServiceProxyLog).toBe(false)

    consoleSpy.mockRestore()
  })
})

describe('createReadyProxy - Custom Configuration', () => {
  it('accepts all configuration options', async () => {
    const documentStub = createDocumentStub()
    setGlobals(documentStub, {})
    const { createReadyProxy } = await importProxy()

    const service = {
      foo: jest.fn(async () => 'ok')
    }

    let resolveCustom!: () => void
    const customReady = new Promise<void>(resolve => {
      resolveCustom = resolve
    })

    const proxy = createReadyProxy(service, 'svc', {
      queueTimeout: 5000,
      debug: false,
      maxQueueSize: 50,
      ready: customReady
    })

    const promise = proxy.foo()

    // 手动触发自定义 ready
    resolveCustom()
    await expect(promise).resolves.toBe('ok')
  })
})

describe('createReadyProxy - Error Handling', () => {
  it('handles synchronous errors in service methods', async () => {
    const documentStub = createDocumentStub()
    setGlobals(documentStub, {})
    const { createReadyProxy } = await importProxy()

    const service = {
      foo: jest.fn(() => {
        throw new Error('sync error')
      })
    }

    const proxy = createReadyProxy(service, 'svc', { ready: Promise.resolve() })

    await expect(proxy.foo()).rejects.toThrow('sync error')
  })

  it('handles async errors in service methods', async () => {
    const documentStub = createDocumentStub()
    setGlobals(documentStub, {})
    const { createReadyProxy } = await importProxy()

    const service = {
      foo: jest.fn(async () => {
        throw new Error('async error')
      })
    }

    const proxy = createReadyProxy(service, 'svc', { ready: Promise.resolve() })

    await expect(proxy.foo()).rejects.toThrow('async error')
  })
})
