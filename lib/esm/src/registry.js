const proxyRegistry = new Map();
export function getRegisteredProxy(serviceName) {
    return proxyRegistry.get(serviceName);
}
export function registerProxy(serviceName, proxy) {
    proxyRegistry.set(serviceName, proxy);
}
export function clearRegistry() {
    proxyRegistry.clear();
}
//# sourceMappingURL=registry.js.map