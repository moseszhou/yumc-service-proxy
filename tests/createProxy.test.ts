import { createReadyProxy } from '../src/createProxy'

interface MiniProgramService {
  knownMethod: (value: string) => void
}

type DynamicMiniProgramService = MiniProgramService & {
  missingMethod: () => void
}

describe('createReadyProxy - Mini Program fallback', () => {
  it('returns false from canIUse and no-op functions for all methods', async () => {
    const proxy = createReadyProxy<MiniProgramService>({}, 'MiniProgramService', { version: '1.0.0' })
    const dynamicProxy = proxy as DynamicMiniProgramService & typeof proxy

    expect(proxy.name).toBe('MiniProgramService')
    expect(proxy.version).toBe('1.0.0')
    await expect(proxy.canIUse('knownMethod')).resolves.toBe(false)
    await expect(proxy.canIUse('missingMethod')).resolves.toBe(false)
    expect(proxy.knownMethod('value')).toBeUndefined()
    expect(dynamicProxy.missingMethod()).toBeUndefined()
  })
})
