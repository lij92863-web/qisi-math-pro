const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../qisi-paper-segmenter');
const O = require('../qisi-block-ownership');
const E = require('../qisi-mineru-evidence');
const P = require('../qisi-block-ownership-prompt');
const C = require('../qisi-mineru-client').internals;
const b = (id, text, extra = {}) => ({ id, type: 'text', text, ...extra });
const q = n => ({ question_no: String(n), type: 'free_response', stem: ['q' + n], options: {}, answer: ['s' + n], solution: ['s' + n], figures: [], issues: [] });
const source = () => [b('q1', '1. 第一题'), b('q2', '2. 第二题'), b('title', '参考答案'), b('s1', '1【答案】A'), b('s2', '2【答案】B')];
const value = items => ({ protocol: O.PROTOCOL, questions: items, unassigned: [] });
const options = { questionNumbers: ['1', '2'], answerTable: { 1: 'A', 2: 'B' } };

test('all projection entry points enforce source ownership, sequence and schema', () => {
    const good = O.assembleExam(value([q(1), q(2)]), source(), options);
    assert.equal(good.valid, true);
    for (const items of [[q(2), q(1)], [q(1), q(1)], [q(1)],
        [{ ...q(1), solution: ['s2'] }, { ...q(2), solution: ['s1'] }],
        [{ ...q(1), stem: ['missing'] }, q(2)], [{ question_no: '1' }, q(2)],
        [{ ...q(1), options: { BAD: ['q1'] } }, q(2)], [{ ...q(1), options: { '[': null } }, q(2)]]) {
        const result = O.assembleExam(value(items), source(), options);
        assert.equal(result.valid, false);
        assert.ok(result.drafts.every(d => !d.answer && !d.solution));
        assert.equal(O.validateOwnership(value(items), { ...options, blocks: source() }).valid, false);
    }
    const single = O.assembleQuestion({ ...q(1), solution: ['s2'] }, source(), { answerTable: options.answerTable });
    assert.equal(single.valid, false); assert.equal(single.answer, ''); assert.equal(single.solution, '');
});

test('numeric coercion cannot manufacture expected question identities', () => {
    for (const numbers of [['1.0'], ['1e2'], ['0x1'], [' 1']]) {
        assert.equal(S.segment([b('q1', '1. 题')], { numbers }).valid, false);
    }
    assert.equal(O.validateOwnership(value([q(1)]), { blocks: source(), questionNumbers: {} }).valid, false);
});

test('source IDs are injective and arrays/maps/objects obey the same registry contract', () => {
    const duplicate = [b('same', 'first'), b('same', 'second')];
    assert.throws(() => O.blockIndex(duplicate), /DUPLICATE/);
    for (const registry of [duplicate, new Map([['wrong', b('actual', 'x')]]), { wrong: b('actual', 'x') }]) {
        const built = O.assembleExam(value([q(1)]), registry, { questionNumbers: ['1'] });
        assert.equal(built.valid, false); assert.ok(built.drafts.every(d => !d.answer && !d.solution));
    }
});

test('a choice draft requires complete option labels and a compatible printed answer', () => {
    const blocks = [b('q1', '1. 题 A.甲 B.乙')];
    for (const answer of ['C', 'AB', '甲']) {
        const built = O.assembleQuestion({ ...q(1), type: 'single_choice', answer: [], solution: [] }, blocks, { answerTable: { 1: answer } });
        assert.equal(built.valid, false); assert.equal(built.answer, '');
    }
    const missing = O.assembleQuestion({ ...q(1), type: 'single_choice', answer: [], solution: [] }, [b('q1', '1. 题')], { answerTable: { 1: 'A' } });
    assert.equal(missing.valid, false); assert.equal(missing.answer, '');
});

test('phase permissions are checked by the validator, not merely written in prompts', () => {
    const out = O.assembleExam(value([q(1), q(2)]), source(), { ...options, phase: 'questions' });
    assert.equal(out.valid, false); assert.ok(out.issues.some(x => x.includes('phase-forbidden')));
    assert.equal(P.parseOutput('{"questions":[]}').ok, false);
    assert.equal(O.assembleExam(value([q(1)]), source(), { phase: 'invented' }).valid, false);
});

test('answer aggregation compares all original declarations, independent of precedence', () => {
    for (const head of ['A', 'B']) {
        const qs = S.segment([b('q', '37. 题')]);
        const ss = S.segment([b('s', `37【答案】${head}`), b('tail', '【详解】故选：B。')], { numbers: ['37'], role: 'support' });
        const built = S.assemble({ questionSegment: qs, solutionSegment: ss });
        assert.equal(built.valid, head === 'B');
        assert.equal(built.questions[0].answer, head === 'B' ? 'B' : '');
        assert.equal(built.questions[0].answerEvidence.evidence.length, 2);
    }
    assert.equal(E.aggregateAnswers([{ value: 'AC' }, { value: 'CA' }]).state, 'agreed');
    assert.equal(E.aggregateAnswers([{ value: 'x+x' }, { value: '2x' }]).state, 'conflicting', 'no algebraic guessing');
});

