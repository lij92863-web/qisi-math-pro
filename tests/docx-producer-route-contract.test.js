const test = require('node:test');
const assert = require('node:assert/strict');

const Contract = require('../qisi-docx-producer-identity-contract.js');
const VisionPort = require('../qisi-production-docx-vision-source-port.js');
const Bridge = require('../qisi-production-import-bridge.js');

const source = {
    id: 'docx-1', sourceId: 'docx-1', fileType: 'docx',
    filename: 'questions.docx', sourceOrder: 1
};
const producerResult = () => ({
    engine: 'mock-browser-engine',
    candidates: [{
        id: 'draft-1', version: 1, questionNumber: '1', type: 'solution',
        stem: 'route contract stem', options: [], answer: '', solution: '', images: []
    }],
    controlledWriteDecisions: [{
        accepted: true, decisionId: 'strict-docx:1', sourceId: 'docx-1',
        fields: ['questionNumber', 'stem', 'options'], method: 'strict-json-contract'
    }]
});

test('DOCX vision route records every required transition in stable order', () => {
    const draft = Contract.projectDocxVisionCandidate({
        candidate: producerResult().candidates[0],
        source: { sourceId: 'docx-1', format: 'docx' },
        engine: 'mock-browser-engine',
        controlledWriteDecision: producerResult().controlledWriteDecisions[0]
    });
    assert.deepEqual(
        draft.route.transitions.map(item => item.code),
        Contract.DOCX_VISION_TRANSITIONS.map(item => item.code)
    );
    assert.ok(draft.route.transitions.every(item => item.reason));
});

test('route transition gap fails identity validation', () => {
    const draft = Contract.projectDocxVisionCandidate({
        candidate: producerResult().candidates[0],
        source: { sourceId: 'docx-1', format: 'docx' },
        engine: 'mock-browser-engine',
        controlledWriteDecision: producerResult().controlledWriteDecisions[0]
    });
    const malformed = structuredClone(draft);
    malformed.route.transitions.splice(2, 1);
    assert.equal(Contract.validateCanonicalIdentity(malformed).valid, false);
});

test('production DOCX vision source port is shadow-only and performs no writes', async () => {
    const result = await VisionPort.runDocxVisionShadow({
        source, shadow: true
    }, { runVisionProducer: async () => producerResult() });
    assert.equal(result.shadow, true);
    assert.equal(result.formalWrites, 0);
    assert.equal(result.reviewDraftWrites, 0);
    assert.equal(result.realApiCalled, false);
    assert.equal(result.drafts[0].producer.mode, 'vision-ai');
});

test('production DOCX vision source port rejects non-shadow execution', async () => {
    await assert.rejects(
        VisionPort.runDocxVisionShadow({ source }, {
            runVisionProducer: async () => producerResult()
        }),
        error => error.code === 'DOCX_VISION_SHADOW_REQUIRED'
    );
});

test('production DOCX vision source port discards a cancelled result', async () => {
    const controller = new AbortController();
    await assert.rejects(
        VisionPort.runDocxVisionShadow({
            source, shadow: true, signal: controller.signal
        }, {
            runVisionProducer: async () => {
                controller.abort();
                return producerResult();
            }
        }),
        error => error.code === 'DOCX_VISION_SHADOW_CANCELLED'
    );
});

test('Bridge DOCX vision shadow delegates to the isolated production port', async () => {
    const required = Object.fromEntries(Bridge.REQUIRED_PORTS.map(name => [
        name, async () => { throw new Error(`unused:${name}`); }
    ]));
    const bridge = Bridge.createProductionImportBridge({
        ...required,
        runDocxVisionShadow: input => VisionPort.runDocxVisionShadow(input, {
            runVisionProducer: async () => producerResult()
        })
    });
    const result = await bridge.runDocxVisionShadow({ source });
    assert.equal(result.drafts.length, 1);
    assert.equal(result.formalWrites, 0);
    assert.equal(result.reviewDraftWrites, 0);
});

test('Bridge rejects a shadow adapter that reports a formal write', async () => {
    const required = Object.fromEntries(Bridge.REQUIRED_PORTS.map(name => [
        name, async () => { throw new Error(`unused:${name}`); }
    ]));
    const bridge = Bridge.createProductionImportBridge({
        ...required,
        runDocxVisionShadow: async () => ({
            shadow: true, drafts: [{}], formalWrites: 1,
            reviewDraftWrites: 0, realApiCalled: false
        })
    });
    await assert.rejects(
        bridge.runDocxVisionShadow({ source }),
        error => error.code === 'PRODUCTION_IMPORT_RESULT_MALFORMED'
    );
});
