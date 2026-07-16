(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.DocxSupportContent = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const normalizeKeyboardCandidate = value => String(value || '')
        .replace(/＝/g, '=')
        .replace(/﹣/g, '-')
        .replace(/（/g, '(')
        .replace(/）/g, ')')
        .replace(/sqrt([A-Z0-9])/g, (_, body) => `\\sqrt{${body}}`)
        .replace(/(?:sin|cos|tan)(?=[A-Z])/g, command => `\\${command} `)
        .replace(/\s+/g, ' ')
        .trim();

    const shouldNormalizeCandidate = value => {
        const source = String(value || '');
        const hasKeyboardFunction = /(?:sin|cos|tan|sqrt)(?=[A-Z0-9(])/.test(source);
        const isExplicitUpperEquation = /^[A-Z](?:[A-Z0-9()+\-*/^]*[=+\-*/^])[A-Z0-9()+\-*/^=]+$/.test(source) && /=/.test(source);
        return source.length >= 3 && (hasKeyboardFunction || isExplicitUpperEquation);
    };

    const normalizeKeyboardMath = value => String(value || '')
        .split(/(\$[^$]*\$)/g)
        .map((segment, index) => {
            if (index % 2 === 1) return segment;
            return segment.replace(/[A-Za-z0-9()+\-*/^=＝（）﹣]+/g, candidate => {
                const comparable = String(candidate).replace(/＝/g, '=').replace(/﹣/g, '-').replace(/（/g, '(').replace(/）/g, ')');
                if (!shouldNormalizeCandidate(comparable)) return candidate;
                return `$${normalizeKeyboardCandidate(comparable)}$`;
            });
        })
        .reduce((result, segment) => (
            result.endsWith('$') && segment.startsWith('$')
                ? `${result}\u200B${segment}`
                : result + segment
        ), '');

    const detailMarker = value => String(value || '').match(/【(?:详解|解析|分析|解答)】/);

    const splitAnswerBlock = value => {
        const source = String(value || '').trim();
        const marker = detailMarker(source);
        if (!marker) return { answer: source, analysis: '', startsAnalysis: false };
        return {
            answer: source.slice(0, marker.index).trim(),
            analysis: source.slice(marker.index + marker[0].length).trim(),
            startsAnalysis: true
        };
    };

    const cleanAnswer = value => String(value || '')
        .replace(/^[：:\s]+|[。；;\s]+$/g, '')
        .trim();

    const finishItem = (current, items, diagnostics) => {
        if (!current) return;
        let answer = cleanAnswer(current.answer);
        let answerDerivedFromAnalysis = false;
        const rawAnalysis = current.analysisParagraphs.join('\n');
        if (!answer) {
            const explicitChoice = rawAnalysis.match(/故选\s*[:：]?\s*([A-D]{1,4})(?=[。；;，,\s]|$)/i);
            if (explicitChoice) {
                answer = explicitChoice[1].toUpperCase();
                answerDerivedFromAnalysis = true;
            }
        }
        if (!answer) diagnostics.push({ code: 'DOCX_SUPPORT_ANSWER_MISSING', questionKey: current.questionKey });
        items.push({
            questionKey: current.questionKey,
            sectionIndex: current.sectionIndex,
            number: current.number,
            answer,
            answerDerivedFromAnalysis,
            analysisParagraphs: current.analysisParagraphs.map(normalizeKeyboardMath),
            solution: normalizeKeyboardMath(rawAnalysis),
            analysisImages: current.analysisImages,
            richBlocks: current.richBlocks,
            sourceParagraphRange: [current.startParagraph, current.endParagraph]
        });
    };

    const sectionHeading = value => /^(?:[一二三四五六七八九十百]+|\d+)\s*[、.．]\s*[^：:]*?(?:选择题|填空题|解答题)(?=\s*(?:[（(：:]|$))/.test(String(value || '').trim());

    const withoutLeadingImageTokens = value => String(value || '')
        .replace(/^((?:\s*\[\[IMAGE:[^\]]+\]\]\s*)+)/, '')
        .trim();

    const leadingImageTokens = value => String(value || '')
        .match(/^((?:\s*\[\[IMAGE:[^\]]+\]\]\s*)+)/)?.[1]
        ?.trim() || '';

    const isSupportHeading = value => {
        const source = withoutLeadingImageTokens(value)
            .replace(/\s+/g, '')
            .replace(/[：:]$/, '');
        return /^(?:《[^》]{1,160}》)?(?:参考答案(?:(?:及|与|和)(?:解析|详解))?|答案(?:及|与|和)(?:解析|详解)|答案解析|参考解析)$/.test(source);
    };

    const partitionQuestionAndSupportBlocks = (blocks = []) => {
        const source = Array.isArray(blocks) ? blocks : [];
        const headingIndex = source.findIndex(block => isSupportHeading(
            block?.serialized ?? block?.text ?? ''
        ));
        if (headingIndex < 0) {
            return {
                hasSupportHeading: false,
                headingBlock: null,
                questionBlocks: source.slice(),
                supportBlocks: []
            };
        }
        return {
            hasSupportHeading: true,
            headingBlock: source[headingIndex],
            questionBlocks: source.slice(0, headingIndex),
            supportBlocks: source.slice(headingIndex + 1)
        };
    };

    const parseAnswerRichBlocks = (blocks = [], options = {}) => {
        const items = [];
        const diagnostics = [];
        const allowNumberedAnswerMarkers = options.allowNumberedAnswerMarkers === true;
        let sectionIndex = 1;
        let sawQuestion = false;
        let current = null;
        for (const block of blocks || []) {
            const value = String(block?.serialized || '').trim();
            const markerSource = withoutLeadingImageTokens(value);
            if (sectionHeading(markerSource)) {
                finishItem(current, items, diagnostics);
                current = null;
                if (sawQuestion) sectionIndex += 1;
                continue;
            }
            const explicitMarker = markerSource.match(/^\s*(\d+)\s*[.．、]?\s*【答案】\s*([\s\S]*)$/);
            const numberedMarker = allowNumberedAnswerMarkers
                ? markerSource.match(/^\s*(\d+)\s*[.．、]\s*([\s\S]*)$/)
                : null;
            const marker = explicitMarker || numberedMarker;
            if (marker) {
                finishItem(current, items, diagnostics);
                sawQuestion = true;
                const split = splitAnswerBlock(marker[2]);
                const leadingEvidence = leadingImageTokens(value);
                current = {
                    sectionIndex,
                    number: Number(marker[1]),
                    questionKey: `section-${sectionIndex}/q-${Number(marker[1])}`,
                    answer: split.answer,
                    analysisParagraphs: [leadingEvidence, split.analysis].filter(Boolean),
                    analysisImages: [...(block.assets || [])],
                    richBlocks: [block],
                    inAnalysis: split.startsAnalysis,
                    startParagraph: block.paragraphIndex,
                    endParagraph: block.paragraphIndex
                };
                continue;
            }
            if (!current || (!value && !(block.assets || []).length)) continue;
            current.richBlocks.push(block);
            current.endParagraph = block.paragraphIndex;
            current.analysisImages.push(...(block.assets || []));
            const markerMatch = detailMarker(value);
            if (markerMatch) {
                current.inAnalysis = true;
                const analysis = value.slice(markerMatch.index + markerMatch[0].length).trim();
                if (analysis) current.analysisParagraphs.push(analysis);
            } else if (current.inAnalysis && value) {
                current.analysisParagraphs.push(value);
            } else if (value) {
                current.answer = [current.answer, value].filter(Boolean).join('\n');
            }
        }
        finishItem(current, items, diagnostics);
        const duplicate = items.find((item, index) => items.findIndex(row => row.questionKey === item.questionKey) !== index);
        if (duplicate) diagnostics.push({ code: 'DOCX_SUPPORT_DUPLICATE_KEY', questionKey: duplicate.questionKey });
        const formulaErrors = (blocks || []).flatMap(block => block.diagnostics || []).filter(row => row.kind === 'formula-error');
        diagnostics.push(...formulaErrors);
        return { ok: diagnostics.length === 0, items, diagnostics };
    };

    const duplicateKeys = rows => {
        const seen = new Set();
        return [...new Set((rows || []).map(row => String(row?.questionKey || '')).filter(key => {
            if (!key || seen.has(key)) return true;
            seen.add(key);
            return false;
        }))];
    };

    const alignQuestionAndSupportByKey = (questions = [], supportItems = []) => {
        const questionDuplicates = duplicateKeys(questions);
        const supportDuplicates = duplicateKeys(supportItems);
        if (questionDuplicates.length || supportDuplicates.length) {
            return {
                ok: false,
                code: 'DOCX_SUPPORT_DUPLICATE_KEY',
                diagnostics: { questionDuplicates, supportDuplicates }
            };
        }
        const questionKeys = questions.map(row => String(row.questionKey || ''));
        const questionNumberMap = new Map();
        for (const question of questions) {
            const number = String(question.questionKey || '').match(/\/q-(\d+)$/)?.[1] || '';
            if (!number || questionNumberMap.has(number)) questionNumberMap.set(number, null);
            else questionNumberMap.set(number, question);
        }
        const supportMap = new Map();
        const extraKeys = [];
        for (const support of supportItems) {
            const exactKey = String(support.questionKey || '');
            const number = exactKey.match(/\/q-(\d+)$/)?.[1] || '';
            const question = questions.find(row => row.questionKey === exactKey) || questionNumberMap.get(number);
            if (!question) extraKeys.push(exactKey);
            else supportMap.set(question.questionKey, support);
        }
        const missingKeys = questionKeys.filter(key => !supportMap.has(key));
        if (missingKeys.length || extraKeys.length) {
            return { ok: false, code: 'DOCX_SUPPORT_KEY_MISMATCH', diagnostics: { missingKeys, extraKeys } };
        }
        return {
            ok: true,
            code: 'DOCX_SUPPORT_ALIGNED',
            diagnostics: { missingKeys: [], extraKeys: [] },
            items: questions.map(question => ({ question, support: supportMap.get(question.questionKey) }))
        };
    };

    return {
        alignQuestionAndSupportByKey,
        isSupportHeading,
        normalizeKeyboardMath,
        parseAnswerRichBlocks,
        partitionQuestionAndSupportBlocks
    };
});
