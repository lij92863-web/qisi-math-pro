(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.Qisi = root.Qisi || {};
        root.Qisi.PdfSupportControlledWrite = factory();
    }
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    const cleanText = value =>
        String(value ?? '').replace(/\r\n?/g, '\n').trim();

    const positiveNumberOr = (value, fallback) => {
        const number =
            Number(value);

        return Number.isFinite(number) && number > 0
            ? number
            : fallback;
    };

    const stripMathShell = value =>
        cleanText(value)
            .replace(/^\s*\$+|\$+\s*$/g, '')
            .replace(/^\\\(|\\\)$/g, '')
            .replace(/^\\\[|\\\]$/g, '')
            .trim();

    const normalizeComparableMathText = value =>
        stripMathShell(value)
            .replace(/\s+/g, '')
            .replace(/[，。；：、]/g, '')
            .replace(/−|－/g, '-')
            .replace(/（/g, '(')
            .replace(/）/g, ')')
            .replace(/^\{|\}$/g, '')
            .toLowerCase();

    const splitObjectiveAnswerValueSegments = value =>
        stripMathShell(value)
            .split(/[，,、;；]+/)
            .map(segment => segment.trim())
            .filter(Boolean);

    const sortLabelsByOptionOrder = (labels, options) => {
        const order =
            new Map(options.map((option, index) => [option.label, index]));

        return [...labels]
            .sort((left, right) =>
                (order.get(left) ?? 999) -
                (order.get(right) ?? 999)
            )
            .join('');
    };

    const inspectStructuralObjectiveLabelAnswer = (answerRaw, draft) => {
        const raw =
            stripMathShell(answerRaw);

        if (
            !/(^\s*\}|_)/.test(raw) ||
            /[0-9+\-=^]/.test(raw)
        ) {
            return {
                candidate: false,
                reason: 'not-structural-label-shell'
            };
        }

        const commands =
            [...raw.matchAll(/\\([A-Za-z]+)/g)].map(match => match[1]);
        const unsafeMathCommands =
            new Set([
                'frac',
                'sqrt',
                'sin',
                'cos',
                'tan',
                'log',
                'ln',
                'sum',
                'int',
                'lim',
                'overline',
                'underline',
                'vec',
                'bar',
                'hat',
                'dot',
                'angle',
                'triangle',
                'cdot',
                'times'
            ]);

        if (
            commands.some(command =>
                unsafeMathCommands.has(command.toLowerCase())
            )
        ) {
            return {
                ok: false,
                candidate: true,
                answer: '',
                reason: 'unsafe-math-command'
            };
        }

        const compact =
            raw
                .replace(/\\[A-Za-z]+\s*/g, '')
                .replace(/[{}\[\]().,，、;；:_\s]/g, '')
                .toUpperCase();

        if (!/^[A-F]+$/.test(compact)) {
            return {
                candidate: true,
                reason: 'non-label-payload'
            };
        }

        const options =
            getDraftOptions(draft);
        const optionLabels =
            new Set(options.map(option => option.label));
        const labels =
            compact.split('');
        const allValid =
            labels.every(label => optionLabels.has(label));

        return allValid
            ? {
                ok: true,
                candidate: true,
                answer:
                    compact,
                reason:
                    'structural-option-label-normalized',
                originalAnswer:
                    raw
            }
            : {
                ok: false,
                candidate: true,
                answer: '',
                reason:
                    'invalid-structural-option-label',
                originalAnswer:
                    raw
            };
    };

    const normalizeStructuralObjectiveLabelAnswer = (answerRaw, draft) => {
        const inspected =
            inspectStructuralObjectiveLabelAnswer(answerRaw, draft);

        return (
            inspected.ok ||
            inspected.reason === 'unsafe-math-command' ||
            inspected.reason === 'invalid-structural-option-label'
        )
            ? inspected
            : null;
    };

    const normalizeQuestionNumber = value => {
        const match =
            String(value ?? '').match(/\d{1,3}/);
        return match ? String(Number(match[0])) : '';
    };

    const getQuestionNumber = item =>
        normalizeQuestionNumber(
            item?.questionNumber ??
            item?.question ??
            item?.number ??
            item?.qno ??
            item?.order ??
            item?.sourceTrace?.questionNumber ??
            ''
        );

    const isObjectiveDraft = draft => {
        const type =
            String(draft?.type || draft?.questionType || draft?.题型 || '').trim();
        return /单选|多选|choice|single|multiple/i.test(type);
    };

    const isMultipleDraft = draft => {
        const type =
            String(draft?.type || draft?.questionType || draft?.题型 || '').trim();
        return /多选|multiple/i.test(type);
    };

    const getDraftOptions = draft => {
        const raw =
            draft?.options || draft?.choices || draft?.optionList || [];
        if (!Array.isArray(raw)) return [];

        return raw.map((item, index) => {
            if (item && typeof item === 'object') {
                return {
                    label:
                        String(item.label || item.key || String.fromCharCode(65 + index))
                            .trim()
                            .toUpperCase(),
                    text:
                        String(item.text || item.content || item.value || '').trim()
                };
            }

            const text =
                String(item || '').trim();
            const match =
                text.match(/^([A-F])[\.\、\)]\s*(.*)$/i);

            return {
                label:
                    match ? match[1].toUpperCase() : String.fromCharCode(65 + index),
                text:
                    match ? match[2].trim() : text
            };
        }).filter(option => option.text || option.label);
    };

    const normalizeObjectiveAnswerToLabels = (answerRaw, draft) => {
        const raw =
            stripMathShell(answerRaw);
        const compact =
            raw.replace(/\s+/g, '').toUpperCase();
        const options =
            getDraftOptions(draft);
        const optionLabels =
            new Set(options.map(option => option.label));

        if (/^[A-F]+$/.test(compact)) {
            const labels =
                compact.split('');
            const allValid =
                labels.every(label => optionLabels.has(label));

            return allValid
                ? { ok: true, answer: compact, reason: 'already-option-label' }
                : { ok: false, answer: '', reason: 'invalid-option-label' };
        }

        const structuralLabel =
            normalizeStructuralObjectiveLabelAnswer(raw, draft);

        if (structuralLabel) {
            return structuralLabel;
        }

        if (!options.length) {
            return {
                ok: false,
                answer: '',
                reason: 'options-missing',
                originalAnswer: raw
            };
        }

        const target =
            normalizeComparableMathText(raw);

        if (isMultipleDraft(draft)) {
            const segments =
                splitObjectiveAnswerValueSegments(raw);

            if (segments.length >= 2) {
                const labels = [];

                for (const segment of segments) {
                    const segmentTarget =
                        normalizeComparableMathText(segment);
                    const segmentMatches =
                        options.filter(option =>
                            normalizeComparableMathText(option.text) === segmentTarget
                        );

                    if (segmentMatches.length !== 1) {
                        return {
                            ok: false,
                            answer: '',
                            reason:
                                segmentMatches.length > 1
                                    ? 'ambiguous-multiple-option-value'
                                    : 'multiple-option-value-not-matched',
                            originalAnswer: raw
                        };
                    }

                    labels.push(segmentMatches[0].label);
                }

                if (new Set(labels).size === labels.length) {
                    return {
                        ok: true,
                        answer:
                            sortLabelsByOptionOrder(labels, options),
                        reason:
                            'multiple-option-values-converted',
                        originalAnswer:
                            raw
                    };
                }
            }

            return {
                ok: false,
                answer: '',
                reason: 'multiple-option-value-rejected',
                originalAnswer: raw
            };
        }

        const matches =
            options.filter(option =>
                normalizeComparableMathText(option.text) === target
            );

        if (matches.length === 1) {
            return {
                ok: true,
                answer: matches[0].label,
                reason: 'option-value-converted',
                originalAnswer: raw
            };
        }

        return {
            ok: false,
            answer: '',
            reason:
                matches.length > 1
                    ? 'ambiguous-option-value'
                    : 'option-value-not-matched',
            originalAnswer: raw
        };
    };

    const isUsableSolutionText = value => {
        const text =
            cleanText(value);
        return Boolean(text) &&
            !/^(未填写|无|暂无|none|null)$/i.test(text) &&
            text.length >= 2;
    };

    const buildItemMap = items => {
        const map =
            new Map();

        (items || []).forEach(item => {
            const question =
                getQuestionNumber(item);
            if (question && !map.has(question)) {
                map.set(question, item);
            }
        });

        return map;
    };

    const getItemAnswer = item =>
        cleanText(item?.answer ?? item?.answerRaw ?? item?.content ?? '');

    const getItemSolution = item =>
        cleanText(item?.solution ?? item?.solutionRaw ?? item?.analysis ?? item?.content ?? '');

    const cloneWithAnswer = (item, answer, extra = {}) => ({
        ...item,
        answer,
        answerRaw: answer,
        ...extra
    });

    const cloneWithSolution = (item, solution, extra = {}) => ({
        ...item,
        solution,
        solutionRaw: solution,
        ...extra
    });

    const normalizePdfSupportRawTextPagesFromPageResult = pageResult => {
        const pages = [];
        const addTextPage = value => {
            const text =
                cleanText(
                    typeof value === 'string'
                        ? value
                        : value?.text || value?.rawText || value?.markdown || value?.pageMarkdown || ''
                );
            if (text) pages.push(text);
        };

        [
            pageResult?.rawTextPages,
            pageResult?.pages,
            pageResult?.rawPages,
            pageResult?.evidence?.pages,
            pageResult?.result?.evidence?.pages
        ].forEach(values => {
            if (Array.isArray(values)) values.forEach(addTextPage);
        });

        ['rawText', 'text', 'fullText', 'markdown', 'pageMarkdown']
            .forEach(field => addTextPage(pageResult?.[field]));

        const seen = new Set();
        return pages.filter(text => {
            if (seen.has(text)) return false;
            seen.add(text);
            return true;
        });
    };

    const nonNegativeNumberOr = (value, fallback) => {
        const number =
            Number(value);

        return Number.isFinite(number) && number >= 0
            ? number
            : fallback;
    };

    const buildPdfSupportParserGate = ({
        parsePdfSupportBlocks,
        alignPdfSupport,
        file = {},
        answers = [],
        solutions = [],
        expectedQuestionNumbers = [],
        rawTextPages: providedRawTextPages = []
    } = {}) => {
        if (
            typeof parsePdfSupportBlocks !== 'function' ||
            typeof alignPdfSupport !== 'function'
        ) {
            return null;
        }

        const pageMap = new Map();
        [...(answers || []), ...(solutions || [])].forEach(item => {
            const trace = item?.sourceTrace || {};
            const text = cleanText(
                trace.pageText || item?.pageText || item?.sourceText || ''
            );
            if (!text) return;

            const pageNo =
                Number(
                    trace.sourcePage ||
                    trace.pageIndex ||
                    item?.sourcePage ||
                    item?.pageIndex ||
                    0
                ) || pageMap.size + 1;
            const key = `${file?.id || ''}:${pageNo}`;

            if (!pageMap.has(key)) {
                pageMap.set(key, {
                    pageIndex: pageNo,
                    sourceOrder: pageNo,
                    text
                });
            }
        });

        (providedRawTextPages || []).forEach((value, index) => {
            const text =
                cleanText(
                    typeof value === 'string'
                        ? value
                        : (
                            value?.text ||
                            value?.rawText ||
                            value?.content ||
                            value?.markdown ||
                            value?.pageMarkdown ||
                            ''
                        )
                );
            if (!text) return;

            const fallbackPageNo =
                index;
            const pageNo =
                nonNegativeNumberOr(
                    value?.sourceOrder ??
                    value?.pageIndex ??
                    value?.sourcePage ??
                    value?.pageNo,
                    fallbackPageNo
                );
            const pageIndex =
                nonNegativeNumberOr(
                    value?.pageIndex ??
                    value?.sourcePage ??
                    value?.pageNo,
                    pageNo
                );
            const key = `${file?.id || ''}:provided:${pageNo}`;
            if (!pageMap.has(key)) {
                pageMap.set(key, {
                    pageIndex,
                    sourceOrder: pageNo,
                    text
                });
            }
        });

        const rawTextPages =
            [...pageMap.values()].sort((a, b) => a.sourceOrder - b.sourceOrder);
        if (!rawTextPages.length) {
            return null;
        }

        const parserResult =
            parsePdfSupportBlocks({
                rawTextPages,
                expectedQuestionNumbers,
                sourceFileId: file?.id || '',
                mode: 'support'
            });
        const enrich = item => ({
            ...item,
            sourceFileId:
                item.sourceFileId || file?.id || item.sourceTrace?.sourceFileId || '',
            sourceFileName:
                item.sourceFileName || file?.filename || '',
            sourcePage:
                item.sourcePage || item.sourceTrace?.pageStart || 0
        });
        const result =
            alignPdfSupport({
                answerItems:
                    (parserResult.answerItems || []).map(enrich),
                solutionItems:
                    (parserResult.solutionItems || []).map(enrich),
                expectedQuestionNumbers
            });

        return {
            answers:
                result.mode === 'fail-closed'
                    ? []
                    : result.safeAnswerItems,
            solutions:
                result.mode === 'fail-closed'
                    ? []
                    : result.safeSolutionItems,
            report:
                result.report,
            mode:
                result.mode,
            safeQuestionNumbers:
                result.safeQuestionNumbers || [],
            fusedQuestionNumbers:
                result.fusedQuestionNumbers || [],
            fusedWarnings:
                result.fusedWarnings || [],
            failClosed:
                result.mode === 'fail-closed',
            parserResult,
            rawTextPagesCount:
                rawTextPages.length
        };
    };

    const buildPdfSupportFieldLevelControlledWrite = ({
        drafts = [],
        legacySafeAnswerItems = [],
        legacySafeSolutionItems = [],
        parserSafeAnswerItems = [],
        parserSafeSolutionItems = [],
        legacyFusedQuestionNumbers = [],
        parserFusedQuestionNumbers = []
    } = {}) => {
        const draftMap =
            new Map(
                (drafts || []).map((draft, index) => [
                    getQuestionNumber(draft) || String(index + 1),
                    draft
                ])
            );
        const legacyAnswerMap =
            buildItemMap(legacySafeAnswerItems);
        const legacySolutionMap =
            buildItemMap(legacySafeSolutionItems);
        const parserAnswerMap =
            buildItemMap(parserSafeAnswerItems);
        const parserSolutionMap =
            buildItemMap(parserSafeSolutionItems);
        const allSafeQuestionNumbers =
            Array.from(new Set([
                ...legacyAnswerMap.keys(),
                ...legacySolutionMap.keys(),
                ...parserAnswerMap.keys(),
                ...parserSolutionMap.keys()
            ])).sort((a, b) => Number(a) - Number(b));
        const effectiveAnswerItems = [];
        const effectiveSolutionItems = [];
        const warnings = [];
        const fieldDecisions = [];

        allSafeQuestionNumbers.forEach(questionNumber => {
            const draft =
                draftMap.get(questionNumber);
            const legacyAnswerItem =
                legacyAnswerMap.get(questionNumber);
            const parserAnswerItem =
                parserAnswerMap.get(questionNumber);
            const legacySolutionItem =
                legacySolutionMap.get(questionNumber);
            const parserSolutionItem =
                parserSolutionMap.get(questionNumber);
            const objective =
                isObjectiveDraft(draft);

            if (objective) {
                if (legacyAnswerItem && getItemAnswer(legacyAnswerItem)) {
                    effectiveAnswerItems.push(legacyAnswerItem);
                    fieldDecisions.push({ questionNumber, field: 'answer', source: 'legacy', reason: 'objective-legacy-preserved' });
                } else if (parserAnswerItem) {
                    const normalized =
                        normalizeObjectiveAnswerToLabels(getItemAnswer(parserAnswerItem), draft);
                    if (normalized.ok) {
                        effectiveAnswerItems.push(cloneWithAnswer(parserAnswerItem, normalized.answer, {
                            normalizedFromParserObjectiveAnswer: true,
                            originalParserAnswer:
                                normalized.originalAnswer || getItemAnswer(parserAnswerItem),
                            normalizeReason:
                                normalized.reason
                        }));
                        fieldDecisions.push({ questionNumber, field: 'answer', source: 'parser', reason: normalized.reason });
                    } else {
                        const structuralDiagnostic =
                            inspectStructuralObjectiveLabelAnswer(
                                getItemAnswer(parserAnswerItem),
                                draft
                            );
                        warnings.push({
                            questionNumber,
                            code: 'parser-objective-answer-rejected',
                            reason: normalized.reason,
                            structuralCandidate:
                                Boolean(structuralDiagnostic.candidate),
                            structuralReason:
                                structuralDiagnostic.reason || '',
                            originalAnswer:
                                normalized.originalAnswer || getItemAnswer(parserAnswerItem)
                        });
                        fieldDecisions.push({ questionNumber, field: 'answer', source: 'none', reason: normalized.reason });
                    }
                }
            } else if (parserAnswerItem && getItemAnswer(parserAnswerItem)) {
                effectiveAnswerItems.push(parserAnswerItem);
                fieldDecisions.push({ questionNumber, field: 'answer', source: 'parser', reason: 'non-objective-parser-safe' });
            } else if (legacyAnswerItem && getItemAnswer(legacyAnswerItem)) {
                effectiveAnswerItems.push(legacyAnswerItem);
                fieldDecisions.push({ questionNumber, field: 'answer', source: 'legacy', reason: 'non-objective-legacy-fallback' });
            }

            if (parserSolutionItem && isUsableSolutionText(getItemSolution(parserSolutionItem))) {
                effectiveSolutionItems.push(cloneWithSolution(parserSolutionItem, getItemSolution(parserSolutionItem)));
                fieldDecisions.push({ questionNumber, field: 'solution', source: 'parser', reason: 'parser-safe-solution' });
            } else if (legacySolutionItem && isUsableSolutionText(getItemSolution(legacySolutionItem))) {
                effectiveSolutionItems.push(cloneWithSolution(legacySolutionItem, getItemSolution(legacySolutionItem)));
                fieldDecisions.push({ questionNumber, field: 'solution', source: 'legacy', reason: 'legacy-safe-solution-fallback' });
            } else {
                fieldDecisions.push({ questionNumber, field: 'solution', source: 'none', reason: 'no-usable-safe-solution' });
            }
        });

        return {
            effectiveAnswerItems,
            effectiveSolutionItems,
            fusedQuestionNumbers:
                Array.from(new Set([
                    ...(legacyFusedQuestionNumbers || []),
                    ...(parserFusedQuestionNumbers || [])
                ])).map(String),
            warnings,
            fieldDecisions,
            answerQuestionNumbers:
                effectiveAnswerItems.map(getQuestionNumber).filter(Boolean),
            solutionQuestionNumbers:
                effectiveSolutionItems.map(getQuestionNumber).filter(Boolean)
        };
    };

    return {
        buildPdfSupportParserGate,
        buildPdfSupportFieldLevelControlledWrite,
        getDraftOptions,
        isObjectiveDraft,
        isUsableSolutionText,
        normalizeObjectiveAnswerToLabels,
        normalizePdfSupportRawTextPagesFromPageResult
    };
});
