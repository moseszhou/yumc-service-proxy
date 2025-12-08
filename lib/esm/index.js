export { isThenable } from './src/utils';
export { deviceReadyPromise } from './src/deviceReady';
export { getRegisteredProxy, registerProxy } from './src/registry';
export { createReadyProxy } from './src/createReadyProxy';
export function createRnProxy(originalService, serviceName, options) {
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