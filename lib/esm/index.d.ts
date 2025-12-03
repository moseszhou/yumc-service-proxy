export interface ProxyOptions {
    queueTimeout?: number;
    debug?: boolean;
    maxQueueSize?: number;
    ready?: Promise<void>;
}
export declare function createReadyProxy<T extends Record<string, any>>(originalService: Partial<T>, serviceName: string, options?: ProxyOptions): T;
//# sourceMappingURL=index.d.ts.map