const test = require('node:test');
const assert = require('node:assert/strict');

const support = require('../qisi-docx-support-content.js');

const paragraph = (paragraphIndex, serialized, extras = {}) => ({
    kind: 'paragraph', paragraphIndex, serialized, runs: [], assets: [], diagnostics: [], ...extras
});

test('answer state machine keeps all analysis paragraphs and binds anchored evidence to its question', () => {
    const analysisAsset = { assetId: 'answer:p1:r0:rId9', rid: 'rId9', url: 'data:image/png;base64,AQID', ext: 'png' };
    const result = support.parseAnswerRichBlocks([
        paragraph(0, '1．【答案】B'),
        paragraph(1, '【详解】第一段推导', { assets: [analysisAsset] }),
        paragraph(2, '第二段推导'),
        paragraph(3, '故选 B。'),
        paragraph(4, '2．【答案】【解析】设侧面高为 h'),
        paragraph(5, '由计算可得结果，故选 C。')
    ]);

    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].answer, 'B');
    assert.deepEqual(result.items[0].analysisParagraphs, ['第一段推导', '第二段推导', '故选 B。']);
    assert.deepEqual(result.items[0].analysisImages.map(asset => asset.rid), ['rId9']);
    assert.equal(result.items[1].answer, 'C');
    assert.equal(result.items[1].answerDerivedFromAnalysis, true);
    assert.match(result.items[1].solution, /设侧面高为 h[\s\S]*故选 C/);
});

test('answer marker can preserve a MathType formula answer and keyboard math is normalized deterministically', () => {
    const formulaBlock = paragraph(58, '10．【答案】$-\\frac{19}{13}$【详解】由计算可得');
    const keyboardBlock = paragraph(66, '12．【答案】1【详解】因为3cosAsinB+2sinAcosB=sinAsinB，所以A+B=C');
    const result = support.parseAnswerRichBlocks([formulaBlock, keyboardBlock]);

    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    assert.equal(result.items[0].answer, '$-\\frac{19}{13}$');
    assert.match(result.items[1].solution, /\$3\\cos A\\sin B\+2\\sin A\\cos B=\\sin A\\sin B\$/);
    assert.match(result.items[1].solution, /\$A\+B=C\$/);
    assert.doesNotMatch(result.items[1].solution, /\$\$/);
});

test('keyboard formula next to a MathType fragment keeps distinct inline boundaries', () => {
    const normalized = support.normalizeKeyboardMath('A+B+C=$\\pi$');

    assert.equal(normalized, '$A+B+C=$\u200B$\\pi$');
    assert.doesNotMatch(normalized, /\$\$/);
});

test('image anchored before an answer number remains renderable analysis evidence', () => {
    const imageToken = '[[IMAGE:answer:p2:r0:rId10]]';
    const analysisAsset = {
        assetId: 'answer:p2:r0:rId10',
        rid: 'rId10',
        url: 'data:image/png;base64,AQID',
        ext: 'png'
    };
    const result = support.parseAnswerRichBlocks([
        paragraph(2, `${imageToken} 2．【答案】C【详解】由图可得`, { assets: [analysisAsset] })
    ]);

    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    assert.deepEqual(result.items[0].analysisImages, [analysisAsset]);
    assert.equal(result.items[0].analysisParagraphs[0], imageToken);
    assert.match(result.items[0].solution, /^\[\[IMAGE:answer:p2:r0:rId10\]\]/);
});

test('explicit support alignment rejects duplicates and missing question keys without positional fallback', () => {
    const questions = [
        { questionKey: 'section-1/q-1' },
        { questionKey: 'section-1/q-2' }
    ];
    const duplicate = support.alignQuestionAndSupportByKey(questions, [
        { questionKey: 'section-1/q-1', answer: 'A' },
        { questionKey: 'section-1/q-1', answer: 'B' }
    ]);
    const missing = support.alignQuestionAndSupportByKey(questions, [
        { questionKey: 'section-1/q-1', answer: 'A' }
    ]);

    assert.equal(duplicate.ok, false);
    assert.match(duplicate.code, /DUPLICATE/);
    assert.equal(missing.ok, false);
    assert.equal(missing.code, 'DOCX_SUPPORT_KEY_MISMATCH');
    assert.deepEqual(missing.diagnostics.missingKeys, ['section-1/q-2']);
});

test('numbered answer shorthand is accepted only inside an explicit support section', () => {
    const blocks = [
        paragraph(0, '《期末练习》参考答案'),
        paragraph(1, '1．B'),
        paragraph(2, '【分析】排除其余选项'),
        paragraph(3, '【详解】故选 B。'),
        paragraph(4, '2．$\\frac{1}{2}$'),
        paragraph(5, '【详解】直接计算。')
    ];
    const partition = support.partitionQuestionAndSupportBlocks(blocks);

    assert.equal(partition.hasSupportHeading, true);
    assert.deepEqual(partition.questionBlocks, []);
    assert.deepEqual(partition.supportBlocks.map(block => block.paragraphIndex), [1, 2, 3, 4, 5]);

    const parsed = support.parseAnswerRichBlocks(partition.supportBlocks, {
        allowNumberedAnswerMarkers: partition.hasSupportHeading
    });
    assert.equal(parsed.ok, true, JSON.stringify(parsed.diagnostics));
    assert.deepEqual(parsed.items.map(item => item.answer), ['B', '$\\frac{1}{2}$']);
    assert.match(parsed.items[0].solution, /排除其余选项[\s\S]*故选 B/);

    const unsafe = support.parseAnswerRichBlocks([
        paragraph(10, '1．这是一道题目，不是答案')
    ]);
    assert.equal(unsafe.items.length, 0);
});

test('combined DOCX is partitioned at the first explicit answer heading', () => {
    const blocks = [
        paragraph(0, '一、单选题'),
        paragraph(1, '1．题目一'),
        paragraph(2, '2．题目二'),
        paragraph(3, '《期末练习》参考答案'),
        paragraph(4, '1．A'),
        paragraph(5, '2．C')
    ];

    const partition = support.partitionQuestionAndSupportBlocks(blocks);
    assert.equal(partition.hasSupportHeading, true);
    assert.equal(partition.headingBlock.paragraphIndex, 3);
    assert.deepEqual(partition.questionBlocks.map(block => block.paragraphIndex), [0, 1, 2]);
    assert.deepEqual(partition.supportBlocks.map(block => block.paragraphIndex), [4, 5]);
});
