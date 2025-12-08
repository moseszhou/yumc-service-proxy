"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRegisteredProxy = getRegisteredProxy;
exports.registerProxy = registerProxy;
const proxyRegistry = new Map();
function getRegisteredProxy(serviceName) {
    return proxyRegistry.get(serviceName);
}
function registerProxy(serviceName, proxy) {
    proxyRegistry.set(serviceName, proxy);
}
//# sourceMappingURL=registry.js.map