const test = require('node:test');
const assert = require('node:assert/strict');

const Equivalence = require('../qisi-import-equivalence-normalizer.js');

const snapshot = (prefix, overrides = {}) => ({
    batches: [{
        id: `${prefix}-batch`, status: 'review', progress: 100,
        totalCount: 1, createdAt: 1, updatedAt: 2
    }],
    files: [{
        id: `${prefix}-file`, batchId: `${prefix}-batch`, order: 1,
        role: 'question', parseStatus: 'success', updatedAt: 3
    }],
    drafts: [{
        id: `${prefix}-draft`, batchId: `${prefix}-batch`, order: 1,
        questionNumber: '1', stem: 'Deterministic stem',
        options: ['A1', 'B1'], answer: 'A', solution: 'Because.', images: [],
        warnings: [], source: { sourceId: `${prefix}-file`, fileIds: [`${prefix}-file`] },
        fieldProvenance: {
            answer: { status: 'controlled-write', reasonCode: '' },
            solution: { status: 'controlled-write', reasonCode: '' }
        },
        createdAt: 4, updatedAt: 5
    }],
    progressEvents: [{ requestId: `${prefix}-request`, time: 6, progress: 100 }],
    ...overrides
});

test('canonical form ignores only volatile time, request, and isolated DB ids', () => {
    const legacy = snapshot('legacy');
    const bridge = snapshot('bridge');
    bridge.batches[0].createdAt = 999;
    bridge.progressEvents[0].time = 1000;
    assert.deepEqual(
        Equivalence.canonicalizeImportSnapshot(legacy),
        Equivalence.canonicalizeImportSnapshot(bridge)
    );
});

test('a business time field is preserved outside progress events', () => {
    const legacy = snapshot('legacy');
    const bridge = snapshot('bridge');
    legacy.drafts[0].time = '09:00';
    bridge.drafts[0].time = '10:00';
    assert.equal(Equivalence.compareImportSnapshots(legacy, bridge, {
        sourceKind: 'pdf'
    }).result, Equivalence.RESULTS.NOT_EQUIVALENT);
});

test('canonical form preserves every protected import decision', () => {
    const protectedMutations = [
        ['questionNumber', '2'], ['stem', 'Changed'], ['options', ['A1']],
        ['answer', 'B'], ['solution', 'Changed'], ['images', [{ id: 'image-1' }]],
        ['warnings', ['unsafe']], ['order', 2]
    ];
    for (const [field, value] of protectedMutations) {
        const legacy = snapshot('legacy');
        const bridge = snapshot('bridge');
        bridge.drafts[0][field] = value;
        assert.equal(
            Equivalence.compareImportSnapshots(legacy, bridge, { sourceKind: 'pdf' }).result,
            Equivalence.RESULTS.NOT_EQUIVALENT,
            field
        );
    }
    const legacy = snapshot('legacy');
    const bridge = snapshot('bridge');
    bridge.files[0].parseStatus = 'failed';
    assert.equal(
        Equivalence.compareImportSnapshots(legacy, bridge, { sourceKind: 'pdf' }).result,
        Equivalence.RESULTS.NOT_EQUIVALENT
    );
});

test('EXACT requires all canonical fields to match', () => {
    const result = Equivalence.compareImportSnapshots(
        snapshot('legacy'), snapshot('bridge'), { sourceKind: 'docx' }
    );
    assert.equal(result.result, Equivalence.RESULTS.EXACT);
    assert.deepEqual(result.differences, []);
});

