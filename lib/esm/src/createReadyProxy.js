import { isThenable } from './utils';
import { deviceReadyPromise } from './deviceReady';
import { getRegisteredProxy, registerProxy } from './registry';
export function createReadyProxy(originalService, serviceName, options = {}) {
    const existingProxyRef = getRegisteredProxy(serviceName);
    if (existingProxyRef) {
        console.warn(`[ServiceProxy] Service "${serviceName}" has already been proxied. ` +
            `Returning existing proxy instance to avoid duplicate creation.`);
        return existingProxyRef;
    }
    const config = {
        queueTimeout: options.queueTimeout ?? 30000,
        debug: options.debug ?? false,
        maxQueueSize: options.maxQueueSize ?? 300,
        ready: options.ready ?? deviceReadyPromise,
        version: options.version ?? ''
    };
    let isReady = false;
    let queuedCalls = [];
    const methodCache = new Map();
    const log = (...args) => {
        if (config.debug) {
            console.log(`[ServiceProxy:${serviceName}]`, ...args);
        }
    };
    const executeQueuedCall = (call) => {
        const { method, args, resolve, reject, timestamp } = call;
        if (Date.now() - timestamp > config.queueTimeout) {
            const error = new Error(`Queued call timeout after ${config.queueTimeout}ms for service ${serviceName}`);
            log('Timeout:', error.message);
            reject(error);
            return;
        }
        try {
            const result = method.apply(originalService, args);
            if (isThenable(result)) {
                result.then(resolve, reject);
            }
            else {
                resolve(result);
            }
        }
        catch (error) {
            log('Execution error:', error);
            reject(error);
        }
    };
    const flushQueuedCalls = () => {
        log('Flushing queue, size:', queuedCalls.length);
        const callsToProcess = queuedCalls;
        queuedCalls = [];
        callsToProcess.forEach(executeQueuedCall);
    };
    config.ready.then(() => {
        isReady = true;
        flushQueuedCalls();
    });
    const createNativeBridgeMethod = (property) => {
        return (...args) => {
            return new Promise((resolve, reject) => {
                try {
                    if (typeof window === 'undefined') {
                        reject(new Error(`Cannot call native service ${serviceName} in non-browser environment`));
                        return;
                    }
                    const nativeService = window[serviceName];
                    if (typeof nativeService === 'undefined') {
                        reject(new Error(`Native service ${serviceName} not found`));
                        return;
                    }
                    const nativeMethod = nativeService[property];
                    if (typeof nativeMethod !== 'function') {
                        reject(new Error(`Method ${String(property)} is not a function in native service ${serviceName}`));
                        return;
                    }
                    log('Calling native method:', String(property));
                    nativeMethod.call(nativeService, ...args, resolve, reject);
                }
                catch (error) {
                    reject(error);
                }
            });
        };
    };
    const wrapMethod = (method) => {
        return function (...args) {
            return new Promise((resolve, reject) => {
                if (isReady) {
                    try {
                        const result = method.apply(originalService, args);
                        if (isThenable(result)) {
                            result.then(resolve, reject);
                        }
                        else {
                            resolve(result);
                        }
                    }
                    catch (error) {
                        reject(error);
                    }
                    return;
                }
                if (queuedCalls.length >= config.maxQueueSize) {
                    reject(new Error(`Queue size limit (${config.maxQueueSize}) reached for service ${serviceName}`));
                    return;
                }
                log('Queueing call, new size:', queuedCalls.length + 1);
                queuedCalls.push({
                    method,
                    args,
                    resolve,
                    reject,
                    timestamp: Date.now()
                });
            });
        };
    };
    const internalService = originalService;
    const serviceVersion = config.version;
    internalService.name = serviceName;
    internalService.version = serviceVersion;
    const proxy = new Proxy(internalService, {
        get: function (_target, property) {
            if (property === 'name') {
                return serviceName;
            }
            if (property === 'version') {
                return serviceVersion;
            }
            if (methodCache.has(property)) {
                return methodCache.get(property);
            }
            const value = Reflect.get(internalService, property);
            if (typeof value === 'function') {
                const wrapped = wrapMethod(value);
                methodCache.set(property, wrapped);
                return wrapped;
            }
            if (typeof value === 'undefined' && typeof property === 'string') {
                log('Property not found in service, trying native bridge:', property);
                const nativeBridgeMethod = wrapMethod(createNativeBridgeMethod(property));
                methodCache.set(property, nativeBridgeMethod);
                return nativeBridgeMethod;
            }
            return value;
        }
    });
    registerProxy(serviceName, proxy);
    log('Service proxy created and registered:', serviceName, 'version:', serviceVersion);
    return proxy;
}
//# sourceMappingURL=createReadyProxy.js.map