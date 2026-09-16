'use strict';

// A question file plus an answer file shaped like 武汉四调 (湖北省武汉市2025届高三下学期毕业生四月调研
// 考试数学试题.docx), reduced to the two shapes that matter:
//
//   * question 2 carries the score table. Its cells are written "7.0", "9.3", "8.9" - each of them
//     parses like the marker of question 7 / 9 / 8, so the XML block reader used to invent duplicate
//     question numbers 7, 8 and 9 inside question 2. The skeleton then stopped being authoritative
//     and every answer of the whole paper was withheld.
//   * the answer file states "4．(1)" where an answer would be: question 4 is a three-part 解答 whose
//     first line is the first sub-question. "(1)" is not an answer, and an empty answer is the
//     acceptable outcome.
const paragraph = inner => `<w:p>${inner}</w:p>`;
const run = text => `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>`;
const cell = text =>
    '<w:tc><w:tcPr><w:tcW w:w="1000" w:type="dxa"/></w:tcPr>'
    + paragraph(run(text))
    + '</w:tc>';
const row = cells => `<w:tr>${cells.map(cell).join('')}</w:tr>`;

const questionDocumentXml = '<w:document><w:body>'
    + paragraph(run('一、选择题（本题共3小题，每小题5分，共15分）'))
    + paragraph(run('1 .已知集合 $A=\\{1,2\\}$，则 $A$ 的子集个数为（ ）'))
    + paragraph(run('A. 1 B. 2 C. 3 D. 4'))
    + paragraph(run('2 .某校六位评委给甲、乙两个模型打分，数据如下表：'))
    + '<w:tbl><w:tblPr><w:tblW w:w="2000" w:type="dxa"/></w:tblPr>'
    + '<w:tblGrid><w:gridCol w:w="1000"/><w:gridCol w:w="1000"/></w:tblGrid>'
    + row(['评委编号', '1', '2', '3', '4', '5', '6'])
    + row(['甲', '7.0', '9.3', '8.3', '9.2', '8.9', '8.9'])
    + row(['乙', '8.1', '9.1', '8.5', '8.6', '8.7', '8.6'])
    + '</w:tbl>'
    + paragraph(run('3 .已知函数 $f(x)=x$，则 $f(1)$ 的值为（ ）'))
    + paragraph(run('A. 一 B. 二 C. 三 D. 四'))
    + paragraph(run('4 .已知向量 $\\vec{a}$，求 $\\vec{a}$ 的模，并证明 $|\\vec{a}|>0$。'))
    + paragraph(run('（1）求 $\\vec{a}$ 的模；'))
    + paragraph(run('（2）证明：$|\\vec{a}|>0$。'))
    + '</w:body></w:document>';

const answerDocumentXml = '<w:document><w:body>'
    + paragraph(run('参考答案'))
    + paragraph(run('1．C 2．A 3．D'))
    // The file states the first sub-question where an answer would be, exactly like 武汉四调 question
    // 15. The value before the 详解 label is therefore "(1)", not an answer.
    + paragraph(run('4．(1)'))
    + paragraph(run('【详解】第四题：（1）由题意得 $1+1=2$，所以 $|\\vec{a}|=2$；'))
    + paragraph(run('（2）因为 $2>0$，所以 $|\\vec{a}|>0$。'))
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
        questionNumbers: ['1', '2', '3', '4'],
        answers: { 1: 'C', 2: 'A', 3: 'D', 4: '' },
        solutionText: { 4: '第四题' }
    }
};
