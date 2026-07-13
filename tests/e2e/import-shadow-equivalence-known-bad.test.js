const test = require('node:test');
const assert = require('node:assert/strict');
const Equivalence = require('../../qisi-import-equivalence-normalizer.js');

test('known-bad shadow contract keeps fabricated, raw, answer-only, and gap output empty', () => {
    const cases = [
        'fabricated-draft', 'raw-json', 'answer-only', 'gap-rewind'
    ];
    for (const caseId of cases) {
        const legacy = {
            batches: [{ id: `legacy-${caseId}`, status: 'failed', totalCount: 0 }],
            files: [{
                id: `legacy-file-${caseId}`, batchId: `legacy-${caseId}`,
                parseStatus: 'failed'
            }],
            drafts: [], warnings: [caseId]
        };
        const bridge = structuredClone(legacy);
        bridge.batches[0].id = `bridge-${caseId}`;
        bridge.files[0].id = `bridge-file-${caseId}`;
        bridge.files[0].batchId = `bridge-${caseId}`;
        assert.equal(Equivalence.compareImportSnapshots(legacy, bridge, {
            sourceKind: 'pdf'
        }).result, Equivalence.RESULTS.EXACT, caseId);
        assert.equal(bridge.drafts.length, 0, caseId);
    }
});
