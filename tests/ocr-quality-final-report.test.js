const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const REPORT = path.join(ROOT, 'docs/release/OCR_QUALITY_R1_FINAL_REPORT.md');

function readReport() {
    assert.equal(fs.existsSync(REPORT), true, 'final report must exist');
    return fs.readFileSync(REPORT, 'utf8');
}

test('Phase 8 final report records the authorized decision and corpus', () => {
    const report = readReport();
    assert.match(report, /OCR_QUALITY_R1_ACCEPTED_WITH_LIMITATIONS/);
    assert.match(report, /Corpus size:\s*0/i);
    assert.match(report, /Real OCR\/API calls:\s*0/i);
    assert.match(report, /Model downloads:\s*0/i);
});

test('final report records engine versions, hardware, and API cost', () => {
    const report = readReport();
    for (const term of ['qwen-vl-plus', 'legacy-unpinned', 'PaddleOCR', 'PaddleOCR-VL', 'olmOCR', 'mock']) {
        assert.match(report, new RegExp(term, 'i'), term);
    }
    for (const term of ['i5-12400F', 'RTX 4060', '17032749056', 'Node v24.16.0', 'CNY 0']) {
        assert.match(report, new RegExp(term, 'i'), term);
    }
});

test('final report keeps quality, safety, and correction metrics honest', () => {
    const report = readReport();
    for (const metric of ['raw CER', 'normalized CER', 'formula', 'structure', 'ownership', '95% CI', 'manual correction time']) {
        assert.match(report, new RegExp(`${metric}[^\n]*not measured`, 'i'), metric);
    }
    assert.match(report, /Synthetic attack classes:\s*22\/22 PASS/i);
    assert.match(report, /Real Holdout safety:\s*not measured/i);
    assert.doesNotMatch(report, /real Holdout[^\n]*PASS/i);
});

test('final report records production, shadow, rollback, and limitations', () => {
    const report = readReport();
    assert.match(report, /Production engines:\s*none added or replaced/i);
    assert.match(report, /Shadow engines measured:\s*none/i);
    assert.match(report, /Manual review required:\s*yes/i);
    assert.match(report, /v1\.1\.0-rc2-post-r2-correction/);
    assert.match(report, /v1\.2\.0-rc1-ocr-quality-r1/);
    assert.match(report, /git merge --ff-only stage\/ocr-quality-r1/);
    assert.match(report, /## Known limitations/i);
});

test('final report records all final gates and no real API use', () => {
    const report = readReport();
    assert.match(report, /Final mandatory gates:\s*PASS/i);
    assert.match(report, /Targeted Program B gates:\s*PASS/i);
    assert.match(report, /realApiCalled=false/);
    assert.match(report, /underlyingApiCallCount=0/);
});
