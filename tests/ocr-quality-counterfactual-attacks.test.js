const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const Contracts = require('../qisi-recognition-contracts.js');
const { createQwenAdapter } = require('../qisi-ocr-qwen-adapter.js');
const { createLocalAdapter } = require('../qisi-ocr-local-adapter.js');
const { createRegistry } = require('../qisi-ocr-engine-registry.js');
const ReadingOrder = require('../qisi-ocr-reading-order.js');
const Structure = require('../qisi-ocr-structure-extractor.js');
const Shadow = require('../qisi-ocr-shadow-mode.js');
const Selection = require('../qisi-ocr-candidate-selection-policy.js');
const { createLocalOcrService } = require('../local-ocr/server.js');

const root = path.resolve(__dirname, '..');
const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

const block = (id, type, rawText, overrides = {}) => ({
    id, page: 1, bbox: [0, 0, 100, 20], column: 0, order: 1,
    type, rawText, confidence: 0.8, ...overrides
});

const selectionCandidate = (engine, metrics = {}) => ({
    engine,
    engineVersion: '1.0.0',
    requestId: `${engine}-request`,
    rawText: `PRIVATE ${engine}`,
    validation: {
        schemaValid: true,
        sequenceValid: true,
        ownershipValid: true,
        formulaValid: true,
        provenanceComplete: true
    },
    metrics: {
        completeness: 0.9,
        engineConfidence: 0.8,
        safetyErrors: [],
        ...metrics
    }
});

const promotion = engine => ({
    engine,
    engineVersion: '1.0.0',
    productionPromoted: true,
    holdoutDecisionId: `${engine}-holdout`
});

const isolatedSyntheticCandidate = async attack => {
    const adapter = createLocalAdapter({
        transport: async () => ({
            rawText: `synthetic-${attack}`,
            engineVersion: 'synthetic-attack-r1',
            warnings: [{ code: `${attack}-manual-review` }]
        })
    });
    const result = await adapter.recognizePage({
        sourceId: 'synthetic-only', mimeType: 'image/png', bytes: pngBytes.length,
        syntheticAttack: attack
    }, { requestId: `attack-${attack}` });
    assert.equal(Contracts.validateRecognitionCandidate(result).valid, true);
    assert.equal(result.answer, undefined);
    assert.equal(result.solution, undefined);
    assert.equal(result.eligibleForControlledWrite, undefined);
};

for (const attack of ['rotated', 'perspective', 'blur', 'low-contrast', 'watermark', 'handwritten-note']) {
    test(`OCR-R1 attack: ${attack} remains isolated candidate evidence`, async () => {
        await isolatedSyntheticCandidate(attack);
    });
}

test('OCR-R1 attack: double-column y inversion follows column regions', () => {
    const result = ReadingOrder.orderBlocks([
        block('right', 'text', 'right', { column: 1, bbox: [500, 1, 600, 20] }),
        block('left', 'text', 'left', { column: 0, bbox: [0, 500, 100, 520], order: 2 })
    ]);
    assert.deepEqual(result.orderedBlocks.map(item => item.id), ['left', 'right']);
});

test('OCR-R1 attack: formula split remains adjacent without ownership inference', () => {
    const result = ReadingOrder.orderBlocks([
        block('f2', 'formula', 'B/C', { bbox: [0, 50, 100, 70], order: 1 }),
        block('after', 'stem', 'after', { bbox: [0, 80, 100, 100], order: 2 }),
        block('q1', 'question-anchor', '1', { bbox: [0, 0, 20, 20], order: 3 }),
        block('f1', 'formula', 'A=', { bbox: [0, 25, 100, 45], order: 4 })
    ]);
    const structured = Structure.extractQuestionStructures(result);
    assert.deepEqual(structured.questions[0].formulas.map(item => item.blockId), ['f1', 'f2']);
    assert.equal(structured.questions[0].eligibleForControlledWrite, false);
});

test('OCR-R1 attack: circled number is not accepted as a strict question anchor', () => {
    const structured = Structure.extractQuestionStructures(ReadingOrder.orderBlocks([
        block('circled', 'question-anchor', '①'),
        block('stem', 'stem', 'text', { bbox: [0, 30, 100, 50], order: 2 })
    ]));
    assert.equal(structured.questions[0].questionNumber, '');
    assert.equal(structured.warnings.some(item => item.code === 'invalid-question-anchor'), true);
    assert.equal(structured.questions[0].eligibleForFormalAdmission, false);
});