test('same-block questions and indistinguishable solution steps retain ambiguity', () => {
    const qs = S.segment([b('q', '1. 第一题\n2. 第二题')]);
    assert.deepEqual(qs.order, ['1', '2']); assert.equal(qs.valid, false);
    const ss = S.segment([b('s', '1. A\n解析步骤：\n2. (1) x=1 (2) y=2')], { numbers: ['1', '2'], role: 'support' });
    assert.equal(ss.valid, false);
    const built = S.assemble({ questionSegment: qs, solutionSegment: ss });
    assert.ok(built.questions.every(x => !x.answer && !x.solutionBlocks.length));
});

test('visual boundary decisions are tied to exact source bytes and offsets, never a question number', () => {
    for (const n of [1, 25, 173]) {
        const raw = b('raw', `${n}. A\n${n + 1}. (1) x=1 (2) y=2`, { origin: { sourceId: 'doc', blockId: 'raw' } });
        const qs = [b('q1', `${n}. 题`), b('q2', `${n + 1}. 题`)];
        const review = { sourceId: 'doc', blockId: raw.id, text: raw.text, offset: raw.text.indexOf('\n') + 1, decision: 'question-start', evidence: 'isolated-page-image.png' };
        const paper = S.segmentPaper([...qs, raw], { boundaryReviews: [review] });
        assert.equal(paper.combined, true); assert.equal(S.assemble(paper).valid, true);
        const changed = S.segmentPaper([...qs, { ...raw, text: raw.text + 'changed' }], { boundaryReviews: [review] });
        assert.equal(S.assemble(changed).valid, false);
        const wrongSource = S.segmentPaper([...qs, raw], { boundaryReviews: [{ ...review, sourceId: 'other' }] });
        assert.equal(S.assemble(wrongSource).valid, false);
    }
});

test('a complete restart is independent of paper length or starting number', () => {
    for (const count of [1, 2, 5]) for (const start of [1, 17, 93]) {
        const ns = Array.from({ length: count }, (_, i) => start + i);
        const paper = S.segmentPaper([...ns.map(n => b('q' + n, n + '. 题目')), ...ns.map(n => b('s' + n, n + '【答案】A'))]);
        assert.equal(paper.combined, true); assert.equal(S.assemble(paper).valid, true);
        const incomplete = S.segmentPaper([...ns.map(n => b('q' + n, n + '. 题目')), b('s', start + '【答案】A')]);
        if (count > 1) assert.equal(incomplete.combined, false);
    }
});

test('option ranges conserve all text, mask math, and never copy a shared block', () => {
    for (const prefix of ['', '原文前导\n']) {
        const text = prefix + 'A. $A.B.C.D.$ 甲 B.乙C.丙 D.丁';
        const input = b('raw', text, { origin: { blockId: 'raw', sourceId: 'doc', range: [0, text.length] } });
        const split = E.splitOptions(input);
        assert.deepEqual(split.options.map(x => x.label), ['A', 'B', 'C', 'D']);
        assert.equal([split.prefix, ...split.options.map(x => x.block)].filter(Boolean).map(x => x.text).join(''), text);
        assert.equal(new Set(split.options.map(x => x.block.id)).size, 4);
    }
    for (const text of ['A.甲 C.丙', '$A. B. C. D.$', '三角形A.边长B.角度', 'A.甲 A.乙 B.丙']) assert.equal(E.splitOptions(b('x', text)), null);
});

test('image identity preserves full paths and source identity', () => {
    const blocks = [b('q1', '1. 题'), ...['first/a.png', 'second/a.png'].map((image, i) => ({ id: 'im' + i, type: 'image', image, origin: { sourceId: 'doc', blockId: 'im' + i } }))];
    const out = O.assembleQuestion({ ...q(1), answer: [], solution: [], figures: ['im0', 'im1'] }, blocks);
    assert.equal(out.valid, true); assert.equal(out.images.length, 2);
    assert.notEqual(out.images[0].assetId, out.images[1].assetId);
    assert.deepEqual(out.images.map(x => x.path), ['first/a.png', 'second/a.png']);
});

