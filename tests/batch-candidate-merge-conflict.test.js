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

test('two disagreeing non-empty answers become a conflict instead of an automatic pick', () => {
    const best = candidate({ id: 'draft-best', answer: 'B', fieldProvenance: {
        answer: { field: 'answer', status: 'deterministic-source', sourceId: 'file-best', evidenceRef: 'docx:answer' }
    } });
    const other = candidate({
        id: 'draft-other',
        answer: 'C',
        stem: '已知向量 $\\vec{a}$，求实数 $m$ 的值（    ）',
        fieldProvenance: {
            answer: { field: 'answer', status: 'deterministic-source', sourceId: 'file-other', evidenceRef: 'docx:answer' }
        }
    });

    const merged = merger.mergeCandidate(best, other);

    // The old behaviour kept one of the two answers (B by length/quality). The new behaviour refuses.
    assert.equal(merged.answer, '', 'a conflicting answer must not be picked automatically');
    assert.equal(merged.duplicateStatus, 'answerConflict', 'the conflict must be visible in review');
    assert.ok(merged.fieldConflicts?.answer, 'the conflict must be recorded');
    assert.equal(merged.fieldConflicts.answer.reasonCode, 'candidate-conflict');
    assert.deepEqual(
        merged.fieldConflicts.answer.candidates.map(item => item.value),
        ['B', 'C'],
        'both candidate values must be preserved'
    );
    assert.deepEqual(
        merged.fieldConflicts.answer.candidates.map(item => item.id),
        ['draft-best', 'draft-other'],
        'both candidate identities must be preserved'
    );
    assert.equal(merged.fieldProvenance.answer.status, 'rejected', 'the conflicted field cannot be admitted');
    assert.equal(merged.fieldProvenance.answer.reasonCode, 'candidate-conflict');
    assert.equal(merged.provenance.answer.status, 'rejected');
    assert.ok(
        merged.warnings.some(warning => /答案冲突/.test(warning)),
        'the teacher must be told which values disagreed'
    );
});

test('the shared resolver used by the primary/fallback merge applies the same rule', () => {
    const primary = { id: 'primary', answer: 'B', solution: 'primary solution' };
    const fallback = { id: 'fallback', answer: 'C', solution: 'fallback solution' };

    const answer = merger.resolveExclusiveField('answer', primary, fallback);
    assert.equal(answer.value, '', 'the primary/fallback merge must not pick one of two answers');
    assert.equal(answer.provenance.status, 'rejected');
    assert.equal(answer.conflict.reasonCode, 'candidate-conflict');

    const solution = merger.resolveExclusiveField('solution', primary, fallback);
    assert.equal(solution.value, '', 'the primary/fallback merge must not pick the longer solution');
    assert.equal(solution.provenance.status, 'rejected');

    // And the same call still fills a gap when only one side has a value.
    const filled = merger.resolveExclusiveField('answer', { id: 'primary', answer: '' }, fallback);
    assert.equal(filled.value, 'C');
    assert.equal(filled.conflict, null);
});

test('two disagreeing non-empty solutions become a conflict instead of the longer one winning', () => {
    const best = candidate({ id: 'draft-best', solution: '由共线得 $m=1$。' });
    const other = candidate({ id: 'draft-other', solution: '由共线得 $m=-1$，故选择不同。' });

    const merged = merger.mergeCandidate(best, other);

    assert.equal(merged.solution, '', 'a conflicting solution must not be picked automatically');
    assert.ok(merged.fieldConflicts?.solution, 'the solution conflict must be recorded');
    assert.deepEqual(
        merged.fieldConflicts.solution.candidates.map(item => item.value),
        ['由共线得 $m=1$。', '由共线得 $m=-1$，故选择不同。']
    );
    assert.equal(merged.fieldProvenance.solution.status, 'rejected');
    assert.equal(merged.duplicateStatus, 'answerConflict');
});

test('the same answer written differently is not a conflict', () => {
    const best = candidate({ id: 'draft-best', answer: 'B' });
    const other = candidate({ id: 'draft-other', answer: ' B ' });

    const merged = merger.mergeCandidate(best, other);

    assert.equal(cleanText(merged.answer), 'B', 'an equal answer must survive the merge');
    assert.equal(merged.fieldConflicts, undefined);
    assert.notEqual(merged.duplicateStatus, 'answerConflict');
});

