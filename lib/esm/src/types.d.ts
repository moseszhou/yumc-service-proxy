export interface QueuedCall {
    method: Function;
    args: any[];
    resolve: (value?: any) => void;
    reject: (reason?: any) => void;
    timestamp: number;
}
export interface ProxyOptions {
    queueTimeout?: number;
    debug?: boolean;
    maxQueueSize?: number;
    ready?: Promise<void>;
    version?: string;
}
export type ProxiedService<T> = T & {
    name: string;
    version: string;
};
//# sourceMappingURL=types.d.ts.map