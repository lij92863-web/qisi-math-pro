const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Utils = require('../qisi-utils.js');
globalThis.Qisi = { ...(globalThis.Qisi || {}), Utils };
const Evidence = require('../qisi-support-evidence.js');
const Parser = require('../qisi-support-text-parser.js').createSupportTextParser({
    normalizeQuestionKey: String, stripQuestionSectionNoise: x => x,
    extractGraphicRefs: () => [], normalizeMathTextForLatexSafe: x => x
});
const Source = require('../qisi-production-docx-source-port.js');
const parse = text => Parser.parseAnswerAndSolutionItemsFromText(text, { id: 's', filename: 's.docx' });
async function runSupport(supports) {
    const question = { id: 'q', fileType: 'docx', roles: ['question'] };
    const runner = Source.createProductionImportRunner({
        coordinator: { runDocxImport: async (input, ports) => ({
            drafts: (await ports.parseSource({ source: input.sources[0], candidateOffset: 0 })).drafts,
            draftImages: [], warnings: []
        }) },
        importer: { parseDocxFile: async source => source.id === 'q' ? { drafts: [{
            id: 'd', questionNumber: '1', stem: '题目', type: '单选题',
            options: ['甲', '乙', '丙', '丁'], answer: '', solution: '', images: []
        }] } : { drafts: [], supportText: source.text } },
        parseSupportText: (text, source) => Parser.parseAnswerAndSolutionItemsFromText(text, source)
    });
    return runner({ batchId: 'b', batch: { id: 'b' }, sources: [question,
        ...supports.map((source, i) => ({ id: 's' + i, fileType: 'docx', roles: ['answer'], ...source }))] });
}

test('support evidence is associative, commutative and idempotent; conflict is absorbing', () => {
    const a = { value: 'A', sourceId: 'a' }, b = { value: 'B', sourceId: 'b' }, c = { value: 'C', sourceId: 'c' };
    const expected = Evidence.aggregate(null, [a, b, c]);
    for (const order of [[a,b,c], [a,c,b], [b,a,c], [b,c,a], [c,a,b], [c,b,a]]) {
        assert.deepEqual(order.reduce((state, row) => Evidence.aggregate(state, [row]), null), expected);
        assert.deepEqual(Evidence.aggregate(null, [...order, ...order]), expected);
    }
    assert.equal(expected.state, 'conflict');
    assert.equal(expected.value, '');
    assert.deepEqual(expected.values, ['A', 'B', 'C']);
    assert.deepEqual(Evidence.aggregate(expected, []), expected);
});

test('real parser and production source runner preserve conflicts across all source permutations', async () => {
    for (const values of ['ABC','ACB','BAC','BCA','CAB','CBA']) {
        const result = await runSupport([...values].map(value => ({ text: `1. 【答案】${value}` })));
        const draft = result.drafts[0];
        assert.equal(draft.answer, '');
        assert.equal(draft.fieldProvenance.answer.status, 'rejected');
        assert.deepEqual(draft.supportEvidence.answer.values, ['A','B','C']);
    }
});

test('single-file conflicts remain reviewable and do not abort the import', async () => {
    const result = await runSupport([{ text: '答案：\n1. A\n1. B\n1. C' }]);
    assert.equal(result.drafts[0].answer, '');
    assert.equal(result.drafts[0].fieldProvenance.answer.status, 'rejected');
    assert.deepEqual(result.drafts[0].supportEvidence.answer.values, ['A','B','C']);
});

test('a solution-only source cannot reject or replace the answer', async () => {
    const result = await runSupport([{ text: '1. 【答案】A' }, {
        roles: ['solution'], text: '1. 【答案】B\n1. 【答案】C\n【解析】完整解析'
    }]);
    assert.equal(result.drafts[0].answer, 'A');
    assert.equal(result.drafts[0].solution, '完整解析');
    assert.equal(result.drafts[0].fieldProvenance.answer.sourceId, 's0');
});

test('substring solutions from different original ranges conflict without truncating evidence', () => {
    const long = '前提'.repeat(160) + 'x=10';
    const result = parse(`1. 【解析】x=1\n1. 【解析】${long}`);
    assert.equal(result.solutions[0].solution, '');
    assert.deepEqual(result.conflicts[0].values.sort(), ['x=1', long].sort());
    assert.equal(result.solutions[0].evidence.declarations.length, 2);
    assert.notDeepEqual(...result.solutions[0].evidence.declarations.map(row => row.range));
});

