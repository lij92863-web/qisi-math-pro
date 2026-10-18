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


        // 冲突不能靠猜：同一题号出现两段不同内容时，两个值都不采用，该题留空并标记，
        // 由审核页要求人工确认。缺答案可以接受，错挂答案不能接受。
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

            const existing = list[existingIndex];
            const existingValue = root.Qisi.Utils.cleanRecognizedText(existing[valueKey]);

            // 完全相同的内容：正常的重复印刷，去重即可。
            if (existingValue === value) return;

            // 解析会被两条路径各抽一次（编号分块 / 行内标签），抽出的文本互为子串。
            // 这是同��段内容的两次抽取，不是两条答案：保留更完整的那一份，不算冲突。
            if (valueKey === 'solution') {
                const compact = row => String(row || '').replace(/\s+/g, '');
                const left = compact(existingValue);
                const right = compact(value);
                if (left && right && (left.includes(right) || right.includes(left))) {
                    if (right.length > left.length) {
                        list[existingIndex] = { ...existing, [valueKey]: value };
                    }
                    return;
                }
            }

            // 之前清空过的题再次出现不同取值：仍然是冲突，不复活。
            const alreadyConflicted = existingValue === '';
            const seenValues = alreadyConflicted
                ? (Array.isArray(existing.conflictValues) ? existing.conflictValues : [])
                : [existingValue];

            list[existingIndex] = {
                ...existing,
                [valueKey]: '',
                conflictValues: [...seenValues, value],
                warnings: [
                    ...(Array.isArray(existing.warnings) ? existing.warnings : []),
                    {
                        code: 'DOCX_SUPPORT_DUPLICATE_QUESTION',
                        field: valueKey,
                        question,
                        message: `题号 ${question} 出现了${seenValues.length + 1}条不同的${valueKey === 'answer' ? '答案' : '解析'}，已全部留空待人工确认。`,
                        values: [...seenValues, value].map(row => String(row).slice(0, 200))
                    }
                ]
            };
        };

        // 冲突清单由行上的 warnings 汇总得出，不另设跨次调用的可变状态。
        // 多条解析路径可能各记一次同一处冲突，这里按题号+字段去重。
        const collectConflicts = (...lists) => {
            const seen = new Set();
            const rows = [];
            for (const list of lists) {
                for (const row of list || []) {
                    for (const item of Array.isArray(row?.warnings) ? row.warnings : []) {
                        if (!item || item.code !== 'DOCX_SUPPORT_DUPLICATE_QUESTION') continue;
                        const question = normalizeQuestionKey(item.question ?? row.question);
                        const key = `${question}|${item.field}`;
                        if (seen.has(key)) continue;
                        seen.add(key);
                        rows.push({
                            question,
                            field: item.field,
                            values: Array.isArray(item.values) ? item.values : []
                        });
                    }
                }
            }
            return rows;
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
            const chosenSet = new Set(chosen.values());
            // 落选的候选如果自己带标签（例如同一题号的第二条「1. 答案：C」），
            // 它不是上一题解析的一部分。把它挡在上一题块之外，
            // 否则这条重复答案会被当成解析正文混进去。
            const droppedLabeled = candidates.filter(
                candidate => !chosenSet.has(candidate) && candidate.hasLabel
            );
            // 被挡下来的重复解析行也要走到冲突通道：两个值都不采用，不静默丢掉。
            const solutions = [];
            droppedLabeled.forEach(candidate => {
                const index = candidates.indexOf(candidate);
                const end = candidates[index + 1]?.start || source.length;
                const text = source.slice(candidate.contentStart, end).trim();
                const inline = text.match(new RegExp(`${solutionLabelPattern}\\s*([\\s\\S]*)$`, 'i'));
                if (!inline) return;
                const value = root.Qisi.Utils.cleanRecognizedText(inline[1]);
                if (!value) return;
                pushUniqueQuestionItem(solutions, {
                    question: candidate.question,
                    solution: value,
                    imageRefs: extractGraphicRefs(value),
                    confidence: 0.86,
                    warnings: [],
                    sourceFileId: sourceFile.id,
                    sourceFileName: sourceFile.filename
                }, 'solution');
            });

            const marks = [...chosen.values()].sort((a, b) => a.start - b.start);

            marks.forEach((mark, idx) => {
                const nextStart = marks[idx + 1]?.start || source.length;
                const blocker = droppedLabeled.find(
                    candidate => candidate.start > mark.start && candidate.start < nextStart
                );
                let block = source.slice(
                    mark.contentStart,
                    blocker ? blocker.start : nextStart
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

            return {
                answers,
                solutions,
                conflicts: collectConflicts(answers, solutions)
            };
        };


        return Object.freeze({
            parseAnswerItemsFromText,
            parseSolutionItemsFromText,
            parseAnswerAndSolutionItemsFromText
        });
    }

    return Object.freeze({ createSupportTextParser });
});
