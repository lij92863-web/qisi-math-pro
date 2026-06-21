(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.PdfAnswerOnlyExtraction = api;

    if (
        typeof module !== 'undefined' &&
        module.exports
    ) {
        module.exports = api;
    }
})(
    typeof globalThis !== 'undefined'
        ? globalThis
        : this,
    function () {
        'use strict';

        const normalizeAnswerOnlyExtractionItem = (item, options = {}) => {
            if (!item || typeof item !== 'object') return null;

            const sourceOrder =
                Number(item.sourceOrder);

            if (!Number.isInteger(sourceOrder) || sourceOrder <= 0) return null;

            const rawLabel =
                String(item.label || '').trim().toUpperCase();
            const labelMatch =
                rawLabel.match(/^[A-F]{1,4}$/);

            if (!labelMatch) return null;

            const label =
                labelMatch[0];

            return {
                sourceOrder,
                questionNumberCandidate:
                    item.questionNumberCandidate || null,
                label,
                rawEvidenceShape:
                    item.rawEvidenceShape || 'unknown',
                confidence:
                    item.confidence || 'low',
                evidenceLevel:
                    'candidate-only',
                source:
                    'aoe-route-a-rawTextPages'
            };
        };

        const isAnswerMarkerLine = line => {
            const text =
                String(line || '').trim();

            if (!text) return false;

            return /答案|参考答案|答[:：.]?|【答案】|【参考答案】/.test(text) ||
                /\\A_\s*(?:【答案】|答案|答)/.test(text) ||
                /\\A\s*\{\s*(?:【答案】|答案|答)/.test(text);
        };

        const extractLabelFromAnswerLine = line => {
            const text =
                String(line || '').trim();

            if (!text) return null;

            if (/[\\_]/.test(text) && !/^(?:答案|参考答案|答|【答案】)/.test(text)) {
                return null;
            }

            if (/^[A-Fa-f]$/.test(text)) return text.toUpperCase();

            const markerMatch =
                text.match(/(?:答案|参考答案|答|【答案】)\s*[:：]?\s*([A-Fa-f])\s*$/);

            if (markerMatch) return markerMatch[1].toUpperCase();

            if (/^[A-Fa-f][.、。]?\s*$/.test(text)) {
                return text.replace(/[^A-Fa-f]/g, '').toUpperCase().slice(0, 1);
            }

            const bracketMatch =
                text.match(/[（(]\s*([A-Fa-f])\s*[)）]\s*$/);

            if (bracketMatch) return bracketMatch[1].toUpperCase();

            const braceMatch =
                text.match(/\{\s*([A-Fa-f])\s*\}\s*$/);

            if (braceMatch) return braceMatch[1].toUpperCase();

            return null;
        };

        const isDirtyOrNonLabelContent = value => {
            const text =
                String(value || '').trim();

            if (!text) return { dirty: true, reason: 'empty' };

            if (text.length > 30) {
                return { dirty: true, reason: 'too-long' };
            }

            if (/\\[a-zA-Z]/.test(text)) {
                return { dirty: true, reason: 'contains-latex-command' };
            }

            if (/[=\+\-×÷<>]/.test(text)) {
                return { dirty: true, reason: 'contains-math-operator' };
            }

            if (/_/.test(text) && !/^[A-Fa-f]$/.test(text)) {
                return { dirty: true, reason: 'contains-underscore' };
            }

            if (/[一-鿿]/.test(text) && text.length > 2) {
                return { dirty: true, reason: 'contains-explanation-text' };
            }

            return { dirty: false, reason: '' };
        };

        const validateAnswerOnlyExtractionSequence = (
            items = [],
            expectedQuestionNumbers = [],
            options = {}
        ) => {
            const normalized = [];
            const rejected = [];
            const warnings = [];
            const seenSourceOrders = new Set();

            if (!Array.isArray(items) || !items.length) {
                return {
                    ok: false,
                    mode: 'fail-closed',
                    candidateItems: [],
                    rejectedItems: [],
                    warnings: ['empty-input'],
                    affectsControlledWrite: false,
                    affectsBaselineCandidate: false,
                    affectsResultClassification: false
                };
            }

            for (let i = 0; i < items.length; i++) {
                const item =
                    normalizeAnswerOnlyExtractionItem(items[i], options);

                if (!item) {
                    const dirtyCheck =
                        isDirtyOrNonLabelContent(String(items[i].label || ''));

                    rejected.push({
                        index: i,
                        original: items[i],
                        reason: dirtyCheck.dirty
                            ? dirtyCheck.reason
                            : 'normalization-failed'
                    });
                    warnings.push({
                        code: dirtyCheck.dirty
                            ? 'aoe-dirty-content'
                            : 'aoe-item-normalization-failed',
                        index: i,
                        detail: dirtyCheck.dirty
                            ? dirtyCheck.reason
                            : ''
                    });
                    continue;
                }

                const dirtyCheck =
                    isDirtyOrNonLabelContent(String(items[i].label || ''));

                if (dirtyCheck.dirty) {
                    rejected.push({
                        index: i,
                        original: items[i],
                        reason: dirtyCheck.reason
                    });
                    warnings.push({ code: 'aoe-dirty-content', index: i, detail: dirtyCheck.reason });
                    continue;
                }

                if (seenSourceOrders.has(item.sourceOrder)) {
                    return {
                        ok: false,
                        mode: 'fail-closed',
                        candidateItems: normalized,
                        rejectedItems: [...rejected, {
                            index: i,
                            original: items[i],
                            reason: 'duplicate-sourceOrder'
                        }],
                        warnings: [...warnings, { code: 'duplicate-sourceOrder' }],
                        affectsControlledWrite: false,
                        affectsBaselineCandidate: false,
                        affectsResultClassification: false
                    };
                }
                seenSourceOrders.add(item.sourceOrder);

                normalized.push(item);
            }

            if (!normalized.length) {
                return {
                    ok: false,
                    mode: 'fail-closed',
                    candidateItems: [],
                    rejectedItems: rejected,
                    warnings: [...warnings, 'no-valid-items'],
                    affectsControlledWrite: false,
                    affectsBaselineCandidate: false,
                    affectsResultClassification: false
                };
            }

            const sourceOrders =
                normalized.map(n => n.sourceOrder);

            for (let i = 1; i < sourceOrders.length; i++) {
                if (sourceOrders[i] < sourceOrders[i - 1]) {
                    return {
                        ok: false,
                        mode: 'fail-closed',
                        candidateItems: normalized,
                        rejectedItems: rejected,
                        warnings: [...warnings, { code: 'jumpBack' }],
                        affectsControlledWrite: false,
                        affectsBaselineCandidate: false,
                        affectsResultClassification: false
                    };
                }
            }

            const expected =
                (expectedQuestionNumbers || []).map(String);
            const candidateQuestionNumbers =
                expected.slice(0, normalized.length);

            const missingCount =
                Math.max(0, expected.length - normalized.length);

            if (missingCount > 0) {
                warnings.push({
                    code: 'aoe-incomplete',
                    detail: `${normalized.length}/${expected.length} covered, ${missingCount} missing`
                });
            }

            const mode =
                missingCount === 0 && warnings.length === 0
                    ? 'full'
                    : normalized.length > 0
                        ? 'pass-safe-partial'
                        : 'fail-closed';

            return {
                ok: mode === 'full',
                mode,
                candidateItems: normalized,
                candidateQuestionNumbers,
                rejectedItems: rejected,
                warnings,
                affectsControlledWrite: false,
                affectsBaselineCandidate: false,
                affectsResultClassification: false
            };
        };

        const buildAnswerOnlyExtractionShadow = (
            rawTextPages = [],
            expectedQuestionNumbers = [],
            options = {}
        ) => {
            if (!Array.isArray(rawTextPages) || !rawTextPages.length) {
                return null;
            }

            const candidates = [];

            for (const page of rawTextPages) {
                const text =
                    typeof page === 'string'
                        ? page
                        : String(page.text || page.rawText || page.content || '');

                if (!text) continue;

                const lines =
                    text.replace(/\r/g, '\n').split('\n');

                for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                    const line =
                        String(lines[lineIndex] || '').trim();

                    if (!line) continue;

                    if (!isAnswerMarkerLine(line)) continue;

                    const label =
                        extractLabelFromAnswerLine(line);

                    if (!label) continue;

                    candidates.push({
                        sourceOrder: candidates.length + 1,
                        label,
                        rawEvidenceShape: 'label-only',
                        pageLine: lineIndex,
                        pageText: text.slice(0, 200)
                    });
                }
            }

            if (!candidates.length) {
                return {
                    mode: 'fail-closed',
                    candidateQuestionNumbers: [],
                    rejectedQuestionNumbers: [],
                    missingQuestionNumbers:
                        (expectedQuestionNumbers || []).map(String),
                    warnings: ['no-answer-labels-found-in-rawTextPages'],
                    affectsControlledWrite: false,
                    affectsBaselineCandidate: false,
                    affectsResultClassification: false
                };
            }

            const expected =
                (expectedQuestionNumbers || []).map(String);
            const candidateQuestionNumbers = [];

            for (let i = 0; i < Math.min(candidates.length, expected.length); i++) {
                candidateQuestionNumbers.push(expected[i]);
            }

            const missingQuestionNumbers =
                expected.slice(candidates.length);

            const mode =
                missingQuestionNumbers.length === 0
                    ? 'full'
                    : candidates.length > 0
                        ? 'pass-safe-partial'
                        : 'fail-closed';

            return {
                mode,
                candidateQuestionNumbers,
                rejectedQuestionNumbers: [],
                missingQuestionNumbers,
                candidateCount: candidates.length,
                expectedCount: expected.length,
                warnings: missingQuestionNumbers.length > 0
                    ? [`${missingQuestionNumbers.length} questions missing from AOE: ${missingQuestionNumbers.join(',')}`]
                    : [],
                affectsControlledWrite: false,
                affectsBaselineCandidate: false,
                affectsResultClassification: false
            };
        };

        return {
            normalizeAnswerOnlyExtractionItem,
            isAnswerMarkerLine,
            extractLabelFromAnswerLine,
            isDirtyOrNonLabelContent,
            validateAnswerOnlyExtractionSequence,
            buildAnswerOnlyExtractionShadow
        };
    }
);
