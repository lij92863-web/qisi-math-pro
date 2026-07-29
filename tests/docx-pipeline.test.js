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
    resolveDocxSourceRoute,
    selectDocxVisualPageSource,
    orderDocxMediaRefsByDocumentUsage,
    foldUnnumberedVisualQuestionFragments,
    mergeVisualSupportPageResultsFailClosed,
    buildVisualSupportCoverage,
    summarizeVisualSupportPageResults,
    partitionVisualSupportPages,
    validateVisualSupportPageIndex,
    buildVisualSupportIndexRetryPlan,
    buildValidatedVisualQuestionContract,
    partitionDocxSupportByQuestionContract,
    repairDocxSupportQuestionMarkerArtifacts,
    mergeDocxVisualSupplementByQuestionContract,
    finalizeDocxVisualSupplementForReview,
    partitionDocxMissingAnswersForReview
} = require('../qisi-docx-pipeline.js');

test('H3R: page-image DOCX uses embedded pages only when every drawing is accounted for', () => {
    const questionSkeleton = {
        diagnostics: {
            visualPageCandidate: true,
            drawingCount: 6,
            pageLikeDrawingCount: 6
        }
    };

    assert.deepEqual(
        selectDocxVisualPageSource({
            questionSkeleton,
            embeddedPageCount: 6
        }),
        {
            route: 'embedded-pages',
            pageCount: 6,
            reason: 'all-drawings-are-ordered-page-images'
        }
    );

    assert.deepEqual(
        selectDocxVisualPageSource({
            questionSkeleton,
            embeddedPageCount: 5
        }),
        {
            route: 'reject',
            pageCount: 5,
            reason: 'visual-page-count-mismatch',
            expectedPageCount: 6
        }
    );
});

test('H3R: ordinary DOCX keeps the converted-PDF visual fallback', () => {
    assert.deepEqual(
        selectDocxVisualPageSource({
            questionSkeleton: {
                diagnostics: {
                    visualPageCandidate: false,
                    drawingCount: 2,
                    pageLikeDrawingCount: 1
                }
            },
            embeddedPageCount: 1
        }),
        {
            route: 'converted-pdf',
            pageCount: 0,
            reason: 'not-visual-page-docx'
        }
    );
});

test('H3R: embedded DOCX pages follow document usage order, not relationship order', () => {
    const refs = [
        { rid: 'rId9', filename: 'image6.png' },
        { rid: 'rId8', filename: 'image5.png' },
        { rid: 'rId4', filename: 'image1.png' }
    ];
    const xml = [
        '<w:drawing><a:blip r:embed="rId4"/></w:drawing>',
        '<w:drawing><a:blip r:embed="rId8"/></w:drawing>',
        '<w:drawing><a:blip r:embed="rId9"/></w:drawing>'
    ].join('');

    assert.deepEqual(
        orderDocxMediaRefsByDocumentUsage(xml, refs)
            .map(ref => ref.filename),
        ['image1.png', 'image5.png', 'image6.png']
    );
});

test('H3R: strict visual questions become a contract only with exact sequence and page order', () => {
    const items = [
        { questionNumber: '1', sourcePage: 1 },
        { questionNumber: '2', sourcePage: 1 },
        { questionNumber: '3', sourcePage: 2 }
    ];
    const contract = buildValidatedVisualQuestionContract({
        items,
        expectedQuestionCount: 3,
        expectedSourcePageCount: 2,
        check: { fatal: false }
    });

    assert.equal(contract.authoritative, true);
    assert.deepEqual(contract.questionNumbers, ['1', '2', '3']);
    assert.equal(
        contract.evidence,
        'strict-visual-explicit-count-and-page-coverage'
    );

    const inferredContract = buildValidatedVisualQuestionContract({
        items: [
            { questionNumber: '1', sourceTrace: { sourcePage: 1 } },
            { questionNumber: '2', sourcePage: 1 },
            {
                questionNumber: '3',
                sourcePage: 2,
                sourcePages: [2, 3]
            }
        ],
        expectedSourcePageCount: 3,
        check: { fatal: false }
    });

    assert.equal(inferredContract.authoritative, true);
    assert.equal(
        inferredContract.evidence,
        'strict-visual-contiguous-sequence-and-page-coverage'
    );
    assert.deepEqual(
        inferredContract.diagnostics.observedPages,
        [1, 2, 3]
    );

    assert.equal(
        buildValidatedVisualQuestionContract({
            items: [
                { questionNumber: '1', sourcePage: 2 },
                { questionNumber: '3', sourcePage: 1 },
                { questionNumber: '2', sourcePage: 1 }
            ],
            expectedQuestionCount: 3,
            expectedSourcePageCount: 2,
            check: { fatal: false }
        }).authoritative,
        false
    );
    assert.equal(
        buildValidatedVisualQuestionContract({
            items,
            expectedQuestionCount: 3,
            expectedSourcePageCount: 2,
            check: { fatal: true }
        }).authoritative,
        false
    );
    assert.equal(
        buildValidatedVisualQuestionContract({
            items: items.slice(0, 2),
            expectedSourcePageCount: 2,
            check: { fatal: false }
        }).diagnostics.reason,
        'source-page-coverage-incomplete'
    );
});

