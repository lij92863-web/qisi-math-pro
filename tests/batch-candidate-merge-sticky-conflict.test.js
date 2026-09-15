const test = require('node:test');
const assert = require('node:assert/strict');

const merge = require('../qisi-batch-candidate-merge.js');
const admission = require('../qisi-formal-admission-policy.js');

// The helpers mirror the ones app.js injects, so the test exercises the same contract.
const cleanText = value => String(value ?? '').trim();
const badCharCount = value => (String(value || '').match(/[�锟斤拷]/g) || []).length;
const latexSignalCount = value => (String(value || '').match(/\\[a-zA-Z]+|\$/g) || []).length;
const optionCount = options => (Array.isArray(options) ? options : [])
    .filter(option => cleanText(option)).length;
const qualityScore = item => (
    optionCount(item?.options) * 60
    + cleanText(item?.stem).length
    - badCharCount(item?.stem) * 80
);
const mergeImages = (...lists) => {
    const seen = new Map();
    for (const list of lists) {
        for (const image of Array.isArray(list) ? list : []) {
            const id = String(image?.id || '');
            if (id && !seen.has(id)) seen.set(id, image);
        }
    }
    return [...seen.values()];
};
const allText = item => [item?.stem, (item?.options || []).join('\n'), item?.answer, item?.solution]
    .map(cleanText).join('\n');
const betterText = (current, candidate) => (
    cleanText(candidate).length > cleanText(current).length ? candidate : current
);

const merger = merge.createBatchCandidateMerge({
    text: cleanText,
    badCharCount,
    latexSignalCount,
    optionCount,
    qualityScore,
    mergeImages,
    allText,
    betterText
});

const candidate = (overrides = {}) => ({
    id: 'draft-1',
    questionNumber: '3',
    sourceTrace: { source: 'visual:strict', pageText: 'page text' },
    stem: '已知向量 $\\vec{a}$，求实数 $m$ 的值（    ）',
    options: ['$\\frac12$', '$1$', '$-\\frac12$', '$-1$'],
    answer: 'B',
    solution: '由向量共线可得 $m=1$。',
    images: [],
    warnings: [],
    ...overrides
});

// The final gate folds candidates into a running "best" item, so a third candidate is merged into
// the *result* of the first merge. That result already has an empty answer, which is exactly how
// the conflict used to be dissolved again.
const foldAll = (...candidates) => {
    const [first, ...rest] = candidates;
    return rest.reduce((best, other) => merger.mergeCandidate(best, other), first);
};

const draftForAdmission = merged => ({
    ...merged,
    id: 'draft-best',
    version: 2,
    type: '单选题',
    source: { mode: 'docx-deterministic', sourceId: 'file-best' },
    fieldProvenance: {
        ...merged.fieldProvenance,
        questionNumber: { field: 'questionNumber', status: 'deterministic-source', sourceId: 'file-best', evidenceRef: 'docx:q' },
        stem: { field: 'stem', status: 'deterministic-source', sourceId: 'file-best', evidenceRef: 'docx:stem' },
        options: { field: 'options', status: 'deterministic-source', sourceId: 'file-best', evidenceRef: 'docx:options' },
        solution: { field: 'solution', status: 'deterministic-source', sourceId: 'file-best', evidenceRef: 'docx:solution' },
        images: { field: 'images', status: 'missing' }
    }
});

const admit = (draft, requestId) => admission.evaluateDraftAdmission(draft, {
    mode: 'docx-deterministic',
    actorId: 'local-teacher',
    explicitConfirmation: true,
    requestId,
    idempotencyKey: requestId,
    source: draft.source
});

test('a conflict survives a third candidate instead of being filled back in', () => {
    const b = candidate({ id: 'draft-b', answer: 'B' });
    const c = candidate({ id: 'draft-c', answer: 'C' });
    const d = candidate({ id: 'draft-d', answer: 'D' });

    const twoWay = merger.mergeCandidate(b, c);
    assert.equal(twoWay.answer, '', 'B against C must not pick one');
    assert.equal(twoWay.fieldProvenance.answer.status, 'rejected');

    const threeWay = foldAll(b, c, d);

    // The defect this guards: with an empty best answer, D used to be accepted and the conflict
    // silently disappeared.
    assert.equal(threeWay.answer, '', 'D must not fill an answer that is empty only because of a conflict');
    assert.equal(
        threeWay.fieldProvenance.answer.status,
        'rejected',
        'the conflicted answer must not regain an accepted provenance'
    );
    assert.equal(threeWay.fieldProvenance.answer.reasonCode, 'candidate-conflict');
    assert.equal(threeWay.duplicateStatus, 'answerConflict', 'the review page must keep showing the conflict');
    assert.deepEqual(
        (threeWay.fieldConflicts?.answer?.candidates || []).map(item => item.value),
        ['B', 'C', 'D'],
        'every disagreeing value must stay auditable'
    );
    assert.deepEqual(
        (threeWay.fieldConflicts?.answer?.candidates || []).map(item => item.id),
        ['draft-b', 'draft-c', 'draft-d']
    );
    assert.ok(
        threeWay.warnings.some(warning => /答案冲突/.test(warning)),
        'the teacher must still be told about the conflict'
    );
});

