/**
 * Merges two recognition candidates that describe the same source file and question number.
 *
 * Presentation fields (stem, options) may be taken from the better candidate, but every field
 * records where its value actually came from. Answer and solution are different: two non-empty
 * values that disagree are a real conflict, and picking one of them automatically is exactly the
 * wrong-answer risk this project is built to avoid. A conflict keeps both candidates' evidence,
 * clears the field, marks its provenance `rejected`, and therefore blocks formal admission until a
 * teacher resolves it.
 *
 * The helper functions are injected so the module stays pure and testable, and so the application
 * keeps using its existing text/quality helpers.
 */
(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.BatchCandidateMerge = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const CONFLICT_REASON = 'candidate-conflict';
    const EXCLUSIVE_FIELDS = Object.freeze(['answer', 'solution']);

    const clone = value => {
        if (Array.isArray(value)) return value.map(clone);
        if (value && typeof value === 'object') {
            return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
        }
        return value;
    };

    const createBatchCandidateMerge = (helpers = {}) => {
        const required = [
            'text',
            'badCharCount',
            'latexSignalCount',
            'optionCount',
            'qualityScore',
            'mergeImages',
            'allText',
            'betterText'
        ];
        for (const name of required) {
            if (typeof helpers[name] !== 'function') {
                throw new TypeError(`batch candidate merge requires helper ${name}`);
            }
        }

        const {
            text,
            badCharCount,
            latexSignalCount,
            optionCount,
            qualityScore,
            mergeImages,
            allText,
            betterText
        } = helpers;

        // Presentation-only normalisation: whitespace, and the fullwidth forms of the same
        // characters. Nothing is deleted here, so mathematical punctuation keeps its meaning.
        const toPresentationForm = value => String(text(value) || '')
            .replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
            .replace(/[\s\u3000]+/g, '');

        // A pure option answer is one or more option labels, optionally decorated: "B", "(B)",
        // "B.", "A,C", "AB". Only when both sides are strictly pure option answers may the
        // decoration be discarded and the labels compared; "(0,1)" and "1,2" are not labels.
        const OPTION_DECORATION_RE = /[()（）\[\]【】]/g;
        const PURE_OPTION_SEQUENCE_RE = /^[A-H](?:[.,:;、，；：]?[A-H])*[.,:;、，；：]?$/;

        const canonicalOptionAnswer = value => {
            const stripped = toPresentationForm(value)
                .replace(OPTION_DECORATION_RE, '')
                .toUpperCase();
            if (!stripped || !PURE_OPTION_SEQUENCE_RE.test(stripped)) return null;
            return stripped.replace(/[^A-H]/g, '');
        };

        // Two values are "the same" only when they agree after presentation-only differences are
        // removed. Anything else is a conflict; length and LaTeX signal are never used to choose.
        const normalizeForCompare = (field, value) => {
            if (field === 'answer') {
                const labels = canonicalOptionAnswer(value);
                return labels === null ? toPresentationForm(value) : labels;
            }
            return String(text(value) || '')
                .replace(/\s+/g, '')
                .replace(/\\left|\\right/g, '')
                .replace(/^\$+|\$+$/g, '')
                .replace(/[。；;]$/g, '');
        };

        const valuesAreEquivalent = (field, leftValue, rightValue) => {
            if (field === 'answer') {
                const leftLabels = canonicalOptionAnswer(leftValue);
                const rightLabels = canonicalOptionAnswer(rightValue);
                // Option-label canonicalisation is allowed only when BOTH sides are pure labels.
                if (leftLabels !== null && rightLabels !== null) return leftLabels === rightLabels;
                return toPresentationForm(leftValue) === toPresentationForm(rightValue);
            }
            return normalizeForCompare(field, leftValue) === normalizeForCompare(field, rightValue);
        };

        const provenanceOf = (item, field) => {
            const fromFieldProvenance = item?.fieldProvenance?.[field];
            const fromProvenance = item?.provenance?.[field];
            const entry = fromFieldProvenance || fromProvenance;
            return entry && typeof entry === 'object' ? clone(entry) : null;
        };

        const candidateIdentity = (item, field) => ({
            field,
            id: String(item?.id || ''),
            questionNumber: String(item?.questionNumber || item?.question || item?.order || ''),
            source:
                item?.sourceTrace?.source
                || item?.recognitionSource
                || item?.source
                || '',
            score: qualityScore(item),
            value: field ? String(item?.[field] ?? '') : ''
        });

        // A field that already carries a candidate conflict stays conflicted. Only a teacher's
        // manual provenance releases it; no later automatic candidate may dissolve it.
        const manualProvenanceOf = (item, field) => {
            const entry = provenanceOf(item, field);
            return entry && entry.status === 'manual' ? entry : null;
        };

        const carriedConflictOf = (item, field) => {
            if (manualProvenanceOf(item, field)) return null;
            const record = item?.fieldConflicts?.[field];
            if (record && typeof record === 'object') return clone(record);
            const entry = provenanceOf(item, field);
            if (entry && entry.status === 'rejected' && entry.reasonCode === CONFLICT_REASON) {
                return { field, reasonCode: CONFLICT_REASON, candidates: [] };
            }
            return null;
        };

        // Folding three or more candidates must keep every disagreeing value, so the conflict
        // record accumulates instead of being replaced by the last pair.
        const accumulateConflict = (field, best, other, carriedBest, carriedOther) => {
            const candidates = [];
            const push = entry => {
                if (!entry) return;
                const value = String(entry.value ?? '');
                if (!value) return;
                if (candidates.some(item => item.id === entry.id && item.value === value)) return;
                candidates.push(entry);
            };

            for (const record of [carriedBest, carriedOther]) {
                for (const entry of record?.candidates || []) push(clone(entry));
            }
            for (const [item, carried] of [[best, carriedBest], [other, carriedOther]]) {
                if (carried || !text(item?.[field])) continue;
                push({ ...candidateIdentity(item, field), sourceTrace: clone(item?.sourceTrace || {}) });
            }

            return { field, reasonCode: CONFLICT_REASON, candidates };
        };

        // Presentation fields: the better value may win, but the provenance must follow the value.
        const choosePresentationField = (field, best, other) => {
            const bestValue = best?.[field];
            const otherValue = other?.[field];
            const chosen = betterText(bestValue, otherValue);
            const chosenFromOther = text(chosen) === text(otherValue)
                && text(otherValue) !== text(bestValue);
            const winner = chosenFromOther ? other : best;

            return {
                value: chosen,
                winner,
                provenance: provenanceOf(winner, field)
            };
        };

        // Answer and solution: never chosen automatically when both sides disagree.
        const resolveExclusiveField = (field, best, other) => {
            const bestValue = best?.[field];
            const otherValue = other?.[field];
            const bestPresent = Boolean(text(bestValue));
            const otherPresent = Boolean(text(otherValue));

            const carriedBest = carriedConflictOf(best, field);
            const carriedOther = carriedConflictOf(other, field);
            if (carriedBest || carriedOther) {
                return {
                    value: '',
                    winner: null,
                    provenance: { field, status: 'rejected', reasonCode: CONFLICT_REASON },
                    conflict: accumulateConflict(field, best, other, carriedBest, carriedOther),
                    sticky: true
                };
            }

            if (!bestPresent && !otherPresent) {
                return { value: bestValue ?? '', winner: best, provenance: provenanceOf(best, field), conflict: null };
            }
            if (!bestPresent) {
                return { value: otherValue, winner: other, provenance: provenanceOf(other, field), conflict: null };
            }
            if (!otherPresent) {
                return { value: bestValue, winner: best, provenance: provenanceOf(best, field), conflict: null };
            }
            if (valuesAreEquivalent(field, bestValue, otherValue)) {
                return { value: bestValue, winner: best, provenance: provenanceOf(best, field), conflict: null };
            }

            return {
                value: '',
                winner: null,
                provenance: { field, status: 'rejected', reasonCode: CONFLICT_REASON },
                conflict: {
                    field,
                    reasonCode: CONFLICT_REASON,
                    candidates: [
                        { ...candidateIdentity(best, field), sourceTrace: clone(best?.sourceTrace || {}) },
                        { ...candidateIdentity(other, field), sourceTrace: clone(other?.sourceTrace || {}) }
                    ]
                }
            };
        };

        const mergeCandidate = (best = {}, other = {}) => {
            const merged = { ...best };
            const bestOptions = Array.isArray(best.options) ? best.options : ['', '', '', ''];
            const otherOptions = Array.isArray(other.options) ? other.options : ['', '', '', ''];
            const bestOptionCount = optionCount(bestOptions);
            const otherOptionCount = optionCount(otherOptions);

            const optionsFromOther = otherOptionCount > bestOptionCount || (
                otherOptionCount === bestOptionCount
                && badCharCount(otherOptions.join('\n')) < badCharCount(bestOptions.join('\n'))
                && latexSignalCount(otherOptions.join('\n')) >= latexSignalCount(bestOptions.join('\n'))
            );
            if (optionsFromOther) merged.options = otherOptions;

            const presentation = {
                stem: choosePresentationField('stem', best, other),
                options: {
                    value: merged.options,
                    winner: optionsFromOther ? other : best,
                    provenance: provenanceOf(optionsFromOther ? other : best, 'options')
                }
            };
            const exclusive = Object.fromEntries(
                EXCLUSIVE_FIELDS.map(field => [field, resolveExclusiveField(field, best, other)])
            );

            merged.stem = presentation.stem.value;
            merged.answer = exclusive.answer.value;
            merged.solution = exclusive.solution.value;
            merged.images = mergeImages(best.images || [], other.images || []);
            merged.recognizedImages = mergeImages(best.recognizedImages || [], other.recognizedImages || []);

            if (!merged.sourcePageImage && other.sourcePageImage) merged.sourcePageImage = other.sourcePageImage;
            if (!merged.answerPageImage && other.answerPageImage) merged.answerPageImage = other.answerPageImage;
            if (!merged.solutionPageImage && other.solutionPageImage) merged.solutionPageImage = other.solutionPageImage;

            const bestTrace = best.sourceTrace || {};
            const otherTrace = other.sourceTrace || {};

            merged.sourceTrace = {
                ...bestTrace,
                sourcePageImage: bestTrace.sourcePageImage || otherTrace.sourcePageImage || other.sourcePageImage || '',
                rawBlock: bestTrace.rawBlock || otherTrace.rawBlock || other.rawBlock || other.rawText || '',
                pageText: bestTrace.pageText || otherTrace.pageText || other.pageText || other.sourceText || '',
                duplicateMergedFrom: [
                    ...(Array.isArray(bestTrace.duplicateMergedFrom) ? bestTrace.duplicateMergedFrom : []),
                    {
                        id: other.id || '',
                        questionNumber: other.questionNumber || other.question || other.order || '',
                        source: otherTrace.source || other.recognitionSource || other.source || '',
                        score: qualityScore(other),
                        badChars: badCharCount(allText(other)),
                        optionCount: optionCount(other.options),
                        stemHead: text(other.stem || '').slice(0, 100)
                    }
                ],
                // Both candidates stay auditable, including the candidate that lost.
                mergedCandidates: [
                    { id: best.id || '', sourceTrace: clone(bestTrace) },
                    { id: other.id || '', sourceTrace: clone(otherTrace) }
                ]
            };

            const conflicts = Object.fromEntries(
                EXCLUSIVE_FIELDS
                    .filter(field => exclusive[field].conflict)
                    .map(field => [field, exclusive[field].conflict])
            );

            // Keep `fieldConflicts`, `duplicateStatus` and the rejected provenance telling the same
            // story: a resolved field drops its record, a conflicted field keeps all of them.
            const carriedConflicts = { ...(best.fieldConflicts || {}) };
            const resolvedByTeacher = [];
            for (const field of EXCLUSIVE_FIELDS) {
                if (conflicts[field]) {
                    carriedConflicts[field] = conflicts[field];
                    continue;
                }
                if (carriedConflicts[field]) {
                    delete carriedConflicts[field];
                    resolvedByTeacher.push(field);
                }
            }
            if (Object.keys(carriedConflicts).length) {
                merged.fieldConflicts = carriedConflicts;
                // The review page already lists this as "重复或答案冲突需要确认".
                merged.duplicateStatus = 'answerConflict';
            } else {
                delete merged.fieldConflicts;
                if (resolvedByTeacher.length && merged.duplicateStatus === 'answerConflict') {
                    merged.duplicateStatus = 'none';
                }
            }

            const fieldProvenance = { ...(best.fieldProvenance || {}) };
            const provenance = { ...(best.provenance || {}) };
            for (const field of ['stem', 'options']) {
                if (presentation[field].provenance) {
                    fieldProvenance[field] = clone(presentation[field].provenance);
                    provenance[field] = clone(presentation[field].provenance);
                } else {
                    // The value may have come from the other candidate, so a stale entry inherited
                    // from `best` must not stay behind.
                    delete fieldProvenance[field];
                    delete provenance[field];
                }
            }
            for (const field of EXCLUSIVE_FIELDS) {
                const entry = exclusive[field].provenance;
                if (entry) {
                    fieldProvenance[field] = clone(entry);
                    provenance[field] = clone(entry);
                } else {
                    delete fieldProvenance[field];
                    delete provenance[field];
                }
            }
            if (Object.keys(fieldProvenance).length) merged.fieldProvenance = fieldProvenance;
            else delete merged.fieldProvenance;
            if (Object.keys(provenance).length) merged.provenance = provenance;
            else delete merged.provenance;

            const conflictWarnings = Object.entries(carriedConflicts).map(([field, conflict]) => {
                const values = (conflict.candidates || [])
                    .map(candidate => String(candidate.value ?? ''))
                    .filter(Boolean);
                const detail = values.length > 2
                    ? `候选共 ${values.length} 个：${values.map(value => `“${value}”`).join('、')}`
                    : `候选一为“${values[0] ?? ''}”，候选二为“${values[1] ?? ''}”`;
                return `${field === 'answer' ? '答案' : '解析'}冲突：${detail}，系统不会自动选择，请人工确认。`;
            });

            merged.warnings = [
                ...new Set([
                    ...(best.warnings || []),
                    ...(other.warnings || []),
                    ...conflictWarnings,
                    '检测到重复题号，系统已合并候选并保留质量更高版本。'
                ])
            ];

            return merged;
        };

        return Object.freeze({
            mergeCandidate,
            resolveExclusiveField,
            normalizeForCompare,
            valuesAreEquivalent,
            canonicalOptionAnswer,
            CONFLICT_REASON
        });
    };

    return Object.freeze({ createBatchCandidateMerge, CONFLICT_REASON, EXCLUSIVE_FIELDS });
});
