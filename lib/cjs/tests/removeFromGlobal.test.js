"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mockNativeModules = {
    SecureService: {
        publicMethod: jest.fn(() => 'public'),
        privateMethod: jest.fn(() => 'private')
    },
    TestService2: {
        method1: jest.fn(() => 'result1')
    }
};
jest.mock('react-native', () => ({
    NativeModules: mockNativeModules
}), { virtual: true });
const createRnProxy_1 = require("../src/createRnProxy");
const registry_1 = require("../src/registry");
describe('removeFromGlobal 功能测试', () => {
    beforeEach(() => {
        (0, registry_1.clearRegistry)();
        mockNativeModules.SecureService = {
            publicMethod: jest.fn(() => 'public'),
            privateMethod: jest.fn(() => 'private')
        };
        mockNativeModules.TestService2 = {
            method1: jest.fn(() => 'result1')
        };
    });
    test('默认行为：不从全局移除', () => {
        (0, createRnProxy_1.createRnProxy)({}, 'TestService2', {
            functions: ['method1'],
            enforceMethodFilter: false
        });
        expect(mockNativeModules.TestService2).toBeDefined();
        expect(mockNativeModules.TestService2.method1).toBeDefined();
    });
    test('enforceMethodFilter: true 时，默认从全局移除', () => {
        (0, createRnProxy_1.createRnProxy)({}, 'SecureService', {
            functions: ['publicMethod'],
            enforceMethodFilter: true
        });
        expect(mockNativeModules.SecureService).toBeUndefined();
    });
    test('显式设置 removeFromGlobal: false，不从全局移除', () => {
        (0, registry_1.clearRegistry)();
        (0, createRnProxy_1.createRnProxy)({}, 'SecureService', {
            functions: ['publicMethod'],
            enforceMethodFilter: true,
            removeFromGlobal: false
        });
        expect(mockNativeModules.SecureService).toBeDefined();
    });
    test('显式设置 removeFromGlobal: true，从全局移除', () => {
        (0, registry_1.clearRegistry)();
        (0, createRnProxy_1.createRnProxy)({}, 'SecureService', {
            functions: ['publicMethod'],
            enforceMethodFilter: false,
            removeFromGlobal: true
        });
        expect(mockNativeModules.SecureService).toBeUndefined();
    });
    test('从全局移除后，代理仍然可以正常工作', () => {
        (0, registry_1.clearRegistry)();
        const service = (0, createRnProxy_1.createRnProxy)({}, 'SecureService', {
            functions: ['publicMethod'],
            enforceMethodFilter: true,
            removeFromGlobal: true
        });
        expect(mockNativeModules.SecureService).toBeUndefined();
        expect(service.publicMethod).toBeDefined();
        expect(service.publicMethod()).toBe('public');
        expect(service.privateMethod).toBeUndefined();
    });
    test('debug 模式下会输出移除日志', () => {
        (0, registry_1.clearRegistry)();
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        (0, createRnProxy_1.createRnProxy)({}, 'SecureService', {
            functions: ['publicMethod'],
            enforceMethodFilter: true,
            removeFromGlobal: true,
            debug: true
        });
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[ServiceProxy:SecureService] Removed from global NativeModules'));
        consoleSpy.mockRestore();
    });
});
//# sourceMappingURL=removeFromGlobal.test.js.map