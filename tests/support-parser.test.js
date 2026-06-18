const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const {
    parseExplicitSupportBlocks,
    validateSupportCoverage
} =
    require('../qisi-support-parser.js');

test(
    'parses twelve explicit answer and solution blocks',
    () => {
        const source =
            Array.from(
                { length: 12 },
                (_, index) => {
                    const q =
                        index + 1;

                    return (
                        `${q}【答案】A\n` +
                        `【详解】因为 $x_${q}>0$，所以故选：A`
                    );
                }
            ).join('\n');

        const result =
            parseExplicitSupportBlocks({
                pages: [{
                    pageNo: 1,
                    rawText: source
                }]
            });

        assert.equal(
            result.blocks.length,
            12
        );

        assert.deepEqual(
            result.blocks.map(
                block =>
                    block.questionNumber
            ),
            [
                '1', '2', '3', '4',
                '5', '6', '7', '8',
                '9', '10', '11', '12'
            ]
        );
    }
);

test(
    'keeps a cross-page solution in the same question block',
    () => {
        const result =
            parseExplicitSupportBlocks({
                pages: [
                    {
                        pageNo: 1,
                        rawText:
                            '6【答案】C\n【详解】第一部分 $V_1='
                    },
                    {
                        pageNo: 2,
                        rawText:
                            '\\frac{1}{27}V$，故选：C\n7【答案】ABD\n【详解】解析'
                    }
                ]
            });

        assert.equal(
            result.blocks.length,
            2
        );

        assert.match(
            result.blocks[0]
                .solutionRaw,
            /\\frac/
        );
    }
);

test(
    'does not treat leading formula numbers as new question markers',
    () => {
        const result =
            parseExplicitSupportBlocks({
                pages: [{
                    pageNo: 1,
                    rawText:
                        '1【答案】B\n【详解】2c=b(\\sin A-\\cos A)\n3\\cos A+2\\sin B=1'
                }]
            });

        assert.equal(
            result.blocks.length,
            1
        );
    }
);

test(
    'coverage detects missing solutions',
    () => {
        const blocks = [
            {
                questionNumber: '1',
                hasAnswerLabel: true,
                hasSolutionLabel: true
            },
            {
                questionNumber: '2',
                hasAnswerLabel: true,
                hasSolutionLabel: true
            }
        ];

        const coverage =
            validateSupportCoverage({
                blocks,
                answers: [
                    {
                        question: '1',
                        answer: 'A'
                    },
                    {
                        question: '2',
                        answer: 'B'
                    }
                ],
                solutions: [
                    {
                        question: '1',
                        solution: '解析1'
                    }
                ]
            });

        assert.equal(
            coverage.ok,
            false
        );

        assert.deepEqual(
            coverage.missingSolutions,
            ['2']
        );
    }
);

test(
    'uses expected question numbers for implicit enumerate items',
    () => {
        const result =
            parseExplicitSupportBlocks({
                expectedQuestionNumbers:
                    ['1', '2', '3'],

                pages: [{
                    pageNo: 1,
                    rawText: [
                        '```latex',
                        '\\begin{enumerate}',
                        '\\item 【答案】A',
                        '\\begin{description}',
                        '\\item【详解】解析1',
                        '\\end{description}',
                        '\\item 【答案】B',
                        '【详解】解析2',
                        '\\item 【答案】C',
                        '【详解】解析3',
                        '\\end{enumerate}',
                        '```'
                    ].join('\n')
                }]
            });

        assert.deepEqual(
            result.blocks.map(
                block =>
                    block.questionNumber
            ),
            ['1', '2', '3']
        );
    }
);

test(
    'recognizes explicit question numbers wrapped by noindent',
    () => {
        const result =
            parseExplicitSupportBlocks({
                expectedQuestionNumbers:
                    ['4', '5'],

                pages: [{
                    pageNo: 1,
                    rawText:
                        '\\noindent 4【答案】C\n【详解】解析4\n\\noindent 5【答案】D\n【详解】解析5'
                }]
            });

        assert.deepEqual(
            result.blocks.map(
                block =>
                    block.questionNumber
            ),
            ['4', '5']
        );
    }
);

test(
    'recognizes question numbers wrapped by textbf',
    () => {
        const result =
            parseExplicitSupportBlocks({
                expectedQuestionNumbers:
                    ['9', '10', '11'],

                pages: [{
                    pageNo: 1,
                    rawText:
                        '\\textbf{9}【答案】ABD\n【详解】解析9\n\\textbf{10}【答案】0\n【详解】解析10\n\\textbf{11}【答案】1\n【详解】解析11'
                }]
            });

        assert.deepEqual(
            result.blocks.map(
                block =>
                    block.questionNumber
            ),
            ['9', '10', '11']
        );
    }
);

test(
    'keeps a solution across pages until the next support marker',
    () => {
        const result =
            parseExplicitSupportBlocks({
                expectedQuestionNumbers:
                    ['6', '7'],

                pages: [
                    {
                        pageNo: 1,
                        rawText:
                            '6【答案】C\n【详解】第一部分 $V_1='
                    },
                    {
                        pageNo: 2,
                        rawText:
                            '\\frac{1}{27}V$，继续解析\n7【答案】ABD\n【详解】解析7'
                    }
                ]
            });

        assert.equal(
            result.blocks.length,
            2
        );

        assert.match(
            result.blocks[0]
                .solutionRaw,
            /\\frac/
        );
    }
);

