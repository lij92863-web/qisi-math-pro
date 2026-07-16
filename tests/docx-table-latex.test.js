const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const tables = require('../qisi-docx-table-latex.js');

const paragraph = text => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
const cell = (content, properties = '') => `<w:tc><w:tcPr>${properties}</w:tcPr>${content}</w:tc>`;
const row = cells => `<w:tr>${cells.join('')}</w:tr>`;

test('top-level DOCX flow keeps a table atomic and excludes its cell paragraphs', () => {
    const table = `<w:tbl>${row([cell(paragraph('7.0')), cell(paragraph('9.3'))])}</w:tbl>`;
    const documentXml = `<w:document><w:body>${paragraph('1. 第一题')}${table}${paragraph('2. 第二题')}</w:body></w:document>`;

    const blocks = tables.extractTopLevelWordBlocks(documentXml);

    assert.deepEqual(blocks.map(block => block.kind), ['paragraph', 'table', 'paragraph']);
    assert.match(blocks[1].xml, /7\.0/);
});

test('Word table becomes strict LaTeX with proportional columns and merged cells', () => {
    const tableXml = [
        '<w:tbl>',
        '<w:tblGrid><w:gridCol w:w="1800"/><w:gridCol w:w="2400"/><w:gridCol w:w="2400"/><w:gridCol w:w="1800"/></w:tblGrid>',
        row([
            cell(paragraph('性别'), '<w:vMerge w:val="restart"/>'),
            cell(paragraph('飞盘运动'), '<w:gridSpan w:val="2"/>'),
            cell(paragraph('合计'), '<w:vMerge w:val="restart"/>')
        ]),
        row([
            cell(paragraph(''), '<w:vMerge/>'),
            cell(paragraph('不爱好')),
            cell(paragraph('爱好')),
            cell(paragraph(''), '<w:vMerge/>')
        ]),
        row([
            cell(paragraph('男')),
            cell(paragraph('6')),
            cell(paragraph('16')),
            cell(paragraph('22'))
        ]),
        '</w:tbl>'
    ].join('');

    const result = tables.convertWordTableToLatex(tableXml, {
        usableWidthTwips: 9000,
        serializeCell: xml => ({ previewContent: tables.extractWordText(xml) })
    });

    assert.equal(result.model.columnWidths.length, 4);
    assert.deepEqual(result.model.columnWidths.map(value => Number(value.toFixed(3))), [0.214, 0.286, 0.286, 0.214]);
    assert.equal(result.model.rows[0][0].rowSpan, 2);
    assert.equal(result.model.rows[0][1].colSpan, 2);
    assert.match(result.latex, /\\begin\{tabular\}/);
    assert.match(result.latex, /\\multirow\{2\}/);
    assert.match(result.latex, /\\multicolumn\{2\}/);
    assert.match(result.latex, /\\cline\{2-3\}/);
    assert.ok(result.latex.includes('\\\\\n\\cline{2-3}'));
    assert.doesNotMatch(result.latex, /\\\\\r?\n\+/);
    assert.doesNotMatch(result.latex, /includegraphics|\[\[IMAGE:/);

    const html = tables.renderLatexTableHtml(result.latex, {
        renderCell: value => value
    });
    assert.match(html, /<table/);
    assert.match(html, /rowspan="2"/);
    assert.match(html, /colspan="2"/);
    assert.match(html, /飞盘运动/);
});

test('two framed regions in one Word row preserve their width ratio on one line', () => {
    const tableXml = [
        '<w:tbl>',
        '<w:tblGrid><w:gridCol w:w="3000"/><w:gridCol w:w="6000"/></w:tblGrid>',
        row([cell(paragraph('左框')), cell(paragraph('右框'))]),
        '</w:tbl>'
    ].join('');

    const result = tables.convertWordTableToLatex(tableXml, {
        usableWidthTwips: 9000,
        serializeCell: xml => ({ previewContent: tables.extractWordText(xml) })
    });
    const html = tables.renderLatexTableHtml(result.latex, { renderCell: value => value });

    assert.deepEqual(result.model.columnWidths.map(value => Number(value.toFixed(3))), [0.333, 0.667]);
    assert.match(html, /width:33\.333%/);
    assert.match(html, /width:66\.667%/);
});

test('preview splits complete table blocks before inline-math tokenization', () => {
    const first = tables.convertWordTableToLatex(
        `<w:tbl><w:tblGrid><w:gridCol w:w="4000"/></w:tblGrid>${row([cell(paragraph('x'))])}</w:tbl>`,
        { serializeCell: () => ({ previewContent: '$x$' }) }
    ).latex;
    const second = tables.convertWordTableToLatex(
        `<w:tbl><w:tblGrid><w:gridCol w:w="4000"/></w:tblGrid>${row([cell(paragraph('y'))])}</w:tbl>`,
        { serializeCell: () => ({ previewContent: '$\\frac{1}{2}$' }) }
    ).latex;
    const parts = tables.splitLatexTableBlocks(`before\n${first}\nbetween\n${second}\nafter`);

    assert.deepEqual(parts.map(part => part.kind), ['text', 'table', 'text', 'table', 'text']);
    assert.equal(parts.filter(part => part.kind === 'table').length, 2);
    assert.match(parts[1].value, /\$x\$/);
    assert.match(parts[3].value, /\\frac\{1\}\{2\}/);
    const polluted = first.replace(
        /(% QISI_TABLE_BEGIN [0-9a-f]{8} [A-Za-z0-9+/=]{12})/,
        '$1$'
    );
    assert.equal(tables.splitLatexTableBlocks(polluted).filter(part => part.kind === 'table').length, 1);
    assert.match(tables.renderLatexTableHtml(polluted), /qisi-latex-table/);

    const tampered = first.replace(
        /(% QISI_TABLE_BEGIN [0-9a-f]{8} )[A-Za-z]/,
        '$1Z'
    );
    assert.equal(tables.extractTableModelFromLatex(tampered), null);

    const source = fs.readFileSync(path.resolve(__dirname, '../qisi-components.js'), 'utf8');
    const protectIndex = source.indexOf('const tableParts =');
    const displayNormalizeIndex = source.indexOf('normalizeBareLatexForDisplayText(content)');
    const tokenizeIndex = source.indexOf('const parsed = tokenizeLatexSource(source);', displayNormalizeIndex);

    assert.ok(protectIndex >= 0, 'table block splitting is missing');
    assert.ok(displayNormalizeIndex > protectIndex, 'display normalization ran before table splitting');
    assert.ok(tokenizeIndex > displayNormalizeIndex, 'math tokenization ran before table splitting');
});
