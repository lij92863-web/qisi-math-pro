const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const productionFiles = fs.readdirSync(ROOT)
    .filter(name => /^(?:app|qisi-[\w-]+)\.js$/.test(name));

test('lower layers have no reverse dependency on UI or app shell', () => {
    for (const file of [
        'qisi-recognition-contracts.js',
        'qisi-support-repair.js',
        'qisi-pdf-support-aligner.js',
        'qisi-pdf-support-controlled-write.js',
        'qisi-storage-repository.js',
        'qisi-ocr-engine-registry.js',
        'qisi-ocr-qwen-adapter.js',
        'qisi-ocr-local-adapter.js'
    ]) {
        const source = read(file);
        assert.doesNotMatch(source, /Qisi\.(?:UiEvents|UiRenderer|Components|AppProxy)/, file);
        assert.doesNotMatch(source, /require\(['"]\.\/app\.js['"]\)/, file);
        assert.doesNotMatch(source, /document\.|querySelector|innerHTML/, file);
    }
});

test('critical implementation symbols have one production owner', () => {
    const symbols = {
        buildPdfSupportFieldLevelControlledWrite: 'qisi-pdf-support-controlled-write.js',
        escapeLatexBackslashesInJsonCandidate: 'qisi-support-repair.js',
        createRepository: 'qisi-storage-repository.js',
        createRegistry: 'qisi-ocr-engine-registry.js',
        validateConfirmedQuestion: 'qisi-recognition-contracts.js',
        alignPdfSupport: 'qisi-pdf-support-aligner.js',
        createExportService: 'qisi-export-service.js',
        createReviewController: 'qisi-review-controller.js'
    };
    for (const [symbol, expected] of Object.entries(symbols)) {
        const implementation = new RegExp(
            `(?:const|function)\\s+${symbol}\\s*(?:=\\s*(?:async\\s*)?(?:\\(|[A-Za-z_$][\\w$]*\\s*=>)|\\()`
        );
        const owners = productionFiles.filter(file => implementation.test(read(file)));
        assert.deepEqual(owners, [expected], symbol);
    }
});

test('review and OCR boundaries cannot bypass controlled-write', () => {
    const review = read('qisi-review-controller.js');
    assert.doesNotMatch(review, /saveQuestion|\.put\s*\(|\.bulkPut\s*\(|\.transaction\s*\(/);
    for (const file of productionFiles.filter(name => name.startsWith('qisi-ocr-'))) {
        const source = read(file);
        assert.doesNotMatch(source, /saveQuestion|confirmedAt|manualConfirmed\s*:\s*true/, file);
        assert.doesNotMatch(source, /eligibleForControlledWrite\s*:\s*true/, file);
    }
    const app = read('app.js');
    assert.match(app, /buildPdfSupportFieldLevelControlledWrite/);
    assert.doesNotMatch(app, /qisi-answer-only-ai-pass|AnswerOnlyAiPass/);
});

test('runtime owner order is deterministic and app is last', () => {
    const { analyzeRuntimeDependencies } = require('../scripts/verify-qisi-runtime-dependencies.js');
    const result = analyzeRuntimeDependencies({
        rootDir: ROOT,
        html: read('main.html')
    });
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.equal(result.scripts.at(-1), 'app.js');
    assert.equal(result.errors.length, 0);
});
