const test = require('node:test');
const assert = require('node:assert/strict');
const numbering = require('../qisi-docx-numbering.js');

const numberingXml = `<?xml version="1.0" encoding="UTF-8"?>
<w:numbering>
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimalEnclosedParen"/><w:lvlText w:val="%1"/></w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="2">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="upperLetter"/><w:lvlText w:val="%1."/></w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="3">
    <w:lvl w:ilvl="0"><w:start w:val="5"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1、"/></w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="4">
    <w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val=""/></w:lvl>
  </w:abstractNum>
  <w:num w:numId="10"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="11"><w:abstractNumId w:val="1"/></w:num>
  <w:num w:numId="12"><w:abstractNumId w:val="2"/></w:num>
  <w:num w:numId="13"><w:abstractNumId w:val="3"/></w:num>
  <w:num w:numId="14"><w:abstractNumId w:val="4"/></w:num>
</w:numbering>`;

const paragraph = (numId, text) =>
    `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr></w:pPr>` +
    `<w:r><w:t>${text}</w:t></w:r></w:p>`;

const plain = text => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;

test('decimal numbering is expanded — this is the format most papers actually use', () => {
    // 题号用 Word 自动编号（1. 2. 3.）时，编号不在文字里。旧实现只认 upperLetter，
    // 这类试卷会被读成 0 道题，整批拒绝。
    const xml = paragraph(10, '已知函数求导') + paragraph(10, '求单调区间');
    const result = numbering.expand(xml, numberingXml);
    assert.equal(result.expanded, 2);
    assert.match(result.xml, /<w:t xml:space="preserve">1\. <\/w:t>/);
    assert.match(result.xml, /<w:t xml:space="preserve">2\. <\/w:t>/);
});

test('enclosed-paren and full-width suffix formats follow the document template', () => {
    // 后缀不是写死的：模板 %1 原样保留（「1、」），括号形式由格式名决定。
    const paren = numbering.expand(paragraph(11, '第一问'), numberingXml);
    assert.match(paren.xml, /<w:t xml:space="preserve">\(1\) <\/w:t>/);

    const dun = numbering.expand(paragraph(13, '第五题'), numberingXml);
    assert.match(dun.xml, /<w:t xml:space="preserve">5、 <\/w:t>/);
});

test('letter numbering keeps working', () => {
    const result = numbering.expand(paragraph(12, '选项组'), numberingXml);
    assert.match(result.xml, /<w:t xml:space="preserve">A\. <\/w:t>/);
});

test('bullet lists produce no number', () => {
    // 项目符号不是题号，给它编上号会把「分点叙述」变成假题目。
    const result = numbering.expand(paragraph(14, '注意事项'), numberingXml);
    assert.equal(result.expanded, 0);
    assert.doesNotMatch(result.xml, /xml:space="preserve"/);
});

test('numbering after the question region is left untouched', () => {
    // 这是「解析串题」的结构性解法：解析里的分步列表同样是自动编号，
    // 但它出现在答案区之后，绝不能展开成题号。
    const xml = paragraph(10, '题目一') + paragraph(10, '题目二') +
        plain('参考答案') + paragraph(10, '当 x>0 时') + paragraph(10, '当 x<0 时');
    const result = numbering.expand(xml, numberingXml, { beforeIndex: 3 });
    assert.equal(result.expanded, 2);
    assert.equal(result.skipped, 2);
    const tail = result.xml.slice(result.xml.indexOf('参考答案'));
    assert.doesNotMatch(tail, /xml:space="preserve">3/);
});

test('inherited paragraph styles share the declared list and direct cancellation wins', () => {
    const stylesXml = `<w:styles>
        <w:style w:type="paragraph" w:styleId="ListBase"><w:pPr>
            <w:numPr><w:numId w:val="10"/></w:numPr></w:pPr></w:style>
        <w:style w:type="paragraph" w:styleId="Question"><w:basedOn w:val="ListBase"/></w:style>
        </w:styles>`;
    const styled = (text, direct = '') => `<w:p><w:pPr><w:pStyle w:val="Question"/>${direct}</w:pPr>
        <w:r><w:t>${text}</w:t></w:r></w:p>`;
    const result = numbering.expand(styled('题目一') +
        styled('取消编号', '<w:numPr><w:numId w:val="0"/></w:numPr>') +
        paragraph(10, '题目二') + styled('解析步骤'), numberingXml, { stylesXml, beforeIndex: 3 });
    assert.equal(result.expanded, 2);
    assert.equal(result.skipped, 1);
    assert.match(result.xml, />1\. <\/w:t><\/w:r>\s*<w:r><w:t>题目一/);
    assert.match(result.xml, />2\. <\/w:t><\/w:r><w:r><w:t>题目二/);
    assert.doesNotMatch(result.xml, />3\. <\/w:t>/);
});

test('a paragraph that already types its own number is not prefixed twice', () => {
    const xml = paragraph(10, '1. 已经手打了编号');
    const result = numbering.expand(xml, numberingXml);
    assert.doesNotMatch(result.xml, /xml:space="preserve">1\. <\/w:t>/);
});

test('startOverride and non-one start values are honoured', () => {
    const xml = paragraph(13, '起始不是一');
    const result = numbering.expand(xml, numberingXml);
    assert.match(result.xml, /<w:t xml:space="preserve">5、 <\/w:t>/);
});

test('missing or unreadable numbering.xml leaves the document unchanged', () => {
    const xml = paragraph(10, '内容');
    assert.equal(numbering.expand(xml, '').xml, xml);
    assert.equal(numbering.expand(xml, '<not-xml>').xml, xml);
});

test('renderLabel returns empty for unknown formats instead of inventing a number', () => {
    assert.equal(numbering.renderLabel('bullet', '%1.', 1), '');
    assert.equal(numbering.renderLabel('nonexistent', '%1.', 1), '');
    assert.equal(numbering.renderLabel('decimal', '', 7), '7.');
});

test('chinese numbering covers the single and double digit cases', () => {
    assert.equal(numbering.renderLabel('chineseCounting', '%1、', 1), '一、');
    assert.equal(numbering.renderLabel('chineseCounting', '%1、', 10), '十、');
    assert.equal(numbering.renderLabel('chineseCounting', '%1、', 21), '二十一、');
});
