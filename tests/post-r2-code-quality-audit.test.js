const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const REPORT = path.join(ROOT, 'docs/audit/POST_R2_CODE_QUALITY_AUDIT_R1.md');

test('Phase 4 report covers every required audit dimension', () => {
    assert.equal(fs.existsSync(REPORT), true);
    const report = fs.readFileSync(REPORT, 'utf8');
    for (const topic of [
        'permissive defaults', 'duplicate owner', 'direct DB formal writes',
        'broad catch', 'swallowed error', 'hidden global state',
        'duplicated schema', 'manual/provenance mutation',
        'test-created production rules', 'seeded E2E terminology',
        'stale state/report'
    ]) assert.match(report, new RegExp(`\\| ${topic.replace('/', '\\/')} \\|`, 'i'), topic);
    assert.match(report, /Decision:\s*PASS/i);
});

test('Phase 4 low-risk remediation removes empty production catches', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    assert.doesNotMatch(app, /catch\s*\([^)]*\)\s*\{\s*\}/);
});