test(
    'coverage detects blocks missing from external expected question numbers',
    () => {
        const coverage =
            validateSupportCoverage({
                expectedQuestionNumbers:
                    ['1', '2', '3', '4'],

                blocks: [{
                    questionNumber: '4',
                    hasAnswerLabel: true,
                    hasSolutionLabel: true
                }],

                answers: [{
                    question: '4',
                    answer: 'C'
                }],

                solutions: [{
                    question: '4',
                    solution: '解析4'
                }],

                requireAnswers: true
            });

        assert.equal(
            coverage.ok,
            false
        );

        assert.deepEqual(
            coverage.missingBlocks,
            ['1', '2', '3']
        );
    }
);

test(
    'parses mixed OCR LaTeX support blocks by external contract',
    () => {
        const answerLabel = '\u3010\u7b54\u6848\u3011';
        const detailLabel = '\u3010\u8be6\u89e3\u3011';
        const solutionLabel = '\u3010\u89e3\u6790\u3011';

        const source = [
            '```latex',
            '\\begin{enumerate}',

            `\\item ${answerLabel}A`,
            '\\begin{description}',
            `\\item${detailLabel}??1`,
            '\\end{description}',

            `\\item ${answerLabel}C`,
            '\\begin{description}',
            `\\item${detailLabel}??2`,
            '\\end{description}',

            `\\item ${answerLabel}B`,
            `\\noindent${solutionLabel}??3`,

            `\\noindent 4${answerLabel}C`,
            `\\noindent${detailLabel}??4`,

            `\\noindent 5${answerLabel}D`,
            `\\noindent${detailLabel}??5`,

            `6${answerLabel}C`,
            `${detailLabel}??6`,

            `7${answerLabel}ABD`,
            `${detailLabel}??7`,

            `8${answerLabel}AC`,
            `${detailLabel}??8`,

            `\\textbf{9}${answerLabel}ABD`,
            `${detailLabel}??9`,

            `\\textbf{10}${answerLabel}A`,
            `${detailLabel}??10`,

            `\\textbf{11}${answerLabel}B`,
            `${detailLabel}??11`,

            `12${answerLabel}D`,
            `${detailLabel}??12`,

            '\\end{enumerate}',
            '```'
        ].join('\n');

        const result =
            parseExplicitSupportBlocks({
                expectedQuestionNumbers: [
                    '1', '2', '3', '4',
                    '5', '6', '7', '8',
                    '9', '10', '11', '12'
                ],

                pages: [{
                    pageNo: 1,
                    rawText: source
                }]
            });

        assert.deepEqual(
            result.blocks.map(
                block =>
                    block.questionNumber
            ),
            [
                '1', '2', '3', '4',
                '5', '6', '7', '8',
                '9', '10', '11', '12'
            ]
        );

        assert.deepEqual(
            result.diagnostics
                .duplicateQuestionNumbers,
            []
        );

        assert.deepEqual(
            result.diagnostics
                .unresolvedMarkers,
            []
        );

        assert.deepEqual(
            result.diagnostics
                .duplicateMarkers,
            []
        );

        assert.deepEqual(
            result.diagnostics
                .unknownMarkers,
            []
        );
    }
);

test(
    'recognizes wrapped OCR LaTeX question numbers',
    () => {
        const answerLabel = '\u3010\u7b54\u6848\u3011';
        const detailLabel = '\u3010\u8be6\u89e3\u3011';

        const source = [
            `\\textbf{9}${answerLabel}ABD`,
            `${detailLabel}latex wrapped 9`,
            `\\textbf{10.}${answerLabel}A`,
            `${detailLabel}latex wrapped 10`,
            `\\noindent \\textbf { 11\u3001}${answerLabel}B`,
            `${detailLabel}latex wrapped 11`
        ].join('\n');

        const result =
            parseExplicitSupportBlocks({
                expectedQuestionNumbers: [
                    '9', '10', '11'
                ],

                pages: [{
                    pageNo: 1,
                    rawText: source
                }]
            });

        assert.deepEqual(
            result.blocks.map(
                block =>
                    block.questionNumber
            ),
            ['9', '10', '11']
        );

        assert.deepEqual(
            result.diagnostics
                .unresolvedMarkers,
            []
        );
    }
);

test(
    'parses marker and answer label on separate lines',
    () => {
        const answerLabel = '\u3010\u7b54\u6848\u3011';
        const detailLabel = '\u3010\u8be6\u89e3\u3011';

        const source = [
            '\\textbf{9}',
            '',
            `${answerLabel}ABD`,
            `${detailLabel}line split 9`,
            '10.',
            `${answerLabel}A`,
            `${detailLabel}line split 10`
        ].join('\n');

        const result =
            parseExplicitSupportBlocks({
                expectedQuestionNumbers: [
                    '9', '10'
                ],

                pages: [{
                    pageNo: 1,
                    rawText: source
                }]
            });

        assert.deepEqual(
            result.blocks.map(
                block =>
                    block.questionNumber
            ),
            ['9', '10']
        );
    }
);

