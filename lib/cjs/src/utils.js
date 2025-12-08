"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isThenable = isThenable;
function isThenable(value) {
    return value != null && typeof value.then === 'function';
}
//# sourceMappingURL=utils.js.map