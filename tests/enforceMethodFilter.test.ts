/**
 * 方法过滤功能测试
 */

// 在导入前先 mock react-native
const mockNativeModules = {
  TestService: {
    method1: jest.fn(() => 'result1'),
    method2: jest.fn(() => 'result2'),
    method3: jest.fn(() => 'result3'),
    secretMethod: jest.fn(() => 'secret')
  }
}

// Mock react-native 模块
jest.mock('react-native', () => ({
  NativeModules: mockNativeModules
}), { virtual: true })

import { createRnProxy } from '../src/createRnProxy'
import { clearRegistry } from '../src/registry'

describe('enforceMethodFilter 功能测试', () => {
  beforeEach(() => {
    // 清除注册表，避免测试间干扰
    clearRegistry()
    // 重置 mockNativeModules.TestService，因为可能在之前的测试中被删除
    mockNativeModules.TestService = {
      method1: jest.fn(() => 'result1'),
      method2: jest.fn(() => 'result2'),
      method3: jest.fn(() => 'result3'),
      secretMethod: jest.fn(() => 'secret')
    }
  })

  test('默认不启用方法过滤 - 可以访问所有方法', () => {
    const service = createRnProxy<any>(
      {},
      'TestService',
      {
        functions: ['method1', 'method2']
        // enforceMethodFilter 默认为 false
      }
    )

    // 所有方法都应该可以访问
    expect(service.method1).toBeDefined()
    expect(service.method2).toBeDefined()
    expect(service.method3).toBeDefined()
    expect(service.secretMethod).toBeDefined()
  })

  test('enforceMethodFilter: false - 可以访问所有方法', () => {
    clearRegistry()
    const service = createRnProxy<any>(
      {},
      'TestService',
      {
        functions: ['method1', 'method2'],
        enforceMethodFilter: false
      }
    )

    // 所有方法都应该可以访问
    expect(service.method1).toBeDefined()
    expect(service.method2).toBeDefined()
    expect(service.method3).toBeDefined()
    expect(service.secretMethod).toBeDefined()
  })

  test('enforceMethodFilter: true - 只能访问 functions 中的方法', () => {
    clearRegistry()
    const service = createRnProxy<any>(
      {},
      'TestService',
      {
        functions: ['method1', 'method2'],
        enforceMethodFilter: true
      }
    )

    // 只有 functions 中的方法可以访问
    expect(service.method1).toBeDefined()
    expect(service.method2).toBeDefined()

    // 不在 functions 中的方法应该返回 undefined
    expect(service.method3).toBeUndefined()
    expect(service.secretMethod).toBeUndefined()
  })

  test('enforceMethodFilter: true 但 functions 为空 - 由于长度检查不会过滤', () => {
    clearRegistry()
    const service = createRnProxy<any>(
      {},
      'TestService',
      {
        functions: [],
        enforceMethodFilter: true
      }
    )

    // functions 为空数组时，长度检查会跳过过滤逻辑
    expect(service.method1).toBeDefined()
    expect(service.method2).toBeDefined()
  })

  test('name 和 version 始终可以访问', () => {
    clearRegistry()
    const service = createRnProxy<any>(
      {},
      'TestService',
      {
        functions: ['method1'],
        enforceMethodFilter: true,
        version: '1.0.0'
      }
    )

    // name 和 version 不受过滤影响
    expect(service.name).toBe('TestService')
    expect(service.version).toBe('1.0.0')
  })

  test('可以执行允许的方法', () => {
    clearRegistry()
    const service = createRnProxy<any>(
      {},
      'TestService',
      {
        functions: ['method1', 'method2'],
        enforceMethodFilter: true
      }
    )

    // 执行允许的方法
    expect(service.method1()).toBe('result1')
    expect(service.method2()).toBe('result2')
  })
})