test(
    'does not treat description item detail as a question',
    () => {
        const answerLabel = '\u3010\u7b54\u6848\u3011';
        const detailLabel = '\u3010\u8be6\u89e3\u3011';

        const source = [
            '\\begin{enumerate}',
            `\\item ${answerLabel}A`,
            '\\begin{description}',
            `\\item${detailLabel}detail 1`,
            '\\end{description}',
            `\\item ${answerLabel}B`,
            `${detailLabel}detail 2`,
            '\\end{enumerate}'
        ].join('\n');

        const result =
            parseExplicitSupportBlocks({
                expectedQuestionNumbers: [
                    '1', '2'
                ],

                pages: [{
                    pageNo: 1,
                    rawText: source
                }]
            });

        assert.deepEqual(
            result.blocks.map(
                block =>
                    block.questionNumber
            ),
            ['1', '2']
        );

        assert.deepEqual(
            result.diagnostics
                .duplicateMarkers,
            []
        );
    }
);

test(
    'does not invent question numbers after external contract is exhausted',
    () => {
        const answerLabel = '\u3010\u7b54\u6848\u3011';
        const detailLabel = '\u3010\u8be6\u89e3\u3011';

        const source = [
            `\\item${answerLabel}A`,
            `${detailLabel}detail 1`,
            `\\item${answerLabel}B`,
            `${detailLabel}extra detail`
        ].join('\n');

        const result =
            parseExplicitSupportBlocks({
                expectedQuestionNumbers: [
                    '1'
                ],

                pages: [{
                    pageNo: 1,
                    rawText: source
                }]
            });

        assert.deepEqual(
            result.blocks.map(
                block =>
                    block.questionNumber
            ),
            ['1']
        );

        assert.equal(
            result.diagnostics
                .unresolvedMarkers
                .length,
            1
        );
    }
);

test(
    'rejected implicit marker closes the previous accepted block without inventing a question number',
    () => {
        const answerLabel = '\u3010\u7b54\u6848\u3011';
        const detailLabel = '\u3010\u8be6\u89e3\u3011';

        const source = [
            `\\item${answerLabel}A`,
            `${detailLabel}detail 1`,
            `\\item${answerLabel}B`,
            `${detailLabel}extra detail`
        ].join('\n');

        const result =
            parseExplicitSupportBlocks({
                expectedQuestionNumbers:
                    ['1'],

                pages: [{
                    pageNo: 1,
                    rawText: source
                }]
            });

        assert.deepEqual(
            result.blocks.map(
                block =>
                    block.questionNumber
            ),
            ['1']
        );

        assert.equal(
            result.blocks[0].answerRaw,
            'A'
        );

        assert.equal(
            result.blocks[0].solutionRaw,
            'detail 1'
        );

        assert.doesNotMatch(
            result.blocks[0].rawBlock,
            /extra detail/
        );

        assert.equal(
            result.diagnostics
                .unresolvedMarkers
                .length,
            1
        );
    }
);

test(
    'unknown explicit marker remains a block so coverage fails closed',
    () => {
        const answerLabel = '\u3010\u7b54\u6848\u3011';
        const detailLabel = '\u3010\u8be6\u89e3\u3011';

        const source = [
            `1${answerLabel}A`,
            `${detailLabel}detail 1`,
            `99${answerLabel}C`,
            `${detailLabel}unknown detail`,
            `2${answerLabel}B`,
            `${detailLabel}detail 2`
        ].join('\n');

        const parsed =
            parseExplicitSupportBlocks({
                expectedQuestionNumbers:
                    ['1', '2'],

                pages: [{
                    pageNo: 1,
                    rawText: source
                }]
            });

        assert.deepEqual(
            parsed.blocks.map(
                block =>
                    block.questionNumber
            ),
            ['1', '99', '2']
        );

        assert.equal(
            parsed.diagnostics
                .unknownMarkers
                .length,
            1
        );

        const coverage =
            validateSupportCoverage({
                expectedQuestionNumbers:
                    ['1', '2'],

                blocks:
                    parsed.blocks,

                answers:
                    parsed.blocks.map(
                        block => ({
                            question:
                                block.questionNumber,

                            answer:
                                block.answerRaw
                        })
                    ),

                solutions:
                    parsed.blocks.map(
                        block => ({
                            question:
                                block.questionNumber,

                            solution:
                                block.solutionRaw
                        })
                    ),

                requireAnswers: true,
                requireSolutions: true
            });

        assert.equal(
            coverage.ok,
            false
        );

        assert.deepEqual(
            coverage.unknownBlocks,
            ['99']
        );
    }
);