test('a table suppresses re-extraction of its cells, not independent declarations with the same numbers', () => {
    const result = parse('题号：1 2\n答案：A B\n答案：1.C 2.D');
    assert.deepEqual(result.answers.map(row => row.answer), ['', '']);
    assert.deepEqual(result.conflicts.map(row => row.values), [['A','C'], ['B','D']]);
    assert.deepEqual(parse('题号：1 2 3 4\n答案：A 2 C 4').answers.map(row => row.answer), ['A','2','C','4']);
    const multiple = parse('题号：1 2\n答案：A B\n题号：1 2\n答案：C D');
    assert.deepEqual(multiple.conflicts.map(row => row.values), [['A','C'], ['B','D']]);
    const malformed = parse('题号：1 2\n答案：A B C\n答案：1.D 2.A');
    assert.deepEqual(malformed.answers.map(row => row.answer), ['D', 'A']);
});

test('unlabelled solution boundaries retain evidence instead of attaching numeric steps', () => {
    const input = '答案：1.A 2.B\n解析：\n1. 由题意得 x=2。\n2. 当 x>0 时 f(x) 递增。\n3. 综上。';
    const result = parse(input);
    assert.ok(result.solutions.length);
    for (const row of result.solutions) {
        assert.equal(row.solution, '');
        assert.equal(row.evidence.state, 'conflict');
        assert.match(row.evidence.declarations[0].value, /综上/);
    }
});

const paragraph = (text, numbered = false) => '<w:p>' + (numbered
    ? '<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>' : '')
    + '<w:r><w:t>' + text + '</w:t></w:r></w:p>';
