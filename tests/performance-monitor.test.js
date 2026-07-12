const test = require('node:test');
const assert = require('node:assert/strict');
const { createMonitor } = require('../qisi-performance-monitor.js');

test('records allowlisted timing metadata without raw content', async () => {
    let time = 0;
    const monitor = createMonitor({ now: () => time, maxSamples: 2 });
    const value = await monitor.measure('library-query', async () => {
        time = 5;
        return 42;
    }, { count: 5000, rawText: 'must not be recorded' });
    assert.equal(value, 42);
    assert.deepEqual(monitor.snapshot(), [{
        stage: 'library-query', durationMs: 5, count: 5000, success: true
    }]);
    assert.equal(JSON.stringify(monitor.snapshot()).includes('rawText'), false);
});

test('records failures, caps samples, and ignores unknown stages', async () => {
    let time = 0;
    const monitor = createMonitor({ now: () => ++time, maxSamples: 2 });
    monitor.record('unknown', 1, { count: 1 });
    monitor.record('save', 2);
    await assert.rejects(
        monitor.measure('export', async () => { throw new Error('failed'); })
    );
    monitor.record('reload', 3);
    const samples = monitor.snapshot();
    assert.equal(samples.length, 2);
    assert.equal(samples[0].stage, 'export');
    assert.equal(samples[0].success, false);
    assert.equal(samples[1].stage, 'reload');
});
