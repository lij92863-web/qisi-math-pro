const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const REPORT = path.join(ROOT, 'docs/audit/POST_R2_ARCHITECTURE_AUDIT_R1.md');

test('Phase 5 report proves every required architecture invariant', () => {
    assert.equal(fs.existsSync(REPORT), true);
    const report = fs.readFileSync(REPORT, 'utf8');
    for (const proof of [
        'controlled-write owner', 'FormalAdmissionPolicy',
        'Repository transaction owner', 'app.js formal DB bypass',
        'controller fail-closed', 'recognition candidate E2E',
        'architecture manifest coverage', 'Route B frozen',
        'DOCX stable', 'PDF safe partial'
    ]) assert.match(report, new RegExp(`\\| ${proof.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')} \\|`, 'i'), proof);
    assert.match(report, /Decision:\s*PASS/i);
});

test('Phase 5 source-level owner chain remains intact', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const start = app.indexOf('const submitDraftQuestion = async');
    const submit = app.slice(start, app.indexOf('const refreshBatchStats', start));
    assert.doesNotMatch(submit, /db\.questions\.(?:put|add|bulkPut)/);
    assert.match(submit, /batchFormalSubmit\.submit/);
    const formal = fs.readFileSync(path.join(ROOT, 'qisi-batch-formal-submit.js'), 'utf8');
    assert.match(formal, /policy\.evaluateDraftAdmission/);
    assert.match(formal, /repository\.confirmDraftToQuestion/);
});
