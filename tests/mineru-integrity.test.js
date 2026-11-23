const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../qisi-mineru-client.js').internals;
const S = require('../qisi-paper-segmenter.js');
const P = require('../qisi-paper-pairing.js');
const b = (id, text, extra = {}) => ({ id, type: 'text', text, ...extra });

test('normalization preserves captions, footnotes, unknown evidence and base identities', () => {
    const raw = [{ type: 'image', page_idx: 0, img_path: 'images/a.jpg', image_caption: ['C.'], image_footnote: ['甲'] },
        { type: 'text', page_idx: 0, text: 'next' }, { type: 'novel', page_idx: 1, payload: 42 },
        { type: 'page_number', page_idx: 2, text: '3' }];
    const saved = JSON.stringify(raw);
    const parsed = C.parseContentList(raw, { sourceId: 'source' });
    assert.equal(parsed.pages.length, 3);
    assert.equal(parsed.pages[0].blocks.find(x => x.text === 'next').id, 'p1b1');
    for (const text of ['C.', '甲']) {
        const caption = parsed.pages[0].blocks.find(x => x.text === text);
        assert.equal(caption.parentId, 'p1b0');
        assert.equal(caption.origin.sourceId, 'source');
    }
    assert.equal(parsed.pages[1].blocks[0].type, 'unsupported');
    assert.deepEqual(parsed.evidence.items, raw);
    assert.equal(JSON.stringify(raw), saved);
    assert.throws(() => C.parseContentList([{ type: 'text', text: 'orphan' }]), /page_idx/);
});

test('inline support boundaries partition exact text with resolvable provenance at arbitrary numbers', () => {
    for (const start of [1, 17, 78, 145]) {
        const text = `${start}. A\n解释 $${start + 1}. x$ 结束. ${start + 1}. (1) $x=2$ (2) 证明见解析\n${start + 2}【答案】B`;
        const input = b('raw', text);
        const numbers = [start, start + 1, start + 2].map(String);
        const segment = S.segment([input], { numbers, role: 'support' });
        assert.deepEqual(segment.order, numbers);
        assert.ok(segment.issues.some(x => x.code === 'ambiguous-boundary'));
        const fragments = segment.runs.flatMap(x => x.blocks);
        assert.equal(fragments.map(x => x.text).join(''), text);
        for (const fragment of fragments) {
            assert.equal(fragment.origin.blockId, 'raw');
            assert.equal(text.slice(...fragment.origin.range), fragment.text);
        }
        const qs = S.segment(numbers.map(no => b('q' + no, `${no}. 题目`)));
        const built = S.assemble({ questionSegment: qs, solutionSegment: segment });
        assert.equal(built.valid, false, 'multipart syntax alone cannot distinguish a nested step');
        assert.ok(built.questions.every(q => !q.answer && !q.solutionBlocks.length));
        for (const q of built.questions) for (const id of [...q.stemBlocks, ...q.solutionBlocks]) assert.ok(built.blocksById[id]);
        assert.equal(built.blocksById.raw.text, text);
        const again = S.segment(fragments, { numbers, role: 'support', sourceRegistry: segment.blocksById });
        assert.deepEqual(again.order, numbers);
        assert.deepEqual(again.runs.flatMap(x => x.blocks).map(x => x.origin), fragments.map(x => x.origin));
        // Re-segmentation must not promote an unresolved fragment to proof.
        assert.equal(S.assemble({ questionSegment: qs, solutionSegment: again }).valid, false);
    }
});

test('caption relation reaches both ownership payloads and cannot become a question boundary', () => {
    const O = require('../qisi-block-ownership.js');
    const Prompt = require('../qisi-block-ownership-prompt.js');
    const parsed = C.parseContentList([{ type: 'text', page_idx: 0, text: '1. 题目' },
        { type: 'image', page_idx: 0, img_path: 'images/a.jpg', image_caption: ['答案', '2. 甲'] }]);
    const payload = O.buildOwnershipPayload({ pages: parsed.pages, questionNumbers: ['1'] });
    assert.equal(payload.blocks.find(x => x.text === '2. 甲').parentId, 'p1b1');
    const blocks = parsed.pages[0].blocks;
    assert.equal(Prompt.buildPayload({ blocks }).blocks.find(x => x.text === '2. 甲').parentId, 'p1b1');
    const paper = S.segmentPaper(blocks);
    assert.equal(paper.combined, false);
    assert.deepEqual(paper.questionSegment.order, ['1']);
});

