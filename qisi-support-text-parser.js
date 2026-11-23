(function initSupportTextParser(root, factory) {
    const evidence = root?.Qisi?.SupportEvidence || (typeof module !== 'undefined' && module.exports
        ? require('./qisi-support-evidence.js') : null);
    const api = factory(root, evidence);
    root.Qisi = root.Qisi || {};
    root.Qisi.SupportTextParser = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root, evidence) {
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


        const pushUniqueQuestionItem = (list, item, field) => {
            const question = normalizeQuestionKey(item.question);
            const value = root.Qisi.Utils.cleanRecognizedText(item[field]);
            if (!question || (!value && !item.evidence)) return;
            const index = list.findIndex(row => normalizeQuestionKey(row.question) === question);
            const existing = index >= 0 ? list[index] : null;
            const state = evidence.aggregate(existing?.evidence,
                item.evidence?.declarations || [{ value, sourceId: item.sourceFileId,
                    sourceName: item.sourceFileName, range: item.range,
                    evidenceRef: item.evidenceRef }],
                { blocked: item.evidence?.state === 'conflict' });
            const row = { ...existing, ...item, question, [field]: state.value, evidence: state,
                warnings: state.state === 'conflict' ? [{
                    code: 'DOCX_SUPPORT_DUPLICATE_QUESTION', field, question,
                    message: `题号 ${question} 的${field === 'answer' ? '答案' : '解析'}${
                        state.values.length > 1 || state.declarations.length > 1
                            ? '证据不唯一' : '边界或归属不明确'
                    }，已留空待人工确认。`,
                    values: state.values
                }] : [] };
            if (state.state === 'conflict') row.conflictValues = state.values;
            if (index < 0) list.push(row); else list[index] = row;
        };

        const collectConflicts = (...lists) => lists.flatMap(list => list
            .filter(row => row.evidence?.state === 'conflict')
            .map(row => ({ question: row.question,
                field: Object.hasOwn(row, 'answer') ? 'answer' : 'solution',
                values: row.evidence.values, evidence: row.evidence })));

        const parseAnswerItemsFromText = (text, sourceFile) => {
            const source = root.Qisi.Utils.normalizeAnswerSolutionSource(text);
            const { answerPart } = root.Qisi.Utils.splitAnswerSolutionSections(source);
            const answers = [];

            const addAnswer = (question, answer, confidence = 0.86, range = null) => {
                const normalized = normalizeAnswerValue(answer);
                if (!normalized) return;

                pushUniqueQuestionItem(answers, {
                    question,
                    answer: normalized,
                    range, evidenceRef: 'normalized-answer-section',
                    confidence,
                    warnings: [],
                    sourceFileId: sourceFile.id,
                    sourceFileName: sourceFile.filename
                }, 'answer');
            };

            const lines = [...answerPart.matchAll(/[^\n]+/g)].map(match => ({
                text: match[0].trim(), start: match.index, end: match.index + match[0].length
            })).filter(line => line.text);
            // 已消费的表格行不参与二次提取；行外同号声明仍是独立证据。
            const tableRanges = [];

            for (let index = 0; index + 1 < lines.length; index++) {
                const header = lines[index], row = lines[index + 1];
                if (!/^题号/.test(header.text) || !/^答案/.test(row.text)) continue;
                const qLine = header.text, aLine = row.text;
                tableRanges.push([header.start, header.end], [row.start, row.end]);
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
                    !as.every(a => a && a.length <= 12)) continue;
                qs.forEach((q, idx) => {
                    addAnswer(q, as[idx], null, [row.start, row.end]);
                });
            }

            // 边界类必须包含冒号：「答案：1.A 2.B」里 1.A 紧贴在标签后面，
            // 旧边界不含冒号就匹配不到第 1 题，首题答案静默缺失。
            const pairRegex = /(?:^|[\n\s，,；;、:：])(?:第\s*)?([0-9０-９]{1,3})(?:\s*题)?\s*[\.:：、．\)）]?\s*(?:【答案】|参考答案[:：]|答案[:：])?\s*([A-DＡ-Ｄ]{1,4})(?=$|[\s，,；;。])/g;

            answerPart.replace(pairRegex, (_, q, answer, offset) => {
                if (tableRanges.some(([start, end]) => offset >= start && offset < end)) return '';
                addAnswer(q, answer, 0.88, [offset, offset + _.length]);
                return '';
            });

            const formulaAnswerRegex = new RegExp(
                `(?:^|\\n)\\s*(?:第\\s*)?([0-9０-９]{1,3})(?:\\s*题)?[\\.:：、．\\)）]?\\s*${answerSolutionLabelPattern}\\s*([^\\n]{1,120})`,
                'g'
            );

            answerPart.replace(formulaAnswerRegex, (_, q, answer, offset) => {
                addAnswer(q, answer, 0.86, [offset, offset + _.length]);
                return '';
            });

            return answers;
        };

        const parseNumberedSolutionBlocks = (section, sourceFile) => {
            const source = root.Qisi.Utils.normalizeAnswerSolutionSource(section);

            const markerRegex = /(^|\n)\s*(?:第\s*)?([0-9０-９]{1,3})(?:\s*题)?[\.:：、．\)）]\s*/g;

            // A question marker plus an explicit field label is a structural anchor.
            // Bare numbered lines do not establish a new question boundary.
            const labelAheadPattern = new RegExp(`^\\s*((?:\\[\\[IMAGE:[A-Za-z0-9_.:-]+\\]\\]\\s*)*)(?:${answerSolutionLabelPattern}|${solutionLabelPattern})`);

            const candidates = [];
            let match;

            while ((match = markerRegex.exec(source)) !== null) {
                // A DOCX drawing can occur between its printed number and label.
                // Only complete image tokens may intervene; text and math do not
                // establish a boundary. Keep those figures with their own block.
                const anchor = source.slice(markerRegex.lastIndex).match(labelAheadPattern);
                candidates.push({
                    question: normalizeQuestionKey(match[2]),
                    start: match.index + match[1].length,
                    contentStart: markerRegex.lastIndex,
                    hasLabel: Boolean(anchor),
                    leadingImages: anchor?.[1]?.trim() || ''
                });
            }

            if (!candidates.length) return [];

            // Explicit labels are structural anchors. Bare numeric lines inside
            // their ranges remain text, even when their numbers match later questions.
            const marks = candidates.filter(candidate => candidate.hasLabel);
            const solutions = [];
            if (!marks.length) {
                // Text alone cannot distinguish "question 2" from "step 2".
                // Retain the complete range as rejected evidence, never manufacture
                // a solution attachment from an ascending numeric sequence.
                for (const mark of candidates) {
                    pushUniqueQuestionItem(solutions, {
                        question: mark.question, solution: '',
                        evidence: evidence.aggregate(null, [{ value: source,
                            sourceId: sourceFile.id, sourceName: sourceFile.filename,
                            range: [0, source.length], evidenceRef: 'unresolved-solution-boundary' }], { blocked: true }),
                        sourceFileId: sourceFile.id, sourceFileName: sourceFile.filename
                    }, 'solution');
                }
                return solutions;
            }
            marks.forEach((mark, index) => {
                const end = marks[index + 1]?.start || source.length;
                const block = source.slice(mark.contentStart, end);
                const label = block.match(new RegExp(`${solutionLabelPattern}\\s*`, 'i'));
                if (!label) return;
                const start = mark.contentStart + label.index + label[0].length;
                const value = root.Qisi.Utils.cleanDisplayTextForBatchSave(
                    stripQuestionSectionNoise([mark.leadingImages, source.slice(start, end).trim()]
                        .filter(Boolean).join('\n')));
                if (!value) return;
                pushUniqueQuestionItem(solutions, {
                    question: mark.question, solution: value,
                    imageRefs: extractGraphicRefs(value), confidence: 0.86,
                    range: [mark.leadingImages ? mark.contentStart : start, end], evidenceRef: 'normalized-support-solution',
                    sourceFileId: sourceFile.id, sourceFileName: sourceFile.filename
                }, 'solution');
            });

            return solutions;
        };

        const parseInlineAnswerBlocks = (text, sourceFile) => {
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

            marks.forEach((mark, idx) => {
                const block = source.slice(
                    mark.contentStart,
                    marks[idx + 1]?.start || source.length
                ).trim();

                if (!block) return;

                const solutionMatch = block.match(new RegExp(`${solutionLabelPattern}\\s*([\\s\\S]*)$`, 'i'));

                let answerBlock = block;

                if (solutionMatch) {
                    answerBlock = block.slice(0, solutionMatch.index).trim();
                }

                const answerMatch = answerBlock.match(new RegExp(`${answerSolutionLabelPattern}\\s*([\\s\\S]*?)$`, 'i'));
                const bareAnswerMatch = answerBlock.match(/^\s*([A-DＡ-Ｄ]{1,4})\b/);

                const answer = normalizeAnswerValue(answerMatch?.[1] || bareAnswerMatch?.[1] || '');

                if (answer) {
                    pushUniqueQuestionItem(answers, {
                        question: mark.question,
                        answer,
                        range: [mark.contentStart, marks[idx + 1]?.start || source.length],
                        evidenceRef: 'normalized-support-answer',
                        confidence: 0.88,
                        warnings: [],
                        sourceFileId: sourceFile.id,
                        sourceFileName: sourceFile.filename
                    }, 'answer');
                }

            });

            return answers;
        };

        const parseSolutionItemsFromText = (text, sourceFile) => {
            const source = root.Qisi.Utils.normalizeAnswerSolutionSource(text);
            // Interleaved labelled rows retain their question anchors; a standalone
            // solution section may carry unresolved boundaries requiring review.
            if (new RegExp(solutionLabelPattern).test(source)) {
                return parseNumberedSolutionBlocks(source, sourceFile);
            }
            return [];
        };

        const parseStructuredSupport = sourceFile => {
            const groups = { answer: new Map(), solution: new Map() }, unmatched = [];
            sourceFile.supportBlocks.forEach((block, index) => {
                const question = normalizeQuestionKey(block.questionNumber);
                const raw = String(block.text || '');
                const blockId = block.blockId || `block-${index}`;
                if (block.kind === 'answer-table') {
                    const allowed = new Set(block.expectedNumbers);
                    for (const item of parseAnswerItemsFromText(raw, sourceFile)) {
                        if (!allowed.has(item.question)) { unmatched.push(item); continue; }
                        const group = groups.answer.get(item.question) || { declarations: [], blocked: false };
                        group.declarations.push(...item.evidence.declarations.map(row => ({ ...row,
                            evidenceRef: `docx-support-block:${blockId}:answer-table` })));
                        groups.answer.set(item.question, group);
                    }
                    return;
                }
                const rejected = block.boundaryStatus === 'rejected';
                if (rejected || !question) unmatched.push({ ...block, sourceFileId: sourceFile.id,
                    sourceFileName: sourceFile.filename, rawText: raw,
                    // The batch-level unmatched list is a display surface. Without
                    // a value it renders as an empty row, which makes a rejected
                    // boundary look like a silent field loss.
                    value: rejected ? raw : undefined });
                // Unknown source declarations do not create output identities.
                if (!question || block.expectedQuestion === false) return;
                const heading = raw.match(/^\s*(?:第\s*)?[（(]?([0-9０-９]{1,3})\s*(?:题)?[.．、:：)）]\s*/);
                const offset = heading && normalizeQuestionKey(heading[1]) === question ? heading[0].length : 0;
                const body = raw.slice(offset);
                const solutionLabel = body.match(new RegExp(solutionLabelPattern));
                const answerArea = body.slice(0, solutionLabel ? solutionLabel.index : body.length);
                const answerLabel = answerArea.match(new RegExp(answerSolutionLabelPattern));
                const parts = [...answerArea.trim().matchAll(/(?:^|\n)\s*[（(]\s*(\d{1,2})\s*[）)]/g)];
                const orderedMultipart = parts.length > 0 && parts[0].index === 0 &&
                    parts.every((part, i) => Number(part[1]) === i + 1);
                const hasUnconvertedFormula = /\[DOCX不可显示图片:/.test(answerArea);
                const multipart = orderedMultipart && !hasUnconvertedFormula;
                let answer = '';
                if (answerLabel) answer = normalizeAnswerValue(answerArea.slice(answerLabel.index + answerLabel[0].length));
                else if (block.directAnswer) answer = normalizeAnswerValue(block.directAnswer);
                else if (/^\d+$/.test(String(block.numericAnswer || ''))) answer = String(block.numericAnswer);
                else if (multipart) answer = root.Qisi.Utils.cleanDisplayTextForBatchSave(answerArea);
                else if (/^[A-DＡ-Ｄ]{1,4}\s*[。；;，,]?\s*$/.test(answerArea.trim())) answer = normalizeAnswerValue(answerArea);
                // Converted inline formula-only answers are explicit values inside
                // a producer-owned support block, never numbers from a solution.
                else if (/^(?:\s*\$[^$]+\$\s*)+$/.test(answerArea)) answer = normalizeAnswerValue(answerArea);
                // Keep a printed slash literally, without interpreting alternatives
                // or dividing formulas. Rejected duplicates only check conflicts.
                else if (block.expectedQuestion === true &&
                    (block.boundaryStatus === 'accepted' || (rejected && groups.answer.get(question)?.declarations.length > 0)) &&
                    Array.isArray(sourceFile.roles) && sourceFile.roles.some(role => ['answer', 'full'].includes(role)) &&
                    !/[\r\n]/.test(answerArea.trim()) &&
                    /^(?:\s*\$[^$]+\$\s*)+(?:\/\s*(?:\$[^$]+\$\s*)+)+$/.test(answerArea.trim())) {
                    answer = normalizeAnswerValue(answerArea);
                }
                const solution = solutionLabel ? root.Qisi.Utils.cleanDisplayTextForBatchSave(
                    stripQuestionSectionNoise(body.slice(solutionLabel.index + solutionLabel[0].length).trim())) : '';
                let answerRange = [offset, offset + answerArea.length];
                if (answerLabel && !answerArea.slice(answerLabel.index + answerLabel[0].length).trim()) {
                    const conclusion = body.match(/(?:故选|应选)\s*[:：]\s*([A-D]{1,4})[。．.]?\s*$/);
                    answer = conclusion?.[1] || '';
                    if (conclusion) answerRange = [offset + conclusion.index, raw.length];
                }
                // An unconverted formula inside the answer area prevents a safe
                // attachment, but it must not erase the answer silently. Keep the
                // raw answer range as explicit unmatched evidence for review.
                if (!answer && !rejected && hasUnconvertedFormula) {
                    unmatched.push({ ...block, questionNumber: question, field: 'answer',
                        value: answerArea.trim(), rawText: raw,
                        code: 'DOCX_SUPPORT_ANSWER_UNCONVERTED_FORMULA',
                        unresolvedReason: 'multipart-unconverted-formula',
                        sourceFileId: sourceFile.id, sourceFileName: sourceFile.filename });
                }
                for (const [field, value, start, end] of [
                    ['answer', answer, ...answerRange],
                    ['solution', solution, solutionLabel ? offset + solutionLabel.index + solutionLabel[0].length : raw.length, raw.length]
                ]) {
                    // A field with no value is not a declaration. Substituting the
                    // whole block text (the old `value || raw`) invented an answer
                    // and turned one boundary rejection into a single-declaration
                    // "conflict", which downstream admission cannot distinguish
                    // from a genuine multi-value conflict and rejects wholesale.
                    if (!value) continue;
                    const existing = groups[field].get(question);
                    // A rejected boundary only participates when the same field
                    // already has another declaration for this question: that is
                    // a real multi-value conflict. Otherwise the block stays in
                    // `unmatched` with its source range and raw text, and the
                    // field remains `missing` instead of a fake conflict.
                    if (rejected && !existing?.declarations?.length) continue;
                    const group = existing || { declarations: [], blocked: false };
                    // A duplicated boundary that repeats the same value is the
                    // same fact, not a field conflict: keep it unique so the
                    // batch stays reviewable. Only a distinct value blocks.
                    const existingValues = new Set(group.declarations
                        .map(row => String(row.value || '').trim()).filter(Boolean));
                    if (rejected && existingValues.size && !existingValues.has(value)) {
                        group.blocked = true;
                    }
                    group.declarations.push({ value, sourceId: sourceFile.id,
                        sourceName: sourceFile.filename, range: [start, end],
                        evidenceRef: `docx-support-block:${blockId}:${field}` });
                    groups[field].set(question, group);
                }
            });
            const rows = field => [...groups[field]].map(([question, group]) => {
                const state = evidence.aggregate(null, group.declarations, { blocked: group.blocked });
                return { question, [field]: state.value, evidence: state, confidence: 0.88,
                    sourceFileId: sourceFile.id, sourceFileName: sourceFile.filename,
                    ...(field === 'solution' ? { imageRefs: extractGraphicRefs(state.value) } : {}),
                    warnings: state.state === 'conflict' ? [{ code: 'DOCX_SUPPORT_BOUNDARY_CONFLICT', field, question }] : [] };
            });
            const answers = rows('answer'), solutions = rows('solution');
            return { answers, solutions, conflicts: collectConflicts(answers, solutions), unmatched };
        };

        const parseEmptySupportBlocks = (text, sourceFile) => {
            const rawText = String(text || '').trim();
            const hasContent = line => line.trim() && !/^\s*[【「]?\s*(?:参考答案|答案)\s*[】」:：]?\s*$/.test(line);
            const lines = rawText.split(/\r?\n/).filter(hasContent);
            const roles = new Set(sourceFile.roles || []);
            const expected = new Set((sourceFile.expectedQuestionNumbers || []).map(number => normalizeQuestionKey(number)));
            const unmatchedRow = (value, questionNumber) => ({
                code: 'DOCX_SUPPORT_BOUNDARY_UNRESOLVED', field: roles.has('solution') && !roles.has('answer') ? 'solution' : 'answer',
                sourceFileId: sourceFile.id, sourceFileName: sourceFile.filename,
                questionNumber, value, rawText: value
            });
            const rowPattern = new RegExp(`^\\s*([0-9０-９]{1,3})[.．、]\\s*${answerSolutionLabelPattern}\\s*(.*)$`);
            const solutionLabel = new RegExp(solutionLabelPattern);
            const rows = lines.map(line => rowPattern.exec(line));
            // Only a standalone answer list with explicit labels and known question identities
            // can recover here. An unstructured question or proof can contain similar numbering.
            if (roles.size === 1 && roles.has('answer') && expected.size && rows.length &&
                rows.every(row => row && !solutionLabel.test(row[2]))) {
                const supportBlocks = [], unmatched = [];
                for (const [index, [line, number, value]] of rows.entries()) {
                    const questionNumber = normalizeQuestionKey(number);
                    if (!expected.has(questionNumber) || /\[DOCX不可显示图片:/.test(value) || !normalizeAnswerValue(value)) {
                        unmatched.push(unmatchedRow(line, questionNumber));
                        continue;
                    }
                    supportBlocks.push({ text: line, questionNumber, expectedQuestion: true,
                        blockId: `explicit-answer-row-${index}` });
                }
                const parsed = parseStructuredSupport({ ...sourceFile, supportBlocks });
                return { ...parsed, unmatched: [...unmatched, ...parsed.unmatched] };
            }
            const unmatched = rawText ? [unmatchedRow(rawText)] : [];
            if (!unmatched.length && sourceFile.supportSectionDeclared) {
                unmatched.push({ ...unmatchedRow(''), value: '识别到参考答案标题，未找到能可靠配对的内容。' });
            }
            return { answers: [], solutions: [], conflicts: [], unmatched };
        };

        const parseAnswerAndSolutionItemsFromText = (text, sourceFile) => {
            if (Array.isArray(sourceFile.supportBlocks)) {
                return sourceFile.supportBlocks.length ? parseStructuredSupport(sourceFile) : parseEmptySupportBlocks(text, sourceFile);
            }
            const directAnswers = parseAnswerItemsFromText(text, sourceFile);
            const directSolutions = parseSolutionItemsFromText(text, sourceFile);
            const inlineAnswers = parseInlineAnswerBlocks(text, sourceFile);

            const answers = [...directAnswers];
            const solutions = [...directSolutions];

            inlineAnswers.forEach(item => pushUniqueQuestionItem(answers, item, 'answer'));


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
