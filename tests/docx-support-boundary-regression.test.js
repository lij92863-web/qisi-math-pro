const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const Utils = require('../qisi-utils.js');
const Evidence = require('../qisi-support-evidence.js');
globalThis.Qisi = { ...(globalThis.Qisi || {}), Utils, SupportEvidence: Evidence };

const Validation = require('../qisi-import-validation-service.js');
const FormalAdmissionPolicy = require('../qisi-formal-admission-policy.js');
const ProductionReviewValidator = require('../qisi-production-review-validator.js');
const DocxIdentity = require('../qisi-docx-producer-identity-contract.js');
const ProductionDocxSourcePort = require('../qisi-production-docx-source-port.js');

const Parser = require('../qisi-support-text-parser.js').createSupportTextParser({
    normalizeQuestionKey: String,
    stripQuestionSectionNoise: value => value,
    extractGraphicRefs: () => [],
    normalizeMathTextForLatexSafe: value => value
});

const paragraph = text => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;

async function importDocx(lines) {
    const xml = lines.map(paragraph).join('');
    const context = {
        fetch,
        console: { log() {}, warn() {}, table() {}, groupCollapsed() {}, groupEnd() {} },
        window: {
            JSZip: {},
            Qisi: {
                Utils,
                DocxNumbering: require('../qisi-docx-numbering.js'),
                ArchiveSecurity: {
                    load: async () => ({
                        file: name => name === 'word/document.xml'
                            ? { async: async () => xml } : null
                    })
                },
                DocxFormulaSource: { expand: async value => ({ xml: value, formulas: [] }) }
            }
        }
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../qisi-batch-importer.js'), 'utf8'), context);
    return context.window.QisiBatchImporter.parseDocxFile({
        id: 'support-source', filename: 'fixture.docx',
        uploadPath: 'data:application/octet-stream;base64,', fileType: 'docx'
    });
}

const parseSupport = result => Parser.parseAnswerAndSolutionItemsFromText(result.supportText, {
    id: 'support-source', filename: 'fixture.docx', supportBlocks: result.supportBlocks
});

const project = questionNumber => DocxIdentity.projectDeterministicDocxCandidate({
    candidate: {
        id: 'question-' + questionNumber, version: 1, questionNumber,
        type: '解答题', stem: '题目' + questionNumber, options: [],
        answer: '', solution: '', images: []
    },
    source: { sourceId: 'questions', format: 'docx', filename: 'questions.docx', sourceOrder: 0 },
    index: Number(questionNumber) - 1
});

test('empty producer blocks recover only explicitly labelled answers with known printed numbers', () => {
    const source = { id: 'answer-file', filename: 'answers.docx', roles: ['answer'],
        supportBlocks: [], expectedQuestionNumbers: ['1', '2', '3'] };
    const parsed = Parser.parseAnswerAndSolutionItemsFromText(
        '参考答案\n2. 【答案】D\n99. 【答案】C\n1. 【答案】B\n3. 【答案】', source);
    assert.deepEqual(parsed.answers.map(row => [row.question, row.answer]), [['2', 'D'], ['1', 'B']]);
    assert.deepEqual(parsed.unmatched.map(row => [row.questionNumber, row.sourceFileId]), [
        ['99', 'answer-file'], ['3', 'answer-file']
    ]);
    const conflict = Parser.parseAnswerAndSolutionItemsFromText('1. 【答案】A\n1. 【答案】B', source);
    assert.equal(conflict.answers[0].evidence.state, 'conflict');
});

test('empty producer blocks retain ambiguous support text without copying proof numbers into answers', () => {
    const source = { id: 'proof-file', filename: 'proof.docx', roles: ['answer', 'solution'],
        supportBlocks: [], expectedQuestionNumbers: ['1'] };
    const input = '参考答案\n1. 【答案】B\n【解析】由第 1 步计算';
    const parsed = Parser.parseAnswerAndSolutionItemsFromText(input, source);
    assert.deepEqual(parsed.answers, []);
    assert.deepEqual(parsed.solutions, []);
    assert.equal(parsed.unmatched[0].code, 'DOCX_SUPPORT_BOUNDARY_UNRESOLVED');
    assert.equal(parsed.unmatched[0].rawText, input);
    assert.equal(parsed.unmatched[0].sourceFileName, 'proof.docx');
    assert.equal(Parser.parseAnswerAndSolutionItemsFromText('参考答案', source).unmatched.length, 1);
});

test('descending multipart support heads keep their own blocks and never fabricate an answer', async () => {
    const result = await importDocx([
        '1. 第一题', '2. 第二题', '参考答案',
        '2.(1)第二答案', '【分析】第二题解法',
        '1.(1)第一答案', '【分析】第一题解法'
    ]);
    assert.deepEqual(Array.from(result.supportBlocks, block => block.questionNumber), ['2', '1']);
    assert.equal(result.supportBlocks[0].boundaryStatus, 'accepted');
    assert.equal(result.supportBlocks[1].boundaryStatus, 'rejected');
    assert.equal(result.supportBlocks[1].boundaryReason, 'backward');
    assert.doesNotMatch(result.supportBlocks[0].text, /第一题解法/);
    assert.doesNotMatch(result.supportBlocks[1].text, /第二题解法/);

    const parsed = parseSupport(result);
    assert.deepEqual(parsed.solutions.map(row => [row.question, row.solution]), [['2', '第二题解法']]);
    assert.deepEqual(parsed.answers.map(row => row.question), ['2']);
    assert.equal(parsed.answers[0].answer, '(1)第二答案');
    assert.deepEqual(parsed.conflicts, []);
    const unmatched = parsed.unmatched.find(row => row.questionNumber === '1');
    assert.ok(unmatched, '倒序边界必须留在未归属证据中');
    assert.equal(unmatched.sourceFileId, 'support-source');
    assert.equal(unmatched.sourceFileName, 'fixture.docx');
    assert.match(unmatched.blockId, /^support-p/);
    assert.match(unmatched.rawText, /第一答案[\s\S]*第一题解法/);
    assert.match(unmatched.value, /第一答案[\s\S]*第一题解法/,
        'unmatched 必须有可展示的值，不能是空行');
    const firstDraft = Array.from(result.drafts)
        .find(draft => draft.questionNumber === '1');
    assert.ok(firstDraft);
    const warning = Array.from(firstDraft.warnings)
        .find(item => /DOCX_SUPPORT_BOUNDARY_REVIEW/.test(item));
    assert.ok(warning, '倒序支持边界必须在对应草稿上留下可见 warning');
    assert.match(warning, /倒序/);
});

test('the same question number printed twice stays two declarations with a visible conflict', async () => {
    const result = await importDocx([
        '1. 第一题', '2. 第二题', '参考答案',
        '1.(1)第一答案', '【分析】第一解法',
        '1.(1)不同答案', '【分析】不同解法'
    ]);
    assert.equal(result.supportBlocks.length, 2);
    assert.ok(result.supportBlocks.every(block => block.questionNumber === '1'));
    assert.equal(result.supportBlocks[0].boundaryStatus, 'accepted');
    assert.equal(result.supportBlocks[1].boundaryStatus, 'rejected');
    assert.equal(result.supportBlocks[1].boundaryReason, 'duplicate');

    const parsed = parseSupport(result);
    const answer = parsed.answers.find(row => row.question === '1');
    assert.ok(answer);
    assert.equal(answer.answer, '');
    assert.deepEqual(answer.evidence.values.slice().sort(), ['(1)不同答案', '(1)第一答案'].sort());
    assert.equal(answer.evidence.declarations.length, 2);
    assert.equal(new Set(answer.evidence.declarations.map(row => row.evidenceRef)).size, 2,
        '同号两次声明必须靠独立证据来源区分，不能合成一段文本');
    assert.match(parsed.solutions.find(row => row.question === '1').solution, /^$/);
});

test('a duplicated boundary repeating the same value is deduplicated instead of conflicting', async () => {
    const result = await importDocx([
        '1. 第一题', '2. 第二题', '参考答案',
        '1.(1)相同答案', '【分析】相同解法',
        '1.(1)相同答案', '【分析】相同解法'
    ]);
    const parsed = parseSupport(result);
    const answer = parsed.answers.find(row => row.question === '1');
    assert.ok(answer);
    assert.equal(answer.answer, '(1)相同答案');
    assert.equal(answer.evidence.state, 'unique');
    assert.deepEqual(parsed.conflicts, []);
});

test('unknown support numbers keep their source identity in unmatched instead of creating drafts', async () => {
    for (const unknown of ['99', '999']) {
        const result = await importDocx([
            '1. 第一题', '2. 第二题', '参考答案',
            '1.【解析】第一题解法', `${unknown}.【解析】其他试卷解法`
        ]);
        const parsed = parseSupport(result);
        assert.deepEqual(parsed.solutions.map(row => row.question), ['1'], unknown);
        assert.deepEqual(parsed.answers, [], unknown);
        assert.deepEqual(parsed.conflicts, [], unknown);
        const row = parsed.unmatched.find(item => item.questionNumber === unknown);
        assert.ok(row, `${unknown} 必须进入未归属证据`);
        assert.equal(row.boundaryReason, 'unknown');
        assert.equal(row.expectedQuestion, false);
        assert.equal(row.sourceFileId, 'support-source');
        assert.equal(row.sourceFileName, 'fixture.docx');
        assert.match(row.blockId, /^support-p/);
        assert.equal(typeof row.sourceStart, 'number');
        assert.match(row.rawText, new RegExp(`${unknown}[\\.．]`));
        assert.match(row.value, new RegExp(`${unknown}[\\.．]`),
            '未归属记录必须有可展示的 raw 值');
    }
});

test('ambiguous parenthesized heads fail closed while an ordinary parenthesized paper still imports', async () => {
    const ambiguous = await importDocx(['(1) 第一大题', '(1) 第一小问', '(2) 第二小问', '(2) 第二大题']);
    assert.equal(ambiguous.drafts.length, 0);
    assert.ok(ambiguous.warnings.some(warning => /DOCX_QUESTION_BOUNDARY_AMBIGUOUS/.test(warning)));
    assert.equal(ambiguous.unmatchedAnswers.length, 1);
    assert.match(ambiguous.unmatchedAnswers[0].rawText, /第一大题[\s\S]*第二大题/);

    const legal = await importDocx(['(1) 第一题', '(2) 第二题', '(3) 第三题']);
    assert.deepEqual(Array.from(legal.drafts, draft => draft.questionNumber), ['1', '2', '3']);
    assert.equal(legal.warnings.some(warning => /DOCX_QUESTION_BOUNDARY_AMBIGUOUS/.test(warning)), false);
});

test('a spaced decimal inside a solution never becomes a new question boundary', async () => {
    const result = await importDocx([
        '1. 第一题', '2. 第二题', '参考答案',
        '1.【解析】计算如下', '2 .5 是测量值'
    ]);
    assert.deepEqual(Array.from(result.supportBlocks, block => block.questionNumber), ['1']);
    const parsed = parseSupport(result);
    assert.deepEqual(parsed.solutions.map(row => [row.question, row.solution]),
        [['1', '计算如下\n2.5 是测量值']]);
});

test('an unconverted formula in a multipart answer is preserved as review evidence, never silently dropped', () => {
    const text = '16．(1)甲，理由如下：\n[DOCX不可显示图片:公式:rId703]\n(2)乙，结果如下：';
    const parsed = Parser.parseAnswerAndSolutionItemsFromText(text, {
        id: 'support-source', filename: 'fixture.docx',
        supportBlocks: [{ questionNumber: '16', text }]
    });
    assert.equal(parsed.answers.length, 0, '含未转换公式的答案不得自动挂载');
    const row = parsed.unmatched.find(item =>
        item.questionNumber === '16' && item.field === 'answer');
    assert.ok(row, '不能静默丢掉整条答案声明');
    assert.equal(row.code, 'DOCX_SUPPORT_ANSWER_UNCONVERTED_FORMULA');
    assert.equal(row.unresolvedReason, 'multipart-unconverted-formula');
    assert.equal(row.sourceFileId, 'support-source');
    assert.equal(row.sourceFileName, 'fixture.docx');
    assert.match(row.value, /rId703/);
    assert.match(row.rawText, /16[.．][\s\S]*rId703/);
});

test('the DOCX importer carries an unconverted support formula to draft warning and unmatched evidence', async () => {
    const result = await importDocx([
        '16. 题目', '参考答案',
        '16.(1)甲，理由如下：',
        '[DOCX不可显示图片:公式:rId703]',
        '(2)乙，结果如下：'
    ]);
    assert.deepEqual(Array.from(result.drafts, draft => draft.questionNumber), ['16']);
    assert.ok(Array.from(result.drafts[0].warnings)
        .some(item => /DOCX_SUPPORT_UNCONVERTED_FORMULA/.test(item)),
    '草稿必须提示支持区存在未转换公式');
    const parsed = parseSupport(result);
    assert.equal(parsed.answers.length, 0);
    const row = parsed.unmatched.find(item =>
        item.questionNumber === '16' && item.field === 'answer');
    assert.ok(row);
    assert.equal(row.code, 'DOCX_SUPPORT_ANSWER_UNCONVERTED_FORMULA');
    assert.match(row.value, /rId703/);
});

test('the production source port keeps rejected and unknown blocks in unmatched with their source identity', async () => {
    const parsedDocx = await importDocx([
        '1. 第一题', '2. 第二题', '参考答案',
        '2.(1)第二答案', '【分析】第二题解法',
        '1.(1)第一答案', '【分析】第一题解法',
        '99.【解析】其他试卷解法'
    ]);
    const runner = ProductionDocxSourcePort.createProductionImportRunner({
        coordinator: {
            runDocxImport: async (input, ports) => ({
                drafts: (await ports.parseSource({
                    source: input.sources[0], candidateOffset: 0
                })).drafts,
                draftImages: [], warnings: []
            })
        },
        importer: { parseDocxFile: async () => parsedDocx },
        parseSupportText: (text, source) =>
            Parser.parseAnswerAndSolutionItemsFromText(text, source)
    });
    const result = await runner({
        batchId: 'batch', batch: { id: 'batch' },
        sources: [{
            id: 'support-source', fileType: 'docx', roles: ['full'],
            filename: 'fixture.docx'
        }]
    });
    assert.deepEqual(Array.from(result.drafts, draft =>
        [draft.questionNumber, draft.answer, draft.solution]), [
        ['1', '', ''],
        ['2', '(1)第二答案', '第二题解法']
    ]);
    for (const [question, reason] of [['1', 'backward'], ['99', 'unknown']]) {
        const row = result.unmatchedAnswers.find(item => item.questionNumber === question);
        assert.ok(row, `${question} 必须保留在未归属证据中`);
        assert.equal(row.sourceFileId, 'support-source');
        assert.equal(row.sourceFileName, 'fixture.docx');
        assert.equal(row.boundaryReason, reason);
        assert.match(row.blockId, /^support-p/);
        assert.match(row.rawText, new RegExp(question + '[\\.．]'));
        assert.match(row.value, new RegExp(question + '[\\.．]'));
    }
    assert.ok(Array.from(result.drafts[0].warnings)
        .some(item => /DOCX_SUPPORT_BOUNDARY_REVIEW/.test(item)),
    '生产来源端口必须把支持边界 warning 带到草稿上');
});

test('a rejected backward boundary does not fail the whole batch and stays reviewable', async () => {
    const result = await importDocx([
        '1. 第一题', '2. 第二题', '参考答案',
        '2.(1)第二答案', '【分析】第二题解法',
        '1.(1)第一答案', '【分析】第一题解法'
    ]);
    const parsed = parseSupport(result);
    const solution = parsed.solutions.find(row => row.question === '2');
    const q1 = project('1');
    const q2 = DocxIdentity.applyDeterministicDocxSupportField({
        candidate: project('2'), field: 'solution',
        support: { ...solution, questionNumber: '2' },
        source: { sourceId: 'support-source', format: 'docx', filename: 'fixture.docx', sourceOrder: 1 },
        roles: ['solution']
    });
    const reviewValidator = ProductionReviewValidator.createProductionReviewValidator({
        policy: FormalAdmissionPolicy
    });
    const ports = {
        ...Validation.createProductionValidationPorts({ reviewValidator }),
        context: { files: [{ fileType: 'docx' }], expectedQuestionNumbers: ['1', '2'] }
    };
    const drafts = Validation.validateImportDrafts([q1, q2], ports);
    const first = drafts.find(draft => draft.questionNumber === '1');
    assert.equal(first.answer, '');
    assert.equal(first.solution, '');
    assert.equal(first.fieldProvenance.answer.status, 'missing');
    assert.equal(drafts.find(draft => draft.questionNumber === '2').solution, '第二题解法');
    assert.ok(parsed.unmatched.some(row => row.questionNumber === '1' && row.sourceFileId === 'support-source'));
});
