"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deviceReadyPromise = void 0;
exports.deviceReadyPromise = (() => {
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
//# sourceMappingURL=deviceReady.js.map