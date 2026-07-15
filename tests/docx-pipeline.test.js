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
    mergeDocxVisualOptionsForV2,
    selectDocxSourceRoute,
    partitionDocxSupportByQuestionContract,
    repairDocxSupportQuestionMarkerArtifacts,
    mergeDocxVisualSupplementByQuestionContract,
    finalizeDocxVisualSupplementForReview,
    partitionDocxMissingAnswersForReview
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

test('dual DOCX route keeps deterministic importer primary without an explicit visual companion', () => {
    const question = {
        id: 'question-docx',
        filename: 'questions.docx',
        fileType: 'docx',
        roles: ['question']
    };
    const support = {
        id: 'support-docx',
        filename: 'answers.docx',
        fileType: 'docx',
        roles: ['answer', 'solution']
    };

    assert.deepEqual(
        selectDocxSourceRoute(question, [question, support]),
        {
            producerIdentity: 'docx-xml-importer',
            routePolicyDecision: 'deterministic-docx-primary',
            selectedSourcePort: 'docx-importer',
            visualCompanionFileId: '',
            allowAutomaticVision: false
        }
    );

    assert.deepEqual(
        selectDocxSourceRoute(support, [question, support]),
        {
            producerIdentity: 'docx-text-support-parser',
            routePolicyDecision: 'deterministic-docx-support',
            selectedSourcePort: 'docx-support-text',
            visualCompanionFileId: '',
            allowAutomaticVision: false
        }
    );
});

test('dual DOCX support keeps only contract questions and preserves the remainder as unmatched', () => {
    const result = partitionDocxSupportByQuestionContract(
        [
            { question: '1', answer: 'A' },
            { question: '6', answer: 'C' },
            { question: '7', answer: 'ABD' },
            { question: '8', answer: 'AC' }
        ],
        ['1', '2', '3', '4', '5', '6']
    );

    assert.deepEqual(result.accepted.map(item => item.question), ['1', '6']);
    assert.deepEqual(result.unmatched.map(item => item.question), ['7', '8']);
    assert.equal(result.unknownNumberItems.length, 0);
});

test('dual DOCX support repairs a long numeric artifact only when its suffix is an expected marker', () => {
    const source = [
        '1【答案】B',
        '【详解】故选：B',
        '3941445800102【答案】',
        '【详解】计算可得，故选：C',
        '3【答案】B'
    ].join('\n');

    const result = repairDocxSupportQuestionMarkerArtifacts(
        source,
        ['1', '2', '3', '4', '5', '6']
    );

    assert.match(result.text, /\n2【答案】/);
    assert.equal(result.repairs.length, 1);
    assert.equal(result.repairs[0].questionNumber, '2');
    assert.equal(result.repairs[0].rawMarker, '3941445800102');
});

test('dual DOCX visual supplement replaces only placeholder evidence under the authoritative contract', () => {
    const deterministic = [
        {
            question: '1',
            stem: '已知[公式图片待转换:wmf]，求值',
            options: ['[公式图片选项待转换:wmf]', '文本 B', '文本 C', '文本 D'],
            sourceTrace: { source: 'docx-importer', raw: 'keep-me' }
        },
        {
            question: '2',
            stem: '确定性题干',
            options: ['A2', 'B2', 'C2', 'D2'],
            sourceTrace: { source: 'docx-importer' }
        }
    ];
    const visual = [
        { question: '1', stem: '已知 $x^2=1$，求值', options: ['$x=1$', '视觉 B', '视觉 C', '视觉 D'] },
        { question: '2', stem: '不应覆盖', options: ['X', 'X', 'X', 'X'] },
        { question: '7', stem: '越界题', options: ['X', 'X', 'X', 'X'] }
    ];

    const result = mergeDocxVisualSupplementByQuestionContract(
        deterministic,
        visual,
        ['1', '2']
    );

    assert.deepEqual(result.items.map(item => item.question), ['1', '2']);
    assert.equal(result.items[0].stem, '已知 $x^2=1$，求值');
    assert.deepEqual(result.items[0].options, ['$x=1$', '文本 B', '文本 C', '文本 D']);
    assert.deepEqual(result.items[0].sourceTrace.raw, 'keep-me');
    assert.equal(result.items[0].sourceTrace.source, 'docx-importer');
    assert.equal(result.items[0].sourceTrace.visualSupplement, 'docx-pdf-strict-vision');
    assert.equal(result.items[1].stem, '确定性题干');
    assert.deepEqual(result.unmatchedVisual.map(item => item.question), ['7']);
    assert.deepEqual(result.mergedQuestionNumbers, ['1']);
});

test('dual DOCX visual supplement failure input preserves deterministic items for manual review', () => {
    const deterministic = [{
        question: '1',
        stem: '题干[公式图片待转换:wmf]',
        options: ['A', 'B', 'C', 'D']
    }];

    const result = mergeDocxVisualSupplementByQuestionContract(deterministic, [], ['1']);

    assert.deepEqual(result.items, deterministic);
    assert.deepEqual(result.mergedQuestionNumbers, []);
    assert.deepEqual(result.unmatchedVisual, []);
});

test('partial DOCX visual supplement removes unresolved display placeholders but preserves raw evidence for review', () => {
    const items = [
        {
            question: '11',
            stem: '完整题干',
            options: [],
            rawText: 'raw-11'
        },
        {
            question: '12',
            stem: '求[公式图片待转换:wmf]的值',
            options: ['[公式图片选项待转换:wmf]', '文本 B', '', ''],
            rawText: '原始题块含 WMF 证据',
            sourceTrace: { source: 'docx-importer', rawBlock: 'keep-raw-block' },
            warnings: ['原警告']
        }
    ];

    const result = finalizeDocxVisualSupplementForReview(items);

    assert.equal(result.items[0], items[0]);
    assert.equal(result.items[1].stem, '求的值');
    assert.deepEqual(result.items[1].options, ['', '文本 B', '', '']);
    assert.equal(result.items[1].rawText, '原始题块含 WMF 证据');
    assert.equal(result.items[1].sourceTrace.rawBlock, 'keep-raw-block');
    assert.equal(result.items[1].sourceTrace.visualSupplement, 'partial-manual-review');
    assert.equal(result.items[1].manualReviewRequired, true);
    assert.match(result.items[1].warnings.join('\n'), /公式图片证据未能自动补全/);
    assert.deepEqual(result.unresolved, [{
        questionNumber: '12',
        fields: ['stem', 'options.0'],
        placeholderCount: 2
    }]);
    assert.equal(/待转换|闂傚/.test([
        result.items[1].stem,
        ...result.items[1].options
    ].join('\n')), false);
    assert.equal(items[1].stem, '求[公式图片待转换:wmf]的值');
});

test('DOCX support contract allows only subjective missing answers with an owned solution into review', () => {
    const result = partitionDocxMissingAnswersForReview({
        missingAnswerNumbers: ['2', '10', '11', '12'],
        questionItems: [
            { question: '2', type: '单选题' },
            { question: '10', type: '解答题' },
            { question: '11', type: '证明题' },
            { question: '12', type: '解答题' }
        ],
        solutionNumbers: ['10', '11']
    });

    assert.deepEqual(result, {
        fatal: ['2', '12'],
        reviewOnly: ['10', '11']
    });
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
