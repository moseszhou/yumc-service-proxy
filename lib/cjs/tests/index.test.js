"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const createDocumentStub = () => {
    const listeners = new Map();
    return {
        addEventListener: (type, cb, options) => {
            const once = typeof options === 'boolean' ? options : Boolean(options?.once);
            const list = listeners.get(type) ?? [];
            list.push({ cb, once });
            listeners.set(type, list);
        },
        dispatchEvent: (event) => {
            const type = typeof event === 'string' ? event : event?.type;
            if (!type)
                return;
            const list = listeners.get(type);
            if (!list)
                return;
            list.slice().forEach((listener, index) => {
                listener.cb(event);
                if (listener.once) {
                    list.splice(index, 1);
                }
            });
        }
    };
};
const setGlobals = (doc, win) => {
    ;
    global.document = doc;
    global.window = win;
};
const clearGlobals = (doc, win) => {
    if (doc === undefined) {
        delete global.document;
    }
    else {
        ;
        global.document = doc;
    }
    if (win === undefined) {
        delete global.window;
    }
    else {
        ;
        global.window = win;
    }
};
const importProxy = async () => {
    globals_1.jest.resetModules();
    return Promise.resolve().then(() => __importStar(require('../index')));
};
let originalDocument;
let originalWindow;
(0, globals_1.beforeEach)(() => {
    originalDocument = global.document;
    originalWindow = global.window;
});
(0, globals_1.afterEach)(() => {
    clearGlobals(originalDocument, originalWindow);
});
(0, globals_1.describe)('createReadyProxy - Basic Functionality', () => {
    (0, globals_1.it)('queues calls until deviceready then flushes', async () => {
        const documentStub = createDocumentStub();
        setGlobals(documentStub, {});
        const { createReadyProxy } = await importProxy();
        const service = {
            foo: globals_1.jest.fn(async (_arg) => 'ok')
        };
        const proxy = createReadyProxy(service, 'svc');
        const promise = proxy.foo('bar');
        let settled = false;
        promise.then(() => {
            settled = true;
        });
        await Promise.resolve();
        (0, globals_1.expect)(settled).toBe(false);
        documentStub.dispatchEvent({ type: 'deviceready' });
        const result = await promise;
        (0, globals_1.expect)(settled).toBe(true);
        (0, globals_1.expect)(result).toBe('ok');
        (0, globals_1.expect)(service.foo).toHaveBeenCalledWith('bar');
    });
    (0, globals_1.it)('runs immediately if device already ready (cordova.fired)', async () => {
        const documentStub = createDocumentStub();
        const windowStub = { cordova: { channels: { deviceReady: { fired: true } } } };
        setGlobals(documentStub, windowStub);
        const { createReadyProxy } = await importProxy();
        const service = {
            foo: globals_1.jest.fn(async (_arg) => 'ok')
        };
        const proxy = createReadyProxy(service, 'svc');
        const result = await proxy.foo('now');
        (0, globals_1.expect)(result).toBe('ok');
        (0, globals_1.expect)(service.foo).toHaveBeenCalledWith('now');
    });
    (0, globals_1.it)('runs immediately if custom ready promise provided', async () => {
        const documentStub = createDocumentStub();
        setGlobals(documentStub, {});
        const { createReadyProxy } = await importProxy();
        const service = {
            foo: globals_1.jest.fn(async (_arg) => 'ok')
        };
        const proxy = createReadyProxy(service, 'svc', { ready: Promise.resolve() });
        const result = await proxy.foo('immediately');
        (0, globals_1.expect)(result).toBe('ok');
        (0, globals_1.expect)(service.foo).toHaveBeenCalledWith('immediately');
    });
    (0, globals_1.it)('bridges to native service methods when not on original object', async () => {
        const documentStub = createDocumentStub();
        const windowStub = {};
        windowStub.nativeService = {
            hello: globals_1.jest.fn((name, resolve) => resolve(`hi ${name}`))
        };
        setGlobals(documentStub, windowStub);
        const { createReadyProxy } = await importProxy();
        const proxy = createReadyProxy({}, 'nativeService', { ready: Promise.resolve() });
        const result = await proxy.hello('bob');
        (0, globals_1.expect)(result).toBe('hi bob');
        (0, globals_1.expect)(windowStub.nativeService.hello).toHaveBeenCalled();
    });
    (0, globals_1.it)('rejects when native service missing', async () => {
        const documentStub = createDocumentStub();
        setGlobals(documentStub, {});
        const { createReadyProxy } = await importProxy();
        const proxy = createReadyProxy({}, 'missingService', { ready: Promise.resolve() });
        await (0, globals_1.expect)(proxy.someMethod()).rejects.toThrow(/missingService|not found/i);
    });
    (0, globals_1.it)('awaits thenable results', async () => {
        const documentStub = createDocumentStub();
        setGlobals(documentStub, {});
        const { createReadyProxy } = await importProxy();
        const thenableService = {
            foo: () => ({
                then: (resolve) => resolve('thenable')
            })
        };
        const proxy = createReadyProxy(thenableService, 'svc', { ready: Promise.resolve() });
        await (0, globals_1.expect)(proxy.foo()).resolves.toBe('thenable');
    });
    (0, globals_1.it)('supports empty object with type annotation', async () => {
        const documentStub = createDocumentStub();
        const windowStub = {};
        windowStub.MyService = {
            doSomething: globals_1.jest.fn((arg, resolve) => resolve(`done ${arg}`))
        };
        setGlobals(documentStub, windowStub);
        const { createReadyProxy } = await importProxy();
        const proxy = createReadyProxy({}, 'MyService', { ready: Promise.resolve() });
        const result = await proxy.doSomething('test');
        (0, globals_1.expect)(result).toBe('done test');
    });
});
(0, globals_1.describe)('createReadyProxy - Timeout Protection', () => {
    (0, globals_1.it)('rejects queued calls that exceed timeout', async () => {
        const documentStub = createDocumentStub();
        setGlobals(documentStub, {});
        const { createReadyProxy } = await importProxy();
        const service = {
            foo: globals_1.jest.fn(async () => 'ok')
        };
        const proxy = createReadyProxy(service, 'svc', { queueTimeout: 100 });
        const promise = proxy.foo();
        await new Promise(resolve => setTimeout(resolve, 150));
        documentStub.dispatchEvent({ type: 'deviceready' });
        await (0, globals_1.expect)(promise).rejects.toThrow(/timeout/i);
    });
    (0, globals_1.it)('does not timeout if deviceready fires in time', async () => {
        const documentStub = createDocumentStub();
        setGlobals(documentStub, {});
        const { createReadyProxy } = await importProxy();
        const service = {
            foo: globals_1.jest.fn(async () => 'ok')
        };
        const proxy = createReadyProxy(service, 'svc', { queueTimeout: 1000 });
        const promise = proxy.foo();
        await new Promise(resolve => setTimeout(resolve, 50));
        documentStub.dispatchEvent({ type: 'deviceready' });
        await (0, globals_1.expect)(promise).resolves.toBe('ok');
    });
});
(0, globals_1.describe)('createReadyProxy - Queue Size Limit', () => {
    (0, globals_1.it)('rejects new calls when queue is full', async () => {
        const documentStub = createDocumentStub();
        setGlobals(documentStub, {});
        const { createReadyProxy } = await importProxy();
        const service = {
            foo: globals_1.jest.fn(async () => 'ok')
        };
        const proxy = createReadyProxy(service, 'svc', { maxQueueSize: 3 });
        const promise1 = proxy.foo();
        const promise2 = proxy.foo();
        const promise3 = proxy.foo();
        await (0, globals_1.expect)(proxy.foo()).rejects.toThrow(/queue size limit/i);
        documentStub.dispatchEvent({ type: 'deviceready' });
        await (0, globals_1.expect)(promise1).resolves.toBe('ok');
        await (0, globals_1.expect)(promise2).resolves.toBe('ok');
        await (0, globals_1.expect)(promise3).resolves.toBe('ok');
    });
});
(0, globals_1.describe)('createReadyProxy - Debug Mode', () => {
    (0, globals_1.it)('logs debug messages when debug=true', async () => {
        const documentStub = createDocumentStub();
        setGlobals(documentStub, {});
        const { createReadyProxy } = await importProxy();
        const consoleSpy = globals_1.jest.spyOn(console, 'log').mockImplementation(() => { });
        const service = {
            foo: globals_1.jest.fn(async () => 'ok')
        };
        const proxy = createReadyProxy(service, 'svc', { debug: true });
        proxy.foo();
        documentStub.dispatchEvent({ type: 'deviceready' });
        await new Promise(resolve => setTimeout(resolve, 10));
        (0, globals_1.expect)(consoleSpy).toHaveBeenCalled();
        const calls = consoleSpy.mock.calls;
        const hasServiceProxyLog = calls.some(call => call.some(arg => typeof arg === 'string' && arg.includes('ServiceProxy')));
        (0, globals_1.expect)(hasServiceProxyLog).toBe(true);
        consoleSpy.mockRestore();
    });
    (0, globals_1.it)('does not log when debug=false (default)', async () => {
        const documentStub = createDocumentStub();
        setGlobals(documentStub, {});
        const { createReadyProxy } = await importProxy();
        const consoleSpy = globals_1.jest.spyOn(console, 'log').mockImplementation(() => { });
        const service = {
            foo: globals_1.jest.fn(async () => 'ok')
        };
        const proxy = createReadyProxy(service, 'svc');
        proxy.foo();
        documentStub.dispatchEvent({ type: 'deviceready' });
        await new Promise(resolve => setTimeout(resolve, 10));
        const calls = consoleSpy.mock.calls;
        const hasServiceProxyLog = calls.some(call => call.some(arg => typeof arg === 'string' && arg.includes('ServiceProxy')));
        (0, globals_1.expect)(hasServiceProxyLog).toBe(false);
        consoleSpy.mockRestore();
    });
});
(0, globals_1.describe)('createReadyProxy - Custom Configuration', () => {
    (0, globals_1.it)('accepts all configuration options', async () => {
        const documentStub = createDocumentStub();
        setGlobals(documentStub, {});
        const { createReadyProxy } = await importProxy();
        const service = {
            foo: globals_1.jest.fn(async () => 'ok')
        };
        let resolveCustom;
        const customReady = new Promise(resolve => {
            resolveCustom = resolve;
        });
        const proxy = createReadyProxy(service, 'svc', {
            queueTimeout: 5000,
            debug: false,
            maxQueueSize: 50,
            ready: customReady
        });
        const promise = proxy.foo();
        resolveCustom();
        await (0, globals_1.expect)(promise).resolves.toBe('ok');
    });
});
(0, globals_1.describe)('createReadyProxy - Error Handling', () => {
    (0, globals_1.it)('handles synchronous errors in service methods', async () => {
        const documentStub = createDocumentStub();
        setGlobals(documentStub, {});
        const { createReadyProxy } = await importProxy();
        const service = {
            foo: globals_1.jest.fn(() => {
                throw new Error('sync error');
            })
        };
        const proxy = createReadyProxy(service, 'svc', { ready: Promise.resolve() });
        await (0, globals_1.expect)(proxy.foo()).rejects.toThrow('sync error');
    });
    (0, globals_1.it)('handles async errors in service methods', async () => {
        const documentStub = createDocumentStub();
        setGlobals(documentStub, {});
        const { createReadyProxy } = await importProxy();
        const service = {
            foo: globals_1.jest.fn(async () => {
                throw new Error('async error');
            })
        };
        const proxy = createReadyProxy(service, 'svc', { ready: Promise.resolve() });
        await (0, globals_1.expect)(proxy.foo()).rejects.toThrow('async error');
    });
});
//# sourceMappingURL=index.test.js.map