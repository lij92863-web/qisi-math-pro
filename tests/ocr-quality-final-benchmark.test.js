const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const reportPath = path.join(root, 'docs', 'benchmark', 'OCR_QUALITY_FINAL_BENCHMARK_R1.md');

test('final benchmark reports zero corpus and no unauthorized measurement or promotion', () => {
    const report = fs.readFileSync(reportPath, 'utf8');
    assert.match(report, /corpus size[^\n]*0/i);
    assert.match(report, /QISI_ALLOW_REAL_OCR_BENCH=1[^\n]*absent/i);
    assert.match(report, /QISI_ALLOW_MODEL_DOWNLOAD=1[^\n]*absent/i);
    assert.match(report, /real OCR\/API calls[^\n]*0/i);
    assert.match(report, /model downloads[^\n]*0/i);
    assert.match(report, /production-promoted engines[^\n]*none/i);
    assert.match(report, /NO_ENGINE_ELIGIBLE_FOR_PROMOTION/);
});

test('per-document and every required category are explicitly not measured', () => {
    const report = fs.readFileSync(reportPath, 'utf8');
    assert.match(report, /Per-document results[\s\S]*No eligible documents/i);
    for (const category of [
        'clear electronic PDF', 'scanned PDF', 'skewed', 'low resolution',
        'formula-dense', 'geometry diagram', 'double-column',
        'watermark/annotation', 'long answer/solution', 'known-bad',
        'DOCX-converted image', 'non-contiguous numbering', 'multiple choice',
        'true/false', 'fill-in-the-blank'
    ]) {
        assert.match(
            report,
            new RegExp(`\\| ${category.replaceAll('/', '\\/')} \\| 0 \\| not measured \\|`, 'i'),
            category
        );
    }
});

test('aggregate quality, confidence interval, and human cost remain unmeasured', () => {
    const report = fs.readFileSync(reportPath, 'utf8');
    for (const metric of [
        'raw CER', 'normalized CER', 'formula token F1', 'formula exact match',
        'question precision/recall', 'ownership accuracy',
        'manual correction time', 'manual review rate'
    ]) {
        assert.match(report, new RegExp(`${metric}[^\\n]*not measured`, 'i'), metric);
    }
    assert.match(report, /95% bootstrap CI[^\n]*not calculated/i);
    assert.match(report, /human efficiency improvement[^\n]*not measured/i);
});

test('fatal safety metrics distinguish real Holdout absence from synthetic gate evidence', () => {
    const report = fs.readFileSync(reportPath, 'utf8');
    for (const metric of [
        'wrong answer attachment', 'wrong solution attachment',
        'fabricated question', 'raw JSON leakage', 'placeholder leakage',
        'controlled-write bypass', 'FormalAdmission bypass'
    ]) {
        assert.match(report, new RegExp(`${metric}[^\\n]*not measured`, 'i'), metric);
    }
    assert.match(report, /synthetic attack[^\n]*introduced[^\n]*0/i);
    assert.doesNotMatch(report, /real Holdout[^\n]*PASS/i);
});

test('cost, hardware, deployment complexity, and engine status are recorded', () => {
    const report = fs.readFileSync(reportPath, 'utf8');
    assert.match(report, /API cost[^\n]*CNY 0/i);
    assert.match(report, /Intel\(R\) Core\(TM\) i5-12400F/i);
    assert.match(report, /NVIDIA GeForce RTX 4060/i);
    assert.match(report, /17032749056 bytes/i);
    assert.match(report, /Node v24\.16\.0/i);
    assert.match(report, /deployment complexity/i);
    assert.match(report, /qwen-vl-plus[^\n]*legacy-unpinned/i);
    assert.match(report, /local-ocr[^\n]*unavailable/i);
    assert.match(report, /mock\/synthetic[^\n]*unit-tested/i);
});
