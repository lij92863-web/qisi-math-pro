const test = require('node:test');
const assert = require('node:assert/strict');

const { createSerialTaskQueue } = require('../qisi-serial-task-queue.js');

test('serial task queue prevents native MathType jobs from overlapping', async () => {
    const enqueue = createSerialTaskQueue();
    let active = 0;
    let maximumActive = 0;
    const order = [];
    const task = id => enqueue(async () => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        order.push(`start-${id}`);
        await new Promise(resolve => setTimeout(resolve, 5));
        order.push(`end-${id}`);
        active -= 1;
        return id;
    });

    assert.deepEqual(await Promise.all([task(1), task(2), task(3)]), [1, 2, 3]);
    assert.equal(maximumActive, 1);
    assert.deepEqual(order, ['start-1', 'end-1', 'start-2', 'end-2', 'start-3', 'end-3']);
});

test('serial task queue continues after a failed native job', async () => {
    const enqueue = createSerialTaskQueue();
    await assert.rejects(enqueue(async () => { throw new Error('native failure'); }), /native failure/);
    assert.equal(await enqueue(async () => 'recovered'), 'recovered');
});
