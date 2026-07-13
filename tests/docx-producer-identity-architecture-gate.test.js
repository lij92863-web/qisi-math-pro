const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('DOCX source, producer, and route axes have one production contract owner', () => {
    const owner = read('qisi-docx-producer-identity-contract.js');
    const app = read('app.js');
    const bridge = read('qisi-production-import-bridge.js');
    const shadowPort = read('qisi-production-docx-vision-source-port.js');

    assert.match(owner, /projectDocxVisionCandidate/);
    assert.match(owner, /projectDeterministicDocxCandidate/);
    assert.match(owner, /docx-vision-engine-output-to-candidate/);
    assert.match(owner, /docx-deterministic-source-to-candidate/);
    assert.doesNotMatch(bridge, /fieldProvenance\s*[:=]\s*\{/);
    assert.doesNotMatch(shadowPort, /fieldProvenance\s*[:=]\s*\{|provenanceEntry/);

    const strictProjection = app.indexOf('.projectDocxVisionCandidate({');
    const mergeOwner = app.indexOf('const mergeDraftRecognition =');
    assert.ok(strictProjection > 0 && strictProjection < mergeOwner);
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

test('Bridge shadow delegates projection and has no independent vision algorithm', () => {
    const bridge = read('qisi-production-import-bridge.js');
    const port = read('qisi-production-docx-vision-source-port.js');
    assert.match(bridge, /ports\.runDocxVisionShadow/);
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
    assert.ok(shadowPort > 0 && shadowPort < bridge);
});

test('six frozen PDF high-risk owners are byte-unchanged from package baseline', () => {
    const files = [
        'qisi-pdf-support-controlled-write.js',
        'qisi-pdf-support-aligner.js',
        'qisi-pdf-support-block-parser.js',
        'qisi-pdf-answer-only-extraction.js',
        'qisi-pdf-answer-extraction-quality.js',
        'scripts/pdf-master-browser-runner.js'
    ];
    const output = execFileSync('git', [
        'diff', '--name-only',
        '9ab2f21282af4f5eb394658f31d5ba357cd46ca5', '--', ...files
    ], { cwd: ROOT, encoding: 'utf8' }).trim();
    assert.equal(output, '');
});

test('deterministic DOCX option labels cannot create a zero-length global match', () => {
    const importer = read('qisi-batch-importer.js');
    assert.match(
        importer,
        /\(\^\|\[\\n\\r\\s,;，；。\]\)\(\[A-D\]\)/
    );
    assert.doesNotMatch(importer, /const labelRe = \/\(\^\|\[[^\n]+\?\(\[A-D\]\)/);
});
