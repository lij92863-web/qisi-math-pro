const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const Utils = require('../qisi-utils.js');
const External = require('../qisi-pdf-external-contract.js');
const Multimodal = require('../qisi-pdf-multimodal-contract.js');
const PageParser = require('../qisi-page-question-parser.js');

// 三条产品路径的挂载方式与生产一致：共享实现在 Qisi.Utils 上，其余模块按main.html 顺序消费。
const ROOT = { Qisi: { Utils } };

const pageParser = PageParser.createPageQuestionParser({
    cleanDisplayTextForBatchSave: (text) => Utils.cleanDisplayTextForBatchSave(text),
    normalizeQuestionKey: (text) => String(text || '').trim(),
    hasChoiceLabelSignal: (text) => {
        const labels = new Set(Utils.findOptionLabels(Utils.cleanRecognizedText(text)).map(hit => hit.label));
        return labels.has('A') && labels.has('B');
    }
});

// DOCX 块解析只在浏览器 IIFE 里存在，测试沿用既有做法：把它挂到 window.Qisi 下再取。
const importerSource = fs.readFileSync(path.join(__dirname, '../qisi-batch-importer.js'), 'utf8');
const importerContext = { window: { Qisi: { Utils } } };
vm.runInNewContext(
    importerSource.replace(
        'window.QisiBatchImporter = {',
        'window.QisiBatchImporter = { parseOptionsFromBlock,'
    ),
    importerContext
);
const docxOptions = text => importerContext.window.QisiBatchImporter
    .parseOptionsFromBlock({ rawXmlParts: [text], lines: [text], q: 'q1' }, new Map(), {})
    .options;

const externalProjection = (text, type = '单选题') => External.projectEditorSource(text, {
    type,
    stem: '占位',
    options: [],
    pdfExternal: { optionLabels: [] }
});

const multimodalProjection = (text, type = '单选题') => Multimodal.projectEditorSource(text, {
    type,
    stem: '占位',
    options: [],
    pdfV1: { optionLabels: [] }
});

const fiveWritingStyles = [
    ['A. 苹果', 'A. 苹果'],
    ['A) 苹果', 'A. 苹果'],
    ['A：苹果', 'A. 苹果'],
    ['A.苹果', 'A. 苹果'],
    ['A、苹果', 'A. 苹果']
];

test('五种选项标签写法在共享实现里归一为同一个标签 A 与同一段选项文本', () => {
    for (const [source, expected] of fiveWritingStyles) {
        const parsed = Utils.splitOptionLabels(`下列水果\n${source}`);
        assert.deepEqual(parsed.optionLabels, ['A'], source);
        assert.deepEqual(parsed.options, ['苹果'], source);
        assert.equal(parsed.stem, '下列水果', source);
    }
});

test('不变量：同一段选项文本，PDF 审核投影、页级块解析、DOCX 块解析的标签与选项文本序列一致', () => {
    const cases = [
        '下列水果\nA. 苹果\nB. 香蕉\nC. 橘子\nD. 葡萄',
        '下列水果\nA) 苹果\nB）香蕉\nC：橘子\nD、葡萄',
        '下列水果\nA.苹果\nB.香蕉\nC.橘子\nD.葡萄',
        '下列水果\nＡ．苹果\nＢ．香蕉\nＣ．橘子\nＤ．葡萄',
        '下列水果\n(A) 苹果\n(B) 香蕉\n(C) 橘子\n(D) 葡萄'
    ];

    for (const source of cases) {
        const shared = Utils.splitOptionLabels(source);
        const external = externalProjection(source);
        const multimodal = multimodalProjection(source);

        assert.deepEqual(external.optionLabels, shared.optionLabels, source);
        assert.deepEqual(external.options, shared.options, source);
        assert.deepEqual(multimodal.optionLabels, shared.optionLabels, source);
        assert.deepEqual(multimodal.options, shared.options, source);

        const page = pageParser.parseOptionsFromBlock(source);
        assert.deepEqual(page.options, shared.options, source);

        const docx = docxOptions(source);
        assert.deepEqual(Array.from(docx).slice(0, 4), shared.options, source);
    }
});

test('source 不含选项行时题干不被切碎，选项为空', () => {
    const plain = '已知△ABC中，AB=AC，D 是BC 上的一点。求∠ADC 的度数。';
    const shared = Utils.splitOptionLabels(plain);
    assert.equal(shared.stem, plain);
    assert.deepEqual(shared.optionLabels, []);
    assert.deepEqual(shared.options, []);

    const external = externalProjection(plain);
    assert.equal(external.stem, plain);
    assert.deepEqual(external.optionLabels, []);
    assert.deepEqual(external.options, []);

    const page = pageParser.parseOptionsFromBlock(plain);
    assert.equal(Utils.cleanRecognizedText(page.stem), Utils.cleanRecognizedText(plain));
    assert.deepEqual(page.options.filter(Boolean), []);
});

test('不变量：系统自己写出的 editorSource 往返一次后完全等价', () => {
    const source = '下列水果\n\nA. 苹果\nB. 香蕉\nC. 橘子\nD. 葡萄';
    for (const [contract, key, seed] of [
        [External, 'pdfExternal', { optionLabels: ['A', 'B', 'C', 'D'] }],
        [Multimodal, 'pdfV1', { optionLabels: ['A', 'B', 'C', 'D'] }]
    ]) {
        const draft = {
            type: '单选题',
            stem: '下列水果',
            options: ['苹果', '香蕉', '橘子', '葡萄'],
            [key]: seed
        };
        const once = contract.editorSource(draft);
        assert.equal(once, source);
        assert.deepEqual(contract.projectEditorSource(once, draft).options, draft.options);
        assert.deepEqual(contract.projectEditorSource(once, draft).optionLabels, draft[key].optionLabels);
        assert.equal(contract.projectEditorSource(once, draft).stem, draft.stem);
    }
});

test('只有宽口径有候选而正式标签未采纳时才报"选项格式未识别"，正常文本不产生噪声', () => {
    const problemFor = (Contract, stem, optionLabels) => Contract.reviewProblem({
        pdfExternal: { taskProblems: [], optionLabels },
        pdfV1: { optionLabels },
        status: 'pending',
        fieldProvenance: {},
        stem,
        type: '单选题',
        options: optionLabels.map(() => '占位'),
        answer: 'A',
        solution: '',
        images: [],
        imageReviewStatus: 'confirmed'
    });

    // 数字标签行：有宽口径候选但正式标签为空 -> 报格式未识别，而不是"答案标签不一致"。
    assert.match(
        problemFor(External, '下列水果\n1. 苹果\n2. 香蕉', []),
        /选项格式未识别/
    );
    assert.match(
        problemFor(Multimodal, '下列水果\n1. 苹果\n2. 香蕉', []),
        /选项格式未识别/
    );

    // 纯题干没有候选行：不报格式未识别。
    assert.doesNotMatch(
        problemFor(External, '已知△ABC中，AB=AC。', []),
        /选项格式未识别/
    );

    // 标签已认下：数字检测不适用，仍走标签完整性/答案一致性判断。
    assert.doesNotMatch(
        problemFor(External, '下列水果\n1. 苹果\n2. 香蕉', ['A', 'B']),
        /选项格式未识别/
    );
});

test('非选择题型不做选项切分，题干是原文', () => {
    const source = '几何证明\nA. $AB = 2$，原文保留';
    assert.equal(externalProjection(source, '解答题').stem, source);
    assert.equal(multimodalProjection(source, '解答题').stem, source);
    assert.deepEqual(externalProjection(source, '解答题').optionLabels, []);
});