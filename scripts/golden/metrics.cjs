'use strict';

const normalize = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const ratio = (numerator, denominator) => denominator ? numerator / denominator : null;
const number = value => /^[1-9]\d{0,2}$/.test(String(value)) ? String(value) : null;
const present = value => normalize(value).length > 0;

function validateExpected(rows) {
    if (!Array.isArray(rows) || !rows.length) throw new Error('GOLDEN_EXPECTED_EMPTY');
    const seen = new Set();
    for (const row of rows) {
        if (typeof row.number !== 'string' || !number(row.number) || seen.has(row.number) || !present(row.stemIncludes) ||
            !(row.answer === null || typeof row.answer === 'string' && present(row.answer)) ||
            !(row.solutionIncludes === null || typeof row.solutionIncludes === 'string' && present(row.solutionIncludes)) ||
            !Number.isInteger(row.optionCount) || row.optionCount < 0 ||
            !Number.isInteger(row.imageCount) || row.imageCount < 0 ||
            !Array.isArray(row.withhold) || new Set(row.withhold).size !== row.withhold.length ||
            row.withhold.some(field => !['answer', 'solution'].includes(field))) {
            throw new Error('GOLDEN_EXPECTED_INVALID');
        }
        seen.add(row.number);
    }
}

function automatic(field, draft) {
    const provenance = draft.fieldProvenance?.[field];
    if (!provenance || provenance.manuallyEdited || ['manual', 'rejected', 'missing'].includes(provenance.status)) return false;
    return provenance.status === 'deterministic-source' ||
        provenance.status === 'controlled-write' && provenance.controlledWriteAccepted === true;
}