test('H3R: same-page unnumbered visual fragments fold into their numbered parent only', () => {
    const folded = foldUnnumberedVisualQuestionFragments([
        {
            questionNumber: '15',
            sourcePage: 3,
            stem: '已知数列',
            options: []
        },
        {
            questionNumber: '（1）',
            sourcePage: 3,
            stem: '（1）求首项'
        },
        {
            questionNumber: '(2)',
            sourcePage: 3,
            stem: '（2）求和'
        },
        {
            questionNumber: '16',
            sourcePage: 3,
            stem: '信息安全问题'
        },
        {
            questionNumber: '',
            sourcePage: 4,
            stem: '无法证明归属的跨页片段'
        },
        {
            questionNumber: '17',
            sourcePage: 4,
            stem: '下一题'
        }
    ]);

    assert.equal(folded.length, 4);
    assert.match(
        folded[0].stem,
        /已知数列\n（1）求首项\n（2）求和/
    );
    assert.equal(
        folded[0].sourceTrace.foldedVisualFragmentCount,
        2
    );
    assert.equal(
        folded[2].questionNumber,
        ''
    );
    assert.equal(
        folded[3].questionNumber,
        '17'
    );
});

test('H3R: multi-page visual support joins solution continuations and rejects answer conflicts', () => {
    const merged = mergeVisualSupportPageResultsFailClosed({
        allowedQuestionNumbers: ['8', '9'],
        pageResults: [
            {
                pageNo: 1,
                answers: [
                    {
                        question: '8',
                        answer: 'B'
                    }
                ],
                solutions: [
                    {
                        question: '8',
                        solution: '第一页解析'
                    }
                ]
            },
            {
                pageNo: 2,
                answers: [
                    {
                        question: '8',
                        answer: 'B'
                    },
                    {
                        question: '9',
                        answer: 'AC'
                    }
                ],
                solutions: [
                    {
                        question: '8',
                        solution: '第二页续文'
                    },
                    {
                        question: '9',
                        solution: '第九题解析'
                    }
                ]
            }
        ]
    });

    assert.equal(merged.authoritative, true);
    assert.equal(merged.answers.length, 2);
    assert.equal(
        merged.solutions[0].solution,
        '第一页解析\n第二页续文'
    );
    assert.deepEqual(
        merged.solutions[0].sourcePages,
        [1, 2]
    );

    const conflict = mergeVisualSupportPageResultsFailClosed({
        allowedQuestionNumbers: ['8'],
        pageResults: [
            {
                pageNo: 1,
                answers: [
                    {
                        question: '8',
                        answer: 'B'
                    }
                ]
            },
            {
                pageNo: 2,
                answers: [
                    {
                        question: '8',
                        answer: 'C'
                    }
                ]
            }
        ]
    });

    assert.equal(conflict.authoritative, false);
    assert.equal(
        conflict.diagnostics.conflicts[0]
            .questionNumber,
        '8'
    );
});

