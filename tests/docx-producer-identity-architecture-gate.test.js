const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { verifyFrozenPdfFiles } = require('../scripts/verify-frozen-pdf-files.js');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('DOCX source, producer, and route axes have one production contract owner', () => {
    const owner = read('qisi-docx-producer-identity-contract.js');
    const app = read('app.js');
    const bridge = read('qisi-production-import-bridge.js');
    const shadowPort = read('qisi-production-docx-vision-source-port.js');
    const qwenSourcePort = read('qisi-qwen-vision-source-port.js');

    assert.match(owner, /projectDocxVisionCandidate/);
    assert.match(owner, /projectDeterministicDocxCandidate/);
    assert.match(owner, /docx-vision-engine-output-to-candidate/);
    assert.match(owner, /docx-deterministic-source-to-candidate/);
    assert.doesNotMatch(bridge, /fieldProvenance\s*[:=]\s*\{/);
    assert.doesNotMatch(shadowPort, /fieldProvenance\s*[:=]\s*\{|provenanceEntry/);

    assert.doesNotMatch(app, /\.projectDocxVisionCandidate\s*\(\{/);
    assert.match(
        qwenSourcePort,
        /ports\.projectDocxVisionCandidate\s*\(\{/
    );
    assert.match(
        read('qisi-production-docx-source-port.js'),
        /contract\.projectDeterministicDocxCandidate\s*\(\{/
    );
});

test('review and persistence preserve producer evidence without constructing it', () => {
    for (const file of [
        'qisi-review-draft-builder.js',
        'qisi-draft-persistence-service.js',
        'qisi-production-review-validator.js'
    ]) {
        const source = read(file);
        assert.doesNotMatch(source, /producerBoundary\s*:/);
        assert.doesNotMatch(source, /controlledWriteAccepted\s*:\s*true/);
        assert.doesNotMatch(
            source,
            /^\s*(?:fieldProvenance\s*:|draft\.fieldProvenance\s*=)\s*\{/m
        );
    }
});

test('canonical contract rejects mixed source/producer axes and unsafe bypass markers', () => {
    const owner = read('qisi-docx-producer-identity-contract.js');
    assert.match(owner, /DOCX_SOURCE_MODE_AXIS_MIXED/);
    assert.match(owner, /docx-vision-source-contaminated/);
    assert.match(owner, /field-not-authorized-by-controlled-write/);
    assert.match(owner, /canonicalReviewHandoff:\s*rejectedFields\.length === 0/);
    assert.doesNotMatch(
        owner,
        /manualReviewRequired[^\n]{0,160}(?:controlledWriteAccepted|canonicalReviewHandoff)\s*:\s*true/
    );
});

test('Bridge retired shadow has no executable delegation or independent vision algorithm', () => {
    const bridge = read('qisi-production-import-bridge.js');
    const port = read('qisi-production-docx-vision-source-port.js');
    assert.doesNotMatch(bridge, /ports\.runDocxVision(?:Shadow|Import)/);
    assert.match(bridge, /PRODUCTION_IMPORT_PRODUCER_RETIRED/);
    assert.match(port, /contract\.projectDocxVisionCandidate/);
    assert.doesNotMatch(port, /strictProtocol|parseStrict|postprocessRecognized|OCR|fetch\s*\(/i);
    assert.doesNotMatch(bridge, /strictProtocol|parseStrict|postprocessRecognized|OCR/i);
});

test('browser dependency order loads identity contract before schema and admission', () => {
    const html = read('main.html');
    const contract = html.indexOf('qisi-docx-producer-identity-contract.js');
    const schema = html.indexOf('qisi-recognition-contracts.js');
    const admission = html.indexOf('qisi-formal-admission-policy.js');
    const shadowPort = html.indexOf('qisi-production-docx-vision-source-port.js');
    const bridge = html.indexOf('qisi-production-import-bridge.js');
    assert.ok(contract > 0 && contract < schema && schema < admission);
    assert.equal(shadowPort, -1);
    assert.ok(bridge > 0 && contract < bridge);
});

test('six frozen PDF high-risk owners match baseline or exact user-approved repairs', () => {
    const files = [
        'qisi-pdf-support-controlled-write.js',
        'qisi-pdf-support-aligner.js',
        'qisi-pdf-support-block-parser.js',
        'qisi-pdf-answer-only-extraction.js',
        'qisi-pdf-answer-extraction-quality.js',
        'scripts/pdf-master-browser-runner.js'
    ];
    // User approved exact N1/N2/D-1 repairs on 2026-10-01; all other files retain this baseline.
    assert.deepEqual(verifyFrozenPdfFiles(files,
        '9ab2f21282af4f5eb394658f31d5ba357cd46ca5'), []);
});

test('deterministic DOCX option labels are owned by the shared option-label implementation', () => {
    const importer = read('qisi-batch-importer.js');
    // 不变量：DOCX 导入路径不再自带选项标签正则，标签口径只有qisi-utils.js 一处。
    assert.doesNotMatch(importer, /\(\[A-D\]\)\s*\[\.．、]/);
    assert.match(importer, /resolveUtils\(\)\.findOptionLabels/);
    assert.equal(
        (importer.match(/findOptionLabels\(/g) || []).length,
        3,
        'DOCX 导入的每一处标签识别都必须走共享实现'
    );
});
