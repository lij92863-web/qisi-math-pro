'use strict';

// A question file whose section headers carry no colon ("一、单选题" / "二、多选题") and an answer
// file that writes the answer without any label ("2．$x=1$" followed by 【详解】). Both shapes come
// from the teacher's 题目.docx + 答案.docx pair.
const paragraph = inner => `<w:p>${inner}</w:p>`;
const run = text => `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>`;

const questionDocumentXml = '<w:document><w:body>'
    + paragraph(run('一、单选题'))
    + paragraph(run('1. 已知集合 $A=\\{1,2\\}$，则 $A$ 的子集个数为（ ）'))
    + paragraph(run('A. 1 B. 2 C. 3 D. 4'))
    + paragraph(run('二、多选题'))
    + paragraph(run('2. 已知 $x$，则下列判断正确的是（ ）'))
    + paragraph(run('A. 甲 B. 乙 C. 丙 D. 丁'))
    + '</w:body></w:document>';

const answerDocumentXml = '<w:document><w:body>'
    + paragraph(run('1．B'))
    + paragraph(run('【详解】第一题：由题意得 $1+1=2$，故选：B'))
    // No 【答案】 label at all: the value before the 详解 is the answer.
    + paragraph(run('2．$x=1$'))
    + paragraph(run('【详解】第二题：由题意得 $x$ 只能取 1。'))
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
    emptyRelsXml
};
