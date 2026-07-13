const test = require('node:test');
const assert = require('node:assert/strict');
const Equivalence = require('../../qisi-import-equivalence-normalizer.js');

test('PDF shadow contract preserves safe-prefix and controlled-write evidence', () => {
    const caseId = 'pdf-safe-partial';
    assert.equal(`legacy-equivalence-${caseId}`, 'legacy-equivalence-pdf-safe-partial');
    assert.equal(`bridge-equivalence-${caseId}`, 'bridge-equivalence-pdf-safe-partial');
    const output = {
        batches: [{ id: 'batch-a', status: 'review', prefixTruncated: true }],
        files: [{ id: 'file-a', batchId: 'batch-a', parseStatus: 'safe-partial' }],
        drafts: [{
            id: 'draft-a', batchId: 'batch-a', order: 1, questionNumber: '1',
            stem: 'PDF safe stem', options: ['A', 'B'], answer: '', solution: 'Safe',
            images: [], warnings: ['missing-answer'], supportLevel: 'prefix',
            fieldProvenance: {
                answer: { status: 'rejected', reasonCode: 'ownership-gap' },
                solution: { status: 'controlled-write', controlledWriteAccepted: true }
            }
        }]
    };
    const bridge = structuredClone(output);
    bridge.batches[0].id = 'batch-b';
    bridge.files[0].id = 'file-b';
    bridge.files[0].batchId = 'batch-b';
    bridge.drafts[0].id = 'draft-b';
    bridge.drafts[0].batchId = 'batch-b';
    assert.equal(Equivalence.compareImportSnapshots(output, bridge, {
        sourceKind: 'pdf'
    }).result, Equivalence.RESULTS.EXACT);
});