test(
    'duplicate explicit marker remains a block so coverage fails closed',
    () => {
        const answerLabel = '\u3010\u7b54\u6848\u3011';
        const detailLabel = '\u3010\u8be6\u89e3\u3011';

        const source = [
            `1${answerLabel}A`,
            `${detailLabel}first detail`,
            `1${answerLabel}C`,
            `${detailLabel}duplicate detail`,
            `2${answerLabel}B`,
            `${detailLabel}second detail`
        ].join('\n');

        const parsed =
            parseExplicitSupportBlocks({
                expectedQuestionNumbers:
                    ['1', '2'],

                pages: [{
                    pageNo: 1,
                    rawText: source
                }]
            });

        assert.deepEqual(
            parsed.blocks.map(
                block =>
                    block.questionNumber
            ),
            ['1', '1', '2']
        );

        assert.equal(
            parsed.diagnostics
                .duplicateMarkers
                .length,
            1
        );

        const coverage =
            validateSupportCoverage({
                expectedQuestionNumbers:
                    ['1', '2'],

                blocks:
                    parsed.blocks,

                answers:
                    parsed.blocks.map(
                        block => ({
                            question:
                                block.questionNumber,

                            answer:
                                block.answerRaw
                        })
                    ),

                solutions:
                    parsed.blocks.map(
                        block => ({
                            question:
                                block.questionNumber,

                            solution:
                                block.solutionRaw
                        })
                    ),

                requireAnswers: true,
                requireSolutions: true
            });

        assert.equal(
            coverage.ok,
            false
        );

        assert.deepEqual(
            coverage
                .duplicateQuestionNumbers,
            ['1']
        );
    }
);

test(
    'reports an answer line whose marker prefix is not recognized',
    () => {
        const answerLabel = '\u3010\u7b54\u6848\u3011';
        const detailLabel = '\u3010\u8be6\u89e3\u3011';

        const result =
            parseExplicitSupportBlocks({
                expectedQuestionNumbers:
                    ['9'],

                pages: [{
                    pageNo: 1,
                    rawText:
                        `\\textbf{9${answerLabel}ABD}\n` +
                        `${detailLabel}detail`
                }]
            });

        assert.deepEqual(
            result.blocks,
            []
        );

        assert.equal(
            result.diagnostics
                .rejectedMarkerCandidates
                .length,
            1
        );

        assert.equal(
            result.diagnostics
                .rejectedMarkerCandidates[0]
                .reason,
            'marker-prefix-not-recognized'
        );
    }
);

test(
    'reports a marker whose next non-empty line is not an answer label',
    () => {
        const answerLabel = '\u3010\u7b54\u6848\u3011';
        const detailLabel = '\u3010\u8be6\u89e3\u3011';

        const result =
            parseExplicitSupportBlocks({
                expectedQuestionNumbers:
                    ['9'],

                pages: [{
                    pageNo: 1,
                    rawText: [
                        '\\textbf{9}',
                        '',
                        '\\quad',
                        `${answerLabel}ABD`,
                        `${detailLabel}detail`
                    ].join('\n')
                }]
            });

        assert.deepEqual(
            result.blocks,
            []
        );

        assert.equal(
            result.diagnostics
                .rejectedMarkerCandidates
                .length,
            1
        );

        assert.equal(
            result.diagnostics
                .rejectedMarkerCandidates[0]
                .reason,
            'answer-label-not-found-after-marker'
        );

        assert.equal(
            result.diagnostics
                .rejectedMarkerCandidates[0]
                .nextNonEmptyLine,
            '\\quad'
        );
    }
);

test(
    'decodes structured JSON OCR rows before support marker scanning',
    () => {
        const answerLabel = '\u3010\u7b54\u6848\u3011';
        const detailLabel = '\u3010\u8be6\u89e3\u3011';

        const rows = [
            {
                rotate_rect:
                    [206, 94, 17, 125, 90],
                text:
                    `9${answerLabel}ABD`
            },
            {
                rotate_rect:
                    [450, 134, 25, 605, 90],
                text:
                    `${detailLabel}detail 9`
            },
            {
                rotate_rect:
                    [212, 644, 25, 125, 90],
                text:
                    `10${answerLabel}\\frac{19}{13}`
            },
            {
                rotate_rect:
                    [432, 710, 31, 569, 90],
                text:
                    `${detailLabel}detail 10`
            },
            {
                rotate_rect:
                    [200, 826, 19, 105, 90],
                text:
                    `11${answerLabel}6`
            },
            {
                rotate_rect:
                    [456, 854, 21, 607, 90],
                text:
                    `${detailLabel}detail 11`
            }
        ];

        const result =
            parseExplicitSupportBlocks({
                expectedQuestionNumbers: [
                    '9', '10', '11'
                ],

                pages: [{
                    pageNo: 4,
                    rawText:
                        '```json\n' +
                        JSON.stringify(
                            rows,
                            null,
                            2
                        ) +
                        '\n```'
                }]
            });

        assert.deepEqual(
            result.blocks.map(
                block =>
                    block.questionNumber
            ),
            ['9', '10', '11']
        );

        assert.equal(
            result.blocks[0].answerRaw,
            'ABD'
        );

        assert.match(
            result.blocks[1].answerRaw,
            /\\frac/
        );

        assert.equal(
            result.blocks[2].answerRaw,
            '6'
        );
    }
);