test('three candidates whose answers all disagree cannot reach formal admission', () => {
    const merged = foldAll(
        candidate({ id: 'draft-b', answer: 'B' }),
        candidate({ id: 'draft-c', answer: 'C' }),
        candidate({ id: 'draft-d', answer: 'D' })
    );

    const decision = admit(draftForAdmission(merged), 'sticky-conflict-1');

    assert.equal(decision.accepted, false, 'a sticky conflict must block formal admission');
    assert.ok(
        decision.errors.some(error =>
            error.code === 'admission-field-rejected' && error.field === 'answer'
        ),
        `expected admission-field-rejected for answer: ${JSON.stringify(decision.errors)}`
    );
});

test('only a teacher edit releases the conflict, and the value then reaches formal data', () => {
    const merged = foldAll(
        candidate({ id: 'draft-b', answer: 'B' }),
        candidate({ id: 'draft-c', answer: 'C' }),
        candidate({ id: 'draft-d', answer: 'D' })
    );
    const conflicted = draftForAdmission(merged);

    // A manual resolution: the teacher typed C, which records manual provenance and drops the
    // conflict record for that field.
    const resolved = {
        ...conflicted,
        answer: 'C',
        fieldConflicts: {},
        duplicateStatus: 'none',
        fieldProvenance: {
            ...conflicted.fieldProvenance,
            answer: { field: 'answer', status: 'manual', manualEditRevision: 1, sourceId: 'file-best' }
        }
    };

    const decision = admit(resolved, 'sticky-conflict-2');
    assert.equal(
        decision.accepted,
        true,
        `a teacher resolution must unblock admission: ${JSON.stringify(decision.errors)}`
    );
});

test('a merge after the teacher resolved the field does not resurrect the conflict by itself', () => {
    const resolved = candidate({
        id: 'draft-resolved',
        answer: 'C',
        fieldConflicts: {},
        fieldProvenance: {
            answer: { field: 'answer', status: 'manual', manualEditRevision: 1, sourceId: 'file-best' }
        }
    });
    const agreeing = candidate({ id: 'draft-agreeing', answer: 'C' });

    const merged = merger.mergeCandidate(resolved, agreeing);
    assert.equal(merged.answer, 'C');
    assert.equal(merged.fieldConflicts, undefined, 'an agreed value must not keep a conflict record');
    assert.equal(merged.fieldProvenance.answer.status, 'manual');

    // A brand new disagreement is still a conflict, so the release is not a blanket bypass.
    const disagreeing = merger.mergeCandidate(resolved, candidate({ id: 'draft-disagreeing', answer: 'D' }));
    assert.equal(disagreeing.answer, '', 'a new disagreement must conflict again');
    assert.equal(disagreeing.fieldProvenance.answer.status, 'rejected');
});

test('a sticky solution conflict behaves the same way', () => {
    const merged = foldAll(
        candidate({ id: 'draft-1', solution: '解析一。' }),
        candidate({ id: 'draft-2', solution: '解析二，明显不同。' }),
        candidate({ id: 'draft-3', solution: '解析三，又不同。' })
    );

    assert.equal(merged.solution, '', 'a third solution must not dissolve the conflict');
    assert.equal(merged.fieldProvenance.solution.status, 'rejected');
    assert.equal(merged.duplicateStatus, 'answerConflict');
    assert.deepEqual(
        (merged.fieldConflicts?.solution?.candidates || []).map(item => item.value),
        ['解析一。', '解析二，明显不同。', '解析三，又不同。']
    );
});

test('the shared resolver is sticky as well, so the fallback merge cannot dissolve a conflict', () => {
    const conflicted = {
        id: 'draft-conflicted',
        answer: '',
        fieldConflicts: {
            answer: {
                field: 'answer',
                reasonCode: 'candidate-conflict',
                candidates: [{ field: 'answer', id: 'a', value: 'B' }, { field: 'answer', id: 'b', value: 'C' }]
            }
        },
        fieldProvenance: {
            answer: { field: 'answer', status: 'rejected', reasonCode: 'candidate-conflict' }
        }
    };
    const fallback = { id: 'draft-fallback', answer: 'D' };

    const resolved = merger.resolveExclusiveField('answer', conflicted, fallback);

    assert.equal(resolved.value, '', 'the fallback merge must not fill a conflicted field');
    assert.equal(resolved.sticky, true);
    assert.equal(resolved.provenance.status, 'rejected');
    assert.deepEqual(
        resolved.conflict.candidates.map(item => item.value),
        ['B', 'C', 'D']
    );

    // A gap that was never conflicted is still filled, so stickiness is not a blanket refusal.
    const gap = merger.resolveExclusiveField('answer', { id: 'clean', answer: '' }, fallback);
    assert.equal(gap.value, 'D');
    assert.equal(gap.conflict, null);
});

test('a plain candidate still merges normally, so stickiness only applies to real conflicts', () => {
    const merged = foldAll(
        candidate({ id: 'draft-1', answer: 'B' }),
        candidate({ id: 'draft-2', answer: 'B' }),
        candidate({ id: 'draft-3', answer: '' })
    );

    assert.equal(merged.answer, 'B');
    assert.equal(merged.fieldConflicts, undefined);
    assert.notEqual(merged.duplicateStatus, 'answerConflict');
});