const numberingXml = '<w:numbering><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>';
function importer(documentXml) {
    const files = { 'word/document.xml': documentXml, 'word/numbering.xml': numberingXml };
    const context = { fetch, console: { log() {}, warn() {}, table() {}, groupCollapsed() {}, groupEnd() {} }, window: {
        JSZip: {}, Qisi: { Utils, DocxNumbering: require('../qisi-docx-numbering.js'),
            ArchiveSecurity: { load: async () => ({ file: name => files[name] === undefined ? null : { async: async () => files[name] } }) },
            DocxFormulaSource: { expand: async xml => ({ xml, formulas: [] }) }
        }
    } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../qisi-batch-importer.js'), 'utf8'), context);
    return context.window.QisiBatchImporter.parseDocxFile({ id: 'q', filename: 'q.docx', uploadPath: 'data:application/octet-stream;base64,', fileType: 'docx' });
}

test('the actual DOCX importer uses one support heading boundary for every accepted spelling', async () => {
    for (const heading of ['参考答案', '参考答案：', '【参考答案】', '答案详解']) {
        const result = await importer(paragraph('1. 求函数定义域') + paragraph(heading) + paragraph('1. 【答案】A'));
        assert.equal(result.drafts.length, 1, heading);
        assert.equal(result.drafts[0].stem, '求函数定义域');
        assert.match(result.supportText, /【答案】A/);
    }
});

test('blank paragraphs do not change automatic question numbering or boundaries', async () => {
    for (const blanks of [0, 1, 4]) {
        const xml = paragraph('').repeat(blanks) + paragraph('求函数定义域', true)
            + paragraph('').repeat(blanks) + paragraph('求方程的实根', true)
            + paragraph('参考答案') + paragraph('1. A');
        const result = await importer(xml);
        assert.deepEqual(Array.from(result.drafts, row => row.questionNumber), ['1','2']);
        assert.deepEqual(Array.from(result.drafts, row => row.stem), ['求函数定义域','求方程的实根']);
    }
});

test('parenthesized question numbers survive DOCX extraction', async () => {
    const result = await importer(paragraph('（1）求函数值') + paragraph('（2）求实数根'));
    assert.deepEqual(Array.from(result.drafts, row => row.questionNumber), ['1','2']);
});

test('parenthesized subquestions stay inside their numbered DOCX parent', async () => {
    const result = await importer(
        paragraph('15. 已知三角形 ABC') + paragraph('（1）求角 B') + paragraph('（2）求面积') +
        paragraph('16. 已知函数 f(x)') + paragraph('（1）求单调区间') +
        paragraph('参考答案') + paragraph('15. 【答案】见解析')
    );
    assert.deepEqual(Array.from(result.drafts, row => row.questionNumber), ['15', '16']);
    assert.match(result.drafts[0].rawBlock, /\(1\)求角 B/);
    assert.match(result.drafts[0].rawBlock, /\(2\)求面积/);
    assert.match(result.drafts[1].rawBlock, /\(1\)求单调区间/);
});

test('spaced DOCX question delimiter before a digit is not a decimal point', async () => {
    const result = await importer(paragraph('12 .已知向量') +
        paragraph('13 .2025年志愿者分配方案') + paragraph('14 .设函数'));
    assert.deepEqual(Array.from(result.drafts, row => row.questionNumber), ['12', '13', '14']);
});

test('DOCX full-role support blocks stop at the next declared top-level question', async () => {
    const result = await importer(
        paragraph('14. 已知函数') + paragraph('15. 已知三角形') + paragraph('（1）求角') +
        paragraph('16. 已知数列') + paragraph('参考答案') +
        paragraph('14. 【答案】区间') + paragraph('【详解】第十四题解法') +
        paragraph('15.(1)角的值') + paragraph('（2）面积') + paragraph('【分析】第十五题分析') +
        paragraph('16.(1)首项') + paragraph('【详解】第十六题解法')
    );
    assert.deepEqual(Array.from(result.supportBlocks, row => row.questionNumber), ['14', '15', '16']);
    assert.doesNotMatch(result.supportBlocks[0].text, /第十五题分析/);
    assert.match(result.supportBlocks[1].text, /[（(]2[）)]面积/);
    assert.doesNotMatch(result.supportBlocks[1].text, /第十六题解法/);
});

test('DOCX native number separator preserves a numeric answer without treating it as a decimal', async () => {
    const result = await importer(paragraph('12 .已知向量') +
        paragraph('13 .2025年志愿者分配方案') + paragraph('14 .设函数') +
        paragraph('参考答案') + paragraph('12．$-4$') +
        paragraph('13．14') + paragraph('14．$\\frac{8}{3}$'));
    assert.deepEqual(Array.from(result.supportBlocks, row => row.questionNumber), ['12', '13', '14']);
    assert.equal(result.supportBlocks[1].numericAnswer, '14');
    const parsed = Parser.parseAnswerAndSolutionItemsFromText(result.supportText, {
        id: 's', filename: 's.docx', supportBlocks: result.supportBlocks
    });
    assert.equal(parsed.answers.find(row => row.question === '13').answer, '14');
});

test('structural DOCX support blocks retain bare objective answers and bound solutions', () => {
    const text = '1.A\n2.B\n14. 【答案】区间\n【详解】第十四题解法\n15.(1)角的值\n【分析】第十五题分析';
    const blocks = [
        { questionNumber: '1', text: '1.A' },
        { questionNumber: '2', text: '2.B' },
        { questionNumber: '14', text: '14. 【答案】区间\n【详解】第十四题解法' },
        { questionNumber: '15', text: '15.(1)角的值\n【分析】第十五题分析' }
    ];
    const result = Parser.parseAnswerAndSolutionItemsFromText(text, {
        id: 's', filename: 's.docx', supportBlocks: blocks
    });
    assert.deepEqual(result.answers.map(row => [row.question, row.answer]), [
        ['1', 'A'], ['2', 'B'], ['14', '区间'], ['15', '(1)角的值']
    ]);
    assert.match(result.solutions.find(row => row.question === '14').solution, /第十四题解法/);
    assert.doesNotMatch(result.solutions.find(row => row.question === '14').solution, /第十五题分析/);
});

test('structural DOCX multipart answers require ordered parts and converted content', () => {
    const blocks = [
        { questionNumber: '15', text: '15.(1)角的值\n(2)三角形面积\n【分析】解法' },
        { questionNumber: '16', text: '16.(1)相关系数 [DOCX不可显示图片:公式:rId1]\n(2)回归方程\n【分析】解法' },
        { questionNumber: '17', text: '17.(1)矩形\n(3)最值\n【分析】解法' }
    ];
    const parsed = Parser.parseAnswerAndSolutionItemsFromText(blocks.map(row => row.text).join('\n'), {
        id: 's', filename: 's.docx', supportBlocks: blocks
    });
    assert.match(parsed.answers.find(row => row.question === '15').answer, /\(2\)三角形面积/);
    assert.equal(parsed.answers.some(row => row.question === '16'), false);
    assert.equal(parsed.answers.some(row => row.question === '17'), false);
});

test('DOCX support rejects backward and unknown declarations without swallowing their ranges', async () => {
    for (const base of [1, 41, 137]) {
        const q = String(base), next = String(base + 1), unknown = String(base + 7);
        for (const heading of [`${q}.(1)首题答案`, `${unknown}.【解析】异卷解析`]) {
            const result = await importer(paragraph(`${q}. 第一题`) + paragraph(`${next}. 第二题`) +
                paragraph('参考答案') + paragraph(`${next}.(1)第二答案`) + paragraph('【分析】第二题解法') +
                paragraph(heading) + paragraph('【分析】后一区间'));
            assert.equal(result.supportBlocks.length, 2);
            assert.doesNotMatch(result.supportBlocks[0].text, /后一区间|首题答案|异卷解析/);
            assert.equal(result.supportBlocks[1].boundaryStatus, 'rejected');
            const parsed = Parser.parseAnswerAndSolutionItemsFromText(result.supportText, {
                id: 's', filename: 's.docx', supportBlocks: result.supportBlocks
            });
            assert.ok(parsed.solutions.every(row => row.question !== unknown));
            assert.ok(parsed.solutions.every(row => !row.solution.includes('后一区间')));
            assert.ok(parsed.unmatched.length > 0);
        }
    }
});

test('DOCX repeated multipart heads are independent conflicting declarations', async () => {
    const result = await importer(paragraph('1. 第一题') + paragraph('2. 第二题') + paragraph('参考答案') +
        paragraph('1.(1)甲答案') + paragraph('【分析】甲解法') +
        paragraph('1.(1)乙答案') + paragraph('【分析】乙解法'));
    assert.equal(result.supportBlocks.length, 2);
    const parsed = Parser.parseAnswerAndSolutionItemsFromText(result.supportText, {
        id: 's', filename: 's.docx', supportBlocks: result.supportBlocks
    });
    assert.equal(parsed.answers.find(row => row.question === '1').answer, '');
    assert.equal(parsed.solutions.find(row => row.question === '1').solution, '');
    assert.equal(parsed.solutions[0].evidence.declarations.length, 2);
});

test('a structural support block never creates another question identity from its body', () => {
    const parsed = Parser.parseAnswerAndSolutionItemsFromText('99.【解析】不属于该结构块的题头', {
        id: 's', filename: 's.docx', supportBlocks: [{ questionNumber: '7',
            text: '7.【解析】本块原文\n99.【解析】保留的正文', sourceStart: 200 }]
    });
    assert.deepEqual(parsed.solutions.map(row => row.question), ['7']);
    assert.equal(parsed.answers.length, 0);
    assert.ok(parsed.solutions[0].evidence.declarations.every(row => /block/.test(row.evidenceRef)));
});

test('ambiguous parenthesized DOCX parents and subquestions remain evidence, never duplicate drafts', async () => {
    const result = await importer(['(1) 第一大题','(1) 第一小问','(2) 第二小问','(2) 第二大题'].map(text => paragraph(text)).join(''));
    assert.equal(result.drafts.length, 0);
    assert.ok(result.warnings.some(warning => /DOCX_QUESTION_BOUNDARY_AMBIGUOUS/.test(warning)));
    assert.ok(result.unmatchedAnswers.some(row => /第一大题[\s\S]*第二大题/.test(row.rawText)));
});

test('DOCX answer summary and a declared solution section are independent ranges', async () => {
    const result = await importer(['1. 第一题','2. 第二题','参考答案','题号：1 2','答案：A B',
        '解析：','1. 【解析】甲解法','2. 【解析】乙解法'].map(text => paragraph(text)).join(''));
    const parsed = Parser.parseAnswerAndSolutionItemsFromText(result.supportText, {
        id: 's', filename: 's.docx', supportBlocks: result.supportBlocks
    });
    assert.deepEqual(parsed.answers.map(row => row.answer), ['A', 'B']);
    assert.deepEqual(parsed.solutions.map(row => row.solution), ['甲解法', '乙解法']);
    assert.equal(parsed.conflicts.length, 0);
});

test('punctuated and complete unpunctuated option rows preserve the DOCX stable behavior', async () => {
    for (const punctuation of ['', '.']) {
        const xml = paragraph('1. 求下列式子的值') + ['甲','乙','丙','丁'].map((value, i) => paragraph(String.fromCharCode(65+i) + punctuation + ' ' + value)).join('');
        const result = await importer(xml);
        assert.deepEqual(Array.from(result.drafts[0].options), ['甲','乙','丙','丁']);
    }
});

test('math tokens cannot become option labels and original offsets are preserved', () => {
    const input = '题干 $\\{ A: x>0, B: y>0 \\}$\r\nA. $1$\r\nB. $2$\r\nC. $3$\r\nD. $4$';
    const result = Utils.splitOptionLabels(input);
    assert.match(result.stem, /B: y>0/);
    assert.deepEqual(result.options, ['$1$', '$2$', '$3$', '$4$']);
    assert.deepEqual(Utils.findOptionLabels('点 A 在直线上'), []);
});

test('same-number short questions and conflicting fields preserve every full candidate', () => {
    const output = require('../qisi-production-import-output-port.js');
    for (const stems of [['求定义域','求值域'], ['相同题目','相同题目']]) {
        const drafts = stems.map((stem, i) => ({ id: 'd'+i, sourceFileId: 's', questionNumber: '1', stem, answer: i ? 'B' : 'A', solution: '保留全部'.repeat(100) }));
        const result = output.projectImportOutput({ drafts });
        assert.equal(result.drafts.length, 2);
        assert.equal(result.removedIds.size, 0);
        assert.equal(result.drafts[1].solution, drafts[1].solution);
    }
});

test('compatible duplicate options fill placeholders independently of input order and candidate id', () => {
    const output = require('../qisi-production-import-output-port.js');
    for (const empty of [[], ['', '', '', ''], ['A.', 'B.', 'C.', 'D.']]) {
        for (const ids of [['a', 'z'], ['z', 'a']]) {
            const rows = [
                { id: ids[0], sourceFileId: 's', questionNumber: '1', stem: '求值', options: empty },
                { id: ids[1], sourceFileId: 's', questionNumber: '1', stem: '求值', options: ['甲', '乙', '丙', '丁'] }
            ];
            for (const drafts of [rows, [...rows].reverse()]) {
                const result = output.projectImportOutput({ drafts: structuredClone(drafts) });
                assert.equal(result.drafts.length, 1);
                assert.deepEqual(result.drafts[0].options, ['甲', '乙', '丙', '丁']);
            }
        }
    }
});

test('dedupe preserves submitted draft assets and deleted detail reads are invisible', async () => {
    const { FakeDatabase } = require('./storage-test-harness.js');
    const Storage = require('../qisi-storage-repository.js');
    const Persistence = require('../qisi-draft-persistence-service.js');
    const Maintenance = require('../qisi-draft-maintenance-service.js');
    const Output = require('../qisi-production-import-output-port.js');
    const questions = ['submitted','pending'].map((status,i) => ({ id: 'd'+i, batchId: 'b', questionNumber: String(i+1), order: i+1, status, stem: '题目'+i, options: [], ...(i ? {} : { submittedQuestionId: 'formal' }) }));
    const images = questions.map(q => ({ id: 'im-'+q.id, batchId: 'b', questionId: q.id, status: 'assigned' }));
    const db = new FakeDatabase({ draftImportBatches: [{ id: 'b', status: 'review', draftPersistence: { version: 0 } }], draftQuestions: questions, draftImages: images });
    const repository = Storage.createRepository(db);
    const persistence = Object.fromEntries(['reloadDraftBatch','persistReviewDraftBatch','refreshDraftBatchStats','deleteDraftBatch'].map(name => [name, (...args) => Persistence[name](...args, repository)]));
    const service = Maintenance.createDraftMaintenanceService({ persistence,
        dedupeDrafts: (drafts, args) => Output.projectImportOutput({ drafts, draftImages: args.draftImages }),
        countOptions: x => x.length, problemsForDraft: () => [], preserveRawEvidence: () => {}, cleanDisplayFields: () => {} });
    await service.dedupeBatchDrafts({ batchId: 'b' });
    assert.deepEqual((await db.table('draftImages').toArray()).sort((a,b) => a.id.localeCompare(b.id)), images);
    assert.deepEqual((await repository.loadDraftBatch('b')).questions.map(row => row.order), [1,2]);
    await service.deleteDraftQuestion({ batchId: 'b', draftId: 'd0', reason: 'review', actorId: 'teacher' });
    assert.equal((await repository.loadDraftReview('b', 'd0')).draft, undefined);
    assert.ok(await db.table('draftQuestions').get('d0'));
    assert.ok(await db.table('draftImages').get('im-d0'));
});

test('the print gate checks the same prepared bare math as the renderer', () => {
    const Gate = require('../qisi-handout-formula-gate.js');
    for (const stem of ['\\frac{1}{', '\\begin{cases}\\badcommand\\end{cases}']) {
        const result = Gate.check([{ stem }]);
        assert.equal(result.ok, false);
        assert.ok(result.blocking.some(issue => issue.kind === 'compile-error'));
    }
    assert.equal(Gate.check([{ stem: '\\frac{1}{2}' }]).ok, true);
    assert.equal(Gate.preparePrintSource('\\frac{1}{2}'), '$\\frac{1}{2}$');
    assert.equal(Gate.check([{ stem: '题目', solution: '$\\badcommand$' }], { includeSolution: false }).ok, true);
    assert.equal(Gate.check([{ stem: '题目', solution: '$\\badcommand$' }], { includeSolution: true }).ok, false);
});
