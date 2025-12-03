function isThenable(value) {
    return value != null && typeof value.then === 'function';
}
const deviceReadyPromise = (() => {
    if (typeof document === 'undefined') {
        return Promise.resolve();
    }
    let resolved = false;
    let resolveReady;
    const promise = new Promise(resolve => {
        resolveReady = () => {
            if (!resolved) {
                resolved = true;
                resolve();
            }
        };
    });
    if (typeof window !== 'undefined' && window.cordova?.channels?.deviceReady?.fired) {
        resolveReady();
    }
    else {
        document.addEventListener('deviceready', resolveReady, { once: true });
    }
    return promise;
})();
export function createReadyProxy(originalService, serviceName, options = {}) {
    const config = {
        queueTimeout: options.queueTimeout ?? 30000,
        debug: options.debug ?? false,
        maxQueueSize: options.maxQueueSize ?? 300,
        ready: options.ready ?? deviceReadyPromise
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
    return new Proxy(internalService, {
        get: function (_target, property) {
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
}
//# sourceMappingURL=index.js.map