test('normalization and window planning preserve source order and reject missing pages', () => {
    const parsed = C.parseContentList([{ page_idx: 1, type: 'text', text: '2. 题' }]);
    const blocks = parsed.pages.flatMap(p => p.blocks);
    assert.equal(blocks[0].page, 2); assert.equal(P.planWindows(blocks)[0].blocks[0], blocks[0]);
    assert.throws(() => P.planWindows([b('x', 'no page')]), /PAGE_REQUIRED/);
    assert.throws(() => P.planWindows(blocks, { pagesPerWindow: 1.5 }), /SIZE_INVALID/);
    const ordered = [b('a', 'x', { page: 3 }), b('b', 'y', { page: 1 }), b('c', 'z', { page: 3 })];
    assert.deepEqual(P.planWindows(ordered, { pagesPerWindow: 1 }).flatMap(w => w.blocks), ordered);
});

test('real HTTP parse handler propagates the complete evidence contract', async () => {
    const fs = require('node:fs'), vm = require('node:vm'), acorn = require('acorn');
    const code = fs.readFileSync(require.resolve('../qisi-local-server'), 'utf8');
    const ast = acorn.parse(code, { ecmaVersion: 'latest' });
    const route = ast.body.find(n => n.type === 'ExpressionStatement' && n.expression.type === 'CallExpression' && n.expression.arguments[0]?.value === '/api/mineru/parse');
    const handler = route.expression.arguments.at(-1);
    const expected = { protocol: 'mineru-blocks-v1', job: 'job', source: { pages: 1 }, pages: [{ page: 1, blocks: [] }], evidence: { items: [{ type: 'new-type', payload: 17 }] }, extension: { retained: true } };
    let cleaned = false, actual;
    const fn = vm.runInNewContext('(' + code.slice(handler.start, handler.end) + ')', {
        AbortController, Date, console: { log() {}, error() {} },
        fsp: { readFile: async () => Buffer.from('%PDF-mock') }, MINERU_MAX_PDF_BYTES: 100, MINERU_MAX_PAGES: 200,
        estimatePdfPageCount: () => 1, decodeMultipartFilename: x => x,
        mineruClient: { parse: async () => expected }, tempJobManager: { track: () => () => {}, cleanupRequest: async () => { cleaned = true; } }
    });
    const res = { once() {}, removeListener() {}, json(data) { actual = data; } };
    await fn({ file: { path: 'mock', originalname: 'mock.pdf' } }, res);
    assert.equal(actual, expected); assert.equal(cleaned, true);
});

test('the production selection copies only selected PDF pages and sends those bytes to MinerU', async () => {
    const fs = require('node:fs'), vm = require('node:vm'), acorn = require('acorn');
    const { PDFDocument } = require('pdf-lib');
    const { createHash } = require('node:crypto');
    const original = await PDFDocument.create();
    for (const width of [501, 502, 503, 504, 505]) original.addPage([width, 600]);
    const bytes = Buffer.from(await original.save());
    const code = fs.readFileSync(require.resolve('../qisi-local-server'), 'utf8');
    const { body } = acorn.parse(code, { ecmaVersion: 'latest' });
    const select = body.find(node => node.id?.name === 'selectMineruPdf');
    const handler = body.find(node => node.expression?.arguments?.[0]?.value === '/api/mineru/parse').expression.arguments.at(-1);
    let outbound;
    const context = vm.createContext({
        AbortController, Date, Buffer,
        require: require('node:module').createRequire(require.resolve('../qisi-local-server')),
        console: { log() {}, error() {} },
        fsp: { readFile: async () => bytes }, MINERU_MAX_PDF_BYTES: 200 * 1024 * 1024, MINERU_MAX_PAGES: 200,
        estimatePdfPageCount: () => 5, decodeMultipartFilename: value => value, mineruErrorStatus: () => 400,
        mineruClient: { parse: async pdf => { outbound = pdf; return { source: { pages: 3 }, pages: [] }; } },
        tempJobManager: { track: () => () => {}, cleanupRequest: async () => {} }
    });
    vm.runInContext(code.slice(select.start, select.end), context);
    const route = vm.runInContext('(' + code.slice(handler.start, handler.end) + ')', context);
    const request = pages => route({ query: { pages }, file: { path: 'fixture', originalname: 'original.pdf' } },
        { once() {}, removeListener() {}, status() { return this; }, json: value => JSON.parse(JSON.stringify(value)) });
    assert.equal((await request('1,6')).code, 'MINERU_PAGE_RANGE_INVALID');
    assert.equal(outbound, undefined);
    const response = await request('1-2,5');
    assert.deepEqual(response.originalSource, { sha256: createHash('sha256').update(bytes).digest('hex'), pages: [1, 2, 5], totalPages: 5 });
    assert.deepEqual((await PDFDocument.load(outbound)).getPages().map(page => page.getWidth()), [501, 502, 505]);
    const before = outbound;
    await request('1-2,5');
    assert.deepEqual(outbound, before);
});
