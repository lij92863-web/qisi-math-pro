'use strict';

// A question file plus an answer file whose answer key states two different values for the same
// question number. That defect is real: 高二.docx writes its key line as
// "49． $\left(-3,0\right)$ 49．9 50． …", and the product must not pick either value.
//
// The fixture keeps the real shape rather than an easier one:
//
//   * the key is a bare entry list under a 参考答案 heading, so it is read as a key and not as
//     解析 prose;
//   * question 2 is stated twice with two different values - one of them a formula - so the answer
//     has to stay empty and both values have to reach the teacher as evidence;
//   * questions 1 and 3 are single-valued controls: an answer file whose key also carries healthy
//     entries must not lose them to the conflict.
const paragraph = inner => `<w:p>${inner}</w:p>`;
const run = text => `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>`;

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
    + paragraph(run('3【答案】D'))
    + paragraph(run('参考答案'))
    + paragraph(run('2． $\\left(-3,0\\right)$ 2．9'))
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

const emptyRelsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>';

module.exports = {
    questionDocumentXml,
    answerDocumentXml,
    contentTypesXml,
    rootRelsXml,
    emptyRelsXml,
    expected: {
        conflictedQuestion: '2',
        // Exactly the two values the answer file states for question 2, in file order.
        conflictValues: ['$\\left(-3,0\\right)$', '9'],
        unaffectedAnswers: { 1: 'B', 3: 'D' },
        notice: '答案区对本题给出两个不一致的值'
    }
};