test('fragment name collisions and invalid source ranges block assembly', () => {
    const q = S.segment([b('q1', '1. 题'), b('q2', '2. 题')]);
    const text = '1. A\n2【答案】B';
    const cut = text.indexOf('2');
    const collided = S.segment([b('raw', text), b(`raw@0:${cut}`, 'other')], { numbers: ['1', '2'], role: 'support' });
    assert.ok(collided.issues.some(x => x.code === 'fragment-id-collision'));
    assert.equal(S.assemble({ questionSegment: q, solutionSegment: collided }).valid, false);
    const damaged = S.segment([b('bad', '1. A', { origin: { blockId: 'source', range: [0, 900] } })], { sourceRegistry: { source: b('source', '1. A') } });
    assert.ok(S.assemble({ questionSegment: S.segment([b('q', '1. 题')]), solutionSegment: damaged }).issues.some(x => x.code === 'invalid-fragment-source'));
});

test('answer titles, tables and their captions stay outside the last question', () => {
    const table = { id: 'table', type: 'table', text: '<table><tr><td>题号</td><td>1</td></tr><tr><td>答案</td><td>A</td></tr></table>' };
    const questions = [b('q1', '1. 题'), b('q2', '2. 题'), b('q3', '3. 题'), b('tail', '最后一题续段')];
    const answers = [b('s1', '1. A'), b('s2', '2. B'), b('s3', '3. C')];
    for (const preamble of [[b('title', '《任意试卷标题》参考答案'), table],
        [b('title', '《任意试卷标题》参考'), table, b('caption', '答案', { parentId: 'table' })],
        [table, b('caption', '《任意标题》参考答案', { parentId: 'table' })]]) {
        const paper = S.segmentPaper([...questions, ...preamble, ...answers]);
        assert.deepEqual(paper.questionSegment.runs.at(-1).blocks.map(x => x.id), ['q3', 'tail']);
        assert.deepEqual(paper.solutionSegment.preamble.map(x => x.id), preamble.map(x => x.id));
        assert.equal(S.assemble(paper).valid, true);
    }
    const questionOnly = S.segmentPaper([...questions, table]);
    assert.equal(questionOnly.combined, false, 'table alone cannot prove an answer section');
});

test('expected numbers alone never turn narrative steps or math into support boundaries', () => {
    for (const math of ['$2. x$', '$$2. x$$', '\\(2. x\\)', '\\[2. x\\]']) {
        const support = S.segment([b('s', `1. A\n计算 ${math}\n  2. 这是第一题的第二个步骤`)], { numbers: ['1', '2'], role: 'support' });
        assert.deepEqual(support.order, ['1']);
        assert.ok(support.issues.some(x => x.code === 'ambiguous-boundary'));
        const built = S.assemble({ questionSegment: S.segment([b('q1', '1. 题'), b('q2', '2. 题')]), solutionSegment: support });
        assert.equal(built.valid, false);
        assert.ok(built.questions.every(q => q.answer === '' && !q.solutionBlocks.length));
    }
    assert.equal(S.numberOnBlock(b('decimal', '2.5 是小数')), null);
    assert.equal(S.numberOnBlock(b('wide', '１２【答案】B')), '12');
});

test('ordinary numeric conclusions are not missing question boundaries', () => {
    const result = S.segment([b('s1', '1. A'), b('s2', '则最小值为 2.'), b('s3', '2. B')], { numbers: ['1', '2'], role: 'support' });
    assert.deepEqual(result.issues, []);
    assert.deepEqual(result.order, ['1', '2']);
});

