const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const REVIEW = path.join(ROOT, 'docs/release/OCR_QUALITY_R1_CTO_REVIEW.md');

function readReview() {
    assert.equal(fs.existsSync(REVIEW), true, 'CTO review must exist');
    return fs.readFileSync(REVIEW, 'utf8');
}

test('Phase 7 CTO review uses exactly one authorized decision', () => {
    const review = readReview();
    const decisions = review.match(/OCR_QUALITY_R1_(?:ACCEPTED(?:_WITH_LIMITATIONS)?|BLOCKED)/g) || [];
    assert.deepEqual([...new Set(decisions)], ['OCR_QUALITY_R1_ACCEPTED_WITH_LIMITATIONS']);
});

test('CTO review distinguishes production, shadow, and research engine status', () => {
    const review = readReview();
    assert.match(review, /production-promoted engines:\s*none/i);
    assert.match(review, /shadow engines measured:\s*none/i);
    for (const engine of ['qwen-vl-plus', 'PaddleOCR', 'PaddleOCR-VL', 'olmOCR', 'mock']) {
        assert.match(review, new RegExp(engine, 'i'), engine);
    }
    assert.match(review, /research-only/i);
});

test('CTO review makes no real efficiency or safety claim', () => {
    const review = readReview();
    assert.match(review, /eligible private documents:\s*0/i);
    assert.match(review, /real Holdout runs:\s*0/i);
    assert.match(review, /human efficiency improvement:\s*not measured/i);
    assert.doesNotMatch(review, /real (?:OCR )?quality[^\n]*(?:improved|passed)/i);
});

test('CTO review preserves manual review and states local deployment burden', () => {
    const review = readReview();
    assert.match(review, /manual review required:\s*yes/i);
    assert.match(review, /installed model burden:\s*none/i);
    assert.match(review, /future local deployment burden/i);
    assert.match(review, /production behavior:\s*unchanged/i);
});

test('CTO review cites the four completed evidence classes and rollback', () => {
    const review = readReview();
    for (const section of ['Code audit', 'Architecture audit', 'Counterfactual attacks', 'Final benchmark', 'Rollback']) {
        assert.match(review, new RegExp(`## ${section}`, 'i'), section);
    }
});
