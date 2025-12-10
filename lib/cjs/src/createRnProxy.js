"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRnProxy = createRnProxy;
const registry_1 = require("./registry");
function getNativeModules() {
    try {
        const RN = require('react-native');
        return RN.NativeModules;
    }
    catch (error) {
        throw new Error('react-native is not available. ' +
            'Make sure you are running in a React Native environment and react-native is installed.');
    }
}
function createRnProxy(originalService, serviceName, options = {}) {
    const existingProxyRef = (0, registry_1.getRegisteredProxy)(serviceName);
    if (existingProxyRef) {
        console.warn(`[ServiceProxy] Service "${serviceName}" has already been proxied. ` +
            `Returning existing proxy instance to avoid duplicate creation.`);
        return existingProxyRef;
    }
    const NativeModules = getNativeModules();
    const nativeModule = NativeModules[serviceName];
    if (!nativeModule) {
        throw new Error(`Native module "${serviceName}" not found in NativeModules`);
    }
    if (typeof originalService === 'function') {
        originalService = originalService({ service: nativeModule });
    }
    const mergedService = {
        ...nativeModule,
        ...originalService
    };
    const serviceVersion = options.version ?? '';
    const serviceFunctions = options.functions ?? [];
    const enforceMethodFilter = options.enforceMethodFilter ?? false;
    const removeFromGlobal = options.removeFromGlobal ?? enforceMethodFilter;
    mergedService.name = serviceName;
    mergedService.version = serviceVersion;
    if (removeFromGlobal) {
        try {
            delete NativeModules[serviceName];
            if (options.debug) {
                console.log(`[ServiceProxy:${serviceName}] Removed from global NativeModules for security. ` +
                    `Access is now only available through the proxy.`);
            }
        }
        catch (error) {
            console.warn(`[ServiceProxy:${serviceName}] Failed to remove from global NativeModules:`, error);
        }
    }
    const proxy = new Proxy(mergedService, {
        get: function (_target, property) {
            if (property === 'name') {
                return serviceName;
            }
            if (property === 'version') {
                return serviceVersion;
            }
            if (enforceMethodFilter && serviceFunctions.length > 0 && typeof property === 'string' && !serviceFunctions.includes(property)) {
                return undefined;
            }
            return Reflect.get(mergedService, property);
        }
    });
    (0, registry_1.registerProxy)(serviceName, proxy);
    if (options.debug) {
        console.log(`[ServiceProxy:${serviceName}] RN proxy created and registered, version:`, serviceVersion);
    }
    return proxy;
}
//# sourceMappingURL=createRnProxy.js.map