test('decimal answer notation stays within its question and a single formula-led answer can close a proven gap', () => {
    const numbers = ['12', '13', '14', '15'];
    const questionSegment = S.segment(numbers.map(no => b('q' + no, no + '. 原题')));
    const blocks = [
        b('s12', '12【答案】$\\frac{4}{9}$【解析】概率计算'),
        b('s13', '13 $x=2$ 或 $3x-4y-6=0$ 由题意可得'),
        b('detail', '若斜率存在，代入距离公式。\n14. 【答案】$\\frac{3}{4}$ #0.75【解析】使用向量'),
        b('s15', '15【详解】解题过程')
    ];
    const solutionSegment = S.segment(blocks, { numbers, role: 'support' });
    assert.deepEqual(solutionSegment.order, numbers);
    assert.deepEqual(solutionSegment.issues, []);
    assert.deepEqual(solutionSegment.runs[0].blocks.map(block => block.id), ['s12']);
    const built = S.assemble({ questionSegment, solutionSegment });
    assert.equal(built.valid, true);
    assert.equal(built.questions[1].answer, '$x=2$ 或 $3x-4y-6=0$');
    const declaration = built.questions[1].answerEvidence.evidence[0];
    assert.equal(blocks[1].text.slice(...declaration.range), built.questions[1].answer);
    assert.equal(built.questions[2].answer, '$\\frac{3}{4}$ #0.75');
    assert.match(built.blocksById[built.questions[2].solutionBlocks[0]].text, /#0\.75【解析】/);
});

test('bare formula headings with competing candidates cannot attach to the preceding solution', () => {
    const numbers = ['12', '13', '14'];
    const questionSegment = S.segment(numbers.map(no => b('q' + no, no + '. 原题')));
    const solutionSegment = S.segment([
        b('s12', '12【答案】A'),
        b('a', '13 $x=1$ 或 $x=2$ 原文'),
        b('b', '13 $x=3$ 或 $x=4$ 原文'),
        b('s14', '14【答案】B')
    ], { numbers, role: 'support' });
    assert.deepEqual(solutionSegment.order, ['12', '14']);
    const built = S.assemblePartial({ questionSegment, solutionSegment });
    assert.deepEqual(built.questions[0].solutionBlocks, []);
    assert.equal(built.questions[0].answer, '');
    assert.equal(built.questions[1].answer, '');
    assert.equal(built.questions[2].answer, 'B');
});

test('invalid answer tables cannot disappear behind a second valid table', () => {
    const table = (numbers, answers) => '<table><tr><td>题号</td>' + numbers.map(x => '<td>' + x + '</td>').join('') + '</tr><tr><td>答案</td>' + answers.map(x => '<td>' + x + '</td>').join('') + '</tr></table>';
    const valid = { type: 'table', text: table(['1', '2'], ['A', 'B']) };
    assert.deepEqual(C.parseAnswerTable([valid]), { 1: 'A', 2: 'B' });
    assert.deepEqual(C.answerTableFromHtml(table(['1', '', ''], ['A', '', ''])), { 1: 'A' });
    assert.equal(C.answerTableFromHtml('<table><tr><td>普通统计表</td></tr></table>'), null);
    for (const invalid of [table(['1-2'], ['A']), table(['1', '1'], ['A', 'B']), table(['1', '2'], ['A']), table(['1'], [''])]) {
        assert.throws(() => C.parseAnswerTable([{ type: 'table', text: invalid }, valid]), /题号|答案/);
    }
    assert.throws(() => C.parseAnswerTable([valid, { type: 'table', text: table(['1'], ['C']) }]), /冲突/);
});

test('duplicates, gaps, backwards sequences and duplicate block IDs cannot bind', () => {
    const questionSegment = S.segment([b('q1', '1. 题'), b('q2', '2. 题')]);
    for (const source of [[b('s1', '1. A')], [b('s1', '2. B'), b('s2', '1. A')],
        [b('s1', '1. A'), b('s2', '1. B'), b('s3', '2. C')], [b('same', '1. A'), b('same', '2. B')]]) {
        const result = S.assemble({ questionSegment, solutionSegment: S.segment(source, { numbers: ['1', '2'], role: 'support' }), answerTable: { 1: 'A', 2: 'B' } });
        assert.equal(result.valid, false);
        assert.ok(result.questions.every(q => !q.answer && !q.solutionBlocks.length));
    }
});

test('separate files namespace identities and accept explicit answer markers', () => {
    const paired = P.pairPapers({ questionBlocks: [b('p1b0', '1. 题'), b('p1b1', '2. 题')],
        answerBlocks: [b('p1b0', '1【答案】B'), b('p1b1', '2【答案】'), b('p1b2', '【详解】原文。故选：C。')] });
    assert.equal(paired.coverage.paired, 2);
    assert.deepEqual(paired.questions.map(q => q.answer), ['B', 'C']);
    assert.equal(paired.blocksById[paired.questions[0].stemBlocks[0]].text, '1. 题');
    assert.equal(paired.blocksById[paired.questions[0].solutionBlocks[0]].text, '1【答案】B');
    assert.notEqual(paired.questions[0].stemBlocks[0], paired.questions[0].solutionBlocks[0]);
});

test('invalid expected sequences and empty files never claim valid pairing', () => {
    for (const numbers of [['2', '1'], ['1', '1'], ['1', 'NaN'], ['0']]) {
        const result = S.segment([b('q1', '1. 题'), b('q2', '2. 题')], { numbers });
        assert.ok(result.issues.some(x => x.code === 'invalid-expected-sequence'));
    }
    const empty = P.pairPapers({ questionBlocks: [], answerBlocks: [] });
    assert.equal(empty.valid, false);
    assert.equal(empty.coverage.paired, 0);
});
