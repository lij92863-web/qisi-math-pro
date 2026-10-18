const test = require('node:test');
const assert = require('node:assert/strict');

const Review = require('../qisi-review-controller.js');
const Admission = require('../qisi-formal-admission-policy.js');
const Machine = require('../qisi-import-state-machine.js');

const FORMAL_FIELDS = Admission.FORMAL_FIELDS;

const controller = () => Review.createReviewController({
    formalFields: FORMAL_FIELDS,
    clock: () => 100
});

const canonical = field => ({
    kind: 'deterministic-source',
    status: 'deterministic-source',
    sourceId: 'source-1',
    sourceFormat: 'docx',
    producerMode: 'deterministic-docx',
    routeId: 'docx-deterministic',
    engine: 'docx-xml-importer',
    producerBoundary: 'docx-deterministic-source-to-candidate',
    manuallyEdited: false
});

// One draft per route family. PDF routes carry their own `states` mirror inside the
// `pdfExternal` / `pdfV1` container; DOCX routes carry no such container at all, so
// `fieldProvenance` is their only field-level state carrier.
const ROUTES = [
    {
        name: 'docx-deterministic',
        draft: () => ({
            version: 1, id: 'd1', batchId: 'b1', status: 'reviewed',
            manualConfirmed: true, confirmedAt: '2026-01-01T00:00:00.000Z',
            questionNumber: '1', type: '解答题',
            stem: 'original stem', options: [], answer: 'A',
            solution: 'original solution', images: [],
            source: { sourceId: 'source-1', format: 'docx' },
            producer: { mode: 'deterministic-docx', routeId: 'docx-deterministic' },
            fieldProvenance: Object.fromEntries(FORMAL_FIELDS.map(f => [f, canonical(f)]))
        })
    },
    {
        name: 'docx-vision',
        draft: () => ({
            version: 1, id: 'd2', batchId: 'b1', status: 'reviewed',
            manualConfirmed: true, confirmedAt: '2026-01-01T00:00:00.000Z',
            questionNumber: '2', type: '解答题',
            stem: 'original stem', options: [], answer: 'A',
            solution: 'original solution', images: [],
            source: { sourceId: 'source-2', format: 'docx' },
            producer: { mode: 'vision-ai', routeId: 'docx-vision' },
            fieldProvenance: Object.fromEntries(FORMAL_FIELDS.map(f => [f, canonical(f)]))
        })
    },
    {
        name: 'pdf-external-v2',
        draft: () => ({
            version: 1, id: 'd3', batchId: 'b1', status: 'reviewed',
            manualConfirmed: true, confirmedAt: '2026-01-01T00:00:00.000Z',
            questionNumber: '3', type: '解答题',
            stem: 'original stem', options: [], answer: 'A',
            solution: 'original solution', images: [],
            source: { sourceId: 'pdf-1', format: 'pdf' },
            producer: { mode: 'vision-ai', routeId: 'pdf-external-v2' },
            pdfExternal: { protocol: 'pdf-external-v2', states: { question: 'complete', answer: 'complete' } },
            fieldProvenance: Object.fromEntries(FORMAL_FIELDS.map(f => [f, canonical(f)]))
        })
    },
    {
        name: 'pdf-multimodal-v1',
        draft: () => ({
            version: 1, id: 'd4', batchId: 'b1', status: 'reviewed',
            manualConfirmed: true, confirmedAt: '2026-01-01T00:00:00.000Z',
            questionNumber: '4', type: '解答题',
            stem: 'original stem', options: [], answer: 'A',
            solution: 'original solution', images: [],
            source: { sourceId: 'pdf-1', format: 'pdf' },
            producer: { mode: 'vision-ai', routeId: 'pdf-multimodal-v1' },
            pdfV1: { protocol: 'pdf-multimodal-v1', states: { question: 'complete', answer: 'complete' } },
            fieldProvenance: Object.fromEntries(FORMAL_FIELDS.map(f => [f, canonical(f)]))
        })
    },
    {
        name: 'missing-route-id',
        draft: () => ({
            version: 1, id: 'd5', batchId: 'b1', status: 'reviewed',
            manualConfirmed: true, confirmedAt: '2026-01-01T00:00:00.000Z',
            questionNumber: '5', type: '解答题',
            stem: 'original stem', options: [], answer: 'A',
            solution: 'original solution', images: [],
            source: { sourceId: 'source-5' },
            fieldProvenance: Object.fromEntries(FORMAL_FIELDS.map(f => [f, canonical(f)]))
        })
    },
    {
        name: 'unknown-route-id',
        draft: () => ({
            version: 1, id: 'd6', batchId: 'b1', status: 'reviewed',
            manualConfirmed: true, confirmedAt: '2026-01-01T00:00:00.000Z',
            questionNumber: '6', type: '解答题',
            stem: 'original stem', options: [], answer: 'A',
            solution: 'original solution', images: [],
            source: { sourceId: 'source-6' },
            producer: { mode: 'unknown', routeId: 'some-future-route-v9' },
            fieldProvenance: Object.fromEntries(FORMAL_FIELDS.map(f => [f, canonical(f)]))
        })
    }
];

// Invariant: an explicit manual edit can never leave a draft in a state where it
// can still be formally submitted. Route identity is irrelevant — only `submitted`
// (immutable, terminal) is exempt.
test('manual edit withdraws confirmation on every route, not only the PDF ones', () => {
    for (const route of ROUTES) {
        const edited = controller().markFieldsManual(route.draft(), ['answer']);
        assert.equal(edited.status, 'pending', `${route.name}: status`);
        assert.equal(edited.manualConfirmed, false, `${route.name}: manualConfirmed`);
        assert.equal(edited.confirmedAt, null, `${route.name}: confirmedAt`);
    }
});

