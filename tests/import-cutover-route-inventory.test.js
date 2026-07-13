const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('route inventory covers every required reachable, rejected, and compatibility route', () => {
    const audit = read('docs/architecture/NORMAL_UI_IMPORT_ROUTE_INVENTORY_C2_11.md');
    for (const token of [
        'DOCX question + DOCX answer', 'DOCX vision', 'DOCX deterministic',
        'PDF full', 'PDF safe-partial', 'PDF known-bad', 'PDF conflict',
        'PDF ambiguity', 'raw JSON', 'formula fallback', 'cancellation',
        'retry', 'duplicate submission', 'unsupported file type',
        'mixed source', 'quick-import', 'resume-import',
        'historical compatibility', 'feature flag'
    ]) assert.ok(audit.toLowerCase().includes(token.toLowerCase()), token);
    assert.match(audit, /normal UI[^\n]*ProductionImportBridge/i);
    assert.match(audit, /DOCX deterministic[^\n]*N\/A/i);
});

test('visible run, retry, rerun, and cancel commands converge on the controller', () => {
    const html = read('main.html');
    const app = read('app.js');
    assert.match(html, /runBatchRecognition\(batch\.id\)/);
    assert.match(html, /rerunActiveBatchRecognition/);
    assert.match(html, /cancelBatchRecognition\(batch\.id\)/);
    assert.match(app, /normalUiImportController\.run/);
    assert.match(app, /normalUiImportController\.cancel/);
});
