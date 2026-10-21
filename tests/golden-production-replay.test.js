const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runSuite } = require('../scripts/golden/run.cjs');

test('offline golden suite preserves production import, review and admission behavior', { timeout: 180000 }, async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'qisi-golden-'));
    const report = await runSuite({ out, port: 32681 });
    assert.equal(report.ok, true, 'Per-question results: ' + path.join(out, 'report.json'));
    assert.equal(report.summary.humanReviewRecorded, false);
    assert.ok(report.cases.some(item => item.workflow === 'confirmed-submitted-reloaded'));
    assert.ok(report.cases.some(item => item.counts.requiredWithheldFields > 0));
});
