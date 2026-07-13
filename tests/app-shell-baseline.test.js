const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const REPORT = path.join(ROOT, 'docs/benchmark/APP_SHELL_BASELINE_R3.md');
const SCRIPT = path.join(ROOT, 'scripts/benchmark/measure-app-shell-browser.js');

test('Program C baseline records every required static and dependency metric', () => {
    assert.equal(fs.existsSync(REPORT), true, 'baseline report must exist');
    const report = fs.readFileSync(REPORT, 'utf8');
    for (const term of [
        'app.js lines', 'function count', 'largest functions', 'direct DB calls',
        'direct OCR calls', 'parser/repair calls', 'export implementation lines',
        'processDraftImportBatch lines', 'browser performance', 'memory',
        'module dependency graph'
    ]) assert.match(report, new RegExp(term, 'i'), term);
    assert.match(report, /21778/);
    assert.match(report, /318/);
    assert.match(report, /processDraftImportBatch[^\n]*5132/i);
});

test('browser baseline harness emits reproducible timing and heap metadata', { timeout: 45000 }, () => {
    assert.equal(fs.existsSync(SCRIPT), true, 'browser benchmark script must exist');
    const run = spawnSync(process.execPath, [SCRIPT, '--runs=1'], {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 40000,
        env: { ...process.env, QISI_BENCHMARK_PURPOSE: 'app-shell-r3-baseline-test' }
    });
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const result = JSON.parse(run.stdout);
    assert.equal(result.schemaVersion, 'qisi.app-shell-browser-benchmark.r3');
    assert.equal(result.purpose, 'app-shell-r3-baseline-test');
    assert.equal(result.sampleRuns, 1);
    assert.equal(result.samples[0].status, 200);
    for (const key of ['coldStartMs', 'domContentLoadedMs', 'loadEventMs', 'jsHeapUsedBytes', 'jsHeapTotalBytes']) {
        assert.equal(Number.isFinite(result.median[key]), true, key);
        assert.equal(result.median[key] >= 0, true, key);
    }
    assert.equal('rawText' in result, false);
});
