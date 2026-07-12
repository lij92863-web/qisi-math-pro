const Storage = require('../../qisi-storage-repository.js');
const Policy = require('../../qisi-formal-admission-policy.js');
const Contracts = require('../../qisi-recognition-contracts.js');

const now = Date.parse('2026-07-13T02:00:00.000Z');

const makeDraft = (overrides = {}) => ({
    id: 'draft-1',
    batchId: 'batch-1',
    version: 1,
    status: 'reviewed',
    questionNumber: '1',
    type: '单选题',
    stem: 'Question stem',
    options: ['one', 'two', 'three', 'four'],
    answer: 'A',
    solution: 'Solution',
    images: [],
    source: { mode: 'pdf-ai', sourceId: 'source-1', batchId: 'batch-1' },
    fieldProvenance: Object.fromEntries(Policy.FORMAL_FIELDS.map(field => [
        field,
        field === 'images'
            ? { status: 'missing' }
            : {
                status: 'controlled-write',
                sourceId: 'source-1',
                controlledWriteAccepted: true,
                controlledWriteDecisionId: `cw-${field}`
            }
    ])),
    ...overrides
});

const makeContext = (idempotencyKey = 'confirm-1') =>
    Policy.createAdmissionContext({
        mode: 'pdf-ai',
        actorId: 'teacher-1',
        explicitConfirmation: true,
        requestId: 'request-1',
        idempotencyKey,
        evaluatedAt: new Date(now).toISOString(),
        source: { sourceId: 'source-1', batchId: 'batch-1' }
    });

const createRepository = database => Storage.createRepository(database, {
    clock: () => now,
    admission: {
        evaluateDraftAdmission: Policy.evaluateDraftAdmission,
        validateAdmissionDecision: Policy.validateAdmissionDecision,
        buildQuestionV2: Policy.buildQuestionV2,
        validateQuestionV2: Contracts.validateQuestionV2
    }
});

const options = (overrides = {}) => ({
    expectedDraftVersion: 1,
    idempotencyKey: 'confirm-1',
    actorId: 'teacher-1',
    requestId: 'request-1',
    questionId: 'question-1',
    context: makeContext(),
    ...overrides
});

module.exports = { now, makeDraft, makeContext, createRepository, options };
