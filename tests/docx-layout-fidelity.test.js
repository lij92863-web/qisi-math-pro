const test = require('node:test');
const assert = require('node:assert/strict');

const layout = require('../qisi-docx-layout.js');

const imageRun = (id, cx = 1500000, cy = 1000000) => ({
    kind: 'image',
    assetId: id,
    token: `[[IMAGE:${id}]]`,
    layout: { anchorType: 'inline', dimensions: { cx, cy } }
});

test('two inline Word drawings in one image-only paragraph remain one horizontal row', () => {
    const serialized = layout.serializeParagraphLayout({
        runs: [imageRun('left'), { kind: 'text', text: '    ' }, imageRun('right')],
        assets: [
            { assetId: 'left', anchorType: 'inline', dimensions: { cx: 1500000, cy: 1000000 } },
            { assetId: 'right', anchorType: 'inline', dimensions: { cx: 1500000, cy: 1000000 } }
        ],
        usableWidthTwips: 8300,
        serializeRuns: runs => runs.map(run => run.token || run.text || '').join('')
    });

    assert.match(serialized, /QISI_LAYOUT_BEGIN/);
    assert.match(serialized, /\\begin\{minipage\}/);
    const model = layout.extractLayoutModel(serialized);
    assert.equal(model.type, 'image-row');
    assert.deepEqual(model.items.map(item => item.id), ['left', 'right']);

    const html = layout.renderLayoutHtml(serialized, {
        renderImage: item => `<img data-id="${item.id}">`
    });
    assert.match(html, /qisi-image-row/);
    assert.match(html, /data-id="left"/);
    assert.match(html, /data-id="right"/);
});

test('an inline Word drawing followed by formulas keeps media and text on the same row', () => {
    const serialized = layout.serializeParagraphLayout({
        runs: [
            imageRun('figure', 1700000, 1350000),
            { kind: 'text', text: '：' },
            { kind: 'math', latex: 'O(0,0,0),B(2,0,0)' }
        ],
        assets: [{ assetId: 'figure', anchorType: 'inline', dimensions: { cx: 1700000, cy: 1350000 } }],
        usableWidthTwips: 8300,
        serializeRuns: runs => runs.map(run => {
            if (run.kind === 'image') return run.token;
            if (run.kind === 'math') return `$${run.latex}$`;
            return run.text || '';
        }).join('')
    });

    const model = layout.extractLayoutModel(serialized);
    assert.equal(model.type, 'media-text');
    assert.equal(model.image.id, 'figure');
    assert.match(model.afterContent, /O\(0,0,0\)/);
    assert.match(serialized, /\\begin\{minipage\}\[c\]/);

    const html = layout.renderLayoutHtml(serialized, {
        renderImage: item => `<img data-id="${item.id}">`,
        renderContent: value => `<span class="copy">${value}</span>`
    });
    assert.match(html, /qisi-media-text/);
    assert.match(html, /qisi-media-copy/);
});

test('a figure before the next question exposes the marker without losing media-text layout', () => {
    const serialized = layout.serializeParagraphLayout({
        runs: [
            imageRun('question-nine', 1500000, 1200000),
            { kind: 'text', text: '9．如图，在梯形中求最值' }
        ],
        assets: [{ assetId: 'question-nine', dimensions: { cx: 1500000, cy: 1200000 } }],
        serializeRuns: runs => runs.map(run => run.token || run.text || '').join('')
    });

    assert.match(serialized, /^9．\s+% QISI_LAYOUT_BEGIN/);
    const model = layout.extractLayoutModel(serialized);
    assert.equal(model.type, 'media-text');
    assert.equal(model.image.id, 'question-nine');
    assert.equal(model.afterContent, '如图，在梯形中求最值');
    assert.doesNotMatch(model.afterContent, /^9[.．]/);
});