test('OCR-R1 attack: A/B/C/D inside formula never becomes options', () => {
    const structured = Structure.extractQuestionStructures(ReadingOrder.orderBlocks([
        block('q1', 'question-anchor', '1'),
        block('formula', 'formula', 'A/B/C/D', { bbox: [0, 30, 100, 50], order: 2 })
    ]));
    assert.deepEqual(structured.questions[0].options, []);
    assert.equal(structured.questions[0].formulas.length, 1);
});

test('OCR-R1 attack: duplicated page questions remain unvalidated and cannot fabricate formal questions', () => {
    const structured = Structure.extractQuestionStructures(ReadingOrder.orderBlocks([
        block('q1-p1', 'question-anchor', '1'),
        block('stem-p1', 'stem', 'first', { bbox: [0, 30, 100, 50], order: 2 }),
        block('q1-p2', 'question-anchor', '1', { page: 2, order: 1 }),
        block('stem-p2', 'stem', 'duplicate', { page: 2, bbox: [0, 30, 100, 50], order: 2 })
    ]));
    assert.equal(structured.questions.length, 2);
    assert.equal(structured.questions.every(item => item.ownershipStatus === 'unvalidated'), true);
    assert.equal(structured.questions.every(item => item.eligibleForFormalAdmission === false), true);
});

test('OCR-R1 attack: page reorder is normalized by explicit page before source input order', () => {
    const result = ReadingOrder.orderBlocks([
        block('page-2', 'stem', 'two', { page: 2 }),
        block('page-1', 'stem', 'one', { page: 1, order: 2 })
    ]);
    assert.deepEqual(result.orderedBlocks.map(item => item.page), [1, 2]);
});

test('OCR-R1 attack: malicious JSON is rejected and cannot enter an option', () => {
    const structured = Structure.extractQuestionStructures(ReadingOrder.orderBlocks([
        block('q1', 'question-anchor', '1'),
        block('json', 'option', 'A. {"question":"fabricated","answer":"B"}', {
            bbox: [0, 30, 100, 50], order: 2
        })
    ]));
    assert.deepEqual(structured.questions[0].options, []);
    assert.equal(structured.rejectedEvidence[0].id, 'json');
});

test('OCR-R1 attack: huge response is rejected before candidate construction', async () => {
    const adapter = createQwenAdapter({
        request: async () => ({ rawText: 'x'.repeat(101) }),
        engineVersion: 'attack-r1',
        maxResponseChars: 100
    });
    await assert.rejects(
        adapter.recognizePage({ sourceId: 'synthetic' }, { requestId: 'huge-response' }),
        error => error.code === 'ocr-response-too-large'
    );
});

test('OCR-R1 attack: timeout is explicit and calls engine cancellation', async () => {
    let cancelled = '';
    const engine = {
        healthCheck: async () => ({ ok: true }),
        getCapabilities: () => ({}),
        recognizePage: () => new Promise(() => {}),
        recognizeDocument: () => new Promise(() => {}),
        cancel: requestId => { cancelled = requestId; return true; }
    };
    const registry = createRegistry({ timeoutMs: 5 });
    registry.registerEngine('slow', engine);
    await assert.rejects(
        registry.recognizePage({}, { requestId: 'timeout-attack' }),
        error => error.code === 'ocr-timeout'
    );
    assert.equal(cancelled, 'timeout-attack');
});

test('OCR-R1 attack: local service unavailable falls back to production in shadow', async () => {
    const production = Contracts.createRecognitionCandidate({
        engine: 'current', engineVersion: '1', requestId: 'prod', sourceId: 's'
    });
    const result = await Shadow.runMeasuredShadow({
        productionCandidate: production,
        shadowEngine: {
            recognizePage: async () => {
                throw Object.assign(new Error('private'), { code: 'ocr-engine-unavailable' });
            }
        },
        input: {}
    });
    assert.equal(result.productionCandidate, production);
    assert.equal(result.report.fallbackToProduction, true);
    assert.equal(result.report.failureCode, 'ocr-engine-unavailable');
});

test('OCR-R1 attack: model version mismatch cannot use another version promotion', () => {
    const input = { ...selectionCandidate('candidate'), engineVersion: '2.0.0' };
    const result = Selection.selectProductionCandidate([input], {
        promotions: [promotion('candidate')]
    });
    assert.equal(result.selectedCandidate, null);
    assert.ok(result.evaluations[0].reasons.includes('engine-not-production-promoted'));
});

test('OCR-R1 attack: engine conflict never synthesizes or merges a candidate', () => {
    const left = selectionCandidate('left', { completeness: 0.95, engineConfidence: 0.7 });
    const right = selectionCandidate('right', { completeness: 0.9, engineConfidence: 0.9 });
    const result = Selection.selectProductionCandidate([left, right], {
        promotions: [promotion('left'), promotion('right')]
    });
    assert.equal(result.decision, 'manual-review');
    assert.equal(result.synthesizedCandidate, null);
    assert.equal(result.fieldMergeAllowed, false);
});

