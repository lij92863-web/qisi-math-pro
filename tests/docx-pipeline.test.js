const test = require('node:test');
const assert = require('node:assert/strict');

const {
    normalizeDocxPipelineResult,
    decodeXmlEntitiesSafe,
    stripXmlTagsForDocxText,
    extractDocxQuestionBlockByNumber,
    extractDocxTableTextFallback,
    parseDocxRelationshipMap,
    mimeFromDocxMediaPath,
    debugDocxXmlStructure,
    extractPlainTextFromDocxOptionXmlFragment,
    splitDocxParagraphsForOptionMap,
    findUploadedVisualCompanionForDocx,
    docxVisualTextIsBetterForV2,
    mergeDocxVisualOptionsForV2
} = require('../qisi-docx-pipeline.js');

test('BM11: full mode', () => {
    const r = normalizeDocxPipelineResult(
        [{ q: '1' }, { q: '2' }],
        [{ q: '1', a: 'A' }, { q: '2', a: 'B' }],
        [{ q: '1', s: 'S1' }, { q: '2', s: 'S2' }]
    );
    assert.equal(r.mode, 'full');
});

test('BM11: partial mode', () => {
    const r = normalizeDocxPipelineResult(
        [{ q: '1' }, { q: '2' }],
        [{ q: '1', a: 'A' }],
        []
    );
    assert.equal(r.mode, 'partial');
});

test('BMR2: extracts DOCX question block by normalized question number', () => {
    const source = '第1题 A．one B．two\n\n第2题 stem A. x B. y\n第3题 done';
    assert.equal(
        extractDocxQuestionBlockByNumber(source, '二'),
        ''
    );
    assert.equal(
        extractDocxQuestionBlockByNumber(source, '2'),
        '第2题 stem A. x B. y'
    );
    assert.equal(extractDocxQuestionBlockByNumber('', '1'), '');
});

test('BMR2: extracts DOCX table fallback option text', () => {
    const cell = value => `<w:tc><w:p><w:r><w:t>${value}</w:t></w:r></w:p></w:tc>`;
    const xml =
        '<w:tbl><w:tr>' +
        cell('A. alpha') +
        cell('B. beta') +
        cell('C. gamma') +
        cell('D. delta') +
        '</w:tr></w:tbl>';

    assert.equal(
        extractDocxTableTextFallback(xml),
        'A. alpha B. beta C. gamma D. delta'
    );
    assert.equal(extractDocxTableTextFallback('<w:p />'), '');
});

test('BMR2: parses relationship targets and media MIME safely', () => {
    const rels =
        '<Relationships>' +
        '<Relationship Id="rId1" Target="media/image1.PNG" Type="image"/>' +
        '<Relationship Id="rId2" Target="../media/vector.wmf" Type="image"/>' +
        '</Relationships>';
    const map = parseDocxRelationshipMap(rels);

    assert.deepEqual(map.get('rId1'), {
        id: 'rId1',
        target: 'word/media/image1.PNG',
        type: 'image'
    });
    assert.deepEqual(map.get('rId2'), {
        id: 'rId2',
        target: 'word/media/vector.wmf',
        type: 'image'
    });
    assert.equal(mimeFromDocxMediaPath('word/media/a.jpeg'), 'image/jpeg');
    assert.equal(mimeFromDocxMediaPath('word/media/a.unknown'), 'application/octet-stream');
});

test('BMR2: splits DOCX option paragraphs and keeps image-only evidence rows', () => {
    const xml =
        '<w:p><w:r><w:t>A&amp;B</w:t></w:r><w:tab/><w:r><m:chr m:val="+"/></w:r></w:p>' +
        '<w:p><w:drawing/></w:p>';
    const plain = extractPlainTextFromDocxOptionXmlFragment(xml);
    const result = splitDocxParagraphsForOptionMap(xml);

    assert.equal(plain, 'A&B +');
    assert.equal(result.paragraphs.length, 2);
    assert.equal(result.paragraphs[0].text, 'A&B +');
    assert.equal(result.paragraphs[1].text, '');
    assert.ok(result.paragraphs[1].rawXml.includes('<w:drawing/>'));
});

