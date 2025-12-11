"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReadyProxy = createReadyProxy;
const utils_1 = require("./utils");
const deviceReady_1 = require("./deviceReady");
const registry_1 = require("./registry");
function createReadyProxy(originalService, serviceName, options = {}) {
    const existingProxyRef = (0, registry_1.getRegisteredProxy)(serviceName);
    if (existingProxyRef) {
        console.warn(`[ServiceProxy] Service "${serviceName}" has already been proxied. ` +
            `Returning existing proxy instance to avoid duplicate creation.`);
        return existingProxyRef;
    }
    const config = {
        queueTimeout: options.queueTimeout ?? 30000,
        debug: options.debug ?? false,
        maxQueueSize: options.maxQueueSize ?? 300,
        ready: options.ready ?? deviceReady_1.deviceReadyPromise,
        version: options.version ?? '',
        properties: options.properties ?? [],
        enforceMethodFilter: options.enforceMethodFilter ?? false,
        removeFromGlobal: options.removeFromGlobal ?? options.enforceMethodFilter ?? false,
        scIndexRecord: options.parameter?.h5 ?? {}
    };
    let isReady = false;
    let queuedCalls = [];
    const methodCache = new Map();
    let nativeServiceRef = null;
    let moduleObject = { service: nativeServiceRef };
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
            if ((0, utils_1.isThenable)(result)) {
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
        if (typeof window !== 'undefined' && serviceName in window) {
            nativeServiceRef = window[serviceName];
            moduleObject.service = nativeServiceRef;
        }
        if (config.removeFromGlobal) {
            try {
                if (typeof window !== 'undefined' && serviceName in window) {
                    delete window[serviceName];
                    log(`Removed from global window object for security (after deviceready). ` +
                        `Access is now only available through the proxy.`);
                }
            }
            catch (error) {
                console.warn(`[ServiceProxy:${serviceName}] Failed to remove from global window:`, error);
            }
        }
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
                    const nativeService = nativeServiceRef || window[serviceName];
                    if (typeof nativeService === 'undefined') {
                        reject(new Error(`Native service ${serviceName} not found`));
                        return;
                    }
                    const nativeMethod = nativeService[property];
                    if (typeof nativeMethod !== 'function') {
                        return nativeMethod;
                    }
                    log('Calling native method:', String(property));
                    const scIndexItem = config.scIndexRecord[property];
                    const scIndex = scIndexItem ? scIndexItem.sc : undefined;
                    if (scIndex !== undefined) {
                        const sc_origin = args[scIndex];
                        const fc_origin = args[scIndex + 1];
                        args[scIndex] = sc_origin === undefined ? resolve : function (_arg) {
                            if (typeof sc_origin === "function") {
                                sc_origin(_arg);
                            }
                            resolve(_arg);
                        };
                        args[scIndex + 1] = fc_origin === undefined ? reject : function (_arg) {
                            if (typeof sc_origin === "function") {
                                fc_origin(_arg);
                            }
                            resolve(_arg);
                        };
                    }
                    const result = nativeMethod.call(nativeService, ...args);
                    if ((0, utils_1.isThenable)(result)) {
                        result.then(resolve, reject);
                    }
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
                        if ((0, utils_1.isThenable)(result)) {
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
    if (typeof originalService === "function") {
        originalService = originalService(moduleObject);
    }
    const internalService = originalService;
    const serviceVersion = config.version;
    internalService.name = serviceName;
    internalService.version = serviceVersion;
    const hasOwnProperty = (obj, property) => {
        return Object.prototype.hasOwnProperty.call(obj, property);
    };
    const inWhiteList = (property) => {
        return typeof property === 'string' && Array.isArray(config.properties) && config.properties.includes(property);
    };
    const proxy = new Proxy(internalService, {
        get: function (target, property) {
            if (property === 'name') {
                return serviceName;
            }
            if (property === 'version') {
                return serviceVersion;
            }
            if (config.enforceMethodFilter && hasOwnProperty(target, property) && !inWhiteList(property)) {
                return undefined;
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
        },
        has(target, property) {
            if (config.enforceMethodFilter && hasOwnProperty(target, property) && !inWhiteList(property)) {
                return false;
            }
            return Reflect.has(target, property);
        },
        ownKeys(target) {
            return Reflect.ownKeys(target).filter((property) => {
                if (config.enforceMethodFilter && !inWhiteList(property)) {
                    return false;
                }
                return true;
            });
        },
        getOwnPropertyDescriptor(target, property) {
            if (config.enforceMethodFilter && hasOwnProperty(target, property) && !inWhiteList(property)) {
                return undefined;
            }
            return Reflect.getOwnPropertyDescriptor(target, property);
        }
    });
    (0, registry_1.registerProxy)(serviceName, proxy);
    log('Service proxy created and registered:', serviceName, 'version:', serviceVersion);
    return proxy;
}
//# sourceMappingURL=createReadyProxy.js.map