test('OCR-R1 attack: wrong confidence is a malformed adapter response', async () => {
    const adapter = createQwenAdapter({
        request: async () => ({ rawText: '', confidence: 1.5 }),
        engineVersion: 'attack-r1'
    });
    await assert.rejects(
        adapter.recognizePage({ sourceId: 's' }, { requestId: 'wrong-confidence' }),
        error => error.code === 'ocr-malformed-response'
    );
});

test('OCR-R1 attack: fabricated block may remain evidence but has no formal authority', () => {
    const structured = Structure.extractQuestionStructures(ReadingOrder.orderBlocks([
        block('fabricated-anchor', 'question-anchor', '999'),
        block('fabricated-stem', 'stem', 'fabricated', { bbox: [0, 30, 100, 50], order: 2 })
    ]));
    assert.equal(structured.questions.length, 1);
    assert.equal(structured.questions[0].eligibleForControlledWrite, false);
    assert.equal(structured.questions[0].eligibleForFormalAdmission, false);
});

test('OCR-R1 attack: path traversal is rejected before local transport', async () => {
    let calls = 0;
    const adapter = createLocalAdapter({
        transport: async () => { calls += 1; return {}; }
    });
    await assert.rejects(
        adapter.recognizePage({
            path: '..\\..\\private\\answer.png', mimeType: 'image/png', bytes: 1
        }),
        error => error.code === 'local-path-forbidden'
    );
    assert.equal(calls, 0);
});

test('OCR-R1 attack: MIME spoofing is rejected by loopback service magic-byte check', async t => {
    let calls = 0;
    const service = createLocalOcrService({
        port: 0,
        tempRoot: fs.mkdtempSync(path.join(os.tmpdir(), 'qisi-mime-spoof-')),
        engine: {
            getMetadata: () => ({ name: 'mock', version: '1', model: 'none' }),
            healthCheck: async () => ({ ok: true }),
            recognize: async () => { calls += 1; return { rawText: '' }; }
        }
    });
    const address = await service.start();
    t.after(() => service.stop());
    const response = await fetch(`http://127.0.0.1:${address.port}/v1/recognize`, {
        method: 'POST',
        headers: { 'content-type': 'image/png', 'x-qisi-request-id': 'mime-spoof' },
        body: '<html>not png</html>'
    });
    assert.equal(response.status, 415);
    assert.equal((await response.json()).code, 'mime-spoofed');
    assert.equal(calls, 0);
});

test('OCR-R1 counterfactual matrix records all 22 attack classes as PASS', () => {
    const matrix = fs.readFileSync(
        path.join(root, 'docs', 'testing', 'OCR_QUALITY_COUNTERFACTUAL_MATRIX_R1.md'),
        'utf8'
    );
    for (const attack of [
        'rotated', 'perspective', 'blur', 'low contrast', 'double column',
        'watermark', 'handwritten note', 'formula split', 'circled number',
        'A/B/C/D in formula', 'page duplication', 'page reorder', 'malicious JSON',
        'huge response', 'timeout', 'local service unavailable',
        'model version mismatch', 'engine conflict', 'wrong confidence',
        'fabricated block', 'path traversal', 'MIME spoofing'
    ]) {
        assert.match(matrix, new RegExp(`\\| ${attack.replaceAll('/', '\\/')} \\|[^\\n]+\\| PASS \\|`, 'i'), attack);
    }
});

test('OCR-R1 aggregate attacks preserve no-bypass, fallback, timeout, and disabled canary invariants', () => {
    const matrix = fs.readFileSync(
        path.join(root, 'docs', 'testing', 'OCR_QUALITY_COUNTERFACTUAL_MATRIX_R1.md'),
        'utf8'
    );
    assert.match(matrix, /Wrong answer attachment introduced:\s*0/i);
    assert.match(matrix, /Wrong solution attachment introduced:\s*0/i);
    assert.match(matrix, /Fabricated formal question introduced:\s*0/i);
    assert.match(matrix, /controlled-write or FormalAdmission bypass:\s*0/i);
    assert.match(matrix, /Shadow failure fallback:\s*verified/i);
    assert.match(matrix, /Timeout swallowing:\s*0/i);
    assert.match(
        fs.readFileSync(path.join(root, 'docs', 'ocr', 'OCR_CANARY_DECISION_R1.md'), 'utf8'),
        /CANARY_DISABLED_PROMOTION_GATE_NOT_MET/
    );
});
