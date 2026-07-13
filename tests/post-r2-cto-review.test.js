const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const REVIEW = path.join(ROOT, 'docs/release/POST_R2_CORRECTION_R1_CTO_REVIEW.md');

test('Phase 7 CTO review uses one authorized decision and states every boundary', () => {
    assert.equal(fs.existsSync(REVIEW), true);
    const review = fs.readFileSync(REVIEW, 'utf8');
    const decisions = review.match(/POST_R2_CORRECTION_(?:ACCEPTED(?:_WITH_LIMITATIONS)?|BLOCKED)/g) || [];
    assert.deepEqual([...new Set(decisions)], ['POST_R2_CORRECTION_ACCEPTED_WITH_LIMITATIONS']);
    for (const section of ['Production-wired', 'Scaffold', 'Real OCR not measured', 'Program B', 'Program C']) {
        assert.match(review, new RegExp(`## ${section}`, 'i'), section);
    }
});

test('Phase 7 status labels agree with the architecture manifest', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'architecture/layers.json'), 'utf8'));
    assert.ok(manifest.modules.some(item => item.status === 'production-wired'));
    assert.ok(manifest.modules.some(item => item.status === 'scaffold'));
    assert.ok(manifest.modules.some(item => item.status === 'research-only'));
});
