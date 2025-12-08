export type { ProxyOptions, ProxiedService, QueuedCall } from './src/types';
export { isThenable } from './src/utils';
export { deviceReadyPromise } from './src/deviceReady';
export { getRegisteredProxy, registerProxy } from './src/registry';
export { createReadyProxy } from './src/createReadyProxy';
import type { ProxyOptions, ProxiedService } from './src/types';
export declare function createRnProxy<T extends Record<string, any>>(originalService: Partial<T> | ((service: T) => Partial<T>), serviceName: string, options?: ProxyOptions): ProxiedService<T>;
//# sourceMappingURL=index.d.ts.map