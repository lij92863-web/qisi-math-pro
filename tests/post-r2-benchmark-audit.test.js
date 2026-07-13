const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Policy = require('../qisi-formal-admission-policy.js');
const Validation = require('../qisi-production-review-validator.js');

const ROOT = path.resolve(__dirname, '..');
const REPORT = path.join(ROOT, 'docs/benchmark/POST_R2_CORRECTION_BENCHMARK_R1.md');

const draft = index => ({
    id: `d${index}`, version: 1, status: 'pending', questionNumber: String(index + 1),
    type: '解答题', stem: `question ${index}`, options: [], answer: 'A', solution: 'solution', images: [],
    source: { mode: 'docx-deterministic', sourceId: 'docx-1', batchId: 'b1' },
    fieldProvenance: Object.fromEntries(Policy.FORMAL_FIELDS.map(field => [field,
        field === 'images' || field === 'options' ? { status: 'missing' } : { status: 'deterministic-source', sourceId: 'docx-1', evidenceRef: `docx:${index}:${field}` }
    ]))
});

test('Phase 6 production review validates 10/50/100 deterministically', () => {
    const validator = Validation.createProductionReviewValidator({ policy: Policy, clock: () => Date.parse('2026-07-13T00:00:00Z') });
    for (const count of [10, 50, 100]) {
        const rows = Array.from({ length: count }, (_, index) => draft(index));
        const started = performance.now();
        const results = rows.map(item => validator.validate(item));
        const duration = performance.now() - started;
        assert.equal(results.every(result => result.valid), true);
        assert.ok(duration < 1000, `${count} review validations took ${duration}ms`);
    }
});

test('Phase 6 formal bypass and app DB callsite counts are explicit', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const start = app.indexOf('const submitDraftQuestion = async');
    const submit = app.slice(start, app.indexOf('const refreshBatchStats', start));
    assert.equal((submit.match(/db\.questions\.(?:put|add|bulkPut)/g) || []).length, 0);
    assert.equal((app.match(
        /db\.questions\.(?:put|add|bulkPut|update|delete|bulkDelete|clear)/g
    ) || []).length, 0);
});

test('Phase 6 benchmark report records every required workload and passes 10 percent gate', () => {
    assert.equal(fs.existsSync(REPORT), true);
    const report = fs.readFileSync(REPORT, 'utf8');
    for (const term of ['Formal Admission', 'true deterministic E2E', '10/50/100', 'formal submit', 'reload', '1000/5000', 'image persistence', 'export', 'wrong attachment', 'partial transaction']) {
        assert.match(report, new RegExp(term, 'i'), term);
    }
    const change = Number(report.match(/Representative regression vs R2 final:\s*\+?([\d.]+)%/i)?.[1]);
    assert.ok(Number.isFinite(change) && change <= 10, `regression ${change}%`);
    assert.match(report, /Decision:\s*PASS/i);
});
