(function initSupportTextParser(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.SupportTextParser = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    function createSupportTextParser(ports = {}) {
        for (const name of ["normalizeQuestionKey","stripQuestionSectionNoise","extractGraphicRefs","normalizeMathTextForLatexSafe"]) {
            if (typeof ports[name] !== 'function') {
                const error = new TypeError(
                    `Support text parser requires ${name}.`
                );
                error.code = 'SUPPORT_TEXT_PARSER_PORT_REQUIRED';
                throw error;
            }
        }

        const normalizeQuestionKey = ports.normalizeQuestionKey;
        const stripQuestionSectionNoise = ports.stripQuestionSectionNoise;
        const extractGraphicRefs = ports.extractGraphicRefs;
        const normalizeMathTextForLatexSafe = ports.normalizeMathTextForLatexSafe;

        const answerSolutionLabelPattern = '(?:【(?:答案|参考答案)】|(?:参考答案|答案)\\s*[:：])';
        const solutionLabelPattern = '(?:【(?:解析|详解|解答|分析)】|(?:解析|详解|解答过程|解答|分析|解)\\s*[:：])';

        const normalizeAnswerValue = (answer) => {
            const raw = root.Qisi.Utils.cleanRecognizedText(answer)
                .replace(new RegExp(`${solutionLabelPattern}[\\s\\S]*$`), '')
                .split(/\n/)[0]
                .replace(/[。；;，,、]+$/g, '')
                .trim();

            if (!raw) return '';

            const choice = raw
                .replace(/[Ａ-Ｄ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248))
                .replace(/[.\s、，。:：；;()（）]/g, '')
                .toUpperCase();

            if (/^[A-D]{1,4}$/.test(choice)) return choice;

            return normalizeMathTextForLatexSafe(raw);
        };


        const pushUniqueQuestionItem = (list, item, valueKey) => {
            const question = normalizeQuestionKey(item.question);
            const value = root.Qisi.Utils.cleanRecognizedText(item[valueKey]);

            if (!question || !value) return;

            const existingIndex = list.findIndex(row => normalizeQuestionKey(row.question) === question);

            if (existingIndex < 0) {
                list.push({
                    ...item,
                    question,
                    [valueKey]: value
                });
                return;
            }

            if (value.length > root.Qisi.Utils.cleanRecognizedText(list[existingIndex][valueKey]).length) {
                list[existingIndex] = {
                    ...item,
                    question,
                    [valueKey]: value
                };
            }
        };

        const parseAnswerItemsFromText = (text, sourceFile) => {
            const source = root.Qisi.Utils.normalizeAnswerSolutionSource(text);
            const { answerPart } = root.Qisi.Utils.splitAnswerSolutionSections(source);
            const answers = [];

            const addAnswer = (question, answer, confidence = 0.86) => {
                const normalized = normalizeAnswerValue(answer);
                if (!normalized) return;

                pushUniqueQuestionItem(answers, {
                    question,
                    answer: normalized,
                    confidence,
                    warnings: [],
                    sourceFileId: sourceFile.id,
                    sourceFileName: sourceFile.filename
                }, 'answer');
            };

            const lines = answerPart.split(/\n+/).map(x => x.trim()).filter(Boolean);
            const qLine = lines.find(line => /^题号/.test(line));
            const aLine = lines.find(line => /^答案/.test(line));

            if (qLine && aLine) {
                const qs = qLine.match(/[0-9０-９]{1,3}/g) || [];
                const as = aLine.match(/[A-DＡ-Ｄ]{1,4}/g) || [];

                qs.forEach((q, idx) => addAnswer(q, as[idx] || '', 0.9));
            }

            const pairRegex = /(?:^|[\n\s，,；;、])(?:第\s*)?([0-9０-９]{1,3})(?:\s*题)?\s*[\.:：、．\)）]?\s*(?:【答案】|参考答案[:：]|答案[:：])?\s*([A-DＡ-Ｄ]{1,4})(?=$|[\s，,；;。])/g;

            answerPart.replace(pairRegex, (_, q, answer) => {
                addAnswer(q, answer, 0.88);
                return '';
            });

            const formulaAnswerRegex = new RegExp(
                `(?:^|\\n)\\s*(?:第\\s*)?([0-9０-９]{1,3})(?:\\s*题)?[\\.:：、．\\)）]?\\s*${answerSolutionLabelPattern}\\s*([^\\n]{1,120})`,
                'g'
            );

            answerPart.replace(formulaAnswerRegex, (_, q, answer) => {
                addAnswer(q, answer, 0.86);
                return '';
            });

            return answers;
        };

        const parseNumberedSolutionBlocks = (section, sourceFile) => {
            const source = root.Qisi.Utils.normalizeAnswerSolutionSource(section);

            const markerRegex = /(^|\n)\s*(?:第\s*)?([0-9０-９]{1,3})(?:\s*题)?[\.:：、．\)）]\s*/g;

            const marks = [];
            let match;

            while ((match = markerRegex.exec(source)) !== null) {
                marks.push({
                    question: normalizeQuestionKey(match[2]),
                    start: match.index + match[1].length,
                    contentStart: markerRegex.lastIndex
                });
            }

            if (!marks.length) return [];

            const solutions = [];

            marks.forEach((mark, idx) => {
                let block = source.slice(
                    mark.contentStart,
                    marks[idx + 1]?.start || source.length
                ).trim();

                const inlineSolutionMatch = block.match(new RegExp(`${solutionLabelPattern}\\s*([\\s\\S]*)$`, 'i'));
                if (inlineSolutionMatch) {
                    block = inlineSolutionMatch[1].trim();
                } else {
                    block = block
                        .replace(new RegExp(`^\\s*${answerSolutionLabelPattern}\\s*[^\\n]{0,120}`), '')
                        .replace(new RegExp(`^\\s*${solutionLabelPattern}\\s*`), '')
                        .trim();
                }

                if (!block) return;

                if (/^[A-DＡ-Ｄ]{1,4}$/.test(block.replace(/\s/g, ''))) return;

                pushUniqueQuestionItem(solutions, {
                    question: mark.question,
                    solution: root.Qisi.Utils.cleanDisplayTextForBatchSave(stripQuestionSectionNoise(block)),
                    imageRefs: extractGraphicRefs ? extractGraphicRefs(block) : [],
                    confidence: 0.86,
                    warnings: [],
                    sourceFileId: sourceFile.id,
                    sourceFileName: sourceFile.filename
                }, 'solution');
            });

            return solutions;
        };

        const parseInlineAnswerSolutionBlocks = (text, sourceFile) => {
            const source = root.Qisi.Utils.normalizeAnswerSolutionSource(text);

            const markerRegex = /(^|\n)\s*(?:第\s*)?([0-9０-９]{1,3})(?:\s*题)?[\.:：、．\)）]?\s*/g;
            const marks = [];
            let match;

            while ((match = markerRegex.exec(source)) !== null) {
                marks.push({
                    question: normalizeQuestionKey(match[2]),
                    start: match.index + match[1].length,
                    contentStart: markerRegex.lastIndex
                });
            }

            const answers = [];
            const solutions = [];

            marks.forEach((mark, idx) => {
                const block = source.slice(
                    mark.contentStart,
                    marks[idx + 1]?.start || source.length
                ).trim();

                if (!block) return;

                const solutionMatch = block.match(new RegExp(`${solutionLabelPattern}\\s*([\\s\\S]*)$`, 'i'));

                let solution = '';
                let answerBlock = block;

                if (solutionMatch) {
                    solution = root.Qisi.Utils.cleanRecognizedText(solutionMatch[1]);
                    answerBlock = block.slice(0, solutionMatch.index).trim();
                }

                const answerMatch = answerBlock.match(new RegExp(`${answerSolutionLabelPattern}\\s*([\\s\\S]*?)$`, 'i'));
                const bareAnswerMatch = answerBlock.match(/^\s*([A-DＡ-Ｄ]{1,4})\b/);

                const answer = normalizeAnswerValue(answerMatch?.[1] || bareAnswerMatch?.[1] || '');

                if (answer) {
                    pushUniqueQuestionItem(answers, {
                        question: mark.question,
                        answer,
                        confidence: 0.88,
                        warnings: [],
                        sourceFileId: sourceFile.id,
                        sourceFileName: sourceFile.filename
                    }, 'answer');
                }

                if (solution) {
                    pushUniqueQuestionItem(solutions, {
                        question: mark.question,
                        solution: root.Qisi.Utils.cleanDisplayTextForBatchSave(stripQuestionSectionNoise(solution)),
                        imageRefs: extractGraphicRefs(solution),
                        confidence: 0.86,
                        warnings: [],
                        sourceFileId: sourceFile.id,
                        sourceFileName: sourceFile.filename
                    }, 'solution');
                }
            });

            return { answers, solutions };
        };

        const parseSolutionItemsFromText = (text, sourceFile) => {
            const source = root.Qisi.Utils.normalizeAnswerSolutionSource(text);
            const { solutionPart } = root.Qisi.Utils.splitAnswerSolutionSections(source);

            const fromGlobalSection = parseNumberedSolutionBlocks(solutionPart, sourceFile);
            if (fromGlobalSection.length) return fromGlobalSection;

            const inline = parseInlineAnswerSolutionBlocks(source, sourceFile);
            return inline.solutions || [];
        };

        const parseAnswerAndSolutionItemsFromText = (text, sourceFile) => {
            const directAnswers = parseAnswerItemsFromText(text, sourceFile);
            const directSolutions = parseSolutionItemsFromText(text, sourceFile);
            const inline = parseInlineAnswerSolutionBlocks(text, sourceFile);

            const answers = [...directAnswers];
            const solutions = [...directSolutions];

            (inline.answers || []).forEach(item => pushUniqueQuestionItem(answers, item, 'answer'));
            (inline.solutions || []).forEach(item => pushUniqueQuestionItem(solutions, item, 'solution'));

            return { answers, solutions };
        };


        return Object.freeze({
            parseAnswerItemsFromText,
            parseSolutionItemsFromText,
            parseAnswerAndSolutionItemsFromText
        });
    }

    return Object.freeze({ createSupportTextParser });
});
