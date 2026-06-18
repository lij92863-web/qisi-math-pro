const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const {
    normalizeSupportRawTextPages,
    parseSupportBlockMarkers,
    splitPdfSupportBlocks,
    buildPdfSupportItemsFromBlocks,
    parsePdfSupportBlocks
} =
    require('../qisi-pdf-support-block-parser.js');

const {
    markerCoverageFixture
} =
    require('./fixtures/pdf-real-case-minimal.js');

test(
    'parses normal 1-3 answer and solution blocks',
    () => {
        const result =
            parsePdfSupportBlocks({
                rawTextPages: [
                    [
                        '1. 【答案】A',
                        '【解析】solution 1',
                        '2. 答案：B',
                        '解析：solution 2',
                        '3、参考答案：C',
                        '详解：solution 3'
                    ].join('\n')
                ],
                expectedQuestionNumbers: [1, 2, 3],
                sourceFileId: 'pdf-a'
            });

        assert.deepEqual(
            result.blocks.map(block => block.question),
            ['1', '2', '3']
        );
        assert.deepEqual(
            result.answerItems.map(item => item.answer),
            ['A', 'B', 'C']
        );
        assert.deepEqual(
            result.solutionItems.map(item => item.solution),
            ['solution 1', 'solution 2', 'solution 3']
        );
        assert.deepEqual(result.warnings, []);
    }
);

test(
    'recognizes 第1题 with bracketed answer and solution labels',
    () => {
        const result =
            parsePdfSupportBlocks({
                rawTextPages: [
                    '第1题\n【答案】42\n【解析】because',
                    '【第2题】\n【答案】x=1\n【解析】solve it'
                ],
                expectedQuestionNumbers: [1, 2]
            });

        assert.deepEqual(
            result.answerItems.map(item => item.question),
            ['1', '2']
        );
        assert.equal(result.answerItems[0].answer, '42');
        assert.equal(result.solutionItems[1].solution, 'solve it');
    }
);

test(
    'continues answer and solution across pages',
    () => {
        const result =
            parsePdfSupportBlocks({
                rawTextPages: [
                    {
                        text:
                            '1. 【答案】A\n【解析】first line',
                        pageIndex: 0,
                        sourceOrder: 0
                    },
                    {
                        text:
                            'second line\n2. 【答案】B\n【解析】done',
                        pageIndex: 1,
                        sourceOrder: 1
                    }
                ],
                expectedQuestionNumbers: [1, 2]
            });

        assert.equal(
            result.solutionItems[0].solution,
            'first line\nsecond line'
        );
        assert.equal(
            result.solutionItems[0].sourceTrace.pageEnd,
            1
        );
    }
);

test(
    'duplicate question number produces warning and unsafe duplicate item',
    () => {
        const result =
            parsePdfSupportBlocks({
                rawTextPages: [
                    '1. 【答案】A\n【解析】S1\n1. 【答案】B\n【解析】S1b'
                ],
                expectedQuestionNumbers: [1]
            });

        assert.ok(
            result.warnings.some(
                warning => warning.code === 'duplicate-question-marker'
            )
        );
        assert.deepEqual(
            result.answerItems.map(item => item.answer),
            ['A']
        );
    }
);

test(
    'jump-back question number produces warning',
    () => {
        const result =
            parsePdfSupportBlocks({
                rawTextPages: [
                    '1. 【答案】A\n2. 【答案】B\n1. 【答案】C'
                ],
                expectedQuestionNumbers: [1, 2]
            });

        assert.ok(
            result.warnings.some(
                warning => warning.code === 'duplicate-question-marker'
            )
        );
        assert.ok(
            result.warnings.some(
                warning => warning.code === 'jump-back-question-marker'
            )
        );
        assert.deepEqual(
            result.sequenceReport.jumpBacks,
            [
                {
                    question: '1',
                    previousQuestion: '2'
                }
            ]
        );
    }
);

test(
    'unknown question marker produces warning and is not emitted as item',
    () => {
        const result =
            parsePdfSupportBlocks({
                rawTextPages: [
                    '1. 【答案】A\n4. 【答案】D'
                ],
                expectedQuestionNumbers: [1, 2, 3]
            });

        assert.ok(
            result.warnings.some(
                warning => warning.code === 'unknown-question-marker'
            )
        );
        assert.deepEqual(
            result.answerItems.map(item => item.question),
            ['1']
        );
        assert.deepEqual(
            result.coverageReport.missingAnswers,
            ['2', '3']
        );
    }
);

test(
    'missing solution leaves answer item and omits solution item',
    () => {
        const result =
            parsePdfSupportBlocks({
                rawTextPages: [
                    '1. 【答案】A\n2. 【答案】B\n【解析】S2'
                ],
                expectedQuestionNumbers: [1, 2]
            });

        assert.deepEqual(
            result.answerItems.map(item => item.question),
            ['1', '2']
        );
        assert.deepEqual(
            result.solutionItems.map(item => item.question),
            ['2']
        );
        assert.deepEqual(
            result.coverageReport.missingSolutions,
            ['1']
        );
    }
);