test('BMR2: finds visual companion by same base or single visual fallback', () => {
    const docx = { id: 'docx-1', filename: 'paper.docx', fileType: 'docx', roles: ['question'] };
    const sameBase = { id: 'pdf-1', filename: 'paper.pdf', fileType: 'pdf', roles: ['question'] };
    const other = { id: 'img-1', filename: 'other.png', fileType: 'image', roles: ['answer'] };

    assert.equal(findUploadedVisualCompanionForDocx(docx, [docx, other, sameBase]), sameBase);
    assert.equal(
        findUploadedVisualCompanionForDocx(
            { id: 'docx-2', filename: '1.docx', fileType: 'docx', roles: ['question'] },
            [{ id: 'only', filename: 'scan.png', fileType: 'image', roles: ['full'] }]
        ).id,
        'only'
    );
    assert.equal(findUploadedVisualCompanionForDocx(docx, [docx]), null);
});

test('BMR2: chooses visual DOCX text only for safer formula evidence', () => {
    assert.equal(
        docxVisualTextIsBetterForV2('[公式图片待转换:wmf]', '$\\frac{1}{2}$'),
        true
    );
    assert.equal(docxVisualTextIsBetterForV2('plain text', ''), false);
    assert.equal(docxVisualTextIsBetterForV2('$x$', '$x$'), false);
});

test('BMR2: merges visual DOCX options without dropping image tokens', () => {
    const merged = mergeDocxVisualOptionsForV2(
        [
            '[[IMAGE:keep]]',
            '[公式图片待转换:wmf]\n[[FORMULA_IMAGE:f1]]',
            '$x$',
            ''
        ],
        [
            'visual A',
            '$\\sqrt{x}$',
            '$x$',
            'visual D'
        ]
    );

    assert.deepEqual(merged, [
        '[[IMAGE:keep]]',
        '$\\sqrt{x}$\n[[FORMULA_IMAGE:f1]]',
        '$x$',
        ''
    ]);
});

test('BMR2: debug DOCX XML structure is side-effect limited and tolerant', () => {
    assert.doesNotThrow(() => {
        debugDocxXmlStructure('<w:p><w:r><w:t>A. option</w:t></w:r></w:p>', 'sample.docx');
        debugDocxXmlStructure(null, null);
    });
});

/* BMR9: decodeXmlEntitiesSafe */
test('BMR9: decodeXmlEntitiesSafe decodes XML entities', () => {
    assert.equal(decodeXmlEntitiesSafe('&lt;tag&gt;'), '<tag>');
    assert.equal(decodeXmlEntitiesSafe('&amp;'), '&');
    assert.equal(decodeXmlEntitiesSafe('&quot;hello&quot;'), '"hello"');
    assert.equal(decodeXmlEntitiesSafe('&apos;world&apos;'), "'world'");
});

test('BMR9: decodeXmlEntitiesSafe handles empty and null', () => {
    assert.equal(decodeXmlEntitiesSafe(''), '');
    assert.equal(decodeXmlEntitiesSafe(null), '');
    assert.equal(decodeXmlEntitiesSafe(undefined), '');
});

test('BMR9: decodeXmlEntitiesSafe preserves non-entity text', () => {
    assert.equal(decodeXmlEntitiesSafe('hello world'), 'hello world');
    assert.equal(decodeXmlEntitiesSafe('数学公式 < 10'), '数学公式 < 10');
});

/* BMR9: stripXmlTagsForDocxText */
test('BMR9: stripXmlTagsForDocxText strips DOCX XML tags', () => {
    const result = stripXmlTagsForDocxText('<w:t>A. option</w:t>');
    assert.equal(result, 'A. option');
});

test('BMR9: stripXmlTagsForDocxText handles tab and br tags', () => {
    const result = stripXmlTagsForDocxText('text<w:tab />more<w:br />end');
    assert.ok(result.includes('text'));
    assert.ok(result.includes('more'));
});

test('BMR9: stripXmlTagsForDocxText handles empty input', () => {
    assert.equal(stripXmlTagsForDocxText(''), '');
    assert.equal(stripXmlTagsForDocxText(null), '');
});