// Measures persisted drafts before simulated human actions. A visible rejected
// PDF candidate is never counted as an automatically accepted binding.
function evaluate(expected, drafts, { expectedAutomaticAnswers, files = [] } = {}) {
    validateExpected(expected);
    if (!Array.isArray(drafts)) throw new Error('GOLDEN_DRAFTS_INVALID');
    const byNumber = new Map();
    for (const draft of drafts) {
        const key = number(draft.questionNumber);
        if (!byNumber.has(key)) byNumber.set(key, []);
        byNumber.get(key).push(draft);
    }
    const expectedNumbers = new Set(expected.map(row => row.number));
    const unexpected = drafts.filter(draft => !expectedNumbers.has(number(draft.questionNumber)));
    const duplicates = [...byNumber.entries()].filter(([, rows]) => rows.length > 1).map(([key]) => key);
    const rows = expected.map(label => {
        const candidates = byNumber.get(label.number) || [];
        const draft = candidates.length === 1 ? candidates[0] : null;
        const identityMatched = Boolean(draft && normalize(draft.stem).includes(normalize(label.stemIncludes)));
        const answer = normalize(draft?.answer);
        const solution = normalize(draft?.solution);
        const answerAnnotated = label.answer !== null;
        const solutionAnnotated = label.solutionIncludes !== null;
        const sourceMatches = field => {
            const filename = label[field + 'SourceFile'];
            if (!filename) return true;
            const matches = files.filter(file => file.id === draft?.fieldProvenance?.[field]?.sourceId);
            return matches.length === 1 && matches[0].filename === filename;
        };
        const answerSourceMatched = sourceMatches('answer'), solutionSourceMatched = sourceMatches('solution');
        const answerCorrect = Boolean(identityMatched && answerSourceMatched && answerAnnotated && answer === normalize(label.answer));
        const solutionAnchorMatched = Boolean(identityMatched && solutionSourceMatched && solutionAnnotated && solution.includes(normalize(label.solutionIncludes)));
        const errors = [];
        if (!draft) errors.push(candidates.length ? 'duplicate-question' : 'missing-question');
        if (draft && !identityMatched) errors.push('identity-anchor-mismatch');
        if (draft && draft.options?.filter(present).length !== label.optionCount) errors.push('option-count-mismatch');
        if (draft && (draft.images || []).length !== label.imageCount) errors.push('image-count-mismatch');
        if (answer && !answerSourceMatched) errors.push('answer-source-mismatch');
        if (solution && !solutionSourceMatched) errors.push('solution-source-mismatch');
        for (const field of label.withhold) if (present(draft?.[field])) errors.push('unsafe-' + field + '-present');
        if (!label.withhold.includes('answer') && answerAnnotated && !answerCorrect) errors.push('answer-mismatch');
        if (!label.withhold.includes('solution') && solutionAnnotated && !solutionAnchorMatched) errors.push('solution-anchor-mismatch');
        if (answer && !answerAnnotated && !label.withhold.includes('answer')) errors.push('answer-ungraded');
        const autoAnswer = Boolean(draft && answer && automatic('answer', draft));
        const wrongAutomaticAnswer = autoAnswer && (label.withhold.includes('answer') || !identityMatched ||
            !answerSourceMatched || answerAnnotated && !answerCorrect);
        return {
            number: label.number, identityMatched, answer, answerAnnotated, answerCorrect, answerSourceMatched, solutionSourceMatched,
            solutionPresent: Boolean(solution), solutionAnnotated, solutionAnchorMatched,
            automaticAnswer: autoAnswer, automaticallyAcceptedWrongAnswer: wrongAutomaticAnswer,
            ungradedAutomaticAnswer: autoAnswer && !wrongAutomaticAnswer && !answerAnnotated,
            withheldFields: label.withhold, errors,
            evidence: draft ? {
                sourceFileId: draft.sourceFileId, sourcePage: draft.sourcePage,
                sourceTrace: draft.sourceTrace, fieldProvenance: draft.fieldProvenance,
                warnings: draft.warnings || [], answerEvidence: draft.pdfReview?.answerEvidence
            } : null
        };
    });
    const expectedAnswers = rows.filter(row => row.answerAnnotated).length;
    const candidateAnswers = drafts.filter(draft => present(draft.answer)).length;
    const correctCandidateAnswers = rows.filter(row => row.answerCorrect).length;
    const accepted = drafts.filter(draft => present(draft.answer) && automatic('answer', draft));
    const wrongUnexpectedAutomaticAnswers = unexpected.filter(draft => present(draft.answer) && automatic('answer', draft)).length;
    const duplicateAccepted = accepted.filter(draft => expectedNumbers.has(number(draft.questionNumber)) &&
        byNumber.get(number(draft.questionNumber)).length > 1);
    const knownWrongDuplicateAnswers = duplicateAccepted.filter(draft => {
        const label = expected.find(row => row.number === number(draft.questionNumber));
        const source = label.answerSourceFile;
        const owners = source ? files.filter(file => file.id === draft.fieldProvenance?.answer?.sourceId) : [];
        return label.withhold.includes('answer') || !normalize(draft.stem).includes(normalize(label.stemIncludes)) ||
            source && (owners.length !== 1 || owners[0].filename !== source) ||
            label.answer !== null && normalize(draft.answer) !== normalize(label.answer);
    }).length;
    const wrongAutomaticAnswers = rows.filter(row => row.automaticallyAcceptedWrongAnswer).length + wrongUnexpectedAutomaticAnswers + knownWrongDuplicateAnswers;
    const correctAutomaticAnswers = rows.filter(row => row.automaticAnswer && row.answerCorrect && !row.automaticallyAcceptedWrongAnswer).length;
    const ambiguousAutomaticAnswers = duplicateAccepted.length - knownWrongDuplicateAnswers;
    const ungradedAutomaticAnswers = rows.filter(row => row.ungradedAutomaticAnswer).length + ambiguousAutomaticAnswers;
    const errors = rows.flatMap(row => row.errors.map(code => ({ number: row.number, code })));
    if (unexpected.length) errors.push({ code: 'unexpected-question', count: unexpected.length });
    if (duplicates.length) errors.push({ code: 'duplicate-question-numbers', numbers: duplicates });
    if (wrongAutomaticAnswers) errors.push({ code: 'wrong-automatic-answer', count: wrongAutomaticAnswers });
    if (ungradedAutomaticAnswers) errors.push({ code: 'ungraded-automatic-answer', count: ungradedAutomaticAnswers });
    if (expectedAutomaticAnswers !== undefined && accepted.length !== expectedAutomaticAnswers) {
        errors.push({ code: 'automatic-answer-policy-mismatch', expected: expectedAutomaticAnswers, actual: accepted.length });
    }
    return {
        ok: errors.length === 0, rows, errors,
        counts: {
            expectedQuestions: expected.length, observedDrafts: drafts.length,
            identityMatched: rows.filter(row => row.identityMatched).length,
            missingQuestions: rows.filter(row => !byNumber.has(row.number)).length,
            duplicateNumbers: duplicates.length, unexpectedQuestions: unexpected.length,
            expectedAnswers, candidateAnswers, correctCandidateAnswers,
            automaticAnswers: accepted.length, correctAutomaticAnswers, wrongAutomaticAnswers, ungradedAutomaticAnswers, ambiguousAutomaticAnswers,
            expectedSolutionAnchors: rows.filter(row => row.solutionAnnotated).length,
            matchedSolutionAnchors: rows.filter(row => row.solutionAnchorMatched).length,
            requiredWithheldFields: rows.reduce((n, row) => n + row.withheldFields.length, 0)
        },
        rates: {
            questionRecall: ratio(rows.filter(row => row.identityMatched).length, expected.length),
            candidateAnswerPrecision: ratio(correctCandidateAnswers, candidateAnswers),
            candidateAnswerCoverage: ratio(correctCandidateAnswers, expectedAnswers),
            automaticAnswerPrecision: ungradedAutomaticAnswers ? null : ratio(correctAutomaticAnswers, accepted.length),
            automaticAnswerCoverage: ratio(correctAutomaticAnswers, expectedAnswers)
        },
        limits: 'Whitespace-only comparison. Solution anchors and image counts do not prove complete solutions or correct figure content. Synthetic cases do not establish real OCR accuracy.'
    };
}

module.exports = { evaluate, validateExpected, automatic, ratio };
