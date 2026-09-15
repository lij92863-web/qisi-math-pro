'use strict';

// A Word document shaped like the teacher's real 周二晚测.docx, small enough to keep in the test
// tree. It reproduces the three structural details that produced the wrong-content defect:
//
//   * the mark sheet's numbering row reaches the text layer as a paragraph "2. 3." before the real
//     question 1, so a flat splitter that trusts the first marker loses question 1;
//   * the option paragraphs carry <w:tabs>/<w:textAlignment> in their properties, which an
//     unanchored "w:t" reader mistakes for a text element and swallows the "A. " label with;
//   * an anchored drawing keeps its <wp:posOffset> values in the paragraph, which that same reader
//     leaks into the text as a 13 digit run glued to the next option label.
//
// The document itself is a 3 question paper, so the expectations stay readable.
const paragraph = (inner, pPr = '') => `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${inner}</w:p>`;
const run = text => `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>`;

// A paragraph property block whose element names all start with "w:t".
const OPTION_PARAGRAPH_PR =
    '<w:tabs><w:tab w:val="left" w:pos="2076"/></w:tabs>'
    + '<w:textAlignment w:val="center"/>';

const ANCHORED_DRAWING =
    '<w:r><w:drawing><wp:anchor distT="0" distB="0" simplePos="0" relativeHeight="1">'
    + '<wp:positionH relativeFrom="column"><wp:posOffset>4071620</wp:posOffset></wp:positionH>'
    + '<wp:positionV relativeFrom="paragraph"><wp:posOffset>147320</wp:posOffset></wp:positionV>'
    + '<wp:extent cx="1647825" cy="1200150"/>'
    + '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
    + '<pic:pic><pic:blipFill><a:blip r:embed="rId90"/></pic:blipFill></pic:pic>'
    + '</a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>';

const MARK_SHEET = '<w:tbl><w:tr>'
    + ['题号', '1', '2', '3', '答案'].map(cell => `<w:tc>${paragraph(run(cell))}</w:tc>`).join('')
    + '</w:tr></w:tbl>';

const documentXml = '<w:document><w:body>'
    + paragraph(run('高一数学作业（九）'))
    + MARK_SHEET
    // The numbering row of the mark sheet, as it reaches the text layer.
    + paragraph(run('2. 3.'))
    + paragraph(run('一、选择题（本题共3小题，每小题5分，共30分）'))

    // Question 1: its own options are only readable once the "w:t" reader is anchored.
    + paragraph(run('1. 已知集合 ，则 （ ）') + ANCHORED_DRAWING, OPTION_PARAGRAPH_PR)
    + paragraph(run('A. 甲 B. 乙 C. 丙 D. 丁'), OPTION_PARAGRAPH_PR)

    // Question 2: same shape.
    + paragraph(run('2. 已知函数 的零点为 （ ）'), OPTION_PARAGRAPH_PR)
    + paragraph(run('A. 一 B. 二 C. 三 D. 四'), OPTION_PARAGRAPH_PR)

    // Question 3: plain paragraphs.
    + paragraph(run('3. 如图，在梯形 中，则 （ ）'))
    + paragraph(run('A. 戊 B. 己 C. 庚 D. 辛'))
    + '</w:body></w:document>';

const contentTypesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    + '</Types>';

const rootRelsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
    + '</Relationships>';

const documentRelsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId90" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>'
    + '</Relationships>';

// One transparent 1x1 PNG so the drawing resolves to a real, displayable image.
const image1PngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

module.exports = {
    documentXml,
    contentTypesXml,
    rootRelsXml,
    documentRelsXml,
    image1PngBase64,
    // One distinctive stem word and one distinctive option word per question.
    stems: { 1: '已知集合', 2: '的零点为', 3: '在梯形' },
    options: { 1: ['甲', '乙', '丙', '丁'], 2: ['一', '二', '三', '四'], 3: ['戊', '己', '庚', '辛'] }
};