test('DOCX content changes can never be classified as SAFE_REFINEMENT', () => {
    const legacy = snapshot('legacy');
    const bridge = snapshot('bridge');
    bridge.drafts[0].answer = '';
    bridge.drafts[0].fieldProvenance.answer = {
        status: 'rejected', reasonCode: 'unsafe-answer'
    };
    const result = Equivalence.compareImportSnapshots(legacy, bridge, {
        sourceKind: 'docx',
        safetyEvidence: [{
            kind: 'conservative-rejection', code: 'unsafe-answer',
            paths: ['drafts[0].answer', 'drafts[0].fieldProvenance.answer'],
            approval: { status: 'approved', reviewer: 'independent-review' }
        }]
    });
    assert.equal(result.result, Equivalence.RESULTS.NOT_EQUIVALENT);
});

test('PDF conservative field rejection requires explicit approved safety evidence', () => {
    const legacy = snapshot('legacy');
    const bridge = snapshot('bridge');
    bridge.drafts[0].answer = '';
    bridge.drafts[0].warnings = ['unsafe-answer-rejected'];
    bridge.drafts[0].fieldProvenance.answer = {
        status: 'rejected', reasonCode: 'unsafe-answer'
    };
    const withoutApproval = Equivalence.compareImportSnapshots(
        legacy, bridge, { sourceKind: 'pdf' }
    );
    assert.equal(withoutApproval.result, Equivalence.RESULTS.NOT_EQUIVALENT);
    const approved = Equivalence.compareImportSnapshots(legacy, bridge, {
        sourceKind: 'pdf',
        safetyEvidence: [{
            kind: 'conservative-rejection', code: 'unsafe-answer',
            paths: [
                'drafts[0].answer', 'drafts[0].warnings',
                'drafts[0].fieldProvenance.answer'
            ],
            approval: { status: 'approved', reviewer: 'independent-review' }
        }]
    });
    assert.equal(approved.result, Equivalence.RESULTS.SAFE_REFINEMENT);
});

test('SAFE_REFINEMENT cannot cover content broadening or fabricated drafts', () => {
    const legacy = snapshot('legacy');
    const broadened = snapshot('bridge');
    broadened.drafts[0].answer = 'A or B';
    const evidence = [{
        kind: 'conservative-rejection', code: 'claimed-safe',
        paths: ['drafts[0].answer'],
        approval: { status: 'approved', reviewer: 'independent-review' }
    }];
    assert.equal(Equivalence.compareImportSnapshots(legacy, broadened, {
        sourceKind: 'pdf', safetyEvidence: evidence
    }).result, Equivalence.RESULTS.NOT_EQUIVALENT);

    const fabricated = snapshot('bridge');
    fabricated.drafts.push({ ...fabricated.drafts[0], id: 'bridge-draft-2', order: 2 });
    assert.equal(Equivalence.compareImportSnapshots(legacy, fabricated, {
        sourceKind: 'pdf', safetyEvidence: evidence
    }).result, Equivalence.RESULTS.NOT_EQUIVALENT);
});

test('source and draft array order remain canonical business evidence', () => {
    const legacy = snapshot('legacy');
    const bridge = snapshot('bridge');
    legacy.files.push({
        id: 'legacy-file-2', batchId: 'legacy-batch', order: 2,
        role: 'solution', parseStatus: 'success'
    });
    bridge.files.unshift({
        id: 'bridge-file-2', batchId: 'bridge-batch', order: 2,
        role: 'solution', parseStatus: 'success'
    });
    assert.equal(Equivalence.compareImportSnapshots(legacy, bridge, {
        sourceKind: 'pdf'
    }).result, Equivalence.RESULTS.NOT_EQUIVALENT);
});

test('canonical snapshots and comparison results are recursively frozen', () => {
    const canonical = Equivalence.canonicalizeImportSnapshot(snapshot('legacy'));
    const compared = Equivalence.compareImportSnapshots(
        snapshot('legacy'), snapshot('bridge'), { sourceKind: 'docx' }
    );
    assert.equal(Object.isFrozen(canonical), true);
    assert.equal(Object.isFrozen(canonical.drafts[0]), true);
    assert.equal(Object.isFrozen(compared), true);
    assert.equal(Object.isFrozen(compared.differences), true);
});
