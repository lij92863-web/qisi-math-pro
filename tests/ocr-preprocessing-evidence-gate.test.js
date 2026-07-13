const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('preprocessing remains unimplemented and disabled without real baseline evidence', () => {
    const decision = read('docs/ocr/OCR_PREPROCESSING_DECISION_R1.md');
    assert.match(decision, /NOT_IMPLEMENTED_NO_BASELINE/);
    assert.match(decision, /eligible private documents[^\n]*0/i);
    assert.match(decision, /QISI_ALLOW_REAL_OCR_BENCH=1[^\n]*absent/i);
    for (const step of [
        'orientation', 'deskew', 'perspective', 'crop', 'contrast',
        'grayscale', 'threshold', 'denoise', 'resolution normalization'
    ]) {
        assert.match(decision, new RegExp(`${step}[^\\n]*disabled`, 'i'), step);
    }
    assert.equal(fs.existsSync(path.join(root, 'qisi-ocr-preprocessing.js')), false);
    assert.doesNotMatch(read('main.html'), /qisi-ocr-preprocessing\.js/);
});

test('future preprocessing requires isolated measured benefit and preserves source evidence', () => {
    const decision = read('docs/ocr/OCR_PREPROCESSING_DECISION_R1.md');
    assert.match(decision, /one step at a time/i);
    assert.match(decision, /transformation metadata/i);
    assert.match(decision, /must not overwrite the source image/i);
    assert.match(decision, /Calibration.*Development.*Holdout/is);
    assert.match(decision, /no benefit[^\n]*not enable/i);
    assert.match(decision, /production-promoted[^\n]*no/i);
});
