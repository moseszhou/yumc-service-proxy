import type { ProxiedService, ProxyOptions } from './types';
export declare function createReadyProxy<T extends object>(originalService: Partial<T> | (({ service }: {
    service: T;
}) => Partial<T>), serviceName: string, options?: ProxyOptions): ProxiedService<T>;
//# sourceMappingURL=createProxy.d.ts.map