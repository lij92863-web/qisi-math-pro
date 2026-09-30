(function (root, factory) {
    const api = factory(); root.Qisi = root.Qisi || {}; root.Qisi.BackupSnapshotPolicy = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const changed = () => { const error = new Error('Current data changed after the safety backup.'); error.code = 'BACKUP_LIVE_DATA_CHANGED'; throw error; };
    const equalBytes = (left, right) => left.length === right.length && left.every((value, index) => value === right[index]);
    async function assertSameSnapshot(expected, actual) {
        const stack = [[expected, actual, 0]], blobs = [];
        while (stack.length) {
            const [left, right, depth] = stack.pop();
            if (Object.is(left, right)) continue;
            if (depth > 64 || typeof left !== typeof right || !left || !right || typeof left !== 'object') changed();
            if (left instanceof Blob || right instanceof Blob) {
                if (!(left instanceof Blob) || !(right instanceof Blob) || left.size !== right.size || left.type !== right.type) changed();
                blobs.push([left, right]); continue;
            }
            if (left instanceof Date || right instanceof Date) {
                if (!(left instanceof Date) || !(right instanceof Date) || !Object.is(left.getTime(), right.getTime())) changed();
                continue;
            }
            if (left instanceof ArrayBuffer || right instanceof ArrayBuffer || ArrayBuffer.isView(left) || ArrayBuffer.isView(right)) {
                if (left.constructor !== right.constructor) changed();
                const bytes = value => value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
                if (!equalBytes(bytes(left), bytes(right))) changed(); continue;
            }
            if (Array.isArray(left) !== Array.isArray(right) || (Array.isArray(left) && left.length !== right.length)) changed();
            if (!Array.isArray(left) && (Object.getPrototypeOf(left) !== Object.prototype || Object.getPrototypeOf(right) !== Object.prototype)) changed();
            const keys = Object.keys(left);
            if (keys.length !== Object.keys(right).length) changed();
            for (const key of keys) {
                if (!Object.hasOwn(right, key)) changed();
                stack.push([left[key], right[key], depth + 1]);
            }
        }
        const chunkSize = 1024 * 1024;
        for (const [left, right] of blobs) for (let offset = 0; offset < left.size; offset += chunkSize) {
            const buffers = await Promise.all([left.slice(offset, offset + chunkSize).arrayBuffer(), right.slice(offset, offset + chunkSize).arrayBuffer()]);
            if (!equalBytes(new Uint8Array(buffers[0]), new Uint8Array(buffers[1]))) changed();
        }
        return true;
    }
    return Object.freeze({ assertSameSnapshot });
});
