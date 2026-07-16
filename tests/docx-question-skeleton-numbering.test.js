const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rich = require('../qisi-docx-rich-content.js');
const support = require('../qisi-docx-support-content.js');

const loadBatchImporter = () => {
    const window = {
        Qisi: { DocxRichContent: rich, DocxSupportContent: support }
    };
    const context = vm.createContext({
        window,
        console,
        fetch: async () => {
            throw new Error('network is forbidden in skeleton tests');
        }
    });
    const source = fs.readFileSync(
        path.resolve(__dirname, '../qisi-batch-importer.js'),
        'utf8'
    );
    vm.runInContext(source, context, {
        filename: 'qisi-batch-importer.js'
    });
    return window.QisiBatchImporter;
};

const paragraph = (text, numId = '', level = 0) => [
    '<w:p>',
    numId
        ? `<w:pPr><w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="${numId}"/></w:numPr></w:pPr>`
        : '',
    `<w:r><w:t>${text}</w:t></w:r>`,
    '</w:p>'
].join('');

const numberingXml = [
    '<w:numbering>',
    '<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0">',
    '<w:start w:val="3"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/>',
    '</w:lvl><w:lvl w:ilvl="1">',
    '<w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1.%2."/>',
    '</w:lvl></w:abstractNum>',
    '<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0">',
    '<w:start w:val="10"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/>',
    '</w:lvl></w:abstractNum>',
    '<w:abstractNum w:abstractNumId="2"><w:lvl w:ilvl="0">',
    '<w:start w:val="1"/><w:numFmt w:val="upperLetter"/><w:lvlText w:val="%1."/>',
    '</w:lvl></w:abstractNum>',
    '<w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>',
    '<w:num w:numId="3"><w:abstractNumId w:val="0"/></w:num>',
    '<w:num w:numId="4"><w:abstractNumId w:val="2"/></w:num>',
    '</w:numbering>'
].join('');

test('question skeleton ignores pre-section answer blanks and resolves Word numbering', () => {
    const importer = loadBatchImporter();
    const documentXml = [
        '<w:document><w:body>',
        paragraph('11. 12.', '1'),
        paragraph('一、选择题（本题共2小题）'),
        paragraph('1. 第一题'),
        paragraph('题内第一小问', '3', 1),
        paragraph('2. 第二题'),
        paragraph('二、填空题（本题共2小题）'),
        paragraph('第三题', '3'),
        paragraph('第四题', '3'),
        '</w:body></w:document>'
    ].join('');

    const skeleton = importer.buildDocxQuestionSkeletonFromXml(
        documentXml,
        numberingXml
    );

    assert.equal(skeleton.authoritative, true);
    assert.deepEqual(
        Array.from(skeleton.questionNumbers),
        ['1', '2', '3', '4']
    );
    assert.equal(skeleton.diagnostics.reason, 'ok');

    const richBlocks = rich.extractDocxRichBlocks(documentXml, {
        numberingXml
    });
    const prepared = importer.prepareDocxQuestionRichBlocks(richBlocks);
    const parsed = rich.parseQuestionRichBlocks(prepared);
    assert.equal(parsed.ok, true);
    assert.deepEqual(
        parsed.questions.map(question => question.number),
        [1, 2, 3, 4]
    );
});

test('question skeleton preserves substantive questions before a later section heading', () => {
    const importer = loadBatchImporter();
    const documentXml = [
        '<w:document><w:body>',
        paragraph('1. 第一题'),
        paragraph('2. 第二题'),
        paragraph('二、填空题（本题共2小题）'),
        paragraph('第三题', '3'),
        paragraph('第四题', '3'),
        '</w:body></w:document>'
    ].join('');

    const skeleton = importer.buildDocxQuestionSkeletonFromXml(
        documentXml,
        numberingXml
    );

    assert.equal(skeleton.authoritative, true);
    assert.deepEqual(
        Array.from(skeleton.questionNumbers),
        ['1', '2', '3', '4']
    );
});

test('combined document skeleton stops before its reference-answer section', () => {
    const importer = loadBatchImporter();
    const documentXml = [
        '<w:document><w:body>',
        paragraph('一、选择题（本题共2小题）'),
        paragraph('1. 第一题'),
        paragraph('2. 第二题'),
        paragraph('《测试卷》参考答案'),
        paragraph('1．A'),
        paragraph('2．B'),
        '</w:body></w:document>'
    ].join('');

    const skeleton = importer.buildDocxQuestionSkeletonFromXml(documentXml, numberingXml);
    assert.equal(skeleton.authoritative, true);
    assert.deepEqual(Array.from(skeleton.questionNumbers), ['1', '2']);
});

test('Word upper-letter numbering restores only missing option labels', () => {
    const importer = loadBatchImporter();
    const documentXml = [
        '<w:document><w:body>',
        paragraph('一、选择题（本题共1小题）'),
        paragraph('1. 题干'),
        paragraph('选项甲', '4'),
        paragraph('B. 选项乙', '4'),
        paragraph('选项丙', '4'),
        paragraph('D. 选项丁', '4'),
        '</w:body></w:document>'
    ].join('');

    const blocks = rich.extractDocxRichBlocks(documentXml, { numberingXml });
    const prepared = importer.prepareDocxQuestionRichBlocks(blocks);
    const parsed = rich.parseQuestionRichBlocks(prepared);

    assert.equal(parsed.ok, true);
    assert.deepEqual(parsed.questions[0].options, ['选项甲', '选项乙', '选项丙', '选项丁']);
    assert.deepEqual(
        Array.from(importer.buildDocxQuestionSkeletonFromXml(documentXml, numberingXml).questionNumbers),
        ['1']
    );
});

test('question skeleton ignores decimal values inside Word tables', () => {
    const importer = loadBatchImporter();
    const scoreTable = [
        '<w:tbl><w:tblGrid><w:gridCol w:w="1200"/><w:gridCol w:w="1200"/></w:tblGrid>',
        '<w:tr><w:tc>', paragraph('评委编号'), '</w:tc><w:tc>', paragraph('模型得分'), '</w:tc></w:tr>',
        '<w:tr><w:tc>', paragraph('7.0'), '</w:tc><w:tc>', paragraph('9.3'), '</w:tc></w:tr>',
        '<w:tr><w:tc>', paragraph('8.3'), '</w:tc><w:tc>', paragraph('8.9'), '</w:tc></w:tr>',
        '</w:tbl>'
    ].join('');
    const documentXml = [
        '<w:document><w:body>',
        paragraph('1. 第一题'),
        scoreTable,
        paragraph('2. 第二题'),
        paragraph('3. 第三题'),
        '</w:body></w:document>'
    ].join('');

    const skeleton = importer.buildDocxQuestionSkeletonFromXml(documentXml, '');

    assert.equal(skeleton.authoritative, true, JSON.stringify(skeleton.diagnostics));
    assert.deepEqual(Array.from(skeleton.questionNumbers), ['1', '2', '3']);
});
