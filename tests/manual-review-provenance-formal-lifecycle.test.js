const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Review = require('../qisi-review-controller.js');
const Submit = require('../qisi-batch-formal-submit.js');
const Machine = require('../qisi-import-state-machine.js');

const ROOT = path.resolve(__dirname, '..');
const FORMAL_FIELDS = [
    'questionNumber', 'stem', 'options', 'answer', 'solution', 'images'
];

const controlled = field => ({
    kind: 'controlled-write',
    status: 'controlled-write',
    sourceId: 'pdf-1',
    controlledWriteAccepted: true,
    controlledWriteDecisionId: `cw:pdf-1:${field}`
});

const draft = () => ({
    id: 'draft-1', batchId: 'batch-1', version: 1,
    status: 'pending', questionNumber: '1', type: '解答题',
    stem: 'original stem', options: [], answer: 'A',
    solution: 'original solution', images: [],
    source: { sourceId: 'pdf-1', mode: 'pdf-ai' },
    fieldProvenance: Object.fromEntries(
        FORMAL_FIELDS.map(field => [field, controlled(field)])
    ),
    userEdited: false,
    manualEdited: false
});

test('single-field edit marks only that field manual and preserves all untouched evidence', () => {
    const controller = Review.createReviewController({
        formalFields: FORMAL_FIELDS,
        clock: () => 100
    });
    const original = draft();
    const edited = controller.editField(original, 'answer', 'B');

    assert.equal(edited.answer, 'B');
    assert.equal(edited.fieldProvenance.answer.status, 'manual');
    assert.equal(edited.fieldProvenance.answer.manualEditRevision, 1);
    assert.equal(edited.fieldProvenance.answer.sourceId, 'pdf-1');
    for (const field of FORMAL_FIELDS.filter(field => field !== 'answer')) {
        assert.deepEqual(
            edited.fieldProvenance[field],
            original.fieldProvenance[field],
            `${field} provenance changed without an edit`
        );
    }
    assert.equal(original.answer, 'A');
    assert.equal(original.fieldProvenance.answer.status, 'controlled-write');
});

test('multi-field and v-model edit commands increment only explicit manual fields', () => {
    const controller = Review.createReviewController({
        formalFields: FORMAL_FIELDS,
        clock: () => 200
    });
    const source = draft();
    const multi = controller.editFields(source, {
        stem: 'edited stem',
        options: ['one'],
        answer: source.answer
    });
    assert.equal(multi.fieldProvenance.stem.status, 'manual');
    assert.equal(multi.fieldProvenance.options.status, 'manual');
    assert.deepEqual(
        multi.fieldProvenance.answer,
        source.fieldProvenance.answer
    );

    const vModel = controller.markFieldsManual({
        ...multi,
        solution: 'teacher solution'
    }, ['solution']);
    assert.equal(vModel.fieldProvenance.solution.status, 'manual');
    assert.equal(vModel.fieldProvenance.solution.manualEditRevision, 1);
    assert.equal(vModel.fieldProvenance.stem.manualEditRevision, 1);
});

test('question numbering and image edits carry field-specific review evidence', () => {
    const controller = Review.createReviewController({
        formalFields: FORMAL_FIELDS,
        clock: () => 300
    });
    const renumbered = controller.editField(draft(), 'questionNumber', '2');
    assert.equal(renumbered.fieldProvenance.questionNumber.status, 'manual');
    assert.equal(renumbered.fieldProvenance.stem.status, 'controlled-write');

    const imageEdited = controller.editFields(renumbered, {
        stem: 'stem with image token',
        images: [{ id: 'manual-image-1' }]
    });
    assert.equal(imageEdited.fieldProvenance.stem.status, 'manual');
    assert.equal(imageEdited.fieldProvenance.images.status, 'manual');
    assert.equal(imageEdited.fieldProvenance.answer.status, 'controlled-write');
});

test('confirmation changes review status without inventing a manual edit', () => {
    const controller = Review.createReviewController({
        formalFields: FORMAL_FIELDS,
        validateDraft: () => ({ valid: true, errors: [], warnings: [] }),
        clock: () => 1000
    });
    const original = draft();
    const result = controller.confirm(original);

    assert.equal(result.accepted, true);
    assert.equal(result.draft.status, 'reviewed');
    assert.equal(result.draft.manualConfirmed, true);
    assert.equal(result.draft.userEdited, false);
    assert.equal(result.draft.manualEdited, false);
    assert.deepEqual(result.draft.fieldProvenance, original.fieldProvenance);
    assert.equal(
        controller.provenanceDisplay(result.draft)
            .some(item => item.manualEdit),
        false
    );
});

test('formal cancellation after policy evaluation stops before repository commit', async () => {
    const abortController = new AbortController();
    let writes = 0;
    let machine;
    const service = Submit.createBatchFormalSubmit({
        policy: {
            FORMAL_FIELDS,
            createAdmissionContext: input => input,
            evaluateDraftAdmission: () => {
                abortController.abort();
                return { accepted: true, errors: [] };
            }
        },
        repository: {
            loadDraft: async () => ({ ...draft(), status: 'reviewed' }),
            confirmDraftToQuestion: async () => {
                writes += 1;
                return { question: { id: 'formal-1' } };
            }
        },
        createStateMachine: options => {
            machine = Machine.createImportStateMachine(options);
            return machine;
        }
    });

    await assert.rejects(
        service.submit({ draft: draft(), signal: abortController.signal }),
        error => error.code === 'FORMAL_SUBMIT_CANCELLED' &&
            error.name === 'AbortError'
    );
    assert.equal(writes, 0);
    assert.equal(machine.snapshot().state, 'CANCELLED');
});

test('shell has no manual provenance constructor or direct formal table mutation', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const formal = fs.readFileSync(
        path.join(ROOT, 'qisi-batch-formal-submit.js'), 'utf8'
    );

    assert.doesNotMatch(app, /\.fieldProvenance\s*=/);
    assert.doesNotMatch(app, /buildManualFieldProvenance/);
    assert.match(app, /reviewController\.(?:editField|editFields|markFieldsManual)/);
    assert.doesNotMatch(formal, /buildManualFieldProvenance|nextDraftVersion/);
    assert.doesNotMatch(app, /db\.questions\.(?:put|add|bulkPut|bulkAdd)\s*\(/);
    assert.match(formal, /policy\.evaluateDraftAdmission\s*\(/);
    assert.match(formal, /repository\.confirmDraftToQuestion\s*\(/);
});