test(
    'keeps a block across a structured JSON page and a plain text page',
    () => {
        const answerLabel = '\u3010\u7b54\u6848\u3011';
        const detailLabel = '\u3010\u8be6\u89e3\u3011';
        const solutionLabel = '\u3010\u89e3\u7b54\u3011';

        const rows = [
            {
                rotate_rect:
                    [200, 826, 19, 105, 90],
                text:
                    `11${answerLabel}6`
            },
            {
                rotate_rect:
                    [456, 854, 21, 607, 90],
                text:
                    `${detailLabel}question 11 first part`
            }
        ];

        const result =
            parseExplicitSupportBlocks({
                expectedQuestionNumbers: [
                    '11', '12'
                ],

                pages: [
                    {
                        pageNo: 4,
                        rawText:
                            '```json\n' +
                            JSON.stringify(
                                rows,
                                null,
                                2
                            ) +
                            '\n```'
                    },
                    {
                        pageNo: 5,
                        rawText: [
                            '```latex',
                            'question 11 second part',
                            '',
                            `12${answerLabel}B`,
                            `${solutionLabel}question 12 solution`,
                            '```'
                        ].join('\n')
                    }
                ]
            });

        assert.deepEqual(
            result.blocks.map(
                block =>
                    block.questionNumber
            ),
            ['11', '12']
        );

        assert.match(
            result.blocks[0].solutionRaw,
            /question 11 first part/
        );

        assert.match(
            result.blocks[0].solutionRaw,
            /question 11 second part/
        );

        assert.equal(
            result.blocks[1].solutionRaw,
            'question 12 solution'
        );
    }
);

test(
    'falls back without throwing for malformed structured OCR JSON',
    () => {
        assert.doesNotThrow(
            () => {
                parseExplicitSupportBlocks({
                    expectedQuestionNumbers:
                        ['9'],

                    pages: [{
                        pageNo: 4,
                        rawText: [
                            '```json',
                            '[',
                            '{"text":"9\\u3010\\u7b54\\u6848\\u3011ABD"},',
                            '{"text":"\\u3010\\u8be6\\u89e3\\u3011detail"',
                            ']',
                            '```'
                        ].join('\n')
                    }]
                });
            }
        );
    }
);

test(
    'recognizes implicit enumerate support markers with bold answer and solution labels',
    () => {
        const answerLabel = '\u3010\u7b54\u6848\u3011';
        const detailLabel = '\u3010\u8be6\u89e3\u3011';

        const result =
            parseExplicitSupportBlocks({
                expectedQuestionNumbers:
                    ['9', '10', '11'],

                pages: [{
                    pageNo:
                        4,

                    rawText:
                        [
                            '```latex',
                            '\\begin{enumerate}',

                            ` \\item \\textbf{${answerLabel}ABD`,
                            ' \\begin{itemize}',
                            ` \\item \\textbf{${detailLabel}\u89e3\u67909`,
                            ' \\end{itemize}',

                            ` \\item \\textbf{${answerLabel}$-\\\\frac{19}{13}$`,
                            ' \\begin{itemize}',
                            ` \\item \\textbf{${detailLabel}\u89e3\u679010`,
                            ' \\end{itemize}',

                            ` \\item \\textbf{${answerLabel}6`,
                            ' \\begin{itemize}',
                            ` \\item \\textbf{${detailLabel}\u89e3\u679011`,
                            ' \\end{itemize}',

                            '\\end{enumerate}',
                            '```'
                        ].join('\n')
                }]
            });

        assert.deepEqual(
            result.diagnostics.questionNumbers,
            ['9', '10', '11']
        );

        assert.equal(
            result.blocks.length,
            3
        );

        assert.deepEqual(
            result.blocks.map(
                block =>
                    block.questionNumber
            ),
            ['9', '10', '11']
        );

        assert.match(
            result.blocks[0].answerRaw,
            /ABD/
        );

        assert.doesNotMatch(
            result.blocks[0].answerRaw,
            /^\s*\}/
        );

        assert.match(
            result.blocks[1].answerRaw,
            /-\\\\frac\{19\}\{13\}/
        );

        assert.doesNotMatch(
            result.blocks[1].answerRaw,
            /^\s*\}/
        );

        assert.match(
            result.blocks[2].answerRaw,
            /6/
        );

        assert.doesNotMatch(
            result.blocks[2].answerRaw,
            /^\s*\}/
        );

        assert.match(
            result.blocks[0].solutionRaw,
            /\u89e3\u67909/
        );

        assert.doesNotMatch(
            result.blocks[0].solutionRaw,
            /^\s*\}/
        );

        assert.equal(
            result.diagnostics
                .unresolvedMarkers
                .length,
            0
        );

        assert.equal(
            result.diagnostics
                .unknownMarkers
                .length,
            0
        );

        assert.equal(
            result.diagnostics
                .duplicateMarkers
                .length,
            0
        );
    }
);