test('H3R: visual support coverage accepts a solution-only subjective response but not an empty block', () => {
    const merged = {
        authoritative: true,
        answers: [
            {
                question: '1',
                answer: 'B'
            }
        ],
        solutions: [
            {
                question: '1',
                solution: 'choice explanation'
            },
            {
                question: '2',
                solution: 'subjective derivation'
            }
        ],
        diagnostics: {
            conflicts: [],
            unknownQuestionNumbers: []
        }
    };
    const coverage =
        buildVisualSupportCoverage({
            merged,
            expectedQuestionNumbers: [
                '1',
                '2',
                '3'
            ],
            requiredKinds: {
                answers: true,
                solutions: false
            }
        });

    assert.equal(coverage.ok, false);
    assert.deepEqual(
        coverage.missingAnswers,
        ['2', '3']
    );
    assert.deepEqual(
        coverage.acceptedMissingAnswersWithSolution,
        ['2']
    );
    assert.deepEqual(
        coverage.unresolvedMissingAnswers,
        ['3']
    );
    assert.deepEqual(
        coverage.missingBlocks,
        ['3']
    );

    assert.deepEqual(
        summarizeVisualSupportPageResults([
            {
                pageNo: 2,
                answers: [
                    {
                        question: '第1题'
                    }
                ],
                solutions: [
                    {
                        questionNumber: 2
                    }
                ]
            }
        ]),
        [
            {
                pageNo: 2,
                answerQuestions: ['1'],
                solutionQuestions: ['2']
            }
        ]
    );
});

test('H3R: visual support partitions by line-start markers and preserves cross-page continuations', () => {
    const chunks =
        partitionVisualSupportPages({
            pages: [
                {
                    pageNo: 2,
                    rawText: [
                        'header',
                        '9. BCD solution',
                        '10. AD solution',
                        '11. ABD solution',
                        '12. fill solution',
                        '13. fill solution',
                        '14. fill solution',
                        '15. subjective solution'
                    ].join('\n')
                },
                {
                    pageNo: 3,
                    rawText: [
                        '16. solution with 5 points',
                        '17. proof solution',
                        '18. function solution'
                    ].join('\n')
                },
                {
                    pageNo: 4,
                    rawText: [
                        'question 18 continuation containing 16^a, not a marker.',
                        'more continuation text for question 18.',
                        '19. conic solution'
                    ].join('\n')
                }
            ],
            allowedQuestionNumbers:
                Array.from(
                    { length: 11 },
                    (_, index) =>
                        String(index + 9)
                ),
            maxQuestionsPerChunk: 4,
            maxCharactersPerChunk: 6500
        });

    assert.deepEqual(
        chunks.map(
            chunk =>
                chunk.questionNumbers
        ),
        [
            ['9', '10', '11', '12'],
            ['13', '14', '15'],
            ['16', '17', '18'],
            ['18', '19']
        ]
    );
    assert.equal(
        chunks[3]
            .continuationQuestionNumber,
        '18'
    );
    assert.match(
        chunks[3].rawText,
        /16\^a/
    );
});

test('H3R: visual page index accepts only the next contiguous question sequence', () => {
    const pageThree =
        validateVisualSupportPageIndex({
            observedQuestionNumbers: [
                '16',
                '17',
                '18'
            ],
            allowedQuestionNumbers:
                Array.from(
                    { length: 5 },
                    (_, index) =>
                        String(index + 15)
                ),
            lastSeenQuestionNumber:
                15,
            continuesPrevious:
                false
        });

    assert.equal(
        pageThree.authoritative,
        true
    );
    assert.deepEqual(
        pageThree.targetQuestionNumbers,
        ['16', '17', '18']
    );

    const pageFour =
        validateVisualSupportPageIndex({
            observedQuestionNumbers: [
                '18',
                '19'
            ],
            allowedQuestionNumbers: [
                '18',
                '19'
            ],
            lastSeenQuestionNumber:
                18,
            continuesPrevious:
                true
        });

    assert.equal(
        pageFour.authoritative,
        true
    );
    assert.deepEqual(
        pageFour.targetQuestionNumbers,
        ['18', '19']
    );

    assert.equal(
        validateVisualSupportPageIndex({
            observedQuestionNumbers: [
                '16',
                '19'
            ],
            allowedQuestionNumbers: [
                '16',
                '17',
                '18',
                '19'
            ],
            lastSeenQuestionNumber:
                15
        }).authoritative,
        false
    );
});

