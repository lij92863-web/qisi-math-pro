const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const retired = [
    'qisi-production-pdf-sources-port.js', 'qisi-pdf-import-coordinator.js',
    'qisi-pdf-candidate-projection.js', 'qisi-pdf-ocr-support-parser.js',
    'qisi-pdf-question-boundary.js', 'qisi-pdf-support-block-parser.js'
];

test('PDF V2 has one active producer and retired entry files cannot be loaded', () => {
    const main = read('main.html');
    const layers = JSON.parse(read('architecture/layers.json')).modules;
    const runtime = JSON.parse(read('architecture/runtime-modules.json')).modules;
    for (const file of retired) {
        assert.equal(fs.existsSync(path.join(ROOT, file)), false, file);
        assert.equal(main.includes(file), false, file);
        assert.equal(layers.some(m => m.file === file), false, file);
        assert.equal(runtime.some(m => m.file === file), false, file);
    }
    assert.equal(main.includes('./qisi-pdf-multimodal-producer.js'), false);
    assert.equal(main.split('./qisi-pdf-external-producer.js').length - 1, 1);
    assert.equal(main.includes('qisi-pdf-support-controlled-write.js'), false);
    assert.equal(layers.find(m => m.id === 'pdf-multimodal-producer').status, 'deprecated');
    assert.equal(layers.find(m => m.id === 'pdf-external-producer').status, 'production-wired');
    assert.ok(main.indexOf('qisi-pdf-external-contract.js') < main.indexOf('qisi-pdf-external-producer.js'));
});

test('V2 Bridge and app have no legacy projection or implicit fallback', () => {
    const app = read('app.js'), bridge = read('qisi-production-import-bridge.js');
    assert.doesNotMatch(app + bridge, /PdfCandidateProjection|ports\.projectPdfCandidates/);
    assert.match(app, /PdfExternalProducer\.createProducer/);
    assert.doesNotMatch(app, /PdfMultimodalProducer\.createProducer/);
    assert.match(bridge, /pdf-v1-protocol-required/);
    assert.match(bridge, /PdfExternalContract[\s\S]*?validateCanonical/);
    assert.doesNotMatch(bridge, /fallbackToLegacy|runLegacyImport|buildPdfSupportFieldLevelControlledWrite/);
});

test('shared DOCX engine exports only its two active visual factories', () => {
    const source = read('qisi-batch-engine-v2.js');
    const sandbox = { window: {} };
    vm.runInNewContext(source, sandbox);
    assert.deepEqual(Object.keys(sandbox.window.QisiBatchEngineV2), [
        'createStrictVisualPreparedPagesRecognizer', 'createStrictVisualQuestionProducer'
    ]);
    assert.equal(Object.hasOwn(sandbox.window, '__qisiBatchV2SelfTest'), false);
    assert.doesNotMatch(source, /processBatchV2|splitQuestionBlocksV2|parseOptionsV2|chooseEvidenceSourceTextV2|buildAutoFigureDraftImagesV2/);
    assert.match(read('app.js'), /QisiBatchEngineV2\.createStrictVisualQuestionProducer/);
});
