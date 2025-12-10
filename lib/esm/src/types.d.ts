export interface QueuedCall {
    method: Function;
    args: any[];
    resolve: (value?: any) => void;
    reject: (reason?: any) => void;
    timestamp: number;
}
interface ParamterItem {
    sc?: number;
}
interface Paramter {
    h5?: Record<string, ParamterItem | undefined>;
    rn?: Record<string, ParamterItem | undefined>;
}
export interface ProxyOptions {
    queueTimeout?: number;
    debug?: boolean;
    maxQueueSize?: number;
    ready?: Promise<void>;
    version?: string;
    properties?: string[];
    parameter?: Paramter;
    enforceMethodFilter?: boolean;
    removeFromGlobal?: boolean;
}
export type ProxiedService<T> = T & {
    name: string;
    version: string;
};
export {};
//# sourceMappingURL=types.d.ts.map