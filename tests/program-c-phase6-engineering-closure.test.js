const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const json = file => JSON.parse(read(file));

const REQUIRED_ATTACKS = [
    'bridge-port-missing', 'validator-missing', 'validator-throws',
    'controlled-write-missing', 'projection-missing', 'persistence-missing',
    'persistence-throws', 'repository-missing', 'formal-admission-missing',
    'state-machine-missing', 'source-classifier-missing',
    'production-source-port-missing', 'source-mode-missing',
    'field-provenance-missing', 'contradictory-provenance',
    'controlled-write-decision-missing',
    'duplicate-accepted-decision-conflict',
    'multiple-support-source-ambiguity', 'raw-json', 'placeholder',
    'answer-solution-swap', 'sequence-gap', 'sequence-rewind',
    'wrong-ownership', 'stale-evidence', 'formula-fallback',
    'malformed-engine-result', 'partial-write', 'readback-mismatch',
    'duplicate-click', 'duplicate-request-id', 'cancellation-race',
    'stale-batch-context', 'refresh', 'two-tab-import',
    'response-lost-after-commit', 'unknown-progress',
    'malformed-bridge-result', 'production-shadow-only', 'shadow-writes',
    'catch-fallback', 'feature-flag-fallback',
    'dynamic-retired-owner-invocation'
];

const ATTACK_FIELDS = [
    'attackId', 'route', 'expected', 'actual', 'diagnostic', 'draftWrites',
    'formalWrites', 'fallbackCalls', 'wrongAttachment', 'leakage',
    'finalUiState', 'pass'
];

test('Phase 6A counterfactual matrix is complete and safety-clean', () => {
    const matrix = json(
        'docs/testing/PROGRAM_C_PHASE6_COUNTERFACTUAL_ATTACK_MATRIX_R3.json'
    );
    assert.equal(
        matrix.schemaVersion,
        'qisi.program-c-phase6-counterfactual.r3'
    );
    assert.equal(matrix.realApiCalled, false);
    assert.equal(new Set(matrix.attacks.map(item => item.attackId)).size, 43);
    assert.deepEqual(
        new Set(matrix.attacks.map(item => item.attack)),
        new Set(REQUIRED_ATTACKS)
    );
    for (const attack of matrix.attacks) {
        for (const field of ATTACK_FIELDS) {
            assert.ok(Object.hasOwn(attack, field), `${attack.attackId}:${field}`);
        }
        assert.equal(attack.pass, true, attack.attackId);
        assert.equal(attack.fallbackCalls, 0, attack.attackId);
        assert.equal(attack.wrongAttachment, 0, attack.attackId);
        assert.equal(attack.leakage, 0, attack.attackId);
        assert.ok(Array.isArray(attack.evidence) && attack.evidence.length);
        for (const evidence of attack.evidence) {
            assert.ok(fs.existsSync(path.join(ROOT, evidence)), evidence);
        }
    }
});

test('Phase 6D closure benchmark smoke covers every non-browser scenario', () => {
    const output = execFileSync(
        process.execPath,
        [
            'scripts/benchmark/measure-program-c-closure.js',
            '--smoke'
        ],
        { cwd: ROOT, encoding: 'utf8', timeout: 30000 }
    );
    const result = JSON.parse(output);
    assert.equal(result.realApiCalled, false);
    assert.equal(
        result.baselineCommit,
        '79fea1e1cad0c682c42539dd575370f3919f1d05'
    );
    assert.equal(result.fixtureCandidateTransport, false);
    assert.equal(result.comparisons.length, 11);
    assert.deepEqual(
        new Set(result.comparisons.map(item => item.name)),
        new Set([
            'docx-deterministic',
            'docx-vision',
            'pdf-safe-partial',
            'review-draft-build-100',
            'review-draft-build-300',
            'confirm',
            'single-formal-submit',
            'batch-submit',
            'dedupe',
            'cleanup',
            'reload'
        ])
    );
    result.comparisons.forEach(item => {
        assert.equal(item.failureCount, 0, item.name);
        assert.equal(item.timeoutCount, 0, item.name);
        assert.ok(Number.isFinite(item.baseline.p50Ms), item.name);
        assert.ok(Number.isFinite(item.baseline.p95Ms), item.name);
        assert.ok(Number.isFinite(item.candidate.p50Ms), item.name);
        assert.ok(Number.isFinite(item.candidate.p95Ms), item.name);
    });
});

test('Phase 6D browser and validation harnesses enforce warmup, p50, p95, and ten runs', () => {
    const startup = read('scripts/benchmark/measure-app-shell-browser.js');
    const review = read('scripts/benchmark/measure-first-review-render.js');
    const validation = read('scripts/benchmark/measure-review-validation.js');
    assert.match(startup, /p50:/);
    assert.match(startup, /p95:/);
    assert.match(startup, /--runs=/);
    assert.match(review, /const warmupRuns = 2/);
    assert.match(review, /: 10\)/);
    assert.match(review, /realApiCalled: false/);
    assert.match(validation, /\[50, 100, 300\]/);
    assert.match(validation, /p50Ms/);
    assert.match(validation, /p95Ms/);
});

test('Phase 6 reports bind code quality, benchmark, and acceptance evidence', () => {
    const quality = read(
        'docs/architecture/PROGRAM_C_CODE_QUALITY_AUDIT_R3.md'
    );
    const benchmark = read(
        'docs/benchmark/PROGRAM_C_APP_SHELL_BENCHMARK_R3.md'
    );
    const report = read(
        'docs/release/PROGRAM_C_PHASE6_ENGINEERING_CLOSURE_REPORT.md'
    );
    assert.match(quality, /app\.js/);
    assert.match(quality, /ProductionImportBridge/);
    assert.match(quality, /transaction boundary/i);
    assert.match(benchmark, /10 measured runs/);
    assert.match(benchmark, /p50/);
    assert.match(benchmark, /p95/);
    assert.match(benchmark, /realApiCalled = false/);
    assert.match(
        report,
        /PROGRAM_C_PHASE6_ENGINEERING_CLOSURE_ACCEPTED/
    );
});
