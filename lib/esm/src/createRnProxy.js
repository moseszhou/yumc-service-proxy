import { getRegisteredProxy, registerProxy } from './registry';
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
export function createRnProxy(originalService, serviceName, options = {}) {
    const existingProxyRef = getRegisteredProxy(serviceName);
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
        originalService = originalService(nativeModule);
    }
    const mergedService = {
        ...nativeModule,
        ...originalService
    };
    const serviceVersion = options.version ?? '';
    mergedService.name = serviceName;
    mergedService.version = serviceVersion;
    const proxy = new Proxy(mergedService, {
        get: function (_target, property) {
            if (property === 'name') {
                return serviceName;
            }
            if (property === 'version') {
                return serviceVersion;
            }
            return Reflect.get(mergedService, property);
        }
    });
    registerProxy(serviceName, proxy);
    if (options.debug) {
        console.log(`[ServiceProxy:${serviceName}] RN proxy created and registered, version:`, serviceVersion);
    }
    return proxy;
}
//# sourceMappingURL=createRnProxy.js.map