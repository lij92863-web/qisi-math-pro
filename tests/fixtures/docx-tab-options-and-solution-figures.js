'use strict';

// A question file plus an answer file shaped like two real defects the teacher found in
// 广东佛山市第一中学2026届高三一模检测数学试题.docx:
//
//   * the options of question 1 are separated by Word *tabs* - "A．98<tab>B．104<tab>C．106<tab>D．108".
//     The tab element is written "<w:tab />" (with the space), and the extractor only knew "<w:tab/>",
//     so the tab vanished and the four options arrived glued together as "A．98B．104C．106D．108",
//     which no option reader can split.
//   * question 2 draws one figure of its own, and its 详解 draws two more. All three were bound as
//     figures of the question and pushed into its stem, so the review page showed three pictures for a
//     question whose page draws one.
//
// One file, like the real paper: both the questions and the 详解 live in it.
const paragraph = inner => `<w:p>${inner}</w:p>`;
const run = text => `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>`;
const tabbedRun = text => `<w:r><w:t xml:space="preserve">${text}</w:t></w:r><w:r><w:tab /></w:r>`;
const picture = rid =>
    '<w:r><w:drawing><wp:inline distT="0" distB="0">'
    + '<wp:extent cx="914400" cy="914400"/>'
    + '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
    + `<pic:pic><pic:blipFill><a:blip r:embed="${rid}"/></pic:blipFill></pic:pic>`
    + '</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';

const documentXml = '<w:document><w:body>'
    + paragraph(run('一、选择题（本题共2小题）'))
    + paragraph(run('1．从小到大排列的一组数据： $80,90,96,x,110,120$ ，则 $x$ 的值为（ ）'))
    + paragraph(tabbedRun('A．98') + tabbedRun('B．104') + tabbedRun('C．106') + run('D．108'))
    + paragraph(run('2．如图，在四面体 $OABC$ 中， $OA=OB$ ， $CA=CB$ ，且 $E,F,G,H$ 分别是 $OA,OB,BC,CA$ 的中点。'))
    + paragraph(picture('rId7'))
    + paragraph(run('(1)判断四边形 $EFGH$ 的形状，并证明；'))
    + paragraph(run('参考答案'))
    + paragraph(run('1．B'))
    + paragraph(run('【详解】第一题：由第 50 百分位数与平均数相同解得 $x=104$ 。'))
    + paragraph(run('2．A'))
    + paragraph(run('【详解】第二题：取 $AB$ 中点 $D$ ，如图。'))
    + paragraph(picture('rId8'))
    + paragraph(picture('rId9') + run('由中位线定理可知四边形 $EFGH$ 是平行四边形。'))
    + '</w:body></w:document>';

const contentTypesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Default Extension="png" ContentType="image/png"/>'
    + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    + '</Types>';

const rootRelsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
    + '</Relationships>';

const imageRelationship = (id, target) =>
    `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/>`;

const documentRelsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + imageRelationship('rId7', 'media/image7.png')
    + imageRelationship('rId8', 'media/image8.png')
    + imageRelationship('rId9', 'media/image9.png')
    + '</Relationships>';

const image1PngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

module.exports = {
    documentXml,
    contentTypesXml,
    rootRelsXml,
    documentRelsXml,
    image1PngBase64,
    expected: {
        options: ['98', '104', '106', '108'],
        // The question's own figure stays in its stem; the two 详解 figures belong to the solution.
        stemFigureCount: { 1: 0, 2: 1 },
        draftImageCount: { 1: 0, 2: 3 }
    }
};
