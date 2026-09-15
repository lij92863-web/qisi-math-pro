const test = require('node:test');
const assert = require('node:assert/strict');

const pipeline = require('../qisi-docx-pipeline.js');

// Structural elements whose names start with "w:t" used to match the unanchored "w:t" alternative of
// the paragraph text extractor, so their attribute values were treated as document text. On the real
// 周二晚测.docx that produced 13-14 digit runs glued to option labels and question numbers.
const STRUCTURAL_ONLY =
    '<w:p><w:pPr><w:tblPr><w:tblW w:w="1052" w:type="dxa"/><w:tblBorders><w:top w:val="single"/></w:tblBorders></w:tblPr>'
    + '<w:tcPr><w:tcW w:w="815" w:type="dxa"/></w:tcPr></w:pPr>'
    + '<w:t>11. 在正方体中</w:t></w:p>';

test('structural elements are not mistaken for text elements', () => {
    const text = pipeline.extractPlainTextFromDocxOptionXmlFragment(STRUCTURAL_ONLY);

    assert.equal(text, '11. 在正方体中');
    assert.doesNotMatch(text, /w:val=|w:w=|dxa|tblPr|tcPr/);
});

test('no long digit run can be assembled out of attribute values', () => {
    const text = pipeline.extractPlainTextFromDocxOptionXmlFragment(STRUCTURAL_ONLY);

    assert.deepEqual([...new Set(text.match(/\d{10,15}/g) || [])], []);
});

test('the real text element is still read, including a legitimately long number', () => {
    const text = pipeline.extractPlainTextFromDocxOptionXmlFragment(
        '<w:p><w:r><w:t>学号 1234567890123 的同学</w:t></w:r></w:p>'
    );

    assert.equal(text, '学号 1234567890123 的同学');
});

test('a standard media token survives the extraction untouched', () => {
    const text = pipeline.extractPlainTextFromDocxOptionXmlFragment(
        '<w:p><w:r><w:t>[[IMAGE:1234567890123]]11.</w:t></w:r></w:p>'
    );

    assert.equal(text, '[[IMAGE:1234567890123]]11.');
    assert.match(text, /\[\[IMAGE:/, 'the token keeps its wrapper');
});

test('the paragraph map still returns every paragraph with clean text', () => {
    const document = `<w:body>${STRUCTURAL_ONLY}${STRUCTURAL_ONLY}</w:body>`;
    const { paragraphs } = pipeline.splitDocxParagraphsForOptionMap(document);

    assert.equal(paragraphs.length, 2);
    for (const paragraph of paragraphs) {
        assert.equal(paragraph.text, '11. 在正方体中');
    }
});
