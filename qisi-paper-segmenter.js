(function initPaperSegmenter(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.PaperSegmenter = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    const Evidence = typeof module !== 'undefined' && module.exports ? require('./qisi-mineru-evidence.js') : root.Qisi.MineruEvidence;

    const NUMBER_START = /^\s*(?:#{1,6}\s*)?([0-9０-９]{1,3})\s*(?:[.、．](?![0-9０-９])\s*|(?=【(?:答案|解析|详解)】))/;
    const SOLUTION_HEAD = /^\s*(?:#{1,6}\s*)?([0-9０-９]{1,3})\s*[.、．]\s*([A-H]{1,8})\s*$/;
    const ANSWER_HEADING = /^\s*#{0,6}\s*(?:《[^\n]*》\s*)?(?:参考答案(?:与解析)?|答案与解析|答案|解析)\s*$/;
    const textOf = block => String(block?.text ?? '');    const canonical = value => {
        const digits = String(value).replace(/[０-９]/g, c => String(c.charCodeAt(0) - 0xff10));
        return /^\d{1,3}$/.test(digits) ? String(Number(digits)) : 'NaN';
    };

    const { maskMath, fragment } = Evidence;

    function headOf(block) {
        if (block?.type !== 'text' || block.parentId) return null;
        const match = maskMath(textOf(block)).match(NUMBER_START);
        if (!match || canonical(match[1]) === '0') return null;
        // Whitespace in the math mask must not consume the answer itself.
        const original = textOf(block).match(NUMBER_START);
        return original ? { no: canonical(match[1]), end: original[0].length } : null;
    }
    const numberOnBlock = block => headOf(block)?.no || null;

    function supportEvidence(body, following = '', internal = false) {
        if (/^\s*【(?:答案|解析|详解)】/.test(body)) return 'explicit-label';
        if (/^\s*[A-H]{1,8}(?=\s*(?:$|\n|【))/.test(body)) return 'choice-head';
        if (/^\s*[（(]\s*1\s*[)）]/.test(body)) {
            if (!internal || /[（(]\s*2\s*[)）]|【(?:分析|解析|详解)】/.test(body) ||
                /^\s*(?:[（(]\s*2\s*[)）]|【(?:分析|解析|详解)】)/.test(following)) return 'multipart-head';
        }
        const firstLine = body.split('\n')[0].trim();
        const plain = maskMath(firstLine).trim();
        if (firstLine && /^[\s\d+−\-.,，/;；=()（）]*$/.test(plain) &&
            /^\s*【(?:分析|解析|详解)】/.test(following)) return 'scalar-head';
        return null;
    }

    function reviewIndex(blocks, reviews, issues) {
        const source = new Map(blocks.map(block => [block.id, block]));
        const index = new Map();
        for (const review of reviews) {
            const block = source.get(review.blockId);
            const key = review.blockId + ':' + review.offset;
            if (!block || !review.sourceId || review.sourceId !== block.origin?.sourceId || review.text !== textOf(block) ||
                !Number.isSafeInteger(review.offset) || review.offset < 1 || review.offset >= review.text.length ||
                !NUMBER_START.test(maskMath(review.text).slice(review.offset)) ||
                !['question-start', 'nested'].includes(review.decision) || !review.evidence || index.has(key)) {
                issues.push({ code: 'invalid-boundary-review', blockId: review.blockId });
            } else index.set(key, review);
        }
        return index;
    }

    function expand(blocks, expected, issues, role, reviews) {
        const out = [];
        for (let index = 0; index < blocks.length; index++) {
            const block = blocks[index];
            if (block?.type !== 'text' || block.parentId) { out.push(block); continue; }
            const text = textOf(block);
            const masked = maskMath(text);
            const cuts = [];
            const ambiguous = new Set();
            const leadingSpace = text.match(/^\s*/)[0].length;
            const pattern = /(^|[\s。；;.!！?？])[ \t]*(?:#{1,6}[ \t]*)?([0-9０-９]{1,3})[ \t]*(?:[.、．](?![0-9０-９])[ \t]*|(?=【(?:答案|解析|详解)】))/g;
            const candidates = [...masked.matchAll(pattern)];
            for (let n = 0; n < candidates.length; n++) {
                const match = candidates[n];
                const prefixEnd = match.index + match[1].length;
                const at = prefixEnd + masked.slice(prefixEnd).match(/^[ \t]*/)[0].length;
                if (at <= leadingSpace) continue;
                const no = canonical(match[2]);
                if (no === '0') continue;
                const end = n + 1 < candidates.length ? candidates[n + 1].index : text.length;
                // Match on original text to avoid treating masked formulas as whitespace.
                const marker = text.slice(at).match(NUMBER_START);
                if (!marker) continue;
                const body = text.slice(at + marker[0].length, end);
                const evidence = supportEvidence(body, textOf(blocks[index + 1]), true);
                const review = reviews.get(block.id + ':' + at);
                if (review?.decision === 'nested') continue;
                if (review?.decision === 'question-start') cuts.push(at);
                else if (role === 'support' && evidence) {
                    cuts.push(at);
                    if (evidence === 'multipart-head') {
                        ambiguous.add(at);
                        issues.push({ code: 'ambiguous-boundary', no, blockId: block.id, offset: at });
                    }
                } else if (match[1] === '\n') {
                    if (role === 'question') cuts.push(at);
                    ambiguous.add(at);
                    issues.push({ code: 'ambiguous-boundary', no, blockId: block.id, offset: at });
                }
            }
            if (!cuts.length) { out.push(block); continue; }
            const offsets = [0, ...cuts, text.length];
            for (let n = 0; n < offsets.length - 1; n++) {
                const piece = fragment(block, offsets[n], offsets[n + 1]);
                if (ambiguous.has(offsets[n])) piece.boundaryAmbiguity = true;
                const review = reviews.get(block.id + ':' + offsets[n]);
                if (review) piece.boundaryReview = review;
                out.push(piece);
            }
        }
        return out;
    }

    function segment(blocks, { numbers = null, role = 'question', sourceRegistry = null, boundaryReviews = [] } = {}) {
        const issues = [];
        const blocksById = Object.assign(Object.create(null), sourceRegistry);
        const inputIds = new Set();
        const inputBlocks = new Set(blocks);
        for (const block of blocks) {
            if (!block.id || inputIds.has(block.id) || (Object.hasOwn(blocksById, block.id) && blocksById[block.id] !== block)) issues.push({ code: 'duplicate-block-id', blockId: block.id });
            else blocksById[block.id] = block;
            inputIds.add(block.id);
            if (block.type === 'unsupported') issues.push({ code: 'unsupported-block', blockId: block.id });
            if (block.boundaryAmbiguity) issues.push({ code: 'ambiguous-boundary', blockId: block.id });
        }
        const expectedNumbers = (numbers || []).map(canonical);
        for (const [index, no] of expectedNumbers.entries()) {
            if (!/^[1-9]\d{0,2}$/.test(no) || (index && Number(no) <= Number(expectedNumbers[index - 1]))) issues.push({ code: 'invalid-expected-sequence', no, index });
        }
        const expectedSet = new Set(expectedNumbers);
        const reviews = reviewIndex(blocks, boundaryReviews, issues);
        const source = expand(blocks, expectedSet, issues, role, reviews);
        const runs = [];
        const preamble = [];
        let current = null;
        for (const block of source) {
            if (!Object.hasOwn(blocksById, block.id)) blocksById[block.id] = block;
            else if (blocksById[block.id] !== block && !inputBlocks.has(block)) issues.push({ code: 'fragment-id-collision', blockId: block.id });
            const head = headOf(block);
            if (head) {
                current = { no: head.no, blocks: [block], marker: textOf(block) };
                runs.push(current);
            } else if (current) current.blocks.push(block);
            else preamble.push(block);
        }
        const seen = new Set();
        for (const [index, run] of runs.entries()) {
            if (seen.has(run.no)) issues.push({ code: 'duplicate-number', no: run.no });
            seen.add(run.no);
            if (index && Number(run.no) <= Number(runs[index - 1].no)) issues.push({ code: 'number-not-increasing', no: run.no, after: runs[index - 1].no });
            run.supportEvidence = supportEvidence(textOf(run.blocks[0]).slice(headOf(run.blocks[0]).end), textOf(run.blocks[1]));
            if (role === 'support' && !run.supportEvidence) issues.push({ code: 'ambiguous-support-head', no: run.no, blockId: run.blocks[0].id });
        }
        if (!numbers && runs.length) {
            const values = [...seen].map(Number);
            for (let n = Math.min(...values); n <= Math.max(...values); n++) expectedSet.add(String(n));
        }
        for (const no of expectedSet) if (!seen.has(no)) issues.push({ code: 'missing-number', no });
        for (const no of seen) if (!expectedSet.has(no)) issues.push({ code: 'unexpected-number', no });
        return { role, coverage: numbers ? 'expected-sequence' : 'observed-sequence', runs, preamble, issues, order: runs.map(run => run.no), expected: [...expectedSet], blocksById, valid: issues.length === 0 };
    }

    // A restart identifies the answer stream, but its title/table may precede
    // the first numbered answer. Keep that contiguous metadata in its preamble.
    function supportPreambleStart(blocks, markerIndex, previousMarker) {
        let start = markerIndex;
        while (start > previousMarker + 1) {
            let at = start - 1;
            while (at > previousMarker && blocks[at].parentId) at--;
            const block = blocks[at];
            const table = block.type === 'table' && /<t[dh]\b[^>]*>\s*题号\s*<\/t[dh]>/i.test(textOf(block)) &&
                /<t[dh]\b[^>]*>\s*答案\s*<\/t[dh]>/i.test(textOf(block));
            const attachments = blocks.slice(at + 1, start).every(item => item.parentId === block.id);
            if (table && attachments) { start = at; continue; }
            if (at === start - 1 && block.type === 'text' && !block.parentId &&
                (ANSWER_HEADING.test(textOf(block)) || /^\s*#{0,6}\s*《[^\n]*》\s*参考\s*$/.test(textOf(block)))) { start = at; continue; }
            break;
        }
        return start;
    }

    function findAnswerBoundary(blocks, { boundaryReviews = [] } = {}) {
        const seen = new Set();
        const order = [];
        let previousMarker = -1;
        for (let index = 0; index < blocks.length; index++) {
            if (!blocks[index].parentId && ANSWER_HEADING.test(textOf(blocks[index]))) return { index, reason: 'heading' };
            const head = headOf(blocks[index]);
            if (!head) continue;
            if (seen.has(head.no)) {
                const suffix = blocks.slice(index);
                const ids = new Set(suffix.map(b => b.id));
                const support = segment(suffix, { numbers: order, role: 'support', boundaryReviews: boundaryReviews.filter(r => ids.has(r.blockId)) });
                const increasing = order.every((no, i) => !i || Number(no) > Number(order[i - 1]));
                if (increasing && support.valid && support.order.length === order.length && support.order.every((no, i) => no === order[i])) {
                    const start = supportPreambleStart(blocks, index, previousMarker);
                    return { index: start, reason: 'numbering-restart', ...(start === index ? {} : { markerIndex: index }) };
                }
                // A complete, strictly increasing prefix followed by a restart
                // at question 1 is the standard "paper then answers" layout.
                // The suffix may legitimately have gaps (an answer omitted, a
                // page without one), which must not invalidate the boundary:
                // per-question binding will leave only the missing ones empty.
                // Evidence still has to look like support material, not a new
                // section of questions.
                const nearbyHeading = blocks
                    .slice(Math.max(0, index - 4), index)
                    .some(block => /参考答案|答案与解析/.test(textOf(block)));
                const restartIsSupport = head.no === '1' &&
                    (support.runs[0]?.supportEvidence || nearbyHeading);
                const substantialSupport = support.order.length >=
                    Math.max(3, Math.ceil(order.length / 2));
                if (increasing && order.length >= 3 && substantialSupport && restartIsSupport) {
                    const start = supportPreambleStart(blocks, index, previousMarker);
                    return { index: start, reason: 'numbering-restart', ...(start === index ? {} : { markerIndex: index }) };
                }
                // A malformed first restart cannot be repaired by looking for a
                // later convenient split. An explicit heading still wins below.
                const heading = blocks.findIndex((block, at) => at > index && !block.parentId && ANSWER_HEADING.test(textOf(block)));
                return { index: heading, reason: heading < 0 ? 'unproved-restart' : 'heading' };
            }
            seen.add(head.no);
            order.push(head.no);
            previousMarker = index;
        }
        return { index: -1, reason: 'none' };
    }

    function segmentPaper(blocks, { numbers = null, boundaryReviews = [] } = {}) {
        const reviewIssues = [];
        reviewIndex(blocks, boundaryReviews, reviewIssues);
        const boundary = findAnswerBoundary(blocks, { boundaryReviews });
        const questionBlocks = boundary.index < 0 ? blocks : blocks.slice(0, boundary.index);
        const qids = new Set(questionBlocks.map(b => b.id));
        const questionSegment = segment(questionBlocks, { numbers, boundaryReviews: boundaryReviews.filter(r => qids.has(r.blockId)) });
        questionSegment.issues.push(...reviewIssues);
        questionSegment.valid = questionSegment.issues.length === 0;
        const solutionSegment = boundary.index < 0 ? null : segment(blocks.slice(boundary.index), { numbers: questionSegment.order, role: 'support', boundaryReviews: boundaryReviews.filter(r => !qids.has(r.blockId)) });
        return { boundary, questionSegment, solutionSegment, combined: boundary.index >= 0 };
    }

    const figureOf = run => run.blocks.filter(block => ['image', 'chart'].includes(block.type));
    const tableOf = run => run.blocks.filter(block => block.type === 'table');

    function answerEvidence(run, tableValue = null) {
        const declarations = Evidence.explicitDeclarations(run?.blocks || []);
        const head = run && headOf(run.blocks[0]);
        if (head) {
            const body = textOf(run.blocks[0]).slice(head.end).trim();
            const choice = body.match(/^([A-H]{1,8})(?=\s*(?:$|\n|【))/);
            const value = choice?.[1] || (run.supportEvidence === 'scalar-head' ? body.split('\n')[0].trim() : null);
            if (value) declarations.unshift({ value, blockId: run.blocks[0].id, kind: 'solution-head' });
        }
        if (tableValue != null) declarations.unshift({ value: tableValue, kind: 'answer-table' });
        return Evidence.aggregateAnswers(declarations);
    }

    function answerStatedInSolution(run) {
        return answerEvidence(run).value || null;
    }

    // Per-question assembly.
    //
    // `assemble` treats ANY issue as fatal for the whole paper: one ambiguous
    // boundary in the support file wipes every answer and every solution. That
    // is how a 19-question paper came back with 19 drafts and 0 answers.
    //
    // A printed question number still identifies its own run. Therefore only
    // ownership-corrupting defects stop the whole assembly (duplicate numbers,
    // missing question markers, broken fragments). A defect that belongs to one
    // question (ambiguous boundary/head, conflicting evidence) blocks that
    // question alone; the rest bind normally and the issue stays visible.
    const ASSEMBLY_GLOBAL_BLOCKERS = Object.freeze(new Set([
        'duplicate-block-id',
        'fragment-id-collision',
        'question-markers-missing',
        'invalid-expected-sequence',
        'number-not-increasing',
        'duplicate-number',
        'backward-number',
        'invalid-fragment-source',
        'invalid-boundary-review',
        'missing-parent-block'
    ]));

    function perQuestionBlocker(issue, no) {
        if (issue.no !== no) return false;
        return ['ambiguous-support-head', 'ambiguous-boundary', 'unexpected-number', 'unexpected-solution',
            'answer-evidence-conflict', 'answer-table-conflict'].includes(issue.code);
    }

    function assemblePartial({ questionSegment, solutionSegment = null, answerTable = null, types = {} }) {
        const issues = [];
        const blocksById = Object.create(null);
        for (const [side, part] of [['question', questionSegment], ['support', solutionSegment]]) {
            if (!part) continue;
            issues.push(...part.issues.map(issue => ({ ...issue, side })));
            for (const [id, block] of Object.entries(part.blocksById)) {
                if (Object.hasOwn(blocksById, id) && blocksById[id] !== block) issues.push({ code: 'duplicate-block-id', blockId: id, side });
                else blocksById[id] = block;
            }
        }
        const questionNumbers = new Set(questionSegment?.order || []);
        if (questionSegment && !questionNumbers.size) issues.push({ code: 'question-markers-missing' });

        // One run per printed number. A duplicated number cannot identify its
        // owner, so it blocks admission for that number only.
        const solutionByNo = new Map();
        const duplicatedSupport = new Set();
        for (const run of solutionSegment?.runs || []) {
            if (solutionByNo.has(run.no)) duplicatedSupport.add(run.no);
            else solutionByNo.set(run.no, run);
        }
        for (const no of duplicatedSupport) issues.push({ code: 'duplicate-number', no, side: 'support' });
        const supportNumbers = new Set(solutionByNo.keys());
        if (solutionSegment) {
            for (const no of questionNumbers) if (!supportNumbers.has(no)) issues.push({ code: 'solution-missing', no });
        }
        for (const block of Object.values(blocksById)) {
            if (block.parentId && !Object.hasOwn(blocksById, block.parentId)) issues.push({ code: 'missing-parent-block', blockId: block.id });
            if (!block.origin || block.origin.blockId === block.id) continue;
            const source = blocksById[block.origin.blockId];
            const range = block.origin.range;
            if (!source || !Array.isArray(range) || range.length !== 2 || !range.every(Number.isSafeInteger) || range[0] < 0 || range[1] < range[0] || range[1] > textOf(source).length || textOf(source).slice(...range) !== textOf(block)) issues.push({ code: 'invalid-fragment-source', blockId: block.id });
        }

        const globallyBlocked = issues.some(issue => ASSEMBLY_GLOBAL_BLOCKERS.has(issue.code));
        const questions = (questionSegment?.runs || []).map(run => {
            const solution = solutionByNo.get(run.no);
            const stated = solution ? answerStatedInSolution(solution) : null;
            const fromTable = answerTable?.[run.no] ?? null;
            const answers = answerEvidence(solution, fromTable);
            const conflict = answers.state === 'conflicting';
            if (conflict) issues.push({ code: fromTable == null ? 'answer-evidence-conflict' : 'answer-table-conflict', no: run.no, evidence: answers.evidence, table: fromTable, solution: stated });
            const blockedHere = duplicatedSupport.has(run.no) ||
                issues.some(issue => perQuestionBlocker(issue, run.no));
            const bind = !globallyBlocked && !blockedHere && !conflict;
            return {
                questionNo: run.no, type: types[run.no] || null,
                stemBlocks: run.blocks.filter(block => !['image', 'chart'].includes(block.type)).map(block => block.id),
                figureBlocks: figureOf(run).map(block => block.id), tableBlocks: tableOf(run).map(block => block.id),
                answer: bind ? answers.value : '',
                answerEvidence: answers,
                contentStatus: 'unverified',
                contentIssues: [...run.blocks, ...(solution?.blocks || [])].filter(b => !textOf(b).trim() && !b.image).map(b => ({ code: 'empty-source-block', blockId: b.id })),
                coverage: questionSegment.coverage,
                answerSource: bind ? (fromTable != null ? 'answer-table' : stated ? 'solution-head' : 'none') : 'none',
                solutionBlocks: bind && solution ? solution.blocks.map(block => block.id) : [],
                reviewRequired: true
            };
        });
        return { questions, issues, blocksById, valid: !globallyBlocked, partial: issues.length > 0 };
    }

    function assemble({ questionSegment, solutionSegment = null, answerTable = null, types = {} }) {
        const issues = [];
        const blocksById = Object.create(null);
        for (const [side, part] of [['question', questionSegment], ['support', solutionSegment]]) {
            if (!part) continue;
            issues.push(...part.issues.map(issue => ({ ...issue, side })));
            for (const [id, block] of Object.entries(part.blocksById)) {
                if (Object.hasOwn(blocksById, id) && blocksById[id] !== block) issues.push({ code: 'duplicate-block-id', blockId: id, side });
                else blocksById[id] = block;
            }
        }
        // Sequence validation precedes the map: duplicates must never overwrite.
        const questionNumbers = new Set(questionSegment?.order || []);
        if (questionSegment && !questionNumbers.size) issues.push({ code: 'question-markers-missing' });
        const supportNumbers = new Set(solutionSegment?.order || []);
        const ambiguousHeads = new Set(issues.filter(i => i.code === 'ambiguous-support-head').map(i => i.no));
        if (solutionSegment) {
            for (const no of questionNumbers) if (!supportNumbers.has(no)) issues.push({ code: 'solution-missing', no });
            for (const run of solutionSegment.runs) {
                if (!questionNumbers.has(run.no)) issues.push({ code: 'unexpected-solution', no: run.no });
                if (!run.supportEvidence && !ambiguousHeads.has(run.no)) issues.push({ code: 'ambiguous-support-head', no: run.no });
            }
        }
        for (const block of Object.values(blocksById)) {
            if (block.parentId && !Object.hasOwn(blocksById, block.parentId)) issues.push({ code: 'missing-parent-block', blockId: block.id });
            if (!block.origin || block.origin.blockId === block.id) continue;
            const source = blocksById[block.origin.blockId];
            const range = block.origin.range;
            if (!source || !Array.isArray(range) || range.length !== 2 || !range.every(Number.isSafeInteger) || range[0] < 0 || range[1] < range[0] || range[1] > textOf(source).length || textOf(source).slice(...range) !== textOf(block)) issues.push({ code: 'invalid-fragment-source', blockId: block.id });
            if (block.boundaryReview && (!source || block.boundaryReview.sourceId !== source.origin?.sourceId || block.boundaryReview.text !== textOf(source) || block.boundaryReview.offset !== range?.[0])) issues.push({ code: 'invalid-boundary-review', blockId: block.id });
        }
        const admissible = issues.length === 0;
        const solutions = admissible ? new Map((solutionSegment?.runs || []).map(run => [run.no, run])) : new Map();
        const questions = (questionSegment?.runs || []).map(run => {
            const solution = solutions.get(run.no);
            const stated = solution ? answerStatedInSolution(solution) : null;
            const fromTable = answerTable?.[run.no] ?? null;
            const answers = answerEvidence(solution, fromTable);
            const conflict = answers.state === 'conflicting';
            if (conflict) issues.push({ code: fromTable == null ? 'answer-evidence-conflict' : 'answer-table-conflict', no: run.no, evidence: answers.evidence, table: fromTable, solution: stated });
            const bind = admissible && !conflict;
            return {
                questionNo: run.no, type: types[run.no] || null,
                stemBlocks: run.blocks.filter(block => !['image', 'chart'].includes(block.type)).map(block => block.id),
                figureBlocks: figureOf(run).map(block => block.id), tableBlocks: tableOf(run).map(block => block.id),
                answer: bind ? answers.value : '',
                answerEvidence: answers,
                contentStatus: 'unverified',
                contentIssues: [...run.blocks, ...(solution?.blocks || [])].filter(b => !textOf(b).trim() && !b.image).map(b => ({ code: 'empty-source-block', blockId: b.id })),
                coverage: questionSegment.coverage,
                answerSource: bind ? (fromTable != null ? 'answer-table' : stated ? 'solution-head' : 'none') : 'none',
                solutionBlocks: bind && solution ? solution.blocks.map(block => block.id) : [],
                reviewRequired: true
            };
        });
        return { questions, issues, blocksById, valid: issues.length === 0 };
    }

    return Object.freeze({ NUMBER_START, SOLUTION_HEAD, ANSWER_HEADING, findAnswerBoundary, segmentPaper, segment, assemble, assemblePartial, numberOnBlock, answerEvidence, answerStatedInSolution, figureOf, tableOf });
});
