const test = require('node:test');
const assert = require('node:assert/strict');
const { expand } = require('../qisi-docx-numbering.js');
const definitions = start => `<w:numbering><w:abstractNum w:abstractNumId="9"><w:lvl w:ilvl="0"><w:start w:val="${start}"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1．"/></w:lvl></w:abstractNum><w:num w:numId="2"><w:abstractNumId w:val="9"/></w:num></w:numbering>`;
const paragraph = (id, text) => `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${id}"/></w:numPr></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
test('Word automatic numbers come from numbering definitions, including non-one starts', () => {
    const result = expand(paragraph(2, '甲') + paragraph(2, '乙'), definitions(11));
    assert.deepEqual(result.evidence.map(row => row.value), [11, 12]);
    assert.match(result.xml, /11． /);
    assert.match(result.xml, /12． /);
});
test('unsupported and absent numbering definitions never invent identities', () => {
    const doc = paragraph(8, '甲');
    assert.equal(expand(doc, definitions(1)).xml, doc);
    assert.equal(expand(doc).evidence[0].status, 'unresolved');
    assert.equal(expand(paragraph(2, '甲'), definitions(1).replace('decimal', 'bullet')).evidence[0].status, 'unresolved');
});
