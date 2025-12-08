"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReadyProxy = exports.registerProxy = exports.getRegisteredProxy = exports.deviceReadyPromise = exports.isThenable = void 0;
exports.createRnProxy = createRnProxy;
var utils_1 = require("./src/utils");
Object.defineProperty(exports, "isThenable", { enumerable: true, get: function () { return utils_1.isThenable; } });
var deviceReady_1 = require("./src/deviceReady");
Object.defineProperty(exports, "deviceReadyPromise", { enumerable: true, get: function () { return deviceReady_1.deviceReadyPromise; } });
var registry_1 = require("./src/registry");
Object.defineProperty(exports, "getRegisteredProxy", { enumerable: true, get: function () { return registry_1.getRegisteredProxy; } });
Object.defineProperty(exports, "registerProxy", { enumerable: true, get: function () { return registry_1.registerProxy; } });
var createReadyProxy_1 = require("./src/createReadyProxy");
Object.defineProperty(exports, "createReadyProxy", { enumerable: true, get: function () { return createReadyProxy_1.createReadyProxy; } });
function createRnProxy(originalService, serviceName, options) {
    try {
        const { createRnProxy: createRnProxyImpl } = require('./src/createRnProxy');
        return createRnProxyImpl(originalService, serviceName, options);
    }
    catch (error) {
        throw new Error('createRnProxy can only be used in React Native environment. ' +
            'Make sure react-native is installed and you are running in RN environment. ' +
            `Original error: ${error instanceof Error ? error.message : String(error)}`);
    }
}
//# sourceMappingURL=index.js.map