const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const json = relativePath => JSON.parse(read(relativePath));

test('architecture audit reports every required invariant and honest limitation', () => {
    const report = read('docs/audit/OCR_QUALITY_ARCHITECTURE_AUDIT_R1.md');
    for (const topic of [
        'adapter pluggability', 'engine-specific domain isolation', 'shadow no-write',
        'unique promotion owner', 'controlled-write unchanged',
        'FormalAdmission unchanged', 'Route B frozen',
        'app local-model isolation', 'config traceability'
    ]) {
        assert.match(report, new RegExp(topic, 'i'), topic);
    }
    assert.match(report, /OCR_QUALITY_ARCHITECTURE_AUDIT_R1_ACCEPTED_WITH_LIMITATIONS/);
    assert.match(report, /production-promoted engines[^\n]*0/i);
});

test('OCR architecture owners are unique, acyclic, and never depend on UI/storage/formal write', () => {
    const layers = json('architecture/layers.json').modules;
    const owners = json('architecture/owners.json');
    const ocr = layers.filter(item => /ocr/.test(item.id));
    assert.ok(ocr.length >= 9);
    assert.equal(new Set(ocr.map(item => item.domainOwner)).size, ocr.length);
    for (const item of ocr) {
        assert.equal(owners[item.domainOwner], item.file);
        if (!['app-shell'].includes(item.id)) {
            assert.equal(item.allowedDependencies.includes('app-shell'), false, item.id);
            assert.equal(item.allowedDependencies.includes('storage-repository'), false, item.id);
            assert.equal(item.allowedDependencies.includes('formal-admission'), false, item.id);
        }
    }
});

test('adapter registry enforces the five-method pluggable contract', () => {
    const registry = read('qisi-ocr-engine-registry.js');
    for (const method of [
        'healthCheck', 'getCapabilities', 'recognizePage', 'recognizeDocument', 'cancel'
    ]) {
        assert.match(registry, new RegExp(`['"]${method}['"]`), method);
    }
    for (const adapter of ['qisi-ocr-qwen-adapter.js', 'qisi-ocr-local-adapter.js']) {
        const source = read(adapter);
        assert.doesNotMatch(source, /answerOwnership|saveQuestion|FormalAdmission|db\.questions/);
    }
});

test('Program A controlled-write, FormalAdmission, Route B, and app stay unchanged from seal', () => {
    const diff = execFileSync('git', [
        'diff', '--name-only',
        '1361d7e7f81d2f23819a995a0f9d1808adf19982..HEAD', '--',
        'qisi-pdf-support-controlled-write.js',
        'qisi-formal-admission-policy.js',
        'qisi-answer-only-ai-pass.js',
        'app.js'
    ], { cwd: root, encoding: 'utf8' });
    assert.equal(diff.trim(), '');
});

test('production and benchmark OCR configuration are traceable without false promotion', () => {
    const trace = json('architecture/ocr-engine-config-r1.json');
    assert.equal(trace.productionCurrent.productionPromotedByProgramB, false);
    assert.equal(trace.productionCurrent.versionStatus, 'legacy-unpinned');
    assert.equal(trace.benchmark.runner, 'scripts/benchmark/run-ocr-benchmark.js');
    assert.deepEqual(trace.promotionRegistry, []);
    assert.equal(trace.canary.enabled, false);
    assert.equal(trace.realOcrCalls, 0);
    assert.equal(trace.modelDownloads, 0);
});

test('app has no specific local model implementation and shadow/selection have no write authority', () => {
    const app = read('app.js');
    assert.doesNotMatch(app, /PaddleOCR|PaddleOCR-VL|olmOCR|Unlimited-OCR|local-ocr\/server/i);
    for (const file of ['qisi-ocr-shadow-mode.js', 'qisi-ocr-candidate-selection-policy.js']) {
        const source = read(file);
        assert.doesNotMatch(source, /eligibleForControlledWrite:\s*true/);
        assert.doesNotMatch(source, /eligibleForFormalAdmission:\s*true/);
        assert.doesNotMatch(source, /saveQuestion|confirmDraftToQuestion|db\.questions/);
    }
});
