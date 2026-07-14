const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('normal UI production matrix does not inject final-candidate transport', () => {
    const suite = read('tests/e2e/production-normal-ui-import-cutover.test.js');
    assert.doesNotMatch(suite, /production-cutover-fixtures/);
    assert.doesNotMatch(suite, /ImportAdapterRegistry|produceCandidates/);
    assert.doesNotMatch(suite, /candidates:\s*\[candidate\]/);
    assert.match(suite, /source-producer-entered/);
    assert.match(suite, /parser-entered/);
    assert.match(suite, /validation-complete/);
    assert.match(suite, /draft-persisted/);
    assert.match(suite, /readback-verified/);
});

test('browser harness exposes only an outer engine mock boundary', () => {
    const harness = read('tests/e2e/browser-harness.js');
    assert.doesNotMatch(harness, /installImportTransport|ImportAdapterRegistry/);
    assert.match(harness, /install.*Engine|engine.*injection/i);
});

test('true import suites do not receive final candidate fixtures', () => {
    const source = [
        read('tests/e2e/true-import-docx.test.js'),
        read('tests/e2e/true-import-pdf-safe-partial.test.js'),
        read('tests/e2e/true-import-admission.test.js')
    ].join('\n');
    assert.doesNotMatch(source, /installImportTransport/);
    assert.doesNotMatch(source, /docxCandidate|pdfCandidate/);
});
