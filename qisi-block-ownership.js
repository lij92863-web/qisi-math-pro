(function (root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.BlockOwnership = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';
    const node = typeof module !== 'undefined' && module.exports;
    const Segmenter = node ? require('./qisi-paper-segmenter.js') : root.Qisi.PaperSegmenter;
    const Evidence = node ? require('./qisi-mineru-evidence.js') : root.Qisi.MineruEvidence;
    const PROTOCOL = 'block-ownership-v1';
    const TYPES = Object.freeze(['single_choice', 'multiple_choice', 'fill_blank', 'free_response', 'unknown']);
    const FIELDS = ['stem', 'answer', 'solution', 'figures'];
    const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    const clone = value => JSON.parse(JSON.stringify(value));

    function blockIndex(source) {
        if (!source) throw new Error('BLOCK_OWNERSHIP_BLOCKS_REQUIRED');
        const entries = source instanceof Map ? [...source] : Array.isArray(source) ? source.map(b => [b?.id, b]) : Object.entries(source);
        const map = new Map();
        for (const [id, block] of entries) {
            if (typeof id !== 'string' || !id || id !== block?.id) throw new Error('BLOCK_OWNERSHIP_BLOCK_ID_REQUIRED');
            if (map.has(id)) throw new Error('BLOCK_OWNERSHIP_DUPLICATE_BLOCK_ID:' + id);
            map.set(id, block);
        }
        return map;
    }

    function buildOwnershipPayload(input, options = {}) {
        if (!Array.isArray(input?.pages)) throw new Error('BLOCK_OWNERSHIP_PAGES_REQUIRED');
        blockIndex(input.pages.flatMap(page => page.blocks));
        const blocks = [];
        for (const page of input.pages) {
            if (!Number.isSafeInteger(page.page) || page.page < 1) throw new Error('BLOCK_OWNERSHIP_PAGE_REQUIRED');
            for (const block of page.blocks) {
                const kind = block.type;
                const entry = { id: block.id, p: page.page, kind };
                if (kind === 'image' || kind === 'chart') entry.alt = '图';
                else entry.text = String(block.text || '');
                if (block.parentId) entry.parentId = block.parentId;
                // Budget overflow belongs to planning. Never erase source identity.
                if (options.maxTextChars > 0 && entry.text?.length > options.maxTextChars) throw new Error('BLOCK_OWNERSHIP_TEXT_BUDGET:' + block.id);
                blocks.push(entry);
            }
        }
        return { exam: { pages: input.pages.length, question_numbers: input.questionNumbers || [] }, answer_table: input.answerTable || null, blocks };
    }

    function sequence(numbers, errors, tag) {
        if (!Array.isArray(numbers) || !numbers.length) { errors.push(tag + ':required'); return; }
        numbers.forEach((no, i) => {
            if (typeof no !== 'string' || !/^[1-9]\d{0,2}$/.test(no)) errors.push(tag + ':invalid-number:' + no);
            if (i && Number(no) <= Number(numbers[i - 1])) errors.push(tag + ':not-increasing:' + no);
        });
    }

    function sourceContext(known, options, errors) {
        const blocks = [...known.values()].filter(b => !b.origin || b.origin.blockId === b.id);
        let paper;
        if (options.phase === 'solutions') {
            const part = Segmenter.segment(blocks, { numbers: options.questionNumbers, role: 'support', boundaryReviews: options.boundaryReviews });
            paper = { solutionSegment: part };
            errors.push(...part.issues.map(i => 'source:' + i.code));
        } else {
            paper = Segmenter.segmentPaper(blocks, { boundaryReviews: options.boundaryReviews });
            const built = Segmenter.assemble({ ...paper, answerTable: options.answerTable });
            errors.push(...built.issues.map(i => 'source:' + i.code));
        }
        const owners = new Map();
        for (const [role, part] of [['question', paper.questionSegment], ['support', paper.solutionSegment]]) {
            for (const run of part?.runs || []) for (const block of run.blocks) {
                owners.set(block.id, { no: run.no, role });
                known.set(block.id, block);
            }
        }
        return { ...paper, owners, solutions: new Map((paper.solutionSegment?.runs || []).map(run => [run.no, run])) };
    }

    // Model references may narrow an anchored interval, never create or expand it.
    function inspect(value, source, options) {
        const errors = [];
        let known;
        try { known = blockIndex(source); } catch (error) { return { errors: [error.message], known: new Map(), context: {} }; }
        if (!object(value)) return { errors: ['result-not-object'], known, context: {} };
        if (value.protocol !== PROTOCOL) errors.push(value.protocol === undefined ? 'missing-protocol' : 'protocol-version:' + value.protocol);
        const phase = options.phase || 'full';
        if (!['full', 'questions', 'solutions'].includes(phase)) errors.push('invalid-phase');
        if (!Array.isArray(value.questions)) errors.push('questions-not-array');
        if (!Array.isArray(value.unassigned)) errors.push('unassigned-not-array');
        if (options.questionNumbers !== undefined && !Array.isArray(options.questionNumbers)) {
            errors.push('expected:not-array');
            return { errors, known, context: {} };
        }
        const context = sourceContext(known, options, errors);
        const expected = options.questionNumbers || context.questionSegment?.order;
        sequence(expected, errors, 'expected');
        const items = Array.isArray(value.questions) ? value.questions : [];
        const actual = items.map(item => item?.question_no);
        sequence(actual, errors, 'questions');
        const expectedSet = new Set(expected || []), actualSet = new Set(actual);
        for (const no of expectedSet) if (!actualSet.has(no)) errors.push('missing-question-no:' + no);
        for (const no of actualSet) if (!expectedSet.has(no)) errors.push('question-no-not-allowed:' + no);
        const counts = new Set(), used = new Set();
        items.forEach((item, i) => {
            const tag = 'questions[' + i + ']';
            if (!object(item)) { errors.push(tag + ':not-object'); return; }
            if (counts.has(item.question_no)) errors.push('duplicate-question-no:' + item.question_no);
            counts.add(item.question_no);
            if (!TYPES.includes(item.type)) errors.push(tag + ':invalid-type');
            if (!Array.isArray(item.issues) || item.issues.some(x => typeof x !== 'string')) errors.push(tag + ':issues-not-array');
            const check = (ids, field) => {
                if (!Array.isArray(ids)) { errors.push(tag + '.' + field + ':not-array'); return; }
                const seen = new Set();
                for (const id of ids) {
                    const label = tag + '.' + field;
                    if (typeof id !== 'string' || !known.has(id)) { errors.push(label + ':unknown-block:' + id); continue; }
                    if (seen.has(id)) errors.push(label + ':duplicate-block:' + id);
                    seen.add(id); used.add(id);
                    const owner = context.owners.get(id);
                    const role = field === 'answer' || field === 'solution' ? 'support' : 'question';
                    if (!owner || owner.no !== item.question_no || (field !== 'figures' && owner.role !== role)) errors.push(label + ':outside-source-range:' + id);
                    if (known.get(id).truncated) errors.push(label + ':incomplete-source:' + id);
                    if ((phase === 'questions' && role === 'support') || (phase === 'solutions' && (role === 'question' || field === 'figures'))) errors.push(label + ':phase-forbidden');
                    if (field === 'figures' && !['image', 'chart'].includes(known.get(id).type)) errors.push(label + ':not-image:' + id);
                }
            };
            for (const field of FIELDS) check(item[field], field);
            if (!object(item.options)) errors.push(tag + '.options:not-object');
            else for (const [label, ids] of Object.entries(item.options)) {
                if (!/^[A-H]$/.test(label)) errors.push(tag + '.options:invalid-label:' + label);
                check(ids, 'options.' + label);
            }
        });
        for (const group of Array.isArray(value.unassigned) ? value.unassigned : []) {
            if (!object(group) || !Array.isArray(group.blocks) || typeof group.reason !== 'string') { errors.push('unassigned-invalid'); continue; }
            for (const id of group.blocks) if (!known.has(id) || used.has(id)) errors.push('unassigned-invalid-block:' + id);
        }
        return { errors: [...new Set(errors)], known, context };
    }

    function validateOwnership(value, options = {}) {
        const { issues: errors } = assembleExam(value, options.blocksById || options.blocks, options);
        return { valid: !errors.length, errors, result: errors.length ? null : clone(value) };
    }

    function project(item, known, context, options) {
        const issues = [], images = new Map();
        const render = ids => (Array.isArray(ids) ? ids : []).map(id => {
            const b = known.get(id);
            if (!b) return '';
            if (['image', 'chart'].includes(b.type)) {
                const path = b.image;
                if (!path) { issues.push('missing-image-path:' + id); return ''; }
                const sourceId = b.origin?.sourceId || null;
                const key = JSON.stringify([sourceId, path]);
                images.set(key, { blockId: id, name: path.split('/').pop(), path, sourceId, assetId: key });
                if (!sourceId) issues.push('missing-image-source:' + id);
                return '[[IMAGE:' + encodeURIComponent(key) + ']]';
            }
            return b.text || '';
        }).filter(Boolean).join('\n').trim();
        const stemIds = Array.isArray(item.stem) ? [...item.stem] : [];
        const optionRefs = object(item.options) ? clone(item.options) : {};
        // The same projection handles model-shared references and options still
        // embedded in a stem. No second parser is delegated to an unknown caller.
        if (!Object.keys(optionRefs).length) for (const id of stemIds) {
            const split = known.has(id) && Evidence.splitOptions(known.get(id));
            if (split) for (const entry of split.options) optionRefs[entry.label] = [id];
        }
        const use = new Map();
        for (const [label, ids] of Object.entries(optionRefs)) if (Array.isArray(ids)) for (const id of ids) {
            if (!use.has(id)) use.set(id, []);
            use.get(id).push(label);
        }
        const optionEvidence = [];
        for (const [id, labels] of use) if (labels.length > 1) {
            const block = known.get(id);
            const split = block && Evidence.splitOptions(block);
            if (!split || [...labels].sort().join('') !== split.options.map(x => x.label).join('')) {
                issues.push('options-unresolved:' + id);
                for (const label of labels) optionRefs[label] = [];
                continue;
            }
            for (const entry of split.options) {
                const existing = known.get(entry.block.id);
                if (existing && (existing.text !== entry.block.text || JSON.stringify(existing.origin) !== JSON.stringify(entry.block.origin))) {
                    issues.push('fragment-id-collision:' + entry.block.id);
                    continue;
                }
                known.set(entry.block.id, entry.block);
                optionRefs[entry.label] = optionRefs[entry.label].map(ref => ref === id ? entry.block.id : ref);
            }
            const at = stemIds.indexOf(id);
            if (split.prefix) {
                known.set(split.prefix.id, split.prefix);
                if (at >= 0) stemIds.splice(at, 1, split.prefix.id);
                else optionEvidence.push(split.prefix.id);
            } else if (at >= 0) stemIds.splice(at, 1);
        }
        const stem = render(stemIds);
        const optionEntries = Object.entries(optionRefs).map(([label, ids]) => ({ label, text: render(ids), blocks: ids }));
        for (const entry of optionEntries) {
            if (!new RegExp('^\\s*' + entry.label + '[.．、]').test(Evidence.maskMath(entry.text))) issues.push('option-label-unproved:' + entry.label);
        }
        render(item.figures);
        const run = context.solutions?.get(item.question_no);
        const answers = Segmenter.answerEvidence(run, options.answerTable?.[item.question_no]);
        if (answers.state === 'conflicting') issues.push('answer-evidence-conflict');
        if (['single_choice', 'multiple_choice'].includes(item.type)) {
            const labels = optionEntries.map(x => x.label).sort();
            if (labels.length < 2 || labels.some((label, i) => label !== String.fromCharCode(65 + i))) issues.push('options-incomplete');
            const key = Evidence.answerKey(answers.value);
            if (key && (!/^[A-H]+$/.test(key) || [...key].some(label => !labels.includes(label)) || (item.type === 'single_choice' && key.length !== 1))) issues.push('choice-answer-invalid');
        }
        const solution = render(item.solution);
        if (!stem && options.phase !== 'solutions') issues.push('empty-stem');
        return { questionNo: item.question_no, type: item.type, stem, options: optionEntries,
            answer: answers.value, solution, images: [...images.values()], issues,
            answerEvidence: answers, optionEvidence, contentStatus: 'unverified', reviewRequired: true };
    }

    function assembleExam(ownership, source, options = {}) {
        const { errors, known, context } = inspect(ownership, source, options);
        const items = Array.isArray(ownership?.questions) ? ownership.questions.filter(object) : [];
        // Invalid external input never enters field projection. Preserve its raw
        // claims and source registry for review instead of partially interpreting
        // malformed fields and trying to repair them in each renderer.
        if (errors.length) return {
            drafts: items.map(item => ({ questionNo: item.question_no, type: item.type,
                stem: '', options: [], answer: '', solution: '', images: [],
                answerEvidence: Segmenter.answerEvidence(context.solutions?.get(item.question_no), options.answerTable?.[item.question_no]),
                valid: false, reviewRequired: true, contentStatus: 'unverified', rawOwnership: clone(item), issues: errors })),
            issues: errors, valid: false, unassigned: Array.isArray(ownership?.unassigned) ? ownership.unassigned : [], blocksById: Object.fromEntries(known)
        };
        const drafts = items.map(item => project(item, known, context, options));
        const issues = [...errors, ...drafts.flatMap(d => d.issues.map(i => d.questionNo + ':' + i))];
        const valid = issues.length === 0;
        for (const draft of drafts) {
            draft.valid = valid;
            if (!valid || options.phase === 'questions') { draft.answer = ''; draft.solution = ''; }
        }
        return { drafts, issues, valid, unassigned: ownership?.unassigned || [], blocksById: Object.fromEntries(known) };
    }

    function assembleQuestion(item, source, options = {}) {
        const built = assembleExam({ protocol: PROTOCOL, questions: [item], unassigned: [] }, source,
            { ...options, questionNumbers: options.questionNumbers || [item?.question_no] });
        return built.drafts[0] ? { ...built.drafts[0], issues: built.issues } :
            { questionNo: '', type: 'unknown', stem: '', options: [], answer: '', solution: '', images: [], valid: false, reviewRequired: true, issues: built.issues };
    }

    return Object.freeze({ PROTOCOL, TYPES, blockIndex, buildOwnershipPayload, validateOwnership, assembleQuestion, assembleExam });
});
