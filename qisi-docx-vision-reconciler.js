(function initDocxVisionReconciler(root, factory) {
    'use strict';
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.Qisi = root.Qisi || {};
        root.Qisi.DocxVisionReconciler = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const fail = code => {
        const error = new Error(code);
        error.code = code;
        error.stage = 'docx-question-reconcile';
        return error;
    };
    const isRecord = value => Boolean(
        value && typeof value === 'object' && !Array.isArray(value)
    );
    const assertActive = signal => {
        if (!signal?.aborted) return;
        const error = fail('DOCX_RECONCILE_CANCELLED');
        error.name = 'AbortError';
        throw error;
    };

    function createDocxVisionReconciler(ports = {}) {
        if (
            typeof ports.normalizeQuestionNumber !== 'function' ||
            typeof ports.cleanText !== 'function' ||
            typeof ports.mergeQuestions !== 'function'
        ) throw fail('DOCX_RECONCILER_PORT_REQUIRED');

        const normalize = value => ports.normalizeQuestionNumber(value);
        const clean = value => ports.cleanText(value);
        const optionConflict = items => {
            const byQuestion = new Map();
            for (const item of items) {
                const number = normalize(
                    item?.questionNumber || item?.question || item?.no || ''
                );
                if (!number) continue;
                const options = Array.isArray(item.options) ? item.options : [];
                const previous = byQuestion.get(number);
                if (!previous) {
                    byQuestion.set(number, options);
                    continue;
                }
                for (let index = 0; index < 4; index += 1) {
                    const left = clean(previous[index] || '');
                    const right = clean(options[index] || '');
                    if (left && right && left !== right) return true;
                }
            }
            return false;
        };

        return function reconcileDocxVisionQuestions(
            items = [],
            skeleton = null,
            options = {}
        ) {
            const signal = options.signal || null;
            assertActive(signal);
            if (!Array.isArray(items)) {
                throw fail('DOCX_RECONCILE_INPUT_INVALID');
            }
            const questionNumbers = Array.isArray(skeleton?.questionNumbers)
                ? skeleton.questionNumbers.map(normalize).filter(Boolean)
                : [];

            if (!skeleton?.authoritative || questionNumbers.length < 2) {
                return {
                    applied: false,
                    questions: items,
                    rejectedCandidates: [],
                    missingQuestionNumbers: [],
                    questionNumbers
                };
            }
            if (new Set(questionNumbers).size !== questionNumbers.length) {
                throw fail('DOCX_RECONCILE_SKELETON_CONFLICT');
            }
            if (optionConflict(items)) {
                throw fail('DOCX_RECONCILE_OPTION_CONFLICT');
            }

            const allowed = new Set(questionNumbers);
            const orderMap = new Map(questionNumbers.map(
                (number, index) => [number, index]
            ));
            const accepted = [];
            const rejectedCandidates = [];

            for (const rawItem of items) {
                if (!isRecord(rawItem)) continue;
                const questionNumber = normalize(
                    rawItem.questionNumber || rawItem.question || rawItem.no || ''
                );
                if (!questionNumber) {
                    rejectedCandidates.push({
                        reason: 'missing-explicit-question-number',
                        questionNumber: '',
                        stemHead: clean(rawItem.stem || '').slice(0, 160),
                        sourcePage: rawItem.sourcePage || rawItem.pageIndex || 0
                    });
                    continue;
                }
                if (!allowed.has(questionNumber)) {
                    rejectedCandidates.push({
                        reason: 'question-number-not-in-docx-skeleton',
                        questionNumber,
                        stemHead: clean(rawItem.stem || '').slice(0, 160),
                        sourcePage: rawItem.sourcePage || rawItem.pageIndex || 0
                    });
                    continue;
                }
                accepted.push({
                    ...rawItem,
                    question: questionNumber,
                    questionNumber,
                    sourceTrace: {
                        ...(rawItem.sourceTrace || {}),
                        questionNumberEvidence:
                            'docx-explicit-paragraph-marker'
                    }
                });
            }

            assertActive(signal);
            const merged = ports.mergeQuestions(accepted);
            assertActive(signal);
            if (
                !Array.isArray(merged) ||
                merged.some(item => !isRecord(item))
            ) throw fail('DOCX_RECONCILE_RESULT_MALFORMED');

            const questions = [...merged].sort((left, right) => {
                const leftKey = normalize(
                    left.questionNumber || left.question || ''
                );
                const rightKey = normalize(
                    right.questionNumber || right.question || ''
                );
                return (
                    (orderMap.get(leftKey) ?? 9999) -
                    (orderMap.get(rightKey) ?? 9999)
                );
            });
            const present = new Set(questions.map(item => normalize(
                item.questionNumber || item.question || ''
            )).filter(Boolean));

            return {
                applied: true,
                questions,
                rejectedCandidates,
                missingQuestionNumbers: questionNumbers.filter(
                    number => !present.has(number)
                ),
                questionNumbers
            };
        };
    }

    return Object.freeze({ createDocxVisionReconciler });
});
