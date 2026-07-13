const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Port = require('../qisi-production-docx-vision-source-port.js');
const ROOT = path.resolve(__dirname, '..');

const questionSource = () => ({
    id: 'docx-question-1', sourceId: 'docx-question-1', fileType: 'docx',
    filename: 'question.docx', roles: ['question'], sourceOrder: 0
});
const candidate = () => ({
    id: 'draft-1', version: 1, questionNumber: '1', type: 'single-choice',
    stem: 'Stem', options: ['A1', 'B1', 'C1', 'D1'], answer: 'A',
    solution: 'Solution', images: [], producer: { engine: 'mock-engine' },
    sourceTrace: {
        strictProtocol: {
            accepted: true, decisionId: 'strict-docx:1',
            sourceId: 'docx-question-1',
            fields: ['questionNumber', 'stem', 'options', 'answer', 'solution', 'images'],
            engine: 'mock-engine'
        },
        blockIds: ['page:1:candidate:1']
    }
});
const ports = overrides => ({
    hasQuestionRole: source => source.roles.includes('question'),
    isFullRole: source => source.roles.includes('full'),
    hasAnswerRole: source => source.roles.includes('answer'),
    hasSolutionRole: source => source.roles.includes('solution'),
    normalizeQuestionNumber: value => String(value || '').trim(),
    processQuestionSource: async () => ({ questions: [candidate()], check: {} }),
    processSupportSource: async () => ({ answers: [], solutions: [] }),
    ...overrides
});

test('production runner owns DOCX vision route, decision, and provenance projection', async () => {
    const runner = Port.createProductionImportRunner(ports());
    const result = await runner({
        batch: { id: 'batch-1', expectedQuestionCount: 1 },
        sources: [questionSource()]
    });
    assert.equal(result.drafts.length, 1);
    assert.equal(result.drafts[0].source.format, 'docx');
    assert.equal(result.drafts[0].producer.routeId, 'docx-rendered-to-pdf-vision');
    assert.equal(result.drafts[0].fieldProvenance.stem.kind, 'controlled-write');
    assert.equal(result.drafts[0].controlledWrite.decisionId, 'strict-docx:1');
});

test('production runner fails closed when support ownership is not unique', async () => {
    const support = {
        id: 'docx-answer-1', sourceId: 'docx-answer-1', fileType: 'docx',
        filename: 'answer.docx', roles: ['answer'], sourceOrder: 1
    };
    const runner = Port.createProductionImportRunner(ports({
        processSupportSource: async () => ({
            answers: [{
                question: '2', answer: 'A',
                controlledWriteDecision: {
                    accepted: true, acceptedFields: ['answer'],
                    decisionId: 'support:2', sourceId: 'docx-answer-1',
                    engine: 'mock-support'
                }
            }],
            solutions: []
        })
    }));
    await assert.rejects(
        runner({
            batch: { id: 'batch-1', expectedQuestionCount: 1 },
            sources: [questionSource(), support]
        }),
        error => error.code === 'DOCX_SUPPORT_OWNERSHIP_INVALID'
    );
});

test('app only assembles the shared DOCX vision production runner', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    assert.match(
        app,
        /ProductionDocxVisionSourcePort\s*\.createProductionImportRunner\s*\(/
    );
    assert.doesNotMatch(app, /docxVisionDecisionFromCandidate/);
    assert.doesNotMatch(app, /\.applyDocxVisionSupportField\s*\(/);
});
