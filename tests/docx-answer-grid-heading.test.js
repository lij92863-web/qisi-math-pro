const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const Utils = require('../qisi-utils.js');
globalThis.Qisi = { ...(globalThis.Qisi || {}), Utils };

const paragraph = text => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
const cell = text => `<w:tc>${paragraph(text)}</w:tc>`;
const row = cells => `<w:tr>${cells.map(cell).join('')}</w:tr>`;

async function importXml(xml) {
    const context = {
        fetch,
        console: { log() {}, warn() {}, table() {}, groupCollapsed() {}, groupEnd() {} },
        window: {
            JSZip: {},
            Qisi: {
                Utils,
                DocxNumbering: require('../qisi-docx-numbering.js'),
                ArchiveSecurity: {
                    load: async () => ({
                        file: name => name === 'word/document.xml'
                            ? { async: async () => xml } : null
                    })
                },
                DocxFormulaSource: { expand: async value => ({ xml: value, formulas: [] }) }
            }
        }
    };
    vm.runInNewContext(
        fs.readFileSync(path.join(__dirname, '../qisi-batch-importer.js'), 'utf8'),
        context
    );
    return context.window.QisiBatchImporter.parseDocxFile({
        id: 'answer-grid-source',
        filename: 'answer-grid.docx',
        uploadPath: 'data:application/octet-stream;base64,',
        fileType: 'docx'
    });
}

test('an answer-grid cell named 答案 before the questions never truncates the paper', async () => {
    // Real papers start with a score/answer grid. Its row label is exactly
    // "答案", and it must not be mistaken for the answer-section heading.
    const grid = `<w:tbl>${[
        row(['题号', '1', '2', '3']),
        row(['答案', '', '', ''])
    ].join('')}</w:tbl>`;
    const xml = [
        paragraph('高一数学作业（九）'),
        grid,
        paragraph('一、选择题'),
        paragraph('1. 第一题'),
        paragraph('A. 甲 B. 乙 C. 丙 D. 丁'),
        paragraph('2. 第二题'),
        paragraph('A. 甲 B. 乙 C. 丙 D. 丁'),
        paragraph('3. 第三题'),
        paragraph('A. 甲 B. 乙 C. 丙 D. 丁')
    ].join('');

    const result = await importXml(xml);

    assert.deepEqual(
        Array.from(result.drafts, draft => draft.questionNumber),
        ['1', '2', '3']
    );
    assert.equal(result.supportBlocks.length, 0);
});

test('a real body-level 参考答案 heading still ends the question section', async () => {
    const xml = [
        paragraph('1. 第一题'),
        paragraph('2. 第二题'),
        paragraph('参考答案'),
        paragraph('1.【答案】A'),
        paragraph('2.【答案】B')
    ].join('');

    const result = await importXml(xml);

    assert.deepEqual(
        Array.from(result.drafts, draft => draft.questionNumber),
        ['1', '2']
    );
    assert.ok(
        (result.supportBlocks || []).length > 0,
        'a body-level 参考答案 heading must start the support section'
    );
});