test('an image before an explicit answer marker stays transparent to the support parser', () => {
    const serialized = layout.serializeParagraphLayout({
        runs: [
            imageRun('answer-two', 1500000, 1200000),
            { kind: 'text', text: '2【答案】C' }
        ],
        assets: [{ assetId: 'answer-two', dimensions: { cx: 1500000, cy: 1200000 } }],
        serializeRuns: runs => runs.map(run => run.token || run.text || '').join('')
    });

    assert.equal(serialized, '[[IMAGE:answer-two]]2【答案】C');
    assert.doesNotMatch(serialized, /QISI_LAYOUT_BEGIN/);
});

test('a figure before several options keeps all labels outside the image layout payload', () => {
    const serialized = layout.serializeParagraphLayout({
        runs: [
            imageRun('choice-figure', 1500000, 1200000),
            { kind: 'text', text: 'A．外心    B．内心    C．重心    D．垂心' }
        ],
        assets: [{ assetId: 'choice-figure', dimensions: { cx: 1500000, cy: 1200000 } }],
        serializeRuns: runs => runs.map(run => run.token || run.text || '').join('')
    });

    const parts = layout.splitLayoutBlocks(serialized);
    assert.deepEqual(parts.map(part => part.kind), ['layout', 'text']);
    assert.equal(layout.extractLayoutModel(parts[0].value).type, 'image-row');
    assert.match(parts[1].value, /A．外心\s+B．内心\s+C．重心\s+D．垂心/);
    assert.doesNotMatch(parts[0].value, /A．外心|B．内心|C．重心|D．垂心/);
});

test('option columns preserve source row evidence but shrink when A4 capacity is insufficient', () => {
    assert.equal(layout.resolveOptionColumns({
        options: ['$1$', '$2$', '$3$', '$4$'],
        sourceRows: [['A', 'B', 'C', 'D']]
    }), 4);

    assert.equal(layout.resolveOptionColumns({
        options: [
            '甲得分的平均数大于乙得分的平均数',
            '甲得分的众数大于乙得分的众数',
            '甲得分的中位数大于乙得分的中位数',
            '甲得分的方差大于乙得分的方差'
        ],
        sourceRows: [['A', 'B', 'C', 'D']]
    }), 2);

    assert.equal(layout.resolveOptionColumns({
        options: ['[[IMAGE:a]]', '[[IMAGE:b]]', '[[IMAGE:c]]', '[[IMAGE:d]]'],
        sourceRows: [['A', 'B'], ['C', 'D']]
    }), 2);

    assert.equal(layout.resolveOptionColumns({
        options: ['一段非常长且无法在半栏内清晰排版的中文选项内容，需要占据整行才能保持可读性', '短项'],
        sourceRows: [['A', 'B']]
    }), 1);
});

test('option row evidence is recovered from Word-rich blocks without filename rules', () => {
    const rows = layout.extractOptionRows([
        { serialized: 'A．[[IMAGE:a]]\tB．[[IMAGE:b]]' },
        { serialized: 'C．[[IMAGE:c]]\tD．[[IMAGE:d]]' }
    ]);
    assert.deepEqual(rows, [['A', 'B'], ['C', 'D']]);
});

test('layout metadata fails closed when its payload is tampered', () => {
    const source = layout.serializeLayoutModel({
        type: 'image-row',
        items: [{ id: 'a', widthRatio: 0.48 }, { id: 'b', widthRatio: 0.48 }]
    });
    const tampered = source.replace(/(QISI_LAYOUT_BEGIN [0-9a-f]{8} )[A-Za-z]/, '$1Z');
    assert.equal(layout.extractLayoutModel(tampered), null);
    assert.match(layout.renderLayoutHtml(tampered), /latex-render-error/);
});

test('font metric scaling is bounded and makes a smaller math cap height match body text', () => {
    assert.equal(layout.resolveMathScale({ textHeight: 100, mathHeight: 92 }), 1.087);
    assert.equal(layout.resolveMathScale({ textHeight: 100, mathHeight: 50 }), 1.16);
    assert.equal(layout.resolveMathScale({ textHeight: 90, mathHeight: 100 }), 1.02);
});
