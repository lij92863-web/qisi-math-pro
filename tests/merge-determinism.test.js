const test = require('node:test');
const assert = require('node:assert/strict');

const OutputPort = require('../qisi-production-import-output-port.js');
const Bridge = require('../qisi-production-import-bridge.js');
const StateMachine = require('../qisi-import-state-machine.js');
const RoutePolicy = require('../qisi-production-import-route-policy.js');

const helpers = {
    cleanText: value => String(value || '').trim(),
    normalizeQuestionKey: value => {
        const match = String(value || '').match(/\d{1,3}/);
        return match ? String(Number(match[0])) : '';
    },
    cleanOptions: options => {
        const list = Array.isArray(options) ? options : [];
        return [0, 1, 2, 3].map(index => String(list[index] || '').trim());
    },
    clock: () => 500
};

const provenance = (field, status, sourceId) => ({
    field, kind: status, status, sourceId, sourceFormat: 'docx',
    controlledWriteAccepted: status === 'controlled-write',
    controlledWriteDecisionId: status === 'controlled-write'
        ? `decision:${field}`
        : ''
});

test('merged field value and provenance always come from the same candidate', () => {
    const stem = '已知函数 $f(x)=x^2+1$，求它的最小值。';
    const complete = {
        id: 'complete', sourceFileId: 'source-1', questionNumber: '3', stem,
        options: ['A. 甲', 'B. 乙', 'C. 丙', 'D. 丁'],
        answer: 'C',
        solution: '因为 $x^2\\ge 0$，所以最小值为 1。',
        warnings: [],
        fieldProvenance: {
            stem: provenance('stem', 'controlled-write', 'source-complete'),
            options: provenance('options', 'controlled-write', 'source-complete'),
            answer: provenance('answer', 'controlled-write', 'source-complete'),
            solution: provenance('solution', 'controlled-write', 'source-complete')
        },
        pdfExternal: { optionLabels: ['甲', '乙', '丙', '丁'] },
        sourceTrace: { source: 'strict-visual' }
    };
    // 被拒候选文本更长：旧的 betterText 会选它，凭证却留在通过态。
    const rejected = {
        id: 'rejected', sourceFileId: 'source-1', questionNumber: '3', stem,
        options: ['A. 甲甲', 'B. 乙乙', 'C. 丙丙', 'D. 丁丁'],
        answer: 'C（理由：二次函数开口向上，顶点处取得最小值，代入即可）',
        solution: '因为 $x^2\\ge 0$，所以 $f(x)=x^2+1\\ge 1$，当且仅当 $x=0$ 时取等号，故最小值为 $1$，本题考查二次函数的最值与配方法。',
        warnings: [],
        fieldProvenance: {
            stem: provenance('stem', 'rejected', 'source-rejected'),
            options: provenance('options', 'rejected', 'source-rejected'),
            answer: provenance('answer', 'rejected', 'source-rejected'),
            solution: provenance('solution', 'rejected', 'source-rejected')
        },
        pdfExternal: { optionLabels: ['甲甲', '乙乙', '丙丙', '丁丁'] },
        sourceTrace: { source: 'strict-visual' }
    };

    const result = OutputPort.projectImportOutput(
        { drafts: [complete, rejected], draftImages: [] }, helpers);
    assert.equal(result.drafts.length, 1);
    const merged = result.drafts[0];

    for (const field of ['stem', 'options', 'answer', 'solution']) {
        assert.equal(
            merged.fieldProvenance[field].status, 'controlled-write',
            `${field} 的凭证必须与取值同源`
        );
        assert.equal(
            merged.fieldProvenance[field].sourceId, 'source-complete',
            `${field} 的凭证不能来自被拒候选`
        );
    }
    assert.equal(merged.answer, complete.answer);
    assert.equal(merged.solution, complete.solution);
    assert.deepEqual(merged.options, complete.options);
    assert.deepEqual(merged.pdfExternal.optionLabels, ['甲', '乙', '丙', '丁']);

    const mergedFrom = merged.sourceTrace.duplicateMergedFrom.at(-1);
    const traced = [complete, rejected].find(row => row.id === mergedFrom.id);
    assert.ok(traced, '合并来源必须指向实际候选');
    assert.equal(mergedFrom.answer, traced.answer);
    assert.equal(mergedFrom.solution, traced.solution);
    assert.deepEqual(mergedFrom.fieldProvenance, traced.fieldProvenance);
    assert.equal(mergedFrom.rejectedValues, undefined);
});

test('a batch that already has submitted drafts never re-enters recognition', async () => {
    let producerCalls = 0;
    let persisted = 0;
    const submittedDraft = {
        id: 'draft-7', batchId: 'batch-1', status: 'submitted',
        questionNumber: '7', stem: '已入库的题干文本', options: []
    };
    const ports = {
        createStateMachine: options => StateMachine.createImportStateMachine(options),
        loadBatchAndFiles: async () => ({
            batch: {
                id: 'batch-1', sourceVersion: 1, status: 'completed',
                producerMode: 'docx-deterministic', progress: 0,
                submittedCount: 3, draftPersistence: { version: 4 }
            },
            files: [{
                id: 'source-1', batchId: 'batch-1', fileType: 'docx',
                roles: ['full'], sourceOrder: 1
            }],
            questions: [
                submittedDraft,
                {
                    id: 'draft-8', batchId: 'batch-1', status: 'reviewed',
                    questionNumber: '8', stem: '尚未入库的题干文本', options: []
                }
            ],
            batchContext: {
                batchMetadata: { producerMode: 'docx-deterministic' },
                sourceManifest: [{
                    id: 'source-1', fileType: 'docx', roles: ['full'],
                    sourceOrder: 1
                }],
                userSettings: {}, engineConfig: {}
            }
        }),
        classifySourceRoles: async () => ({
            sources: [{
                id: 'source-1', fileType: 'docx', roles: ['full'],
                sourceOrder: 1, isQuestion: true, isSupplementalImage: false
            }]
        }),
        resolveProductionRoute: input =>
            RoutePolicy.resolveProductionImportRoute(input),
        runDocxImport: async () => {
            producerCalls += 1;
            return { drafts: [], draftImages: [] };
        },
        runPdfImport: async () => { throw new Error('unexpected-pdf'); },
        normalizeCandidates: async rows => rows,
        projectImportOutput: async input => ({
            drafts: input.drafts, draftImages: input.draftImages
        }),
        validateCandidates: async rows => rows,
        buildReviewDrafts: async () => [],
        persistReviewDraftBatch: async () => {
            persisted += 1;
            return { version: 5, idempotent: false };
        },
        reloadDraftBatch: async () => ({
            batch: { id: 'batch-1', status: 'completed' },
            files: [], questions: [submittedDraft], images: []
        }),
        createDiagnostics: () => ({
            start() {}, record() {}, fail() {}, snapshot: () => ({})
        }),
        reportProgress: async () => {},
        reportImportFailure: async () => {},
        clock: () => 100
    };

    await assert.rejects(
        Bridge.createProductionImportBridge(ports).run({
            mode: 'production', batchId: 'batch-1', requestId: 'request-2',
            expectedSourceVersion: 1
        }),
        error => {
            assert.equal(
                error.code, 'PRODUCTION_IMPORT_SUBMITTED_DRAFT_AT_RISK');
            assert.equal(error.submittedCount, 3);
            assert.deepEqual(error.draftIds, ['draft-7']);
            return true;
        }
    );
    assert.equal(producerCalls, 0, '闸门必须在视觉识别之前拦下重跑');
    assert.equal(persisted, 0);
});
