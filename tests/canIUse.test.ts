import { createReadyProxy } from '../src/createReadyProxy'
import { createRnProxy } from '../src/createRnProxy'
import { createReadyProxy as createRnReadyProxy } from '../index'
import { clearRegistry, getRegisteredProxy } from '../src/registry'

interface ExampleService {
  existingMethod: () => string
  nonFunctionValue?: string
}

describe('canIUse', () => {
  const globalWithWindow = globalThis as unknown as { window?: unknown }
  let originalWindow: unknown

  beforeEach(() => {
    originalWindow = globalWithWindow.window
    clearRegistry()
    jest.resetModules()
  })

  afterEach(() => {
    if (originalWindow === undefined) {
      delete globalWithWindow.window
      return
    }

    globalWithWindow.window = originalWindow
  })

  it('checks whether an H5 window service contains a callable method', async () => {
    globalWithWindow.window = {
      H5CanIUseService: {
        existingMethod: () => 'ok',
        nonFunctionValue: 'value',
      },
    }

    const proxy = createReadyProxy<ExampleService>({}, 'H5CanIUseService', { ready: Promise.resolve() })

    expect(typeof proxy.canIUse).toBe('function')
    expect(typeof proxy.canIUse('existingMethod').then).toBe('function')
    await expect(proxy.canIUse('existingMethod')).resolves.toBe(true)
    await expect(proxy.canIUse('nonFunctionValue')).resolves.toBe(false)
    await expect(proxy.canIUse('missingMethod')).resolves.toBe(false)
  })

  it('returns false for H5 window service methods outside the enforced whitelist', async () => {
    globalWithWindow.window = {
      H5FilteredCanIUseService: {
        allowedMethod: () => 'allowed',
        blockedMethod: () => 'blocked',
      },
    }

    const proxy = createReadyProxy<Record<string, unknown>>(
      {},
      'H5FilteredCanIUseService',
      {
        ready: Promise.resolve(),
        enforceMethodFilter: true,
        properties: ['allowedMethod'],
      },
    )

    await expect(proxy.canIUse('allowedMethod')).resolves.toBe(true)
    await expect(proxy.canIUse('blockedMethod')).resolves.toBe(false)
  })

  it('waits for H5 ready before checking a window service that registers late', async () => {
    let resolveReady!: () => void
    const ready = new Promise<void>((resolve) => {
      resolveReady = resolve
    })

    globalWithWindow.window = {}

    const proxy = createReadyProxy<ExampleService>({}, 'H5ReadyCanIUseService', { ready })
    const result = proxy.canIUse('existingMethod')
    let settled = false

    result.then(() => {
      settled = true
    })

    await Promise.resolve()
    expect(settled).toBe(false)

    globalWithWindow.window = {
      H5ReadyCanIUseService: {
        existingMethod: () => 'ok',
      },
    }

    resolveReady()

    await expect(result).resolves.toBe(true)
  })

  it('checks whether an RN proxied service contains a callable method', async () => {
    jest.doMock(
      'react-native',
      () => ({
        NativeModules: {
          RNCanIUseService: {
            nativeMethod: () => 'native',
            blockedNativeMethod: () => 'blocked',
            nativeValue: 'value',
          },
        },
      }),
      { virtual: true },
    )

    const proxy = createRnProxy<Record<string, unknown>>(
      {
        localMethod: () => 'local',
      },
      'RNCanIUseService',
      {
        enforceMethodFilter: true,
        properties: ['nativeMethod', 'localMethod'],
      },
    )

    expect(typeof proxy.canIUse).toBe('function')
    expect(typeof proxy.canIUse('nativeMethod').then).toBe('function')
    await expect(proxy.canIUse('nativeMethod')).resolves.toBe(true)
    await expect(proxy.canIUse('localMethod')).resolves.toBe(false)
    await expect(proxy.canIUse('blockedNativeMethod')).resolves.toBe(false)
    await expect(proxy.canIUse('nativeValue')).resolves.toBe(false)
    await expect(proxy.canIUse('missingMethod')).resolves.toBe(false)
  })

  it.each([undefined, null])('returns false when the RN native module is %s', async (nativeModule) => {
    jest.doMock('react-native', () => ({ NativeModules: { RuntimeService: nativeModule } }), { virtual: true })

    const proxy = createRnReadyProxy<ExampleService>({}, 'RuntimeService', { version: '1.0.0' })

    await expect(proxy.canIUse('existingMethod')).resolves.toBe(false)
    await expect(proxy.canIUse('toString')).resolves.toBe(false)
    expect(proxy.existingMethod).toBeUndefined()
    expect(proxy.name).toBe('RuntimeService')
    expect(proxy.version).toBe('1.0.0')
    expect(getRegisteredProxy('RuntimeService')).toBe(proxy)
  })

  it('keeps local overrides usable without reporting them as missing RN native capabilities', async () => {
    jest.doMock('react-native', () => ({ NativeModules: {} }), { virtual: true })

    const proxy = createRnProxy<ExampleService>(
      { existingMethod: () => 'local' },
      'RuntimeService',
      { enforceMethodFilter: true, properties: ['existingMethod'] },
    )

    await expect(proxy.canIUse('existingMethod')).resolves.toBe(false)
    await expect(proxy.canIUse('missingMethod')).resolves.toBe(false)
    expect(proxy.existingMethod()).toBe('local')
    expect('canIUse' in proxy).toBe(true)
    expect(() => Object.keys(proxy)).not.toThrow()
  })

  it.each([undefined, null])('skips the RN extension factory when the native module is %s', async (nativeModule) => {
    jest.doMock('react-native', () => ({ NativeModules: { RuntimeService: nativeModule } }), { virtual: true })

    const proxy = createRnReadyProxy<ExampleService>(
      ({ service }) => ({ existingMethod: service.existingMethod.bind(service) }),
      'RuntimeService',
      { enforceMethodFilter: true, properties: ['existingMethod'] },
    )

    await expect(proxy.canIUse('existingMethod')).resolves.toBe(false)
    expect(proxy.existingMethod).toBeUndefined()
  })

  it('preserves raw native access in RN extension factories after removing the global module', async () => {
    const nativeModule: ExampleService = { existingMethod: () => 'native' }
    const nativeModules: { RuntimeService?: ExampleService } = { RuntimeService: nativeModule }
    jest.doMock('react-native', () => ({ NativeModules: nativeModules }), { virtual: true })

    const proxy = createRnReadyProxy<ExampleService>(
      ({ service }) => ({ existingMethod: () => `wrapped:${service.existingMethod()}` }),
      'RuntimeService',
      { enforceMethodFilter: true, properties: ['existingMethod'] },
    )

    await expect(proxy.canIUse('existingMethod')).resolves.toBe(true)
    expect(proxy.existingMethod()).toBe('wrapped:native')
    expect(nativeModules.RuntimeService).toBeUndefined()
  })
})