test(
    'answer-only support emits answer items without solutions',
    () => {
        const result =
            parsePdfSupportBlocks({
                rawTextPages: [
                    '1. 答案：A\n2. 参考答案：B'
                ],
                expectedQuestionNumbers: [1, 2],
                mode: 'answer'
            });

        assert.deepEqual(
            result.answerItems.map(item => item.answer),
            ['A', 'B']
        );
        assert.deepEqual(result.solutionItems, []);
    }
);

test(
    'does not treat formula numbers as question markers',
    () => {
        const result =
            parsePdfSupportBlocks({
                rawTextPages: [
                    [
                        '1. 【答案】A',
                        '【解析】Use \\frac{1}{2}.',
                        'The value 2.5 is not a question marker.',
                        '2. 【答案】B'
                    ].join('\n')
                ],
                expectedQuestionNumbers: [1, 2]
            });

        assert.deepEqual(
            result.blocks.map(block => block.question),
            ['1', '2']
        );
        assert.ok(
            result.solutionItems[0].solution.includes(
                '\\frac{1}{2}'
            )
        );
        assert.ok(
            result.solutionItems[0].solution.includes(
                '2.5'
            )
        );
    }
);

test(
    'does not use semantic keywords to infer ownership',
    () => {
        const result =
            parsePdfSupportBlocks({
                rawTextPages: [
                    [
                        '1. 【答案】A',
                        '【解析】triangle area explanation',
                        'circle radius explanation without marker'
                    ].join('\n')
                ],
                expectedQuestionNumbers: [1, 2]
            });

        assert.deepEqual(
            result.blocks.map(block => block.question),
            ['1']
        );
        assert.equal(result.solutionItems.length, 1);
        assert.deepEqual(
            result.coverageReport.missingBlocks,
            ['2']
        );
    }
);

test(
    'raw support pages with no block markers remain incomplete and safe',
    () => {
        const result =
            parsePdfSupportBlocks({
                rawTextPages: [
                    'CASE02_SANITIZED_UNPARSED_SUPPORT_PAGE_1',
                    'CASE02_SANITIZED_UNPARSED_SUPPORT_PAGE_2',
                    'CASE02_SANITIZED_UNPARSED_SUPPORT_PAGE_3',
                    'CASE02_SANITIZED_UNPARSED_SUPPORT_PAGE_4'
                ],
                expectedQuestionNumbers:
                    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15],
                sourceFileId:
                    'case02-sanitized-support'
            });

        assert.equal(result.blocks.length, 0);
        assert.deepEqual(result.answerItems, []);
        assert.deepEqual(result.solutionItems, []);
        assert.deepEqual(
            result.coverageReport.missingBlocks,
            ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '13', '15']
        );
        assert.deepEqual(
            result.coverageReport.missingSolutions,
            result.coverageReport.missingBlocks
        );
        assert.deepEqual(
            result.sequenceReport.questionNumbers,
            []
        );
    }
);

test(
    'sanitized marker-form fixture parses wrapped answer and solution blocks',
    () => {
        const fixture =
            markerCoverageFixture;
        const result =
            parsePdfSupportBlocks({
                rawTextPages:
                    fixture.rawTextPages,
                expectedQuestionNumbers:
                    fixture.expectedQuestionNumbers,
                sourceFileId:
                    fixture.id
            });

        assert.equal(
            result.blocks.length,
            fixture.expected.supportBlockCount
        );
        assert.deepEqual(
            result.sequenceReport.questionNumbers,
            fixture.expected.supportDetectedNumbers
        );
        assert.deepEqual(
            result.answerItems.map(item => item.question),
            fixture.expected.answerDetectedNumbers
        );
        assert.deepEqual(
            result.solutionItems.map(item => item.question),
            fixture.expected.solutionDetectedNumbers
        );
        assert.equal(
            result.answerItems.length,
            fixture.expected.answerBlockCount
        );
        assert.equal(
            result.solutionItems.length,
            fixture.expected.solutionBlockCount
        );
        assert.deepEqual(
            result.warnings
                .filter(warning => warning.code === 'unknown-question-marker')
                .map(warning => warning.question),
            fixture.expected.outOfRangeNumbers
        );
        assert.deepEqual(
            result.coverageReport.missingAnswers,
            []
        );
        assert.deepEqual(
            result.coverageReport.missingSolutions,
            []
        );
        assert.deepEqual(
            result.coverageReport.expectedQuestionNumbers,
            fixture.expectedQuestionNumbers.map(String)
        );
    }
);

test(
    'exports marker and raw page helpers',
    () => {
        assert.deepEqual(
            normalizeSupportRawTextPages(['page one'])[0],
            {
                pageIndex: 0,
                sourceOrder: 0,
                text: 'page one'
            }
        );

        assert.deepEqual(
            parseSupportBlockMarkers('【第3题】 【答案】C'),
            {
                type: 'question',
                question: '3',
                rest: '【答案】C'
            }
        );

        const split =
            splitPdfSupportBlocks({
                rawTextPages: ['1. 【答案】A'],
                expectedQuestionNumbers: [1]
            });
        const items =
            buildPdfSupportItemsFromBlocks({
                blocks: split.blocks,
                expectedQuestionNumbers: [1]
            });

        assert.equal(items.answerItems[0].answer, 'A');
    }
);
