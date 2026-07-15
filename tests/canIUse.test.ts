import { createReadyProxy } from '../src/createReadyProxy'
import { createRnProxy } from '../src/createRnProxy'
import { clearRegistry } from '../src/registry'

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
})
