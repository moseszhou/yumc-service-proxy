"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRegisteredProxy = getRegisteredProxy;
exports.registerProxy = registerProxy;
exports.clearRegistry = clearRegistry;
const proxyRegistry = new Map();
function getRegisteredProxy(serviceName) {
    return proxyRegistry.get(serviceName);
}
function registerProxy(serviceName, proxy) {
    proxyRegistry.set(serviceName, proxy);
}
function clearRegistry() {
    proxyRegistry.clear();
}
//# sourceMappingURL=registry.js.map