"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCanIUse = createCanIUse;
exports.attachCanIUse = attachCanIUse;
function createCanIUse(resolveService, options = {}) {
    return async (functionName) => {
        if (!functionName || functionName === 'canIUse') {
            return false;
        }
        if (options.isAllowed && !options.isAllowed(functionName)) {
            return false;
        }
        try {
            if (options.ready) {
                await options.ready;
            }
            const service = resolveService();
            if (!service) {
                return false;
            }
            return typeof Reflect.get(service, functionName) === 'function';
        }
        catch {
            return false;
        }
    };
}
function attachCanIUse(service, options = {}) {
    const canIUse = createCanIUse(options.resolveService ?? (() => service), options);
    Object.defineProperty(service, 'canIUse', {
        value: canIUse,
        enumerable: false,
        configurable: false,
        writable: false,
    });
    return canIUse;
}
//# sourceMappingURL=canIUse.js.map