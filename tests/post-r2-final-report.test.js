const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const REPORT = path.join(ROOT, 'docs/release/POST_R2_CORRECTION_R1_FINAL_REPORT.md');

test('Phase 8 final report contains decision, evidence, limitations, and seal plan', () => {
    assert.equal(fs.existsSync(REPORT), true);
    const report = fs.readFileSync(REPORT, 'utf8');
    for (const term of [
        'POST_R2_CORRECTION_ACCEPTED_WITH_LIMITATIONS',
        '6ab88d0551be5af24d134f17906ba0c42631b2ea',
        'Formal Admission', 'Question schema v2', 'Repository transaction',
        '18 counterfactual', 'Benchmark', 'real OCR', 'Program B', 'Program C',
        'v1.1.0-rc2-post-r2-correction', 'merge --ff-only'
    ]) assert.match(report, new RegExp(term, 'i'), term);
    assert.match(report, /Final mandatory gates:\s*PASS/i);
});

test('Phase 8 report does not claim real OCR or Route B production promotion', () => {
    const report = fs.readFileSync(REPORT, 'utf8');
    assert.doesNotMatch(report, /real OCR(?:[^\n]{0,40})(?:passed|improved|promoted)/i);
    assert.match(report, /Route B[^\n]+research-only/i);
});