test('manual edit withdraws confirmation for every formal field on every route', () => {
    for (const route of ROUTES) {
        for (const field of FORMAL_FIELDS) {
            const edited = controller().editField(route.draft(), field, `edited-${field}`);
            assert.equal(edited.status, 'pending', `${route.name}/${field}: status`);
            assert.equal(edited.manualConfirmed, false, `${route.name}/${field}: manualConfirmed`);
            assert.equal(edited.confirmedAt, null, `${route.name}/${field}: confirmedAt`);
        }
    }
});

test('every edited field carries a manual credential on every route', () => {
    for (const route of ROUTES) {
        for (const field of FORMAL_FIELDS) {
            const edited = controller().markFieldsManual(route.draft(), [field]);
            const evidence = edited.fieldProvenance[field];
            assert.ok(evidence, `${route.name}/${field}: missing provenance`);
            assert.equal(evidence.kind, 'manual', `${route.name}/${field}: kind`);
            assert.equal(evidence.status, 'manual', `${route.name}/${field}: status`);
            assert.equal(evidence.manuallyEdited, true, `${route.name}/${field}: manuallyEdited`);
        }
    }
});

// DOCX routes have no `pdfExternal` / `pdfV1` container, so `fieldProvenance` is the
// only field-level state they carry. If it were skipped for DOCX, an edited DOCX draft
// would keep its pre-edit "deterministic-source" evidence and read as machine-verified.
test('DOCX routes have no states container; fieldProvenance is their only field-level state', () => {
    for (const route of ROUTES.filter(r => r.name.startsWith('docx'))) {
        const before = route.draft();
        assert.equal(before.pdfExternal, undefined, `${route.name}: pdfExternal`);
        assert.equal(before.pdfV1, undefined, `${route.name}: pdfV1`);

        const edited = controller().editField(before, 'answer', 'B');
        assert.equal(edited.fieldProvenance.answer.status, 'manual', `${route.name}: manual`);
        assert.equal(edited.fieldProvenance.answer.manualEditRevision, 1, `${route.name}: revision`);
        // Untouched fields keep their producer-time evidence.
        assert.equal(edited.fieldProvenance.stem.status, 'deterministic-source', `${route.name}: stem kept`);
    }
});

// The PDF `states` mirror is an extra, container-local bookkeeping copy. It must stay
// in sync where it exists, without becoming the only place manual state is recorded.
test('PDF states mirror follows the same rule where the container exists', () => {
    for (const route of ROUTES.filter(r => r.name.startsWith('pdf'))) {
        const edited = controller().markFieldsManual(route.draft(), ['answer']);
        const states = (edited.pdfExternal || edited.pdfV1).states;
        assert.equal(states.answer, 'manual', `${route.name}: answer mirror`);
        assert.equal(edited.fieldProvenance.answer.status, 'manual', `${route.name}: provenance`);
    }
});

test('image edits reset image review state on every route', () => {
    for (const route of ROUTES) {
        const withImage = route.draft();
        withImage.images = [{ id: 'img-1', position: 'option:A' }];
        withImage.imageReviewStatus = 'confirmed';
        const edited = controller().markFieldsManual(withImage, ['images']);
        assert.equal(edited.imageReviewStatus, 'need_confirm', `${route.name}: with image`);

        const emptied = route.draft();
        emptied.images = [];
        emptied.imageReviewStatus = 'confirmed';
        const cleared = controller().markFieldsManual(emptied, ['images']);
        assert.equal(cleared.imageReviewStatus, 'none', `${route.name}: no image`);
    }
});

test('submitted drafts are immutable on every route', () => {
    for (const route of ROUTES) {
        const submitted = route.draft();
        submitted.status = 'submitted';
        const edited = controller().markFieldsManual(submitted, ['answer']);
        assert.deepEqual(edited, submitted, `${route.name}: submitted must be unchanged`);
    }
});

test('a no-op edit does not withdraw confirmation', () => {
    for (const route of ROUTES) {
        const original = route.draft();
        const edited = controller().editField(original, 'answer', original.answer);
        assert.equal(edited.status, 'reviewed', `${route.name}: unchanged value`);
        assert.equal(edited.manualConfirmed, true, `${route.name}: manualConfirmed`);
    }
});

// The purpose of the reset: a withdrawn confirmation must actually block submission.
test('edited draft cannot reach formal submission without re-confirmation', async () => {
    const Submit = require('../qisi-batch-formal-submit.js');
    for (const route of ROUTES) {
        const edited = controller().editField(route.draft(), 'answer', 'B');
        let writes = 0;
        const service = Submit.createBatchFormalSubmit({
            policy: {
                createAdmissionContext: input => input,
                evaluateDraftAdmission: () => {
                    throw new Error('admission must not be evaluated');
                }
            },
            repository: {
                loadDraft: async () => edited,
                confirmDraftToQuestion: async () => {
                    writes += 1;
                    return { question: { id: 'formal-1' } };
                }
            },
            createStateMachine: options => Machine.createImportStateMachine(options)
        });

        await assert.rejects(
            () => service.submit({ draft: edited }),
            error => error.code === 'BATCH_FORMAL_SUBMIT_NOT_REVIEWED',
            `${route.name}: must be blocked`
        );
        assert.equal(writes, 0, `${route.name}: no formal write`);
    }
});
