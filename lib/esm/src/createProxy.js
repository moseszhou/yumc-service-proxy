import { attachCanIUse } from './canIUse';
export function createReadyProxy(originalService, serviceName, options = {}) {
    void originalService;
    const noop = () => undefined;
    const target = {
        name: serviceName,
        version: options.version ?? ''
    };
    const canIUse = attachCanIUse(target, {
        isAllowed: () => false
    });
    return new Proxy(target, {
        get(currentTarget, property) {
            if (property === 'name') {
                return serviceName;
            }
            if (property === 'version') {
                return target.version;
            }
            if (property === 'canIUse') {
                return canIUse;
            }
            if (typeof property === 'string') {
                return noop;
            }
            return Reflect.get(currentTarget, property);
        }
    });
}
//# sourceMappingURL=createProxy.js.map