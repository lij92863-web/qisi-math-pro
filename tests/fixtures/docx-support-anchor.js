'use strict';

// A question file plus an answer file shaped like the teacher's real group 1
// (简略版题目（只有一页）.docx + 完整版答案.docx):
//
//   * the answer file writes each block as "N【答案】" and "N【详解】";
//   * question 2's answer label is empty - the file states no letter for it - while its 详解 ends
//     with 故选：C;
//   * question 2's figure is anchored in front of its own marker, so the text layer reads
//     "[[IMAGE:…]] 2【答案】". That is the "active anchor" case: the marker must still count.
const paragraph = inner => `<w:p>${inner}</w:p>`;
const run = text => `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>`;

const ANCHORED_PICTURE =
    '<w:r><w:drawing><wp:anchor distT="0" distB="0" simplePos="0" relativeHeight="1">'
    + '<wp:positionH relativeFrom="column"><wp:posOffset>0</wp:posOffset></wp:positionH>'
    + '<wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>'
    + '<wp:extent cx="914400" cy="914400"/>'
    + '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
    + '<pic:pic><pic:blipFill><a:blip r:embed="rId9"/></pic:blipFill></pic:pic>'
    + '</a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>';

const questionDocumentXml = '<w:document><w:body>'
    + paragraph(run('一、选择题（本题共3小题，每小题5分，共15分）'))
    + paragraph(run('1. 已知集合 $A=\\{1,2\\}$，则 $A$ 的子集个数为（ ）'))
    + paragraph(run('A. 1 B. 2 C. 3 D. 4'))
    + paragraph(run('2. 已知函数 $f(x)=x$，则 $f(1)$ 的值为（ ）'))
    + paragraph(run('A. 一 B. 二 C. 三 D. 四'))
    + paragraph(run('3. 已知向量 $\\vec{a}$，则 $\\vec{a}$ 的模为（ ）'))
    + paragraph(run('A. 戊 B. 己 C. 庚 D. 辛'))
    + '</w:body></w:document>';

const answerDocumentXml = '<w:document><w:body>'
    + paragraph(run('1【答案】B'))
    + paragraph(run('【详解】第一题：由题意得 $1+1=2$，故选：B'))
    // The figure of question 2 is anchored in front of its own marker.
    + paragraph(ANCHORED_PICTURE + run('2【答案】'))
    + paragraph(run('【详解】第二题：由题意得 $2+2=4$，故选：C'))
    // Question 3 states no answer either, but its marker is a plain one, so the marker rule is not
    // what makes its answer empty - the 故选 conclusion must not become the answer by itself.
    + paragraph(run('3【答案】'))
    + paragraph(run('【详解】第三题：由题意得 $3+3=6$，故选：D'))
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

const answerDocumentRelsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>'
    + '</Relationships>';

const emptyRelsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>';

const image1PngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

module.exports = {
    questionDocumentXml,
    answerDocumentXml,
    contentTypesXml,
    rootRelsXml,
    answerDocumentRelsXml,
    emptyRelsXml,
    image1PngBase64,
    expected: {
        answers: { 1: 'B', 2: '', 3: '' },
        solutionText: { 2: '第二题', 3: '第三题' }
    }
};
