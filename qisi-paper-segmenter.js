(function initPaperSegmenter(root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.PaperSegmenter = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Identity is the printed number, joined by key — the same rule the PDF chain
    // already uses for support alignment, applied to layout blocks. The segmenter
    // never invents a question: any deviation (duplicate, gap, out-of-range, or a
    // number that does not advance) fails the whole segmentation so the caller can
    // fail closed instead of shipping a paper with a misplaced solution.

    const NUMBER_START = /^\s*(?:#{1,6}\s*)?(\d{1,2})\s*[.、．]\s*/;
    // A parser sometimes glues the next question's marker onto the previous block
    // ("…米.\n16. (1) 1/5"). Splitting there is not a guess: the marker is printed
    // on its own line, and it is only split when that number is one the paper is
    // known to contain and has not been seen yet.
    const NUMBER_INLINE = /(^|\n)[ \t]*(?:#{1,6}[ \t]*)?(\d{1,2})[ \t]*[.、．][ \t]*/g;
    const SOLUTION_HEAD = /^\s*(?:#{1,6}\s*)?(\d{1,2})\s*[.、．]\s*([A-D]{1,4})\s*$/;

    const textOf = block => String(block && block.text == null ? '' : block.text);

    const numberOnBlock = block => {
        if (String(block && block.type) !== 'text') return null;
        const match = textOf(block).match(NUMBER_START);
        if (!match) return null;
        const value = Number(match[1]);
        return Number.isSafeInteger(value) && value > 0 ? match[1] : null;
    };

    // Only invoked when the caller knows which numbers the paper contains, so a
    // numbered list inside a solution is never mistaken for a question boundary.
    const expandGluedMarkers = (blocks, numbers) => {
        const expected = new Set((numbers || []).map(String));
        const seen = new Set();
        const out = [];
        for (const block of blocks) {
            const text = textOf(block);
            if (String(block && block.type) !== 'text') { out.push(block); continue; }
            const head = numberOnBlock(block);
            if (head) seen.add(head);
            const cuts = [];
            if (text.includes('\n')) {
                for (const match of text.matchAll(NUMBER_INLINE)) {
                    const at = match.index + (match[1] ? match[1].length : 0);
                    const no = match[2];
                    if (at === 0 || !expected.has(no) || seen.has(no) || cuts.some(cut => cut.no === no)) continue;
                    cuts.push({ at, no });
                }
            }
            if (!cuts.length) { out.push(block); continue; }
            let start = 0;
            cuts.forEach((cut, index) => {
                out.push({ ...block, id: block.id + '#' + index, text: text.slice(start, cut.at).trim() });
                seen.add(cut.no);
                start = cut.at;
            });
            out.push({ ...block, id: block.id + '#' + cuts.length, text: text.slice(start).trim() });
        }
        return out;
    };

    // Split a contiguous block range into runs keyed by printed number. Paragraphs
    // before the first number (title, section heading, page furniture) go to the
    // preamble and never become a question.
    const segment = (blocks, { numbers = null } = {}) => {
        const issues = [];
        const runs = [];
        const preamble = [];
        let current = null;
        const source = Array.isArray(numbers) && numbers.length ? expandGluedMarkers(blocks, numbers) : blocks;
        for (const block of source) {
            const number = numberOnBlock(block);
            if (number) {
                if (current) runs.push(current);
                current = { no: number, blocks: [block], marker: textOf(block) };
                continue;
            }
            if (current) current.blocks.push(block);
            else preamble.push(block);
        }
        if (current) runs.push(current);

        const seen = new Map();
        for (const run of runs) {
            if (seen.has(run.no)) issues.push({ code: 'duplicate-number', no: run.no, at: seen.get(run.no) });
            else seen.set(run.no, run.no);
        }

        let expected = Array.isArray(numbers) && numbers.length
            ? numbers.map(String)
            : runs.map(run => run.no);
        for (let index = 0; index < expected.length; index += 1) {
            if (!seen.has(expected[index])) issues.push({ code: 'missing-number', no: expected[index], index });
        }

        // The numbers must advance strictly, in the order the paper prints them.
        for (let index = 1; index < runs.length; index += 1) {
            if (Number(runs[index].no) <= Number(runs[index - 1].no)) issues.push({ code: 'number-not-increasing', no: runs[index].no, after: runs[index - 1].no });
        }

        for (const run of runs) {
            if (!expected.includes(run.no)) issues.push({ code: 'unexpected-number', no: run.no });
        }

        return { runs, preamble, issues, order: runs.map(run => run.no), expected };
    };

    // A question owns the figures that sit inside its own block range, in reading
    // order. This is positional, not semantic: no model, no guessing.
    const figureOf = run => run.blocks.filter(block => ['image', 'chart'].includes(String(block && block.type)));
    const tableOf = run => run.blocks.filter(block => String(block && block.type) === 'table');

    const answerStatedInSolution = run => {
        const head = textOf(run.blocks[0]).match(SOLUTION_HEAD);
        return head ? head[2] : null;
    };

    // Build one draft-shaped record per question. `answerTable` (parsed by the
    // caller from the printed answer table) always wins over the model or the
    // solution text, because that table is the paper's own verdict.
    const assemble = ({ questionSegment, solutionSegment, answerTable = null, types = {} }) => {
        const issues = [];
        const solutions = new Map((solutionSegment ? solutionSegment.runs : []).map(run => [run.no, run]));
        const questions = (questionSegment ? questionSegment.runs : []).map(run => {
            const solution = solutions.get(run.no) || null;
            const stated = solution ? answerStatedInSolution(solution) : null;
            const fromTable = answerTable ? (answerTable[run.no] ?? null) : null;
            if (answerTable && stated && fromTable && String(stated) !== String(fromTable)) {
                issues.push({ code: 'answer-table-conflict', no: run.no, table: fromTable, solution: stated });
            }
            if (!solution) issues.push({ code: 'solution-missing', no: run.no });
            return {
                questionNo: run.no,
                type: types[run.no] || null,
                stemBlocks: run.blocks.filter(block => !['image', 'chart'].includes(String(block && block.type))).map(block => block.id),
                figureBlocks: figureOf(run).map(block => block.id),
                tableBlocks: tableOf(run).map(block => block.id),
                answer: fromTable != null ? String(fromTable) : (stated || ''),
                answerSource: fromTable != null ? 'answer-table' : (stated ? 'solution-head' : 'none'),
                solutionBlocks: solution ? solution.blocks.map(block => block.id) : []
            };
        });
        return { questions, issues };
    };

    return Object.freeze({ NUMBER_START, SOLUTION_HEAD, segment, assemble, numberOnBlock, answerStatedInSolution, figureOf, tableOf });
});
