const test = require('node:test');
const assert = require('node:assert/strict');

const rich = require('../qisi-docx-rich-content.js');

const wrapDocument = paragraphs => [
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
    ' xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"',
    ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
    ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"',
    ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">',
    '<w:body>',
    ...paragraphs,
    '</w:body></w:document>'
].join('');

const textParagraph = text => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

test('question state machine stops options at section and next-question boundaries', () => {
    const documentXml = wrapDocument([
        textParagraph('一、单选题'),
        textParagraph('1. 第一题题干'),
        textParagraph('A. 甲    B. 乙'),
        '<w:p><w:r><w:br w:type="page"/></w:r><w:r><w:t xml:space="preserve">C. 丙    D. 丁</w:t></w:r></w:p>',
        textParagraph('2. 第二题题干'),
        textParagraph('A. 戊 B. 己 C. 庚 D. 辛'),
        textParagraph('三、填空题：本题共 1 小题'),
        textParagraph('1. 填空题题干______')
    ]);

    const blocks = rich.extractDocxRichBlocks(documentXml, {
        mediaMap: new Map(),
        mathByRid: new Map(),
        fileId: 'fixture'
    });
    const parsed = rich.parseQuestionRichBlocks(blocks);

    assert.deepEqual(parsed.questions.map(question => question.questionKey), [
        'section-1/q-1',
        'section-1/q-2',
        'section-2/q-1'
    ]);
    assert.deepEqual(parsed.questions[0].options, ['甲', '乙', '丙', '丁']);
    assert.equal(parsed.questions[0].options.some(option => /第二题|填空题/.test(option)), false);
    assert.equal(parsed.questions[1].options[3], '辛');
    assert.equal(parsed.questions[2].type, '填空题');
    assert.equal(parsed.questions[0].sourceParagraphRange[1], 3);
});

test('rich block extraction keeps ordered math and anchored image evidence', () => {
    const documentXml = wrapDocument([
        [
            '<w:p>',
            '<w:r><w:t>1. 已知</w:t></w:r>',
            '<m:oMath><m:f><m:num><m:r><m:t>1</m:t></m:r></m:num><m:den><m:r><m:t>2</m:t></m:r></m:den></m:f></m:oMath>',
            '<w:r><w:t>，如图</w:t></w:r>',
            '<w:r><w:drawing><wp:anchor><wp:extent cx="120" cy="80"/><a:blip r:embed="rId9"/></wp:anchor></w:drawing></w:r>',
            '</w:p>'
        ].join('')
    ]);
    const mediaMap = new Map([['rId9', {
        rid: 'rId9',
        target: 'word/media/figure.png',
        type: 'image',
        ext: 'png',
        mime: 'image/png',
        displayable: true,
        url: 'data:image/png;base64,AQID'
    }]]);

    const blocks = rich.extractDocxRichBlocks(documentXml, {
        mediaMap,
        mathByRid: new Map(),
        fileId: 'fixture'
    });

    assert.deepEqual(blocks[0].runs.map(run => run.kind), ['text', 'math', 'text', 'image']);
    assert.match(blocks[0].serialized, /\$\\frac\{1\}\{2\}\$/);
    assert.equal(blocks[0].assets[0].rid, 'rId9');
    assert.equal(blocks[0].assets[0].anchorType, 'anchor');
    assert.deepEqual(blocks[0].assets[0].dimensions, { cx: 120, cy: 80 });
    assert.equal(blocks[0].assets[0].paragraphIndex, 0);
});

test('MathType OLE preview becomes a math run rather than a generic image', () => {
    const documentXml = wrapDocument([
        '<w:p><w:r><w:t>1. 集合</w:t></w:r><w:r><w:object><v:shape xmlns:v="urn:schemas-microsoft-com:vml"><v:imagedata r:id="rId5"/></v:shape><o:OLEObject xmlns:o="urn:schemas-microsoft-com:office:office" r:id="rId4"/></w:object></w:r></w:p>'
    ]);
    const blocks = rich.extractDocxRichBlocks(documentXml, {
        mediaMap: new Map(),
        mathByRid: new Map([['rId5', 'A\\subseteq B']]),
        fileId: 'fixture'
    });

    assert.deepEqual(blocks[0].runs.map(run => run.kind), ['text', 'math']);
    assert.equal(blocks[0].assets.length, 0);
    assert.match(blocks[0].serialized, /\$A\\subseteq B\$/);
});
