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

            const existingValue = root.Qisi.Utils.cleanRecognizedText(list[existingIndex][valueKey]);

            // 完全相同的内容：正常的重复印刷，去重即可。
            if (existingValue === value) return;

            // 同一个题号出现两段不同内容。旧逻辑「保留更长的那段」是在用长度
            // 猜哪条对 —— 题号印错时会挂错答案。
            // 三条路都试过了，各有利弊：
            //   清空字段 → 老师以为源文件本来就没有，静默丢数据；
            //   抛错拒整份 → 解析切分不可靠时会误杀完全正常的文件；
            // 所以这里选：保留先出现的一条（行为确定、不猜），并在 warnings
            // 里留下痕迹，让上层有机会提示「第 N 题的题号可能印重了」。
            list[existingIndex] = {
                ...list[existingIndex],
                warnings: [
                    ...(Array.isArray(list[existingIndex].warnings)
                        ? list[existingIndex].warnings
                        : []),
                    `duplicate-${valueKey}:题号 ${question} 出现了两条不同的${valueKey === 'answer' ? '答案' : '解析'}，已保留先出现的一条`
                ]
            };
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
            // 结构化表格已经定过的题号，后面按位置猜的 pairRegex 不许再解析一遍，
            // 否则「答案：A 2 C 4」会被读成「2 的答案是 C」。
            const tableNumbers = new Set();

            if (qLine && aLine) {
                const questionCells = qLine.replace(/^题号\s*[:：]?/, '').trim().split(/[\s|,，、]+/);
                const answerCells = aLine.replace(/^答案\s*[:：]?/, '').trim()
                    .replace(/[Ａ-Ｈ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248));
                const qs = questionCells.map(value => /^[0-9０-９]+$/.test(value)
                    ? String(Number(value.replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248)))) : '');
                // 一个格子就是一个答案。多选题的 "AB" 是一个答案，不能拆成 A、B 两格；
                // 填空题的答案就是 2、3/2、√3 这类数值，不能只认字母。
                // 旧逻辑按单字符拆且只收 A-F，会让「题号 1-4 / 答案 A 2 C 4」整表作废。
                const cells = answerCells.split(/[\s|,，、]+/).filter(Boolean).map(v => v.toUpperCase());
                const chars = answerCells.replace(/[\s|,，、]+/g, '').split('');
                const as = cells.length === qs.length ? cells : (chars.every(ch => /^[A-H]$/.test(ch)) ? chars : []);
                // A complete explicit label row is the only positional summary accepted.
                if (qs.length !== as.length || qs.some(q => !Number.isSafeInteger(Number(q)) || Number(q) < 1) ||
                    qs.some((q, i) => i > 0 && Number(q) <= Number(qs[i - 1])) ||
                    !as.every(a => a && a.length <= 12)) return [];
                qs.forEach((q, idx) => {
                    tableNumbers.add(normalizeQuestionKey(q));
                    addAnswer(q, as[idx], null);
                });
            }

            // 边界类必须包含冒号：「答案：1.A 2.B」里 1.A 紧贴在标签后面，
            // 旧边界不含冒号就匹配不到第 1 题，首题答案静默缺失。
            const pairRegex = /(?:^|[\n\s，,；;、:：])(?:第\s*)?([0-9０-９]{1,3})(?:\s*题)?\s*[\.:：、．\)）]?\s*(?:【答案】|参考答案[:：]|答案[:：])?\s*([A-DＡ-Ｄ]{1,4})(?=$|[\s，,；;。])/g;

            answerPart.replace(pairRegex, (_, q, answer) => {
                if (tableNumbers.has(normalizeQuestionKey(q))) return '';
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

            // 标记后面紧跟着【答案】/【解析】这类标签 → 大概率是真正的题目起点。
            // 解析正文里的分步叙述「2. 分两种情况讨论」后面跟的是普通文字。
            // 这是把两者区分开的关键信号：同一个题号出现两次时，
            // 带标签的那个才是题目的真正起点，另一个只是上一题解析的一部分。
            const labelAheadPattern = new RegExp(
                '^[\\s\\n]{0,80}(?:【(?:答案|参考答案|解析|详解|解答|分析)】|(?:参考答案|答案|解析|详解|解答过程|解答|分析)\\s*[:：])'
            );

            const candidates = [];
            let match;

            while ((match = markerRegex.exec(source)) !== null) {
                candidates.push({
                    question: normalizeQuestionKey(match[2]),
                    start: match.index + match[1].length,
                    contentStart: markerRegex.lastIndex,
                    hasLabel: labelAheadPattern.test(
                        source.slice(markerRegex.lastIndex, markerRegex.lastIndex + 200)
                    )
                });
            }

            if (!candidates.length) return [];

            const chosen = new Map();
            for (const candidate of candidates) {
                const previous = chosen.get(candidate.question);
                if (!previous || (candidate.hasLabel && !previous.hasLabel)) {
                    chosen.set(candidate.question, candidate);
                }
            }
            const marks = [...chosen.values()].sort((a, b) => a.start - b.start);

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