test(
    'recognizes lightly wrapped support labels',
    () => {
        const answerLabel = '\u3010\u7b54\u6848\u3011';
        const detailLabel = '\u3010\u8be6\u89e3\u3011';
        const analysisLabel = '\u3010\u89e3\u6790\u3011';
        const solutionLabel = '\u3010\u89e3\u7b54\u3011';

        const result =
            parseExplicitSupportBlocks({
                expectedQuestionNumbers:
                    ['1', '2', '3', '4'],

                pages: [{
                    pageNo:
                        1,

                    rawText:
                        [
                            `\\item \\textbf { ${answerLabel}}A`,
                            `\\textbf { ${detailLabel}}\u89e3\u67901`,

                            `\\item {\\textbf{${answerLabel}}B`,
                            `{\\textbf{${detailLabel}}\u89e3\u67902`,

                            `\\item \\mathbf{${answerLabel}C`,
                            `\\mathbf{${analysisLabel}\u89e3\u67903`,

                            `\\item \\bfseries ${answerLabel}D`,
                            `\\bfseries ${solutionLabel}\u89e3\u67904`
                        ].join('\n')
                }]
            });

        assert.deepEqual(
            result.blocks.map(
                block =>
                    block.questionNumber
            ),
            ['1', '2', '3', '4']
        );

        assert.deepEqual(
            result.blocks.map(
                block =>
                    block.answerRaw
                        .replace(/\s+/g, '')
                        .replace(/\\item/g, '')
            ),
            ['A', 'B', 'C', 'D']
        );

        assert.ok(
            result.blocks.every(
                block =>
                    !/^\s*\}/.test(
                        block.answerRaw
                    ) &&
                    !/^\s*\}/.test(
                        block.solutionRaw
                    )
            )
        );
    }
);

test(
    'does not treat bold answer label without support marker as a new block',
    () => {
        const answerLabel = '\u3010\u7b54\u6848\u3011';
        const detailLabel = '\u3010\u8be6\u89e3\u3011';

        const result =
            parseExplicitSupportBlocks({
                expectedQuestionNumbers:
                    ['1'],

                pages: [{
                    pageNo:
                        1,

                    rawText:
                        [
                            `\\item ${answerLabel}A`,
                            `body text \\textbf{${answerLabel}B is not a new question`,
                            `${detailLabel}\u89e3\u6790`
                        ].join('\n')
                }]
            });

        assert.deepEqual(
            result.blocks.map(
                block =>
                    block.questionNumber
            ),
            ['1']
        );

        assert.equal(
            result.blocks.length,
            1
        );
    }
);

test(
    'does not drop the first implicit enumerate support block',
    () => {
        const answerLabel = '\u3010\u7b54\u6848\u3011';
        const detailLabel = '\u3010\u8be6\u89e3\u3011';
        const analysisLabel = '\u3010\u89e3\u6790\u3011';

        const result =
            parseExplicitSupportBlocks({
                expectedQuestionNumbers:
                    ['1', '2', '3', '4', '5'],

                pages: [{
                    pageNo:
                        1,

                    rawText:
                        [
                            '```latex',
                            '\\begin{enumerate}',

                            ` \\item ${answerLabel}B`,
                            ' \\begin{description}',
                            ` \\item${detailLabel}\u89e3\u67901, therefore B`,
                            ' \\end{description}',

                            ` \\item ${answerLabel}`,
                            ' \\begin{description}',
                            ` \\item${detailLabel}\u89e3\u67902, therefore C`,
                            ' \\end{description}',

                            ` \\item ${answerLabel}B`,
                            ' \\begin{description}',
                            ` \\item${analysisLabel}\u89e3\u67903, therefore B`,
                            ' \\end{description}',

                            ` \\item ${answerLabel}C`,
                            ' \\begin{description}',
                            ` \\item${detailLabel}\u89e3\u67904, therefore C`,
                            ' \\end{description}',

                            ` \\item ${answerLabel}D`,
                            ' \\begin{description}',
                            ` \\item${detailLabel}\u89e3\u67905, therefore D`,
                            ' \\end{description}',

                            '\\end{enumerate}',
                            '```'
                        ].join('\n')
                }]
            });

        assert.deepEqual(
            result.blocks.map(
                block =>
                    block.questionNumber
            ),
            ['1', '2', '3', '4', '5']
        );

        assert.equal(
            result.blocks.length,
            5
        );

        assert.match(
            result.blocks[0].answerRaw,
            /B/
        );

        assert.match(
            result.blocks[0].solutionRaw,
            /\u89e3\u67901/
        );

        assert.deepEqual(
            result.diagnostics
                .droppedBlockMarkers,
            []
        );
    }
);

