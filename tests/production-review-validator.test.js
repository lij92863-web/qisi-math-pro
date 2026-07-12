const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Policy = require('../qisi-formal-admission-policy.js');
const ReviewValidation = require('../qisi-production-review-validator.js');

const ROOT = path.resolve(__dirname, '..');
const fields = Policy.FORMAL_FIELDS;

const makeDraft = (overrides = {}) => ({
    id: 'draft-1',
    version: 1,
    status: 'pending',
    questionNumber: '1',
    type: '单选题',
    stem: 'Question stem',
    options: ['A1', 'B1', 'C1', 'D1'],
    answer: 'A',
    solution: 'Solution',
    images: [],
    source: {
        mode: 'docx-deterministic',
        sourceId: 'docx-1',
        batchId: 'batch-1'
    },
    fieldProvenance: Object.fromEntries(fields.map(field => [
        field,
        field === 'images'
            ? { status: 'missing' }
            : {
                status: 'deterministic-source',
                sourceId: 'docx-1',
                evidenceRef: `docx:${field}`
            }
    ])),
    ...overrides
});

const create = () => ReviewValidation.createProductionReviewValidator({
    policy: Policy,
    clock: () => Date.parse('2026-07-13T03:00:00.000Z')
});

const codes = result => result.errors.map(error => error.code);

test('production review validator composes schema, provenance, and policy', () => {
    const result = create().validate(makeDraft());
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.equal(result.admissionDecision.accepted, true);
    assert.equal(result.admissionDecision.mode, 'docx-deterministic');
});

test('missing draft schema and provenance fail closed', () => {
    const draft = makeDraft();
    delete draft.version;
    delete draft.fieldProvenance.answer;
    const result = create().validate(draft);
    assert.equal(result.valid, false);
    assert.ok(codes(result).includes('review-draft-schema-invalid'));
    assert.ok(codes(result).includes('admission-provenance-missing'));
});

test('fake global manual flags cannot wash rejected controlled-write', () => {
    const draft = makeDraft({
        source: { mode: 'pdf-ai', sourceId: 'pdf-1', batchId: 'batch-1' },
        userEdited: true,
        manualEdited: true,
        manualConfirmed: true
    });
    draft.fieldProvenance = Object.fromEntries(fields.map(field => [
        field,
        field === 'images'
            ? { status: 'missing' }
            : {
                status: 'controlled-write',
                sourceId: 'pdf-1',
                controlledWriteAccepted: true,
                controlledWriteDecisionId: `cw-${field}`
            }
    ]));
    draft.fieldProvenance.answer = {
        status: 'rejected', reasonCode: 'ownership-invalid'
    };
    const result = create().validate(draft);
    assert.equal(result.valid, false);
    assert.ok(codes(result).includes('admission-field-rejected'));
});

test('an actual field-level manual revision passes PDF precheck', () => {
    const draft = makeDraft({
        source: { mode: 'pdf-ai', sourceId: 'pdf-1', batchId: 'batch-1' }
    });
    draft.fieldProvenance = Object.fromEntries(fields.map(field => [
        field,
        field === 'images'
            ? { status: 'missing' }
            : {
                status: 'controlled-write',
                sourceId: 'pdf-1',
                controlledWriteAccepted: true,
                controlledWriteDecisionId: `cw-${field}`
            }
    ]));
    draft.fieldProvenance.answer = {
        status: 'manual', sourceId: 'pdf-1', manualEditRevision: 1
    };
    const result = create().validate(draft);
    assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test('base content errors compose with admission errors without mutation', () => {
    const draft = makeDraft();
    const before = structuredClone(draft);
    const result = create().validate(draft, {
        baseErrors: [{ code: 'review-content-invalid', message: 'bad content' }]
    });
    assert.equal(result.valid, false);
    assert.ok(codes(result).includes('review-content-invalid'));
    assert.deepEqual(draft, before);
});

test('app production validator delegates to the real owner', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    assert.match(app, /ProductionReviewValidator\.createProductionReviewValidator/);
    assert.match(app, /productionReviewValidator\.validate\s*\(/);
    assert.doesNotMatch(
        app,
        /controlledWriteAccepted\s*:\s*true[\s\S]{0,200}validateDraftForReview/
    );
});
