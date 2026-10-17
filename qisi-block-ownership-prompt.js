(function initBlockOwnershipPrompt(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.BlockOwnershipPrompt = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    // The model's only job in this architecture is to say which block belongs to
    // which field of which question. It never rewrites text: the text already
    // exists in the parsed blocks, so a model that mistypes a formula cannot
    // corrupt the paper. That is why this prompt forbids any prose output.

    const SYSTEM = [
        '你是试卷结构标注器，不是排版器。',
        '输入是一份试卷解析出的块清单（每个块有唯一 id、页码、类型、文本）。',
        '你的唯一任务是：为每道题指出它用了哪些块，用于题干、选项、答案、解析、配图。',
        '',
        '铁律：',
        '1. 只输出块 id，绝不抄写、改写、翻译、补全任何正文。',
        '2. 不得发明 id：只能用输入里出现过的 id。找不到就留空数组，并在 issues 里说明。',
        '3. 不得把两块内容"合并成一句"，也不得推断原文没写的公式。',
        '4. 图片块（kind=image/chart）只能放进 figures，不能放进 stem/options 文本数组。',
        '5. 表格块（kind=table）可以放进 stem 或 solution（例如列联表、杨辉三角）。',
        '6. 同一题的同一字段内不得重复同一个 id。',
        '7. 题号必须使用原文印刷的题号（阿拉伯数字字符串）。原文没印题号的块放进 unassigned。',
        '',
        '只输出 JSON，不要任何解释文字。'
    ].join('\n');

    const SCHEMA_SAMPLE = {
        protocol: 'block-ownership-v1',
        questions: [{
            question_no: '1',
            type: 'single_choice',
            stem: ['p1b5'],
            options: { A: ['p1b5'], B: ['p1b5'], C: ['p1b5'], D: ['p1b5'] },
            answer: [],
            solution: [],
            figures: ['p1b6'],
            issues: []
        }],
        unassigned: [{ blocks: ['p9b9'], reason: '没有印刷题号' }]
    };

    // Two independent phases, because ownership is local even though the paper is
    // not: a question's stem, options and figures always live on the question
    // pages, while its answer and solution always live on the answer pages. Each
    // phase is therefore a set of small parallel windows instead of one request
    // over the whole document (which measured 66.7 s and could not be split).
    const PHASES = Object.freeze({
        QUESTIONS: 'questions',
        SOLUTIONS: 'solutions'
    });

    const QUESTION_KINDS = new Set(['text', 'equation', 'table', 'image', 'chart']);
    const SOLUTION_MARKER = /(【\s*(?:答案|详解|分析|解析|点睛)\s*】|^\s*\(?\d{1,2}[\.、\)]|^\s*[（(]\s*\d{1,2}\s*[）)]\s*[（(]\s*[iⅠ]\s*[）)])/m;

    const kindOf = block => String(block && block.type || '');

    // Page windows over the blocks of one phase, in page order, never splitting a
    // page. A window is the unit of one model request.
    const planWindows = (blocks, { pagesPerWindow = 4 } = {}) => {
        const size = Math.max(1, Math.min(8, Number(pagesPerWindow) || 4));
        const byPage = new Map();
        for (const block of blocks) {
            const page = Number(block.page);
            if (!Number.isSafeInteger(page)) continue;
            if (!byPage.has(page)) byPage.set(page, []);
            byPage.get(page).push(block);
        }
        const pages = [...byPage.keys()].sort((a, b) => a - b);
        const windows = [];
        for (let index = 0; index < pages.length; index += size) {
            const slice = pages.slice(index, index + size);
            windows.push({
                pages: slice,
                blocks: slice.flatMap(page => byPage.get(page))
            });
        }
        return windows;
    };

    // §2 of the protocol: ids, pages, kinds and text only. Image and chart blocks
    // travel as placeholders because the model may never read pixels or bytes here.
    const buildPayload = ({ blocks, answerTable = null, questionNumbers = [], phase, pages = [] }) => ({
        phase,
        pages,
        answer_table: answerTable,
        expected_question_numbers: questionNumbers,
        blocks: (blocks || []).map(block => {
            const kind = kindOf(block);
            if (kind === 'image' || kind === 'chart') return { id: block.id, p: block.page, kind, alt: '图' };
            return { id: block.id, p: block.page, kind, text: String(block.text == null ? '' : block.text) };
        })
    });

    const buildPrompt = payload => [
        'phase: ' + payload.phase,
        'pages: ' + JSON.stringify(payload.pages),
        'expected_question_numbers: ' + JSON.stringify(payload.expected_question_numbers),
        'answer_table: ' + JSON.stringify(payload.answer_table),
        '',
        'blocks_json:',
        JSON.stringify(payload.blocks),
        '',
        '输出骨架（只替换内容，不要增删字段）：',
        JSON.stringify(SCHEMA_SAMPLE),
        '',
        payload.phase === PHASES.QUESTIONS
            ? '本阶段只填 stem / options / figures；answer 与 solution 留空数组。'
            : '本阶段只填 answer / solution；stem 与 options 留空对象或空数组，figures 留空数组。'
    ].join('\n');

    const parseOutput = text => {
        const raw = String(text || '').trim();
        if (!raw) return { ok: false, reason: 'empty' };
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
        try {
            const value = JSON.parse(cleaned);
            if (!value || typeof value !== 'object' || !Array.isArray(value.questions)) return { ok: false, reason: 'shape' };
            if (value.protocol && value.protocol !== 'block-ownership-v1') return { ok: false, reason: 'protocol' };
            return { ok: true, value };
        } catch (error) {
            return { ok: false, reason: 'json', message: error.message };
        }
    };

    return Object.freeze({
        SYSTEM,
        SCHEMA_SAMPLE,
        PHASES,
        planWindows,
        buildPayload,
        buildPrompt,
        parseOutput,
        SOLUTION_MARKER
    });
});
