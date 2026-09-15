const assert = require('node:assert/strict');
const test = require('node:test');

const { startBrowserApp } = require('./browser-harness.js');

const CONTENT_TYPES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    + '</Types>';

const ROOT_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
    + '</Relationships>';

const paragraph = text =>
    `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

const documentXml = paragraphs =>
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    + `<w:body>${paragraphs.map(paragraph).join('')}</w:body></w:document>`;

// A paper whose section heading prints the numbers of the section ("11. 12.") before the title.
// The importer used to read that strip as question 11, inventing a duplicate for a real paper whose
// questions are 1..12, and the skeleton then failed the whole batch.
const STRIP_HEADER_PAPER = documentXml([
    '11. 12.',
    '一、 选择题 ( 本题共 2 小题,每小题 5 分,共 10 分 )',
    '1. 已知集合 A={1}，则（ ）',
    'A. 甲 B. 乙 C. 丙 D. 丁',
    '2. 已知函数 f(x)=x，则（ ）',
    'A. 甲 B. 乙 C. 丙 D. 丁'
]);

// Control: some papers put the number on its own line and the stem on the next. That must still be
// a question, so the strip rule has to require two or more numbers.
const MARKER_ON_ITS_OWN_LINE = documentXml([
    '3.',
    '已知向量，则（ ）',
    '4. 已知函数，则（ ）'
]);

const buildDocxInPage = async (page, xml) => page.evaluate(async payload => {
    const zip = new window.JSZip();
    zip.file('[Content_Types].xml', payload.contentTypes);
    zip.file('_rels/.rels', payload.rootRels);
    zip.file('word/document.xml', payload.xml);
    const bytes = await zip.generateAsync({ type: 'base64' });
    return `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${bytes}`;
}, { contentTypes: CONTENT_TYPES, rootRels: ROOT_RELS, xml });

const skeletonOf = (page, uploadPath) => page.evaluate(
    async path => window.QisiBatchImporter.extractDocxQuestionSkeleton({
        id: 'strip-test',
        filename: 'paper.docx',
        fileType: 'docx',
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        uploadPath: path
    }),
    uploadPath
);

test('a section number strip is not read as a question', {
    timeout: 90_000
}, async () => {
    const harness = await startBrowserApp(32125);
    const { page } = harness;

    try {
        const stripPaper = await buildDocxInPage(page, STRIP_HEADER_PAPER);
        const skeleton = await skeletonOf(page, stripPaper);

        assert.deepEqual(
            skeleton.questionNumbers,
            ['1', '2'],
            `the number strip must not become a question: ${JSON.stringify(skeleton.diagnostics)}`
        );
        assert.equal(skeleton.diagnostics.noDuplicates, true);
        assert.equal(skeleton.authoritative, true, JSON.stringify(skeleton.diagnostics));
    } finally {
        await harness.close();
    }
});

test('a number alone on its own line is still a question', {
    timeout: 90_000
}, async () => {
    const harness = await startBrowserApp(32126);
    const { page } = harness;

    try {
        const paper = await buildDocxInPage(page, MARKER_ON_ITS_OWN_LINE);
        const skeleton = await skeletonOf(page, paper);

        assert.deepEqual(
            skeleton.questionNumbers,
            ['3', '4'],
            'a single marker on its own line must keep starting a question'
        );
        assert.equal(skeleton.diagnostics.noDuplicates, true);
    } finally {
        await harness.close();
    }
});
