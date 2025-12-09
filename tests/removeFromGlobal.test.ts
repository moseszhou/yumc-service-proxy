/**
 * removeFromGlobal 功能测试
 * 测试从全局 NativeModules 中移除模块引用的安全功能
 */

// 在导入前先 mock react-native
const mockNativeModules: Record<string, any> = {
  SecureService: {
    publicMethod: jest.fn(() => 'public'),
    privateMethod: jest.fn(() => 'private')
  },
  TestService2: {
    method1: jest.fn(() => 'result1')
  }
}

// Mock react-native 模块
jest.mock('react-native', () => ({
  NativeModules: mockNativeModules
}), { virtual: true })

import { createRnProxy } from '../src/createRnProxy'
import { clearRegistry } from '../src/registry'

describe('removeFromGlobal 功能测试', () => {
  beforeEach(() => {
    clearRegistry()
    // 重置 mock NativeModules
    mockNativeModules.SecureService = {
      publicMethod: jest.fn(() => 'public'),
      privateMethod: jest.fn(() => 'private')
    }
    mockNativeModules.TestService2 = {
      method1: jest.fn(() => 'result1')
    }
  })

  test('默认行为：不从全局移除', () => {
    createRnProxy<any>(
      {},
      'TestService2',
      {
        functions: ['method1'],
        enforceMethodFilter: false
        // removeFromGlobal 默认为 false
      }
    )

    // NativeModules 中应该仍然存在
    expect(mockNativeModules.TestService2).toBeDefined()
    expect(mockNativeModules.TestService2.method1).toBeDefined()
  })

  test('enforceMethodFilter: true 时，默认从全局移除', () => {
    createRnProxy<any>(
      {},
      'SecureService',
      {
        functions: ['publicMethod'],
        enforceMethodFilter: true
        // removeFromGlobal 默认与 enforceMethodFilter 一致，即 true
      }
    )

    // NativeModules 中应该已被移除
    expect(mockNativeModules.SecureService).toBeUndefined()
  })

  test('显式设置 removeFromGlobal: false，不从全局移除', () => {
    clearRegistry()

    createRnProxy<any>(
      {},
      'SecureService',
      {
        functions: ['publicMethod'],
        enforceMethodFilter: true,
        removeFromGlobal: false // 显式不移除
      }
    )

    // NativeModules 中应该仍然存在
    expect(mockNativeModules.SecureService).toBeDefined()
  })

  test('显式设置 removeFromGlobal: true，从全局移除', () => {
    clearRegistry()

    createRnProxy<any>(
      {},
      'SecureService',
      {
        functions: ['publicMethod'],
        enforceMethodFilter: false,
        removeFromGlobal: true // 显式移除
      }
    )

    // NativeModules 中应该已被移除
    expect(mockNativeModules.SecureService).toBeUndefined()
  })

  test('从全局移除后，代理仍然可以正常工作', () => {
    clearRegistry()

    const service = createRnProxy<any>(
      {},
      'SecureService',
      {
        functions: ['publicMethod'],
        enforceMethodFilter: true,
        removeFromGlobal: true
      }
    )

    // 全局已移除
    expect(mockNativeModules.SecureService).toBeUndefined()

    // 但代理仍然可以访问允许的方法
    expect(service.publicMethod).toBeDefined()
    expect(service.publicMethod()).toBe('public')

    // 不允许的方法返回 undefined
    expect(service.privateMethod).toBeUndefined()
  })

  test('debug 模式下会输出移除日志', () => {
    clearRegistry()
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

    createRnProxy<any>(
      {},
      'SecureService',
      {
        functions: ['publicMethod'],
        enforceMethodFilter: true,
        removeFromGlobal: true,
        debug: true
      }
    )

    // 应该输出移除日志
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[ServiceProxy:SecureService] Removed from global NativeModules')
    )

    consoleSpy.mockRestore()
  })
})