test('an empty answer is filled from the other candidate without a conflict', () => {
    const best = candidate({ id: 'draft-best', answer: '' });
    const other = candidate({
        id: 'draft-other',
        answer: 'C',
        fieldProvenance: {
            answer: { field: 'answer', status: 'deterministic-source', sourceId: 'file-other', evidenceRef: 'docx:answer' }
        }
    });

    const merged = merger.mergeCandidate(best, other);

    assert.equal(merged.answer, 'C');
    assert.equal(merged.fieldConflicts, undefined);
    // Provenance follows the candidate that supplied the value, never the better-ranked one.
    assert.equal(merged.fieldProvenance.answer.sourceId, 'file-other');
});

test('provenance follows the candidate that actually supplied a replaced presentation field', () => {
    const best = candidate({
        id: 'draft-best',
        stem: '短题干',
        fieldProvenance: { stem: { field: 'stem', status: 'deterministic-source', sourceId: 'file-best', evidenceRef: 'docx:stem' } }
    });
    const other = candidate({
        id: 'draft-other',
        stem: '明显更长更完整的题干，包含完整的条件与设问（    ）',
        fieldProvenance: { stem: { field: 'stem', status: 'deterministic-source', sourceId: 'file-other', evidenceRef: 'docx:stem' } }
    });

    const merged = merger.mergeCandidate(best, other);

    assert.equal(merged.stem, other.stem, 'the better stem still wins');
    assert.equal(
        merged.fieldProvenance.stem.sourceId,
        'file-other',
        'the stem provenance must point at the candidate the stem came from, not at the best candidate'
    );

    // And when the value is taken from the other candidate but it has no provenance, a stale entry
    // inherited from the best candidate must not survive.
    const noProvenance = candidate({ id: 'draft-plain', stem: '另一个更长的题干内容，包含完整条件与设问（    ）' });
    delete noProvenance.fieldProvenance;
    const second = merger.mergeCandidate(best, noProvenance);
    assert.equal(second.stem, noProvenance.stem);
    assert.equal(
        second.fieldProvenance?.stem,
        undefined,
        'a field taken from a candidate without provenance must not inherit the other candidate provenance'
    );
});

test('both candidates stay auditable after the merge', () => {
    const best = candidate({ id: 'draft-best', answer: 'B' });
    const other = candidate({ id: 'draft-other', answer: 'C', sourceTrace: { source: 'pdf-text', rawBlock: 'raw other' } });

    const merged = merger.mergeCandidate(best, other);

    assert.ok(Array.isArray(merged.sourceTrace.duplicateMergedFrom));
    assert.equal(merged.sourceTrace.duplicateMergedFrom.at(-1).id, 'draft-other');
    assert.deepEqual(
        merged.sourceTrace.mergedCandidates.map(item => item.id),
        ['draft-best', 'draft-other'],
        'both candidate traces must be kept'
    );
    assert.equal(merged.sourceTrace.mergedCandidates[1].sourceTrace.source, 'pdf-text');
});

test('a conflicted field cannot be admitted until a teacher resolves it', () => {
    const best = candidate({ id: 'draft-best', answer: 'B' });
    const other = candidate({ id: 'draft-other', answer: 'C' });
    const merged = merger.mergeCandidate(best, other);

    const draft = {
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
    };

    const blocked = admission.evaluateDraftAdmission(draft, {
        mode: 'docx-deterministic',
        actorId: 'local-teacher',
        explicitConfirmation: true,
        requestId: 'test-1',
        idempotencyKey: 'test-1',
        source: draft.source
    });
    assert.equal(blocked.accepted, false, 'a conflicted field must block formal admission');
    assert.ok(
        blocked.errors.some(error => error.code === 'admission-field-rejected' && error.field === 'answer'),
        `expected an admission-field-rejected error for answer: ${JSON.stringify(blocked.errors)}`
    );

    // The teacher resolves it by editing the field: manual provenance with an edit revision.
    const resolved = {
        ...draft,
        answer: 'C',
        fieldProvenance: {
            ...draft.fieldProvenance,
            answer: { field: 'answer', status: 'manual', manualEditRevision: 1, sourceId: 'file-best' }
        }
    };
    const allowed = admission.evaluateDraftAdmission(resolved, {
        mode: 'docx-deterministic',
        actorId: 'local-teacher',
        explicitConfirmation: true,
        requestId: 'test-2',
        idempotencyKey: 'test-2',
        source: resolved.source
    });
    assert.equal(allowed.accepted, true, `resolution must unblock admission: ${JSON.stringify(allowed.errors)}`);
});
