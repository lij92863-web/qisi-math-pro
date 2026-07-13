const test = require('node:test');
const assert = require('node:assert/strict');
const Equivalence = require('../../qisi-import-equivalence-normalizer.js');

test('DOCX shadow contract uses isolated DB identities and requires EXACT', () => {
    const caseId = 'docx-complete';
    const plan = {
        legacyDatabase: `legacy-equivalence-${caseId}`,
        bridgeDatabase: `bridge-equivalence-${caseId}`,
        seedTables: ['draftImportBatches', 'draftImportFiles'],
        seedReviewDraft: false,
        injectedImportTransport: false
    };
    assert.notEqual(plan.legacyDatabase, plan.bridgeDatabase);
    assert.deepEqual(plan.seedTables, ['draftImportBatches', 'draftImportFiles']);
    assert.equal(plan.seedReviewDraft, false);
    assert.equal(plan.injectedImportTransport, false);

    const base = {
        batches: [{ id: 'legacy-batch', status: 'review', totalCount: 1 }],
        files: [{ id: 'legacy-file', batchId: 'legacy-batch', parseStatus: 'success' }],
        drafts: [{
            id: 'legacy-draft', batchId: 'legacy-batch', order: 1,
            questionNumber: '1', stem: 'DOCX stem', options: ['A', 'B'],
            answer: 'A', solution: 'DOCX solution', images: [], warnings: []
        }]
    };
    const bridge = structuredClone(base);
    bridge.batches[0].id = 'bridge-batch';
    bridge.files[0].id = 'bridge-file';
    bridge.files[0].batchId = 'bridge-batch';
    bridge.drafts[0].id = 'bridge-draft';
    bridge.drafts[0].batchId = 'bridge-batch';
    assert.equal(Equivalence.compareImportSnapshots(base, bridge, {
        sourceKind: 'docx'
    }).result, Equivalence.RESULTS.EXACT);
});
