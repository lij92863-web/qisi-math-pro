const { performance } = require('node:perf_hooks');
const {
    startBrowserApp,
    callProxy,
    seedReviewBatch,
    clearE2eData,
    assertNoRuntimeErrors
} = require('../../tests/e2e/browser-harness.js');

const readRuns = () => {
    const raw = process.argv.slice(2)
        .find(value => value.startsWith('--runs='));
    const runs = Number(raw ? raw.slice('--runs='.length) : 10);
    if (!Number.isInteger(runs) || runs < 1 || runs > 20) {
        throw new Error('runs-must-be-1-to-20');
    }
    return runs;
};

const percentile = (samples, ratio) => {
    const values = [...samples].sort((left, right) => left - right);
    return values[Math.max(
        0,
        Math.min(values.length - 1, Math.ceil(values.length * ratio) - 1)
    )];
};

async function measure() {
    const sampleRuns = readRuns();
    const warmupRuns = 2;
    const harness = await startBrowserApp(32120);
    const samplesMs = [];

    try {
        await harness.page.evaluate(() => {
            const proxy = window.Qisi.Runtime
                .getRuntimeDependency('AppProxy');
            proxy.view = 'batchImport';
        });
        for (
            let index = 0;
            index < warmupRuns + sampleRuns;
            index += 1
        ) {
            await clearE2eData(harness.page);
            const batchId = await seedReviewBatch(harness.page, {
                batchId: `benchmark-review-render-${index}`,
                title: `Benchmark review render ${index}`
            });
            await callProxy(harness.page, 'openBatchList');
            const started = performance.now();
            await callProxy(harness.page, 'openBatchReview', batchId);
            await harness.page.locator('.batch-latex-source-editor')
                .waitFor({ state: 'visible', timeout: 15000 });
            const durationMs = performance.now() - started;
            if (index >= warmupRuns) samplesMs.push(durationMs);
        }
        assertNoRuntimeErrors(harness);
        return {
            schemaVersion: 'qisi.first-review-render-benchmark.r3',
            browser: 'playwright-chromium-headless',
            sampleRuns,
            warmupRuns,
            p50Ms: percentile(samplesMs, 0.5),
            p95Ms: percentile(samplesMs, 0.95),
            timeoutCount: 0,
            failureCount: 0,
            realApiCalled: false,
            samplesMs
        };
    } finally {
        await clearE2eData(harness.page).catch(() => {});
        await harness.close();
    }
}

measure()
    .then(result => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
    .catch(error => {
        process.stderr.write(
            `[measure-first-review-render] ${error?.stack || error}\n`
        );
        process.exitCode = 1;
    });
