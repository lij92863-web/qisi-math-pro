const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Utils = require('../qisi-utils.js');
const text = value => `<w:r><w:t>${value}</w:t></w:r>`;
const drawing = rid => `<w:r><w:drawing><a:blip r:embed="${rid}"/></w:drawing></w:r>`;
const paragraph = value => `<w:p>${value}</w:p>`;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64');

async function importXml(xml) {
    const contents = {
        'word/document.xml': xml,
        'word/_rels/document.xml.rels': '<Relationships>' + ['rId1', 'rId2'].map(id =>
            `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${id}.png"/>`).join('') + '</Relationships>',
        'word/media/rId1.png': png,
        'word/media/rId2.png': png
    };
    class FileReader {
        readAsDataURL(blob) {
            blob.arrayBuffer().then(bytes => {
                this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString('base64')}`;
                this.onload();
            }).catch(error => { this.error = error; this.onerror(); });
        }
    }
    const context = { fetch, Blob, FileReader,
        console: { log() {}, warn() {}, table() {}, groupCollapsed() {}, groupEnd() {} },
        window: { JSZip: {}, Qisi: { Utils,
            DocxNumbering: require('../qisi-docx-numbering.js'),
            DocxFormulaSource: { expand: async value => ({ xml: value, formulas: [] }) },
            ArchiveSecurity: { load: async () => ({ file: name => Object.hasOwn(contents, name)
                ? { async: async kind => kind === 'blob' ? new Blob([contents[name]]) : contents[name] } : null }) }
        } }
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../qisi-batch-importer.js'), 'utf8'), context);
    return context.window.QisiBatchImporter.parseDocxFile({ id: 'leading-drawing-source',
        filename: 'synthetic.docx', uploadPath: 'data:application/octet-stream;base64,', fileType: 'docx' });
}

test('a drawing before a printed choice-question number survives in the stem with original bytes', async () => {
    const xml = paragraph(drawing('rId1') + text('8. FIRST_STEM')) + paragraph(text('A. one B. two C. three D. four'));
    const result = await importXml(xml), q = result.drafts[0];
    assert.equal(q.questionNumber, '8');
    assert.equal(q.images.length, 1);
    assert.equal(q.stem, `[[IMAGE:${q.images[0].id}]] FIRST_STEM`);
    assert.deepEqual(Array.from(q.options), ['one', 'two', 'three', 'four']);
    assert.equal(q.images[0].url.split(',')[1], png.toString('base64'));
    assert.match(q.sourceTrace.rawXml, /r:embed="rId1"/);
});

test('multiple leading drawings retain their exact order before a split-digit fill-blank question', async () => {
    const result = await importXml(paragraph(text('三、填空题')) + paragraph(drawing('rId1') + drawing('rId2') + text('1 1 . SECOND_STEM ______')));
    const q = result.drafts[0];
    assert.equal(q.questionNumber, '11');
    assert.equal(q.images.length, 2);
    assert.equal(q.stem, q.images.map(image => `[[IMAGE:${image.id}]]`).join(' ') + ' SECOND_STEM ______');
    assert.equal(q.options.filter(Boolean).length, 0);
});

test('an image already after the question number stays in its original inline position', async () => {
    const q = (await importXml(paragraph(text('3. BEFORE ') + drawing('rId1') + text(' AFTER')))).drafts[0];
    assert.equal(q.stem, `BEFORE [[IMAGE:${q.images[0].id}]] AFTER`);
});

test('repeated references to one graphic preserve both tokens and one image record', async () => {
    const q = (await importXml(paragraph(drawing('rId1') + text('1. BETWEEN ') + drawing('rId1') + text(' END')))).drafts[0];
    assert.equal(q.images.length, 1);
    const token = `[[IMAGE:${q.images[0].id}]]`;
    assert.equal(q.stem, `${token} BETWEEN ${token} END`);
});

test('a continuation drawing stays within its already established question', async () => {
    const result = await importXml(paragraph(text('1. FIRST_STEM')) + paragraph(drawing('rId1')) + paragraph(text('2. SECOND_STEM')));
    assert.deepEqual(Array.from(result.drafts, q => q.questionNumber), ['1', '2']);
    assert.match(result.drafts[0].stem, /FIRST_STEM/);
    assert.ok(result.drafts[0].stem.includes(`[[IMAGE:${result.drafts[0].images[0].id}]]`));
    assert.equal(result.drafts[1].images.length, 0);
});