test(
    'keeps implicit support numbering across plain and bold answer labels',
    () => {
        const answerLabel = '\u3010\u7b54\u6848\u3011';
        const detailLabel = '\u3010\u8be6\u89e3\u3011';
        const analysisLabel = '\u3010\u89e3\u6790\u3011';

        const result =
            parseExplicitSupportBlocks({
                expectedQuestionNumbers:
                    [
                        '1', '2', '3', '4',
                        '5', '6', '7', '8',
                        '9', '10', '11', '12'
                    ],

                pages: [{
                    pageNo:
                        1,

                    rawText:
                        [
                            '\\begin{enumerate}',
                            `\\item ${answerLabel}B`,
                            `\\item${detailLabel}\u89e3\u67901`,

                            `\\item ${answerLabel}`,
                            `\\item${detailLabel}\u89e3\u67902, therefore C`,

                            `\\item ${answerLabel}B`,
                            `\\item${analysisLabel}\u89e3\u67903`,

                            `\\item ${answerLabel}C`,
                            `\\item${detailLabel}\u89e3\u67904`,

                            `\\item ${answerLabel}D`,
                            `\\item${detailLabel}\u89e3\u67905`
                        ].join('\n')
                }, {
                    pageNo:
                        2,

                    rawText:
                        [
                            `\\item ${answerLabel}A`,
                            `${detailLabel}\u89e3\u67906`,

                            `\\item ${answerLabel}ABD`,
                            `${detailLabel}\u89e3\u67907`,

                            `\\item ${answerLabel}ACD`,
                            `${detailLabel}\u89e3\u67908`
                        ].join('\n')
                }, {
                    pageNo:
                        4,

                    rawText:
                        [
                            `\\item \\textbf{${answerLabel}ABD`,
                            `\\item \\textbf{${detailLabel}\u89e3\u67909`,

                            `\\item \\textbf{${answerLabel}$-\\\\frac{19}{13}$`,
                            `\\item \\textbf{${detailLabel}\u89e3\u679010`,

                            `\\item \\textbf{${answerLabel}6`,
                            `\\item \\textbf{${detailLabel}\u89e3\u679011`
                        ].join('\n')
                }, {
                    pageNo:
                        5,

                    rawText:
                        [
                            `12${answerLabel}`,
                            `${detailLabel}\u89e3\u679012`
                        ].join('\n')
                }]
            });

        assert.deepEqual(
            result.blocks.map(
                block =>
                    block.questionNumber
            ),
            [
                '1', '2', '3', '4',
                '5', '6', '7', '8',
                '9', '10', '11', '12'
            ]
        );

        assert.equal(
            result.blocks.length,
            12
        );

        assert.deepEqual(
            result.diagnostics
                .droppedBlockMarkers,
            []
        );

        assert.deepEqual(
            result.diagnostics
                .unresolvedMarkers,
            []
        );

        assert.deepEqual(
            result.diagnostics
                .unknownMarkers,
            []
        );

        assert.deepEqual(
            result.diagnostics
                .duplicateMarkers,
            []
        );
    }
);

test(
    'uses accepted marker answer label range for answer extraction',
    () => {
        const answerLabel = '\u3010\u7b54\u6848\u3011';
        const detailLabel = '\u3010\u8be6\u89e3\u3011';

        const result =
            parseExplicitSupportBlocks({
                expectedQuestionNumbers:
                    ['1', '2'],

                pages: [{
                    pageNo:
                        1,

                    rawText:
                        [
                            `\\item \\textbf{${answerLabel}A`,
                            `\\textbf{${detailLabel}\u89e3\u67901`,

                            `\\item {\\textbf{${answerLabel}}B`,
                            `{\\textbf{${detailLabel}}\u89e3\u67902`
                        ].join('\n')
                }]
            });

        assert.deepEqual(
            result.blocks.map(
                block =>
                    block.questionNumber
            ),
            ['1', '2']
        );

        assert.deepEqual(
            result.blocks.map(
                block =>
                    block.answerRaw
                        .replace(/\s+/g, '')
            ),
            ['A', 'B']
        );

        assert.ok(
            result.blocks.every(
                block =>
                    !/^\s*\}/.test(
                        block.answerRaw
                    ) &&
                    !/^\s*\}/.test(
                        block.solutionRaw
                    )
            )
        );
    }
);

test(
    'cleans support answer and solution environment shells',
    () => {
        const answerLabel = '\u3010\u7b54\u6848\u3011';
        const detailLabel = '\u3010\u8be6\u89e3\u3011';

        const result =
            parseExplicitSupportBlocks({
                expectedQuestionNumbers:
                    ['1'],

                pages: [{
                    pageNo:
                        1,

                    rawText:
                        [
                            `\\item ${answerLabel}`,
                            '\\begin{description}',
                            '\\item',
                            'B',
                            `${detailLabel}`,
                            '\u89e3\u6790\u6b63\u6587',
                            '\\end{description}'
                        ].join('\n')
                }]
            });

        assert.equal(
            result.blocks[0].answerRaw,
            'B'
        );

        assert.doesNotMatch(
            result.blocks[0].answerRaw,
            /\\begin\{description\}|^\\item$/m
        );

        assert.doesNotMatch(
            result.blocks[0].solutionRaw,
            /\\end\{description\}/
        );

        assert.match(
            result.blocks[0].solutionRaw,
            /\u89e3\u6790\u6b63\u6587/
        );

        assert.deepEqual(
            result.diagnostics
                .droppedBlockMarkers,
            []
        );
    }
);

test(
    'splits embedded solution label from answerRaw when primary solution label is missing',
    () => {
        const answerLabel = '\u3010\u7b54\u6848\u3011';
        const detailLabel = '\u8be6 \u89e3\uff1a';

        const result =
            parseExplicitSupportBlocks({
                expectedQuestionNumbers:
                    ['1'],

                pages: [{
                    pageNo:
                        1,

                    rawText:
                        [
                            `1${answerLabel}`,
                            'A',
                            `\\item ${detailLabel}`,
                            '\u7531\u9898\u610f\u53ef\u5f97 x>0\uff0c\u6240\u4ee5\u9009 A\u3002'
                        ].join('\n')
                }]
            });

        assert.equal(
            result.blocks.length,
            1
        );

        assert.equal(
            result.blocks[0].answerRaw,
            'A'
        );

        assert.match(
            result.blocks[0].solutionRaw,
            /\u7531\u9898\u610f/
        );

        assert.equal(
            result.blocks[0]
                .correctedByAnswerRawSolutionSplit,
            true
        );

        assert.deepEqual(
            result.diagnostics
                .answerRawSolutionSplits
                .map(item => item.questionNumber),
            ['1']
        );
    }
);