test('H3R: visual page index retries only a bounded contract mismatch with the next required question', () => {
    const invalid =
        validateVisualSupportPageIndex({
            observedQuestionNumbers: [
                '16',
                '17'
            ],
            allowedQuestionNumbers:
                Array.from(
                    { length: 12 },
                    (_, index) =>
                        String(index + 8)
                ),
            lastSeenQuestionNumber:
                8,
            continuesPrevious:
                false
        });
    const retry =
        buildVisualSupportIndexRetryPlan({
            validation:
                invalid,
            allowedQuestionNumbers:
                Array.from(
                    { length: 12 },
                    (_, index) =>
                        String(index + 8)
                ),
            lastSeenQuestionNumber:
                8,
            previousAttemptNumbers: [
                '16',
                '17'
            ]
        });

    assert.equal(
        retry.shouldRetry,
        true
    );
    assert.equal(
        retry.requiredFirstQuestionNumber,
        '9'
    );
    assert.deepEqual(
        retry.previousAttemptNumbers,
        ['16', '17']
    );

    assert.equal(
        buildVisualSupportIndexRetryPlan({
            validation: {
                authoritative: false,
                diagnostics: {
                    reasons: [
                        'unknown-question-number'
                    ]
                }
            },
            allowedQuestionNumbers: [
                '9',
                '10'
            ],
            lastSeenQuestionNumber:
                8
        }).shouldRetry,
        false
    );
});

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

test('image-page DOCX routes to strict vision only with explicit page-image evidence', async () => {
    const question = {
        id: 'visual-page-docx',
        filename: 'scanned-paper.docx',
        fileType: 'docx',
        roles: ['question']
    };
    const route = await resolveDocxSourceRoute(question, [question], {
        extractQuestionSkeleton: async () => ({
            authoritative: false,
            questionNumbers: [],
            entries: [],
            diagnostics: {
                reason: 'no-explicit-question-markers',
                visualPageCandidate: true
            }
        })
    });

    assert.deepEqual(route, {
        producerIdentity: 'docx-visual-page-importer',
        routePolicyDecision: 'visual-page-docx',
        selectedSourcePort: 'docx-convert-strict-vision',
        visualCompanionFileId: '',
        allowAutomaticVision: true,
        questionSkeleton: {
            authoritative: false,
            questionNumbers: [],
            entries: [],
            diagnostics: {
                reason: 'no-explicit-question-markers',
                visualPageCandidate: true
            }
        }
    });
});

test('image-page answer DOCX routes to visual support under the same evidence gate', async () => {
    const support = {
        id: 'visual-page-answer-docx',
        filename: 'scanned-answer.docx',
        fileType: 'docx',
        roles: ['answer']
    };
    const skeleton = {
        authoritative: false,
        questionNumbers: [],
        entries: [],
        diagnostics: {
            reason: 'no-explicit-question-markers',
            visualPageCandidate: true
        }
    };
    const route = await resolveDocxSourceRoute(support, [support], {
        extractQuestionSkeleton: async () => skeleton
    });

    assert.deepEqual(route, {
        producerIdentity: 'docx-visual-page-support-importer',
        routePolicyDecision: 'visual-page-docx-support',
        selectedSourcePort: 'docx-convert-strict-vision',
        visualCompanionFileId: '',
        allowAutomaticVision: true,
        questionSkeleton: skeleton
    });
});

test('DOCX without page-image evidence stays on the deterministic fail-closed route', async () => {
    const question = {
        id: 'ambiguous-docx',
        filename: 'ambiguous.docx',
        fileType: 'docx',
        roles: ['question']
    };
    const skeleton = {
        authoritative: false,
        questionNumbers: [],
        entries: [],
        diagnostics: {
            reason: 'no-explicit-question-markers',
            visualPageCandidate: false
        }
    };
    const route = await resolveDocxSourceRoute(question, [question], {
        extractQuestionSkeleton: async () => skeleton
    });

    assert.equal(route.routePolicyDecision, 'deterministic-docx-primary');
    assert.equal(route.selectedSourcePort, 'docx-importer');
    assert.equal(route.allowAutomaticVision, false);
    assert.equal(route.questionSkeleton, skeleton);
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
