(function initRecognitionStructurePolicy(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.RecognitionStructurePolicy = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    function createRecognitionStructurePolicy(ports = {}) {
        for (const name of ["stripQuestionSectionNoise","splitQuestionForStorage","normalizeQuestionType","normalizeAnswerForLatex","normalizeInlineImageList","collectValidRecognizedFigures","mergeStemWithOptions","batchDebugLog","toBatchDebugQuestion","getDefaultType"]) {
            if (typeof ports[name] !== 'function') {
                const error = new TypeError(
                    `Recognition structure policy requires ${name}.`
                );
                error.code = 'RECOGNITION_STRUCTURE_POLICY_PORT_REQUIRED';
                throw error;
            }
        }
        if (!ports.choiceRepairDeps || typeof ports.choiceRepairDeps !== 'object') {
            const error = new TypeError(
                'Recognition structure policy requires choiceRepairDeps.'
            );
            error.code = 'RECOGNITION_STRUCTURE_POLICY_PORT_REQUIRED';
            throw error;
        }

        const stripQuestionSectionNoise = ports.stripQuestionSectionNoise;
        const splitQuestionForStorage = ports.splitQuestionForStorage;
        const normalizeQuestionType = ports.normalizeQuestionType;
        const normalizeAnswerForLatex = ports.normalizeAnswerForLatex;
        const normalizeInlineImageList = ports.normalizeInlineImageList;
        const collectValidRecognizedFigures = ports.collectValidRecognizedFigures;
        const mergeStemWithOptions = ports.mergeStemWithOptions;
        const batchDebugLog = ports.batchDebugLog;
        const toBatchDebugQuestion = ports.toBatchDebugQuestion;
        const getDefaultType = ports.getDefaultType;
        const choiceRepairDeps = ports.choiceRepairDeps;

        const prepareQuestionRecognitionText = (text) => {
            let source = root.Qisi.Utils.cleanRecognizedText(text)
                .replace(/\r/g, '\n')
                .replace(/\u3000/g, ' ')
                .replace(/[ \t]+/g, ' ')
                .replace(/(?:^|\n|\s)(?:[一二三四五六七八九十]+[、.．]\s*)?(单项选择题|单选题)\s*[：:][^0-9\n]{0,120}/g, '\n[[TYPE:单选题]]\n')
                .replace(/(?:^|\n|\s)(?:[一二三四五六七八九十]+[、.．]\s*)?(多项选择题|多选题)\s*[：:][^0-9\n]{0,160}/g, '\n[[TYPE:多选题]]\n')
                .replace(/(?:^|\n|\s)(?:[一二三四五六七八九十]+[、.．]\s*)?(填空题)\s*[：:][^0-9\n]{0,120}/g, '\n[[TYPE:填空题]]\n')
                .replace(/(?:^|\n|\s)(?:[一二三四五六七八九十]+[、.．]\s*)?(解答题|证明题)\s*[：:][^0-9\n]{0,120}/g, '\n[[TYPE:解答题]]\n')
                .replace(/_{3,}[^。\n]{0,30}(姓名|评分|班别)[^。\n]*/g, '')
                .replace(/(姓名|评分|班别)\s*_{2,}/g, '')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
            const firstQuestion = source.search(/(^|\n)\s*(?:第\s*)?[1-9]\d{0,2}(?:\s*题)?[\.、．\)]\s*/);
            if (firstQuestion > 0) {
                const before = source.slice(0, firstQuestion);
                const typeMarkers = [...before.matchAll(/\[\[TYPE:[^\]]+\]\]/g)];
                const lastTypeMarker = typeMarkers.at(-1);
                source = `${lastTypeMarker ? `${lastTypeMarker[0]}\n` : ''}${source.slice(firstQuestion)}`.trim();
            }
            return source;
        };

        const splitQuestionBlocksByNumber = (text) => {
            const source = root.Qisi.Utils.cleanRecognizedText(text)
                .replace(/\r/g, '\n')
                .replace(/\u3000/g, ' ')
                .replace(/\n{3,}/g, '\n\n');

            const markerRegex = /(^|\n)\s*(?:第\s*)?([1-9１-９][0-9０-９]{0,2})(?:\s*题)?\s*[\.．、:：\)）]\s*/g;

            const marks = [];
            let match;

            while ((match = markerRegex.exec(source)) !== null) {
                const questionNo = Number(
                    String(match[2]).replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248))
                );

                if (questionNo >= 1900 && questionNo <= 2100) continue;

                marks.push({
                    question: String(questionNo),
                    start: match.index + match[1].length,
                    contentStart: markerRegex.lastIndex
                });
            }

            if (!marks.length) return [];

            const blocks = [];

            marks.forEach((mark, idx) => {
                const next = marks[idx + 1];
                const content = source.slice(mark.contentStart, next ? next.start : source.length).trim();

                if (!content) return;

                blocks.push({
                    question: mark.question,
                    block: content,
                    start: mark.start
                });
            });

            return blocks.filter((item, idx, arr) => {
                if (idx === 0) return true;
                const prev = Number(arr[idx - 1].question);
                const curr = Number(item.question);
                return curr > prev || Math.abs(curr - prev) <= 1;
            });
        };

        const parseQuestionItemsFromText = (text, sourceFile, includeInlineAnswer = false) => {
            const source = prepareQuestionRecognitionText(text);
            if (!source) return [];
            const typeMarks = [...source.matchAll(/\[\[TYPE:([^\]]+)\]\]/g)].map(m => ({ type: m[1], index: m.index }));
            const typeAt = (index) => {
                let current = '';
                for (const mark of typeMarks) {
                    if (mark.index <= index) current = mark.type;
                    else break;
                }
                return current;
            };
            const blocks = splitQuestionBlocksByNumber(source);
            const segments = blocks.length ? blocks.map(block => ({
                question: block.question,
                type: typeAt(block.start),
                text: block.block.split(/\[\[TYPE:[^\]]+\]\]/)[0].trim()
            })) : [{ question: '1', text: source }];

            const result = segments.filter(seg => seg.text && !/^(一|二|三|四)[、.．]/.test(seg.text)).map((seg, idx) => {
                const split = root.Qisi.Utils.stripAnswerSolution(stripQuestionSectionNoise(seg.text));
                const answer = includeInlineAnswer ? root.Qisi.Utils.cleanRecognizedText(split.answer) : '';
                const prepared = splitQuestionForStorage(split.stem, getDefaultType(), ['', '', '', '']);
                const repaired = root.Qisi.SupportRepair.repairChoiceOptions(prepared.stem || split.stem, prepared.options, prepared.type, choiceRepairDeps);
                const options = repaired.options;
                const stem = repaired.stem;
                return {
                    question: seg.question || String(idx + 1),
                    stem,
                    options,
                    answer,
                    solution: includeInlineAnswer ? root.Qisi.Utils.cleanRecognizedText(split.solution) : '',
                    type: normalizeQuestionType(seg.type || prepared.type, stem, options, answer, getDefaultType()),
                    images: Array.isArray(sourceFile.images) ? sourceFile.images : [],
                    question_bbox: [],
                    confidence: sourceFile.fileType === 'pdf' ? 0.62 : 0.82,
                    warnings: sourceFile.fileType === 'pdf' ? ['PDF 文本提取结果可能不完整，请重点核对。'] : [],
                    sourceFileId: sourceFile.id,
                    sourceFileName: sourceFile.filename || '',
                    pageIndex: sourceFile.pageIndex || sourceFile.sourcePage || 0,
                    sourceText: source,
                    pageText: source,
                    rawBlock: seg.text,
                    sourceTrace: {
                        sourceFileId: sourceFile.id || '',
                        sourceFileName: sourceFile.filename || '',
                        pageIndex: sourceFile.pageIndex || sourceFile.sourcePage || 0,
                        sourcePage: sourceFile.sourcePage || 0,
                        sourcePageImage: sourceFile.sourcePageImage || '',
                        rawBlock: seg.text,
                        pageText: source,
                        imageIds: []
                    },
                    rawText: seg.text
                };
            });
            batchDebugLog('parsed', result.map(toBatchDebugQuestion));
            return result;
        };


        const extractItemOptions = (item = {}) => {
            const direct = item.options ?? item.choices ?? item.choice ?? item.option ?? item.选项;

            if (Array.isArray(direct)) {
                const result = ['', '', '', ''];

                direct.forEach((entry, idx) => {
                    if (idx > 3) return;

                    if (typeof entry === 'string') {
                        result[idx] = entry;
                        return;
                    }

                    if (entry && typeof entry === 'object') {
                        const label = root.Qisi.Utils.cleanRecognizedText(entry.label || entry.key || entry.name || entry.option || '');
                        const text = entry.text ?? entry.content ?? entry.value ?? entry.内容 ?? '';
                        const normalizedLabel = label
                            .replace(/[Ａ-Ｄ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248))
                            .replace(/[.\s、，。:：；;()（）]/g, '')
                            .toUpperCase();

                        const targetIndex = /^[A-D]$/.test(normalizedLabel)
                            ? normalizedLabel.charCodeAt(0) - 65
                            : idx;

                        if (targetIndex >= 0 && targetIndex < 4) result[targetIndex] = text;
                    }
                });

                return result;
            }

            if (direct && typeof direct === 'object') {
                return ['A', 'B', 'C', 'D'].map(label =>
                    direct[label] ??
                    direct[label.toLowerCase()] ??
                    direct[`选项${label}`] ??
                    direct[`option${label}`] ??
                    direct[`option_${label.toLowerCase()}`] ??
                    direct[`choice${label}`] ??
                    direct[`choice_${label.toLowerCase()}`] ??
                    ''
                );
            }

            return ['A', 'B', 'C', 'D'].map(label =>
                item[label] ??
                item[label.toLowerCase()] ??
                item[`选项${label}`] ??
                item[`option${label}`] ??
                item[`option_${label.toLowerCase()}`] ??
                item[`choice${label}`] ??
                item[`choice_${label.toLowerCase()}`] ??
                ''
            );
        };

        const candidateNormalizerHelpers = Object.freeze({
            hasUnescapedLatexCommandInJsonString:
                root.Qisi.SupportRepair
                    .hasUnescapedLatexCommandInJsonString,
            escapeLatexBackslashesInJsonCandidate:
                root.Qisi.SupportRepair
                    .escapeLatexBackslashesInJsonCandidate,
            tryRepairedCandidate:
                root.Qisi.SupportRepair
                    .tryRepairedCandidate
        });

        const parseStrictQuestionPayload = rawText =>
            root.Qisi.CandidateNormalizer.normalizeCandidates(
                [rawText],
                candidateNormalizerHelpers
            );

        const extractAnswerArray = (parsed) => {
            if (Array.isArray(parsed?.answers)) return parsed.answers;
            if (Array.isArray(parsed?.答案)) return parsed.答案;
            return [];
        };

        const extractSolutionArray = (parsed) => {
            if (Array.isArray(parsed?.solutions)) return parsed.solutions;
            if (Array.isArray(parsed?.解析)) return parsed.解析;
            if (Array.isArray(parsed?.analysis)) return parsed.analysis;
            return [];
        };

        const postprocessRecognizedItems = (items, sourceFile, fallbackType = '', options = {}) => {
            const allowTextResplit =
                options.allowTextResplit !== false;

            const allowSyntheticQuestionNumber =
                options.allowSyntheticQuestionNumber !== false;

            const mapped = Array.isArray(items) ? items.map((item, idx) => {
                const rawStem =
                    item.stem ??
                    item.questionText ??
                    item.question_text ??
                    item.content ??
                    item.text ??
                    item.题干 ??
                    item.题目内容 ??
                    '';

                const rawOptions = extractItemOptions(item);
                const rawOptionText = rawOptions
                    .map((opt, optIdx) => root.Qisi.Utils.cleanRecognizedText(opt) ? `${String.fromCharCode(65 + optIdx)}. ${root.Qisi.Utils.cleanRecognizedText(opt)}` : '')
                    .filter(Boolean)
                    .join('\n');
                const rawBlock = root.Qisi.Utils.cleanRecognizedText(
                    item.rawText ||
                    item.raw_text ||
                    item.rawBlock ||
                    item.sourceText ||
                    [rawStem, rawOptionText].filter(Boolean).join('\n')
                );

                const rawAnswer =
                    item.answer ??
                    item.答案 ??
                    item.correctAnswer ??
                    item.correct_answer ??
                    '';

                const rawSolution =
                    item.solution ??
                    item.analysis ??
                    item.explanation ??
                    item.解析 ??
                    item.详解 ??
                    item.解答 ??
                    '';

                const answer = normalizeAnswerForLatex(rawAnswer);
                const repaired = root.Qisi.SupportRepair.repairChoiceOptions(rawStem, rawOptions, item.type || item.题型 || fallbackType, choiceRepairDeps);
                const type = normalizeQuestionType(
                    item.type || item.题型 || fallbackType,
                    repaired.stem,
                    repaired.options,
                    answer,
                    fallbackType || getDefaultType()
                );

                const questionNumber = root.Qisi.Utils.cleanRecognizedText(
                    item.questionNumber ??
                    item.question ??
                    item.no ??
                    item.index ??
                    item.题号 ??
                    (
                        allowSyntheticQuestionNumber
                            ? String(idx + 1)
                            : ''
                    )
                );

                return {
                    question: questionNumber,
                    questionNumber,
                    stem: repaired.stem,
                    options: repaired.options,
                    answer,
                    solution: root.Qisi.Utils.cleanDisplayTextForBatchSave(rawSolution),
                    type,
                    images: normalizeInlineImageList(item.inlineImages || item.imageRefs || []),
                    recognizedImages: collectValidRecognizedFigures(item),
                    question_bbox:
                        item.question_bbox ||
                        item.questionBbox ||
                        item.bbox ||
                        item.题目区域 ||
                        [],
                    confidence: Number(item.confidence || item.score || 0.78),
                    warnings: Array.isArray(item.warnings) ? item.warnings : [],
                    sourceFileId: sourceFile.id,
                    sourceFileName: sourceFile.filename || '',
                    pageIndex: item.pageIndex || item.sourcePage || sourceFile.pageIndex || sourceFile.sourcePage || 0,
                    rawText: rawBlock || root.Qisi.Utils.cleanRecognizedText(sourceFile.pageText || sourceFile.sourceText || rawStem || ''),
                    rawBlock: rawBlock || '',
                    pageText: root.Qisi.Utils.cleanRecognizedText(sourceFile.pageText || sourceFile.sourceText || ''),
                    sourceText: root.Qisi.Utils.cleanRecognizedText(sourceFile.sourceText || sourceFile.pageText || ''),
                    recognitionRaw: item,
                    sourceTrace: {
                        sourceFileId: sourceFile.id || '',
                        sourceFileName: sourceFile.filename || '',
                        pageIndex: item.pageIndex || item.sourcePage || sourceFile.pageIndex || sourceFile.sourcePage || 0,
                        sourcePage: item.sourcePage || sourceFile.sourcePage || 0,
                        sourcePageImage: sourceFile.sourcePageImage || '',
                        rawBlock: rawBlock || '',
                        pageText: root.Qisi.Utils.cleanRecognizedText(sourceFile.pageText || sourceFile.sourceText || ''),
                        imageIds: []
                    }
                };
            }).filter(item => item.stem || item.options.some(Boolean)) : [];

            const result = allowTextResplit
                ? splitMergedRecognizedItems(mapped, sourceFile)
                : mapped;

            batchDebugLog('parsed', result.map(toBatchDebugQuestion));
            return result;
        };


        const splitMergedRecognizedItems = (items, sourceFile) => {
            const result = [];
            for (const item of items || []) {
                const combined = mergeStemWithOptions(item.stem || '', item.options || ['', '', '', ''], item.type || '解答题');
                const parsed = parseQuestionItemsFromText(combined, sourceFile, false);
                const hasManyQuestions = parsed.length > 1;
                const hasHeaderNoise = /姓名|评分|班别|本小题|基础训练|单选题|多选题/.test(combined);
                if (!hasManyQuestions && !hasHeaderNoise) {
                    result.push(item);
                    continue;
                }
                if (!parsed.length) {
                    result.push({ ...item, stem: prepareQuestionRecognitionText(item.stem || '') });
                    continue;
                }
                const imageTargets = Array.isArray(item.images) ? [...item.images] : [];
                const preferredImageIndex = parsed.findIndex(q => /图|如图|图中|图甲|图乙/.test(q.stem || ''));
                parsed.forEach((q, idx) => {
                    result.push({
                        ...item,
                        question: q.question,
                        stem: q.stem,
                        options: q.options,
                        answer: idx === 0 ? item.answer || '' : '',
                        solution: '',
                        type: normalizeQuestionType(q.type || item.type, q.stem, q.options, idx === 0 ? item.answer || '' : '', getDefaultType()),
                        images: idx === preferredImageIndex ? imageTargets : [],
                        rawText: q.rawText || item.rawText || '',
                        rawBlock: q.rawText || item.rawBlock || item.rawText || '',
                        pageText: item.pageText || item.sourceText || sourceFile.pageText || sourceFile.sourceText || '',
                        sourceText: item.sourceText || item.pageText || sourceFile.sourceText || sourceFile.pageText || '',
                        recognitionRaw: item.recognitionRaw || item,
                        sourceTrace: {
                            ...(item.sourceTrace || {}),
                            rawBlock: q.rawText || item.rawBlock || item.rawText || '',
                            pageText: item.sourceTrace?.pageText || item.pageText || item.sourceText || sourceFile.pageText || sourceFile.sourceText || '',
                            sourceFileId: item.sourceFileId || sourceFile.id || '',
                            sourceFileName: item.sourceFileName || sourceFile.filename || ''
                        },
                        warnings: [...(item.warnings || []), '系统已将整页识别结果按题号拆分，请核对题干边界。']
                    });
                });
            }
            return result;
        };



        return Object.freeze({
            prepareQuestionRecognitionText,
            splitQuestionBlocksByNumber,
            parseQuestionItemsFromText,
            extractItemOptions,
            parseStrictQuestionPayload,
            extractAnswerArray,
            extractSolutionArray,
            postprocessRecognizedItems,
            splitMergedRecognizedItems
        });
    }

    return Object.freeze({ createRecognitionStructurePolicy });
});
