const test = require('node:test');
const assert = require('node:assert/strict');
const Controller = require('../qisi-normal-ui-import-controller.js');
const { createHarness } = require('./helpers/production-import-harness.js');

const reviewResult = () => ({
    mode: 'production', state: { state: 'WAITING_CONFIRMATION' },
    readback: {
        batch: { id: 'batch-1', status: 'review' },
        questions: [{ id: 'draft-1' }]
    }
});

test('duplicate normal UI clicks share one Bridge production execution', async () => {
    let calls = 0;
    let release;
    const controller = Controller.createNormalUiImportController({
        bridge: { run: async () => {
            calls += 1;
            await new Promise(resolve => { release = resolve; });
            return reviewResult();
        } },
        loadBatch: async () => ({
            id: 'batch-1', sourceType: 'pdf', sourceVersion: 2,
            draftPersistence: { version: 0 }
        }),
        applyReviewModel: async () => {}
    });
    const first = controller.run('batch-1');
    const second = controller.run('batch-1');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 1);
    release();
    assert.equal(await first, await second);
    assert.equal(controller.isRunning('batch-1'), false);
});

test('cancellation reaches Bridge and busy state is always released', async () => {
    const busy = [];
    let observedSignal;
    const controller = Controller.createNormalUiImportController({
        bridge: { run: input => {
            observedSignal = input.signal;
            return new Promise((resolve, reject) => {
                input.signal.addEventListener('abort', () => {
                    const error = new Error('private cancellation detail');
                    error.code = 'IMPORT_CANCELLED';
                    reject(error);
                });
            });
        } },
        loadBatch: async () => ({
            id: 'batch-1', sourceType: 'docx', sourceVersion: 1
        }),
        applyReviewModel: async () => {},
        setBusy: event => busy.push(event.busy)
    });
    const pending = controller.run('batch-1');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(controller.cancel('batch-1'), true);
    await assert.rejects(pending, error =>
        error.code === 'IMPORT_CANCELLED' &&
        !/private cancellation detail/.test(error.message)
    );
    assert.equal(observedSignal.aborted, true);
    assert.deepEqual(busy, [true, false]);
});

test('review model is applied only after verified Bridge readback', async () => {
    const calls = [];
    const controller = Controller.createNormalUiImportController({
        bridge: { run: async input => {
            calls.push(['bridge', input.mode, input.producerRoute]);
            return reviewResult();
        } },
        loadBatch: async () => ({
            id: 'batch-1', sourceType: 'docx', sourceVersion: 1
        }),
        applyReviewModel: async result => calls.push([
            'review', result.readback.questions.length
        ])
    });
    await controller.run('batch-1');
    assert.deepEqual(calls, [
        ['bridge', 'production', 'docx-vision'],
        ['review', 1]
    ]);
});

test('a request cancelled before source execution produces no draft write', async () => {
    const harness = createHarness();
    const abortController = new AbortController();
    abortController.abort();

    await assert.rejects(
        harness.bridge.run({
            mode: 'production',
            batchId: 'batch-1',
            requestId: 'cancel-before-source',
            producerRoute: 'docx-deterministic',
            expectedSourceVersion: 1,
            signal: abortController.signal
        }),
        error => error.code === 'IMPORT_CANCELLED'
    );
    assert.equal(harness.metrics.producerCalls, 0);
    assert.equal(harness.metrics.persistenceCalls, 0);
    assert.deepEqual(harness.getStoredDrafts(), []);
});

for (const stage of [
    {
        name: 'before validation',
        port: 'projectImportOutput',
        result: input => ({
            drafts: input.drafts,
            draftImages: input.draftImages
        })
    },
    {
        name: 'before persistence',
        port: 'buildReviewDrafts',
        result: rows => rows
    }
]) {
    test(`cancellation ${stage.name} fails closed before draft persistence`, async () => {
        const abortController = new AbortController();
        const harness = createHarness({
            [stage.port]: async input => {
                abortController.abort();
                return stage.result(input);
            }
        });

        await assert.rejects(
            harness.bridge.run({
                mode: 'production',
                batchId: 'batch-1',
                requestId: `cancel-${stage.port}`,
                producerRoute: 'docx-deterministic',
                expectedSourceVersion: 1,
                signal: abortController.signal
            }),
            error => error.code === 'IMPORT_CANCELLED'
        );
        assert.equal(harness.metrics.persistenceCalls, 0);
        assert.deepEqual(harness.getStoredDrafts(), []);
    });
}

test('a verified committed result is not converted into cancellation before UI return', async () => {
    let releaseReview;
    let reviewStarted;
    const started = new Promise(resolve => { reviewStarted = resolve; });
    const controller = Controller.createNormalUiImportController({
        bridge: { run: async () => reviewResult() },
        loadBatch: async () => ({
            id: 'batch-1', sourceType: 'docx', sourceVersion: 1
        }),
        applyReviewModel: async () => {
            reviewStarted();
            await new Promise(resolve => { releaseReview = resolve; });
        }
    });

    const pending = controller.run('batch-1');
    await started;
    assert.equal(controller.cancel('batch-1'), false);
    releaseReview();
    const result = await pending;
    assert.equal(result.state.state, 'WAITING_CONFIRMATION');
});
