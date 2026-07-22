const test = require('node:test');
const assert = require('node:assert/strict');

const integrity = require('../qisi-pdf-content-integrity.js');
const controlledWrite = require('../qisi-pdf-support-controlled-write.js');

test('explicit PDF text-layer answers override a conflicting model answer by the same number', () => {
    const evidence = integrity.extractExplicitAnswerEvidence([
        { pageNo: 1, text: '5【答案】D\n一些解析' },
        { pageNo: 2, text: '6【答案】C\n【详解】如图' }
    ], { expectedQuestionNumbers: ['5', '6'] });
    const result = integrity.reconcileAnswersWithExplicitEvidence([
        { question: '5', answer: 'D' },
        { question: '6', answer: 'B' }
    ], evidence);

    assert.deepEqual(result.items.map(item => item.answer), ['D', 'C']);
    assert.equal(result.decisions[1].action, 'replaced-by-explicit-evidence');
    assert.equal(result.items[1].answerEvidence.source, 'pdf-text-layer-explicit-answer');
});

test('explicit PDF text-layer evidence adds a missing answer without order guessing', () => {
    const evidence = integrity.extractExplicitAnswerEvidence([
        { pageNo: 2, text: '6【答案】C\n【详解】跨页解析' }
    ], { expectedQuestionNumbers: ['1', '6'] });
    const result = integrity.reconcileAnswersWithExplicitEvidence([
        { question: '1', answer: 'B' }
    ], evidence);
    const added = result.items.find(item => item.question === '6');

    assert.equal(added.answer, 'C');
    assert.equal(added.sourceTrace.answerEvidence.source, 'pdf-text-layer-explicit-answer');
    assert.equal(result.decisions.at(-1).action, 'added-by-explicit-evidence');
});

test('conflicting duplicate explicit answers are ambiguous and never used', () => {
    const evidence = integrity.extractExplicitAnswerEvidence([
        { pageNo: 1, text: '6【答案】B' },
        { pageNo: 2, text: '6【答案】C' }
    ]);
    const result = integrity.reconcileAnswersWithExplicitEvidence([
        { question: '6', answer: 'B' }
    ], evidence);
    assert.equal(evidence.ambiguous.length, 1);
    assert.equal(result.items[0].answer, 'B');
    assert.deepEqual(result.decisions, []);
});

test('blank answer label uses only a unique explicit choice conclusion in the same numbered block', () => {
    const evidence = integrity.extractExplicitAnswerEvidence([{
        pageNo: 1,
        text: [
            '1【答案】B',
            '【详解】逐项判断，故选：B',
            '2【答案】',
            '【详解】计算得侧棱长为 5，故选：C',
            '3【答案】B'
        ].join('\n')
    }], { expectedQuestionNumbers: ['1', '2', '3'] });

    assert.deepEqual(
        evidence.accepted.map(item => [item.question, item.answer]),
        [['1', 'B'], ['2', 'C'], ['3', 'B']]
    );
    assert.equal(
        evidence.accepted.find(item => item.question === '2').source,
        'pdf-text-layer-explicit-solution-conclusion'
    );
});

test('unanchored or conflicting solution conclusions are rejected instead of guessed', () => {
    const unanchored = integrity.extractExplicitAnswerEvidence([{
        pageNo: 1,
        text: '一段没有题号答案块的解析，故选：C'
    }], { expectedQuestionNumbers: ['2'] });
    assert.deepEqual(unanchored.accepted, []);

    const conflicting = integrity.extractExplicitAnswerEvidence([{
        pageNo: 1,
        text: '2【答案】B\n【详解】另一处写成故选：C'
    }], { expectedQuestionNumbers: ['2'] });
    assert.deepEqual(conflicting.accepted, []);
    assert.equal(conflicting.ambiguous[0].question, '2');
});

test('alignment uses section, explicit question number and subquestion path', () => {
    const report = integrity.buildAlignmentReport({
        questionItems: [
            { section: '单选题', question: '1', subquestionPath: '' },
            { section: '填空题', question: '1', subquestionPath: '(1)' }
        ],
        supportItems: [
            { section: '单选题', question: '1', subquestionPath: '', answer: 'B' },
            { section: '填空题', question: '1', subquestionPath: '(1)', answer: '2' }
        ]
    });
    assert.equal(report.ok, true);
    assert.equal(report.matched.length, 2);
});

test('controlled write preserves unique explicit PDF answer evidence', () => {
    const evidence = {
        question: '6',
        answer: 'C',
        pageNo: 2,
        source: 'pdf-text-layer-explicit-answer'
    };
    const result = controlledWrite.buildPdfSupportFieldLevelControlledWrite({
        drafts: [{ question: '6', type: '单选题', options: ['1:8', '1:9', '1:26', '1:27'] }],
        parserSafeAnswerItems: [{ question: '6', answer: 'C' }],
        explicitAnswerEvidence: [evidence]
    });

    assert.equal(result.effectiveAnswerItems[0].answer, 'C');
    assert.deepEqual(result.effectiveAnswerItems[0].answerEvidence, evidence);
    assert.deepEqual(result.effectiveAnswerItems[0].sourceTrace.answerEvidence, evidence);
    assert.equal(result.fieldDecisions[0].source, 'pdf-text-layer-explicit');
});

test('cross-page PDF text evidence repairs only a complete A-D option sequence', () => {
    const result = integrity.repairMissingOptionsFromPdfText({
        questions: [
            {
                question: '6',
                questionNumber: '6',
                options: ['', '', '', ''],
                contentIntegrity: {
                    version: 'pdf-math-region-r1',
                    sourceEvidence: { stem: '圆锥题', options: [] }
                }
            },
            { question: '7', questionNumber: '7', options: ['已有A', '已有B', '已有C', '已有D'] }
        ],
        layouts: [
            {
                pageNo: 1,
                lines: [{ text: '6．圆锥题', ny1: 900, ny2: 930 }]
            },
            {
                pageNo: 2,
                lines: [
                    { text: 'A. 1:8 B. 1:9 C. 1: 26 D. 1:27', ny1: 40, ny2: 70 },
                    { text: '7. 已知复数 z', ny1: 130, ny2: 160 }
                ]
            }
        ],
        expectedQuestionNumbers: ['6', '7']
    });

    assert.deepEqual(result.questions[0].options, ['1:8', '1:9', '1:26', '1:27']);
    assert.equal(result.decisions[0].question, '6');
    assert.equal(
        result.questions[0].sourceTrace.pdfTextOptionEvidence.source,
        'pdf-text-layer-explicit-option-labels'
    );
    assert.deepEqual(result.questions[1].options, ['已有A', '已有B', '已有C', '已有D']);
});

test('partial or discontinuous option evidence never repairs a question', () => {
    assert.equal(integrity.extractFourLabeledOptions('A. 1 B. 2 D. 4'), null);
    const result = integrity.repairMissingOptionsFromPdfText({
        questions: [{ question: '6', options: ['', '', '', ''] }],
        layouts: [{
            pageNo: 1,
            lines: [{ text: '6．题目', ny1: 100 }, { text: 'A. 1 B. 2 C. 3 D. 4', ny1: 200 }]
        }],
        expectedQuestionNumbers: ['6', '7']
    });
    assert.equal(result.regionReport.complete, false);
    assert.deepEqual(result.questions[0].options, ['', '', '', '']);
});
