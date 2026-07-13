const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('app shell has zero direct OCR transport, model, and strict producer ownership', () => {
    const app = read('app.js');
    assert.doesNotMatch(app, /fetch\s*\(\s*['"`]\/api\/ai\//);
    assert.doesNotMatch(
        app,
        /qwenProxyTransport\.(?:request|getEndpoint|checkHealth)\s*\(/
    );
    assert.doesNotMatch(
        app,
        /qwen-vl|qwen3|qwen-plus|OCR_MODEL|VISION_MODELS|getVisionModelsForMode/
    );
    assert.doesNotMatch(
        app,
        /document_parsing|advanced_recognition|formula_recognition/
    );
    assert.doesNotMatch(app, /const\s+recognizeStrictQuestionPageWithQwen\b/);
    assert.doesNotMatch(app, /const\s+recognizeExamPageStructuredWithQwen\b/);
    assert.doesNotMatch(app, /InjectedImportTransport/);
    assert.match(app, /createQwenTaskClient\s*\(/);
    assert.match(app, /QwenVisionSourcePort/);
});

test('production owns adapter and strict source while browser mocks stay isolated', () => {
    const app = read('app.js');
    const html = read('main.html');
    const adapterIndex = html.indexOf('qisi-ocr-qwen-adapter.js');
    const sourceIndex = html.indexOf('qisi-qwen-vision-source-port.js');
    const appIndex = html.indexOf('app.js');
    assert.ok(adapterIndex > 0 && adapterIndex < sourceIndex && sourceIndex < appIndex);
    assert.doesNotMatch(html, /tests\/|mock-import-transport/);

    const adapter = read('qisi-ocr-qwen-adapter.js');
    const source = read('qisi-qwen-vision-source-port.js');
    assert.match(adapter, /createQwenTaskClient/);
    assert.match(source, /createStrictQuestionPageRecognizer/);
    assert.doesNotMatch(source, /\bdb\.|formalAdmission|confirmDraftToQuestion/);
    assert.doesNotMatch(adapter, /console\.(?:log|error)\s*\(/);

    const browserHarness = read('tests/e2e/browser-harness.js');
    assert.match(browserHarness, /qisi\.mock-import-transport\.v1/);
    assert.doesNotMatch(app, /qisi\.mock-import-transport\.v1/);
});

test('retired OCR producer functions have no production definitions or references', () => {
    const app = read('app.js');
    for (const name of [
        'recognizeTextQuestionsWithQwen',
        'recognizeImageQuestionJsonWithQwen',
        'recognizeDocxRenderedPagesWithQwen',
        'recognizePdfStructuredWithQwen',
        'recognizePdfPagesWithQwen',
        'recognizeDocxPageImagesWithQwen',
        'recognizePdfAnswerPagesWithQwen',
        'recognizeDocxAnswerImagesWithQwen',
        'repairDraftAnswersWithQwen',
        'repairFinalDraftDetailsWithVision',
        'repairChoiceOptionsWithQwen',
        'rebuildMissingChoiceOptionsWithQwen'
    ]) {
        assert.doesNotMatch(app, new RegExp(`\\b${name}\\b`), name);
    }
});
