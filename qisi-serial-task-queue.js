'use strict';

const createSerialTaskQueue = () => {
    let tail = Promise.resolve();
    return task => {
        if (typeof task !== 'function') return Promise.reject(new TypeError('Queued task must be a function.'));
        const current = tail.then(() => task());
        tail = current.catch(() => undefined);
        return current;
    };
};

module.exports = { createSerialTaskQueue };