test(
    'cleans leading latex item prefixes inside support fields',
    () => {
        const answerLabel = '\u3010\u7b54\u6848\u3011';
        const detailLabel = '\u3010\u8be6\u89e3\u3011';

        const result =
            parseExplicitSupportBlocks({
                expectedQuestionNumbers:
                    ['1'],

                pages: [{
                    pageNo:
                        1,

                    rawText:
                        [
                            `\\item ${answerLabel}`,
                            '\\item B',
                            `${detailLabel}`,
                            '\\item \u25b3ABC \u7684\u9762\u79ef',
                            '  \\item \u7531 S=\\frac{1}{2}ab\\sin C',
                            '\\item\u7531 \\sin A > 0 \u53ef\u5f97',
                            '\\item[\u63d0\u793a] \\sqrt{x} \u4fdd\u7559',
                            '\u6587\u672c \\item \u6587\u672c',
                            '\\begin{cases}',
                            'x>0',
                            '\\end{cases}'
                        ].join('\n')
                }]
            });

        assert.equal(
            result.blocks[0].answerRaw,
            'B'
        );

        assert.equal(
            result.blocks[0]
                .solutionRaw
                .split('\n')[0],
            '\u25b3ABC \u7684\u9762\u79ef'
        );

        assert.doesNotMatch(
            result.blocks[0].solutionRaw,
            /^\s*\\item/m
        );

        assert.match(
            result.blocks[0].solutionRaw,
            /\u7531 S=\\frac\{1\}\{2\}ab\\sin C/
        );

        assert.match(
            result.blocks[0].solutionRaw,
            /\u7531 \\sin A > 0 \u53ef\u5f97/
        );

        assert.match(
            result.blocks[0].solutionRaw,
            /\\sqrt\{x\}/
        );

        assert.match(
            result.blocks[0].solutionRaw,
            /\u6587\u672c \\item \u6587\u672c/
        );

        assert.match(
            result.blocks[0].solutionRaw,
            /\\begin\{cases\}/
        );

        assert.deepEqual(
            result.diagnostics
                .droppedBlockMarkers,
            []
        );
    }
);

test(
    'strips unsupported tikz graphics from support solutions',
    () => {
        const answerLabel = '\u3010\u7b54\u6848\u3011';
        const detailLabel = '\u3010\u8be6\u89e3\u3011';

        const result =
            parseExplicitSupportBlocks({
                expectedQuestionNumbers:
                    ['1'],

                pages: [{
                    pageNo:
                        1,

                    rawText:
                        [
                            `\\item ${answerLabel}A`,
                            `${detailLabel}`,
                            '\u8bbe\u6b63\u56db\u68f1\u53f0\u4fa7\u9762\u7684\u9ad8\u4e3a h',
                            '\\begin{center}',
                            '\\begin{tikzpicture}',
                            '\\draw (0,0) -- (1,1);',
                            '\\end{tikzpicture}',
                            '\\end{center}',
                            '\u6240\u4ee5\u7b54\u6848\u6210\u7acb'
                        ].join('\n')
                }]
            });

        assert.match(
            result.blocks[0].solutionRaw,
            /\u8bbe\u6b63\u56db\u68f1\u53f0\u4fa7\u9762\u7684\u9ad8\u4e3a h/
        );

        assert.match(
            result.blocks[0].solutionRaw,
            /\u6240\u4ee5\u7b54\u6848\u6210\u7acb/
        );

        assert.doesNotMatch(
            result.blocks[0].solutionRaw,
            /tikzpicture|\\draw|\\begin\{center\}|\\end\{center\}/
        );

        assert.deepEqual(
            result.diagnostics
                .droppedBlockMarkers,
            []
        );
    }
);

test(
    'keeps normal latex formulas while cleaning support fields',
    () => {
        const answerLabel = '\u3010\u7b54\u6848\u3011';
        const detailLabel = '\u3010\u8be6\u89e3\u3011';

        const result =
            parseExplicitSupportBlocks({
                expectedQuestionNumbers:
                    ['1'],

                pages: [{
                    pageNo:
                        1,

                    rawText:
                        [
                            `\\item ${answerLabel}`,
                            '$\\frac{1}{2}+\\sqrt{x}$',
                            `${detailLabel}`,
                            '\\begin{cases}',
                            'x=1',
                            '\\\\ y=2',
                            '\\end{cases}',
                            '$\\frac{a}{b}=\\sqrt{c}$'
                        ].join('\n')
                }]
            });

        assert.match(
            result.blocks[0].answerRaw,
            /\\frac\{1\}\{2\}/
        );

        assert.match(
            result.blocks[0].answerRaw,
            /\\sqrt\{x\}/
        );

        assert.match(
            result.blocks[0].solutionRaw,
            /\\begin\{cases\}/
        );

        assert.match(
            result.blocks[0].solutionRaw,
            /\\end\{cases\}/
        );

        assert.match(
            result.blocks[0].solutionRaw,
            /\\frac\{a\}\{b\}=\\sqrt\{c\}/
        );

        assert.deepEqual(
            result.diagnostics
                .droppedBlockMarkers,
            []
        );
    }
);
