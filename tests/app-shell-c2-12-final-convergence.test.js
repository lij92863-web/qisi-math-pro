const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('C2-12 shell has no legacy import owner or audited dead merge owner', () => {
    const app = read('app.js');
    assert.doesNotMatch(
        app,
        /processDraftImportBatch(?:V2)?|mergeDraftRecognition|__qisiExplicitQuestionMergeSelfTest/
    );
    assert.doesNotMatch(
        app,
        /alignSupportItemsSafely|mapItemsByMatchKey|buildExplicitQuestionMergePlan/
    );
    assert.match(app, /createProductionImportBridge\s*\(/);
    assert.match(app, /createNormalUiImportController\s*\(/);
});

test('active browser source, PDF render, support, and strict policy owners are outside app', () => {
    const app = read('app.js');
    const html = read('main.html');
    assert.doesNotMatch(
        app,
        /const (?:extractTextFromDraftFile|extractPdfTextWithPdfJs|extractPdfLayoutWithPdfJs|renderPdfFilePages)\s*=/
    );
    assert.doesNotMatch(
        app,
        /const (?:recognizeVisualSupportFromPreparedPages|validateVisualQuestionItems|mergeStrictQuestionItemsByNumber)\s*=/
    );
    assert.doesNotMatch(
        app,
        /const (?:parseQuestionItemsFromText|parseAnswerAndSolutionItemsFromText|parseStrictQuestionPayload|postprocessRecognizedItems|locateQuestionFiguresWithQwen|repairPageChoiceAndSolutionDetailsWithVision|normalizeDraftQuestionBeforeSave)\s*=/
    );
    assert.match(app, /Qisi\.BrowserDocumentSource/);
    assert.match(app, /Qisi\.BrowserPdfRenderer/);
    assert.match(app, /Qisi\.VisualSupportSource/);
    assert.match(app, /Qisi\.StrictQuestionPolicy/);
    for (const script of [
        'qisi-browser-document-source.js',
        'qisi-browser-pdf-renderer.js',
        'qisi-visual-support-source.js',
        'qisi-visual-question-source.js',
        'qisi-question-content-policy.js',
        'qisi-question-image-policy.js',
        'qisi-page-question-parser.js',
        'qisi-solution-quality-policy.js',
        'qisi-support-text-parser.js',
        'qisi-support-latex-policy.js',
        'qisi-recognition-structure-policy.js',
        'qisi-review-draft-normalization-policy.js',
        'qisi-strict-question-policy.js'
    ]) {
        assert.ok(html.indexOf(script) > 0, `${script} must be loaded`);
        assert.ok(
            html.indexOf(script) < html.indexOf('./app.js'),
            `${script} must load before app.js`
        );
    }
});

test('C2-12 hard storage, OCR transport, validation, and review boundaries stay closed', () => {
    const app = read('app.js');
    assert.doesNotMatch(
        app,
        /\bdb\.questions\.(?:put|add|bulkPut|update|delete|bulkDelete|clear)\s*\(/
    );
    assert.doesNotMatch(app, /fetch\s*\(\s*['"]\/api\/ai\//);
    assert.doesNotMatch(app, /const importValidationPorts\s*=\s*\{/);
    assert.doesNotMatch(app, /db\.transaction[^\n]*(?:draftQuestions|draftImages)/);
    assert.match(app, /ImportValidationService\.validateImportDrafts\s*\(/);
    assert.match(app, /ReviewDraftBuilder\.buildReviewDrafts\s*\(/);
    assert.match(app, /draftPersistenceService\.persistReviewDraftBatch\s*\(/);
});
