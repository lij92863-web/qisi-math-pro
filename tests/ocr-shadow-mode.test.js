const test = require('node:test');
const assert = require('node:assert/strict');
const Shadow = require('../qisi-ocr-shadow-mode.js');

const candidate = (engine, blocks) => ({
    engine, engineVersion: 'mock', requestId: `${engine}-1`, sourceId: 's1',
    page: 1, rawText: 'private source text', rawEvidence: { private: true },
    blocks: Array.from({ length: blocks }, () => ({})), formulas: [], images: [],
    warnings: [], durationMs: 1
});

test('shadow comparison is structured, isolated, and omits raw content', () => {
    const report = Shadow.compareCandidates(candidate('prod', 1), candidate('shadow', 2));
    assert.equal(report.differences.blocks, 1);
    assert.equal(report.manualReviewRequired, true);
    assert.equal(report.eligibleForReview, false);
    assert.equal(report.eligibleForControlledWrite, false);
    assert.equal(report.autoSelectWinner, false);
    assert.equal(report.fieldMergeAllowed, false);
    assert.equal(JSON.stringify(report).includes('private source text'), false);
    assert.equal(JSON.stringify(report).includes('rawEvidence'), false);
});

test('runShadow preserves the production candidate and retains separate evidence', async () => {
    const production = candidate('prod', 1);
    const before = structuredClone(production);
    const shadow = candidate('shadow', 1);
    const result = await Shadow.runShadow({
        productionCandidate: production,
        shadowEngine: { recognizePage: async () => shadow },
        input: { bytes: 1 }
    });
    assert.deepEqual(production, before);
    assert.equal(result.productionCandidate, production);
    assert.equal(result.shadowCandidate, shadow);
    assert.notEqual(result.productionCandidate, result.shadowCandidate);
    assert.equal(result.productionCandidateUnchanged, true);
});

test('measured shadow comparison emits sanitized metrics and numeric deltas only', async () => {
    const logs = [];
    const production = candidate('prod', 1);
    const shadow = candidate('shadow', 3);
    const result = await Shadow.runMeasuredShadow({
        productionCandidate: production,
        shadowEngine: { recognizePage: async () => shadow },
        input: { bytes: 1, rawText: 'PRIVATE_INPUT' },
        measureCandidate: value => ({
            blockCount: value.blocks.length,
            formulaTokenF1: value.engine === 'prod' ? 0.5 : 0.75,
            fatalSafetyErrors: 0,
            rawText: value.rawText,
            privateEvidence: value.rawEvidence
        }),
        logger: event => logs.push(event)
    });
    assert.equal(result.productionCandidate, production);
    assert.equal(result.shadowCandidate, shadow);
    assert.equal(result.report.shadowStatus, 'measured');
    assert.equal(result.report.metrics.production.blockCount, 1);
    assert.equal(result.report.metrics.shadow.blockCount, 3);
    assert.equal(result.report.metrics.delta.blockCount, 2);
    assert.equal(result.report.metrics.delta.formulaTokenF1, 0.25);
    assert.equal(result.report.autoSelectWinner, false);
    assert.equal(result.report.fieldMergeAllowed, false);
    assert.equal(result.report.answerSupplementAllowed, false);
    assert.equal(result.report.eligibleForControlledWrite, false);
    assert.equal(JSON.stringify(result.report).includes('private source text'), false);
    assert.equal(JSON.stringify(result.report).includes('rawText'), false);
    assert.equal(JSON.stringify(result.report).includes('privateEvidence'), false);
    assert.equal(JSON.stringify(logs).includes('PRIVATE_INPUT'), false);
    assert.equal(JSON.stringify(logs).includes('private source text'), false);
});

test('shadow engine failure falls back to untouched production candidate with stable code', async () => {
    const production = candidate('prod', 1);
    const before = structuredClone(production);
    const result = await Shadow.runMeasuredShadow({
        productionCandidate: production,
        shadowEngine: {
            recognizePage: async () => {
                throw Object.assign(new Error('PRIVATE_SHADOW_FAILURE'), {
                    code: 'ocr-engine-unavailable'
                });
            }
        },
        input: { bytes: 1 }
    });
    assert.deepEqual(production, before);
    assert.equal(result.productionCandidate, production);
    assert.equal(result.shadowCandidate, null);
    assert.equal(result.report.shadowStatus, 'failed');
    assert.equal(result.report.failureCode, 'ocr-engine-unavailable');
    assert.equal(result.report.fallbackToProduction, true);
    assert.equal(result.report.productionCandidateUnchanged, true);
    assert.equal(JSON.stringify(result.report).includes('PRIVATE_SHADOW_FAILURE'), false);
});

test('measured shadow passes benchmark-only flags and never exposes formal-write authority', async () => {
    let receivedOptions;
    const result = await Shadow.runMeasuredShadow({
        productionCandidate: candidate('prod', 1),
        shadowEngine: {
            recognizePage: async (_input, options) => {
                receivedOptions = options;
                return candidate('shadow', 1);
            }
        },
        input: { bytes: 1 },
        options: { requestId: 'shadow-request-1' }
    });
    assert.equal(receivedOptions.shadowMode, true);
    assert.equal(receivedOptions.benchmarkOnly, true);
    assert.equal(result.report.eligibleForReview, false);
    assert.equal(result.report.eligibleForControlledWrite, false);
    assert.equal(result.report.eligibleForFormalAdmission, false);
    assert.equal(result.report.defaultUiResult, false);
});
