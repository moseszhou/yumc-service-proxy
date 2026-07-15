import type { ProxyOptions, ProxiedService } from './types';
export declare function createRnProxy<T extends Record<string, any>>(originalService: Partial<T> | (({ service }: {
    service: T;
}) => Partial<T>), serviceName: string, options?: ProxyOptions): ProxiedService<T>;
//# sourceMappingURL=createRnProxy.d.ts.map