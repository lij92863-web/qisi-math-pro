(function initPdfOcrSupportParser(root) {
    'use strict';

    const numberOf = value => {
        const text = String(value ?? '').replace(/[０-９]/g, char =>
            String.fromCharCode(char.charCodeAt(0) - 0xFEE0)).trim();
        return /^[1-9]\d{0,2}$/.test(text) ? String(Number(text)) : '';
    };
    const shell = value => String(value || '').trim()
        .replace(/^\$(.*)\$$/, '$1').replace(/^\\\((.*)\\\)$/, '$1')
        .replace(/^\\(?:text|textbf|mathrm)\{([^{}]*)\}$/, '$1').trim();
    const sameAnswer = (a, b) => shell(a).replace(/\s+/g, ' ') ===
        shell(b).replace(/\s+/g, ' ');

    // Separators inside braces or escaped separators do not delimit table cells.
    function splitTopLevel(text, separator) {
        const parts = [];
        let depth = 0, start = 0;
        for (let i = 0; i < text.length; i += 1) {
            if (text[i] === '\\' && text[i + 1] !== '\\') {
                i += 1;
                continue;
            }
            if (text[i] === '{') depth += 1;
            if (text[i] === '}') {
                depth -= 1;
                if (depth < 0) return null;
            }
            if (!depth && text.startsWith(separator, i)) {
                parts.push(text.slice(start, i).trim());
                i += separator.length - 1;
                start = i + 1;
            }
        }
        if (depth) return null;
        parts.push(text.slice(start).trim());
        return parts;
    }

    function tableRows(text, latex) {
        if (!latex) {
            const rows = text.split('\n').filter(line => line.trim()).map(line => {
                const row = splitTopLevel(line.trim().replace(/^\|/, '').replace(/\|$/, ''), '|');
                return row && row.every(cell => /^:?-{3,}:?$/.test(cell))
                    ? [] : row;
            });
            return rows.some(row => !row) ? null : rows.filter(row => row.length);
        }
        const inner = text.replace(/^\\begin\{(?:tabular|array)\}(?:\[[^\]]*\])?\{[^{}]*\}/, '')
            .replace(/\\end\{(?:tabular|array)\}\s*$/, '')
            .replace(/\\hline\b/g, '').trim();
        const rows = splitTopLevel(inner, '\\\\');
        return rows?.filter(Boolean).map(row => splitTopLevel(row, '&')) || null;
    }

    function readAnswerTable(text, latex, expectedIndex) {
        const rows = tableRows(text, latex);
        const summary = /题号|参考答案|答案/.test(text);
        if (!summary) return { summary: false, entries: [] };
        if (!rows?.length || rows.some(row => !row)) {
            return { summary: true, error: 'ocr-answer-table-unbalanced' };
        }
        const entries = [];
        for (let i = 0; i < rows.length; i += 2) {
            const header = rows[i]?.map(shell), answers = rows[i + 1]?.map(cell => cell.trim());
            if (!header || !answers || shell(header[0]) !== '题号' ||
                !/^(?:参考)?答案$/.test(shell(answers[0])) || header.length !== answers.length) {
                return { summary: true, error: 'ocr-answer-table-shape' };
            }
            let end = header.length;
            while (end > 1 && !header[end - 1] && !answers[end - 1]) end -= 1;
            if (end < 2) return { summary: true, error: 'ocr-answer-table-empty' };
            for (let column = 1; column < end; column += 1) {
                const question = numberOf(header[column]), answer = answers[column];
                if (!question || !answer || !expectedIndex.has(question)) {
                    return { summary: true, error: 'ocr-answer-table-cell' };
                }
                const previous = entries[entries.length - 1]?.question;
                if (previous && expectedIndex.get(question) !== expectedIndex.get(previous) + 1) {
                    return { summary: true, error: 'ocr-answer-table-sequence' };
                }
                entries.push({ question, answer, column, row: i + 1 });
            }
        }
        return { summary: true, entries };
    }

    const mathEnvironments = new Set([
        'equation', 'equation*', 'align', 'align*', 'aligned', 'alignedat',
        'gather', 'gather*', 'gathered', 'cases', 'matrix', 'pmatrix', 'bmatrix',
        'vmatrix', 'Vmatrix', 'smallmatrix', 'split', 'array'
    ]);
    function advanceMath(line, state) {
        for (let i = 0; i < line.length; i += 1) {
            if (line[i] === '\\') {
                const env = /^\\(begin|end)\{([A-Za-z*]{1,20})\}/.exec(line.slice(i, i + 40));
                if (env && mathEnvironments.has(env[2])) {
                    if (env[1] === 'begin') state.environments.push(env[2]);
                    else if (state.environments.pop() !== env[2]) state.invalid = true;
                    i += env[0].length - 1;
                    continue;
                }
                const next = line[i + 1];
                if ('(['.includes(next || '\0')) {
                    if (state.delimiter) state.invalid = true;
                    state.delimiter = next === '(' ? '\\)' : '\\]';
                } else if (')]' .includes(next || '\0')) {
                    if (state.delimiter !== '\\' + next) state.invalid = true;
                    state.delimiter = '';
                }
                i += 1;
                continue;
            }
            if (line[i] === '$') {
                const token = line[i + 1] === '$' ? '$$' : '$';
                if (!state.delimiter) state.delimiter = token;
                else if (state.delimiter === token) state.delimiter = '';
                else state.invalid = true;
                i += token.length - 1;
            }
        }
    }
    const mathOpen = state => Boolean(state.delimiter || state.environments.length);
    const labelOf = line => {
        const value = line.replace(/^\\item\s*/, '')
            .replace(/^\\(?:textbf|text)\{(【[^】]+】)\}/, '$1').trim();
        const match = /^(【\s*(答案|参考答案|分析|解析|详解|证明)\s*】|(答案|参考答案|解析|详解)\s*[:：])\s*(.*)$/.exec(value);
        return match ? {
            field: /答案/.test(match[2] || match[3]) ? 'answer' : 'solution',
            label: match[1], rest: match[4]
        } : null;
    };
    const answerLead = value => /^(?:\$|\\\(|\\\[|[A-F]{1,6}(?:[。.]?$)|[（(](?:\d+|[iv]+)[）)]\s*(?:\$|\\\(|\\\[))/i
        .test(String(value || '').trim());
    const footer = line => /^(?:答案|试卷)第\s*\d+\s*页[,，、\s]*共\s*\d+\s*页[。.]?$/.test(line);
    const structuralLine = line => /^\x60{3}(?:latex|tex|markdown)?\s*$/.test(line) ||
        /^\\(?:begin|end)\{center\}$/.test(line) ||
        /^\\(?:documentclass|usepackage|title|maketitle)\b/.test(line) ||
        /^\\(?:begin|end)\{document\}$/.test(line);

    function parsePdfSupportBlocks({
        rawTextPages = [], expectedQuestionNumbers = [], sourceFileId = ''
    } = {}) {
        const expected = expectedQuestionNumbers.map(numberOf);
        const expectedIndex = new Map(expected.map((question, index) => [question, index]));
        const warnings = [], blocks = [], tableAnswers = new Map(), sections = new Map();
        const warn = (code, detail = {}) => warnings.push({ code, ...detail });
        const invalidExpected = expected.some((question, index) => !question ||
            (index > 0 && Number(question) !== Number(expected[index - 1]) + 1)) ||
            expectedIndex.size !== expected.length;
        if (!expected.length || invalidExpected) {
            warn('ocr-support-expected-sequence-invalid');
            return finish([], []);
        }
        let current = null, previousQuestion = '', previousTableQuestion = '';
        let cutoff = expected.length, fatalTable = false, previousPage = null;
        const enums = [], math = { delimiter: '', environments: [], invalid: false };
        let mathFaultReported = false;
        const pages = rawTextPages.map((page, index) => ({
            pageIndex: Number.isInteger(page?.pageIndex) ? page.pageIndex :
                Number.isInteger(page?.pageNo) ? page.pageNo : index,
            sourceOrder: Number.isInteger(page?.sourceOrder) ? page.sourceOrder : index,
            text: typeof page === 'string' ? page : String(page?.text ?? page?.rawText ?? '')
        }));
        const trace = (page, start, end, raw) => ({
            sourceFileId, pageIndex: page.pageIndex, pageStart: page.pageIndex,
            pageEnd: page.pageIndex, sourceOrder: page.sourceOrder,
            sectionStartLine: start, sectionEndLine: end, rawBlockExcerpt: raw.slice(0, 500)
        });
        const rejectAt = (question, code) => {
            const index = expectedIndex.get(question);
            cutoff = Math.min(cutoff, index ?? (expectedIndex.get(previousQuestion) ?? -1) + 1);
            warn(code, { question });
        };
        const scanMath = line => {
            advanceMath(line, math);
            if (math.invalid && !mathFaultReported) {
                mathFaultReported = true;
                rejectAt(previousQuestion, 'ocr-support-math-unbalanced');
            }
        };
        const append = (field, text, page, lineIndex, raw) => {
            if (!current || !text) return;
            const rows = current[field];
            rows.push(text);
            current.rawLines.push(raw);
            const range = current.ranges[field];
            if (!range) current.ranges[field] = trace(page, lineIndex, lineIndex, raw);
            else {
                range.pageEnd = page.pageIndex;
                range.sectionEndLine = lineIndex;
            }
        };
        const start = (question, rest, page, lineIndex, raw, markerType) => {
            if (!expectedIndex.has(question)) {
                rejectAt(question, 'unknown-question-marker');
                current = null;
                return;
            }
            if (previousQuestion && expectedIndex.get(question) !== expectedIndex.get(previousQuestion) + 1) {
                rejectAt(question, question === previousQuestion || sections.has(question)
                    ? 'duplicate-question-marker' : Number(question) < Number(previousQuestion)
                        ? 'jump-back-question-marker' : 'missing-question-marker');
            }
            previousQuestion = question;
            current = { question, markerType, answer: [], solution: [], body: [],
                ranges: {}, rawLines: [raw], field: 'body' };
            blocks.push(current);
            if (!sections.has(question)) sections.set(question, current);
            const label = labelOf(rest);
            current.field = label?.field || (answerLead(rest) ? 'answer' : 'body');
            current.label = label?.label || (current.field === 'answer' ? '编号答案' : '');
            append(current.field, label?.rest ?? rest, page, lineIndex, raw);
        };

        for (const page of pages) {
            if (previousPage && (page.sourceOrder <= previousPage.sourceOrder ||
                page.pageIndex !== previousPage.pageIndex + 1)) {
                rejectAt(previousQuestion, 'ocr-support-page-discontinuous');
                current = null;
            }
            previousPage = page;
            const lines = page.text.replace(/\r\n?/g, '\n').split('\n');
            for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
                const raw = lines[lineIndex], line = raw.trim();
                if (!line || footer(line) || structuralLine(line)) continue;
                if (!mathOpen(math) && (/^\\begin\{(?:tabular|array)\}/.test(line) || /^\|/.test(line))) {
                    const latex = line.startsWith('\\begin'), startLine = lineIndex;
                    const table = [raw];
                    if (latex) {
                        const environment = /^\\begin\{([^}]+)\}/.exec(line)[1];
                        let depth = 0;
                        const count = value => {
                            for (const token of value.matchAll(/\\(begin|end)\{([^}]+)\}/g)) {
                                if (token[2] === environment) depth += token[1] === 'begin' ? 1 : -1;
                            }
                        };
                        count(raw);
                        while (depth > 0 && lineIndex + 1 < lines.length) {
                            table.push(lines[++lineIndex]);
                            count(lines[lineIndex]);
                        }
                        if (depth !== 0) {
                            fatalTable = true;
                            warn('ocr-table-unclosed', { pageIndex: page.pageIndex });
                        }
                    } else {
                        while (lineIndex + 1 < lines.length && /^\s*\|/.test(lines[lineIndex + 1])) {
                            table.push(lines[++lineIndex]);
                        }
                    }
                    const rawTable = table.join('\n');
                    const parsed = readAnswerTable(rawTable.trim(), latex, expectedIndex);
                    if (parsed.summary) {
                        if (parsed.error) { fatalTable = true; warn(parsed.error); continue; }
                        for (const entry of parsed.entries) {
                            if (previousTableQuestion &&
                                expectedIndex.get(entry.question) !== expectedIndex.get(previousTableQuestion) + 1) {
                                fatalTable = true;
                                warn('ocr-answer-table-sequence');
                            }
                            previousTableQuestion = entry.question;
                            tableAnswers.set(entry.question, { ...entry, trace:
                                trace(page, startLine, lineIndex, rawTable) });
                        }
                    } else {
                        append(current?.field || 'body', rawTable, page, startLine, rawTable);
                    }
                    continue;
                }
                if (!mathOpen(math)) {
                    const begin = /^\\begin\{(enumerate|itemize)\}(?:\[(.*?)\])?/.exec(line);
                    if (begin) {
                        const explicitStart = /(?:^|,)\s*start=(\d+)/.exec(begin[2] || '');
                        enums.push({ type: begin[1], next: Number(explicitStart?.[1] || 1) });
                        continue;
                    }
                    if (/^\\end\{(?:enumerate|itemize)\}/.test(line)) { enums.pop(); continue; }
                    let head = /^\\item\s*\[\s*([1-9]\d{0,2})[.、]?\s*\]\s*(.*)$/.exec(line) ||
                        /^(?:第\s*([1-9]\d{0,2})\s*题|([1-9]\d{0,2})[.、]\s+)\s*(.*)$/.exec(line);
                    let question = head ? numberOf(head[1] || head[2]) : '';
                    let rest = head ? head[3] ?? head[2] ?? '' : '';
                    const implicit = /^\\item\s+([A-F]{1,6})[。.]?\s*$/.exec(line);
                    if (!head && implicit && enums.length === 1 && enums.at(-1)?.type === 'enumerate') {
                        const candidate = String(enums.at(-1).next++);
                        if (tableAnswers.has(candidate) && sameAnswer(tableAnswers.get(candidate).answer, implicit[1])) {
                            question = candidate;
                            rest = implicit[1];
                        } else {
                            rejectAt(candidate, 'ocr-enumeration-unverified');
                            current = null;
                        }
                    }
                    if (question && enums.length <= 1 && enums.at(-1)?.type !== 'itemize') {
                        if (rest && !labelOf(rest) && !answerLead(rest)) {
                            rejectAt(question, 'ocr-numbered-head-unclassified');
                            current = null;
                            scanMath(line);
                            continue;
                        }
                        start(question, rest, page, lineIndex, raw, implicit ? 'table-confirmed-enumerate' : 'explicit-marker');
                        scanMath(line);
                        continue;
                    }
                    const label = labelOf(line);
                    if (label && current) {
                        current.field = label.field;
                        current.label = label.label;
                        append(label.field, label.rest, page, lineIndex, raw);
                        scanMath(line);
                        continue;
                    }
                    if (current?.field === 'body' && !current.body.length && answerLead(line)) current.field = 'answer';
                }
                append(current?.field || 'body', line.replace(/^\\item\s*/, ''), page, lineIndex, raw);
                scanMath(line);
            }
        }
        if (mathOpen(math) || math.invalid) {
            rejectAt(previousQuestion, 'ocr-support-math-unbalanced');
        }
        if (fatalTable) return finish([], []);
        const answers = [], solutions = [];
        for (const question of expected) {
            if (expectedIndex.get(question) >= cutoff) break;
            const block = sections.get(question), table = tableAnswers.get(question);
            const numberedAnswer = block?.answer.join('\n').trim() || '';
            if (table && numberedAnswer && !sameAnswer(table.answer, numberedAnswer)) {
                rejectAt(question, 'ocr-answer-evidence-conflict');
                break;
            }
            const makeItem = (field, text, range, marker) => ({
                question, [field]: text, sourceFileId,
                evidenceId: sourceFileId + ':ocr:' + range.pageIndex + ':' +
                    range.sectionStartLine + ':' + question + ':' + field,
                sourceTrace: { ...range, questionNumber: question,
                    markerType: marker, rawBlockExcerpt:
                        (field === 'answer' && table ? table.trace.rawBlockExcerpt :
                            block.rawLines.join('\n').slice(0, 500)) },
                evidence: { questionMarker: true, labelMarker: true,
                    label: field === 'answer' ? table ? '答案表' : '编号答案' : '解析',
                    evidenceLevel: 'explicit-marker' },
                warnings: []
            });
            const answer = table?.answer || numberedAnswer;
            if (answer) {
                const item = makeItem('answer', answer, table?.trace || block.ranges.answer,
                    table ? 'answer-table-cell' : block.markerType);
                if (table) item.sourceTrace.tableCell = { row: table.row, column: table.column };
                if (table && numberedAnswer) item.corroboratingSourceTrace = block.ranges.answer;
                answers.push(item);
            }
            const solution = block?.solution.join('\n').trim() || '';
            if (solution && !/^(?:略|见解析|证明见解析|未填写|暂无)[。.]?$/.test(solution)) {
                solutions.push(makeItem('solution', solution, block.ranges.solution, block.markerType));
            }
        }
        return finish(answers, solutions);

        function finish(answerItems, solutionItems) {
            const answerNumbers = new Set(answerItems.map(item => item.question));
            const solutionNumbers = new Set(solutionItems.map(item => item.question));
            return { answerItems, solutionItems, blocks, warnings,
                coverageReport: {
                    expectedQuestionNumbers: expected,
                    answerQuestionNumbers: answerItems.map(item => item.question),
                    solutionQuestionNumbers: solutionItems.map(item => item.question),
                    missingAnswers: expected.filter(q => !answerNumbers.has(q)),
                    missingSolutions: expected.filter(q => !solutionNumbers.has(q))
                },
                sequenceReport: { questionNumbers: blocks.map(block => block.question),
                    strictlyIncreasing: !warnings.some(w => /sequence|marker|conflict/.test(w.code)) }
            };
        }
    }
    const api = Object.freeze({ parsePdfSupportBlocks });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.Qisi = root.Qisi || {};
        root.Qisi.PdfOcrSupportParser = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
