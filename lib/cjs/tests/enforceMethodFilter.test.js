"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mockNativeModules = {
    TestService: {
        method1: jest.fn(() => 'result1'),
        method2: jest.fn(() => 'result2'),
        method3: jest.fn(() => 'result3'),
        secretMethod: jest.fn(() => 'secret')
    }
};
jest.mock('react-native', () => ({
    NativeModules: mockNativeModules
}), { virtual: true });
const createRnProxy_1 = require("../src/createRnProxy");
const registry_1 = require("../src/registry");
describe('enforceMethodFilter 功能测试', () => {
    beforeEach(() => {
        (0, registry_1.clearRegistry)();
        mockNativeModules.TestService = {
            method1: jest.fn(() => 'result1'),
            method2: jest.fn(() => 'result2'),
            method3: jest.fn(() => 'result3'),
            secretMethod: jest.fn(() => 'secret')
        };
    });
    test('默认不启用方法过滤 - 可以访问所有方法', () => {
        const service = (0, createRnProxy_1.createRnProxy)({}, 'TestService', {
            functions: ['method1', 'method2']
        });
        expect(service.method1).toBeDefined();
        expect(service.method2).toBeDefined();
        expect(service.method3).toBeDefined();
        expect(service.secretMethod).toBeDefined();
    });
    test('enforceMethodFilter: false - 可以访问所有方法', () => {
        (0, registry_1.clearRegistry)();
        const service = (0, createRnProxy_1.createRnProxy)({}, 'TestService', {
            functions: ['method1', 'method2'],
            enforceMethodFilter: false
        });
        expect(service.method1).toBeDefined();
        expect(service.method2).toBeDefined();
        expect(service.method3).toBeDefined();
        expect(service.secretMethod).toBeDefined();
    });
    test('enforceMethodFilter: true - 只能访问 functions 中的方法', () => {
        (0, registry_1.clearRegistry)();
        const service = (0, createRnProxy_1.createRnProxy)({}, 'TestService', {
            functions: ['method1', 'method2'],
            enforceMethodFilter: true
        });
        expect(service.method1).toBeDefined();
        expect(service.method2).toBeDefined();
        expect(service.method3).toBeUndefined();
        expect(service.secretMethod).toBeUndefined();
    });
    test('enforceMethodFilter: true 但 functions 为空 - 由于长度检查不会过滤', () => {
        (0, registry_1.clearRegistry)();
        const service = (0, createRnProxy_1.createRnProxy)({}, 'TestService', {
            functions: [],
            enforceMethodFilter: true
        });
        expect(service.method1).toBeDefined();
        expect(service.method2).toBeDefined();
    });
    test('name 和 version 始终可以访问', () => {
        (0, registry_1.clearRegistry)();
        const service = (0, createRnProxy_1.createRnProxy)({}, 'TestService', {
            functions: ['method1'],
            enforceMethodFilter: true,
            version: '1.0.0'
        });
        expect(service.name).toBe('TestService');
        expect(service.version).toBe('1.0.0');
    });
    test('可以执行允许的方法', () => {
        (0, registry_1.clearRegistry)();
        const service = (0, createRnProxy_1.createRnProxy)({}, 'TestService', {
            functions: ['method1', 'method2'],
            enforceMethodFilter: true
        });
        expect(service.method1()).toBe('result1');
        expect(service.method2()).toBe('result2');
    });
});
//# sourceMappingURL=enforceMethodFilter.test.js.map