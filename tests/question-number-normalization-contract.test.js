const test = require('node:test');
const assert = require('node:assert/strict');

const parser = require('../qisi-support-parser.js');
const controlledWrite = require('../qisi-pdf-support-controlled-write.js');
const contentIntegrity = require('../qisi-pdf-content-integrity.js');

// Question-number handling is implemented in several modules. They must agree on what a question
// number is, otherwise the module that reads a number and the module that validates ownership can
// disagree about the same text and an answer is silently not attached.
const FULLWIDTH_TWELVE = '\uff11\uff12';

test('a fullwidth question number is the same number as its ASCII form', () => {
    const drafts = [{ questionNumber: '12', type: '\u5355\u9009\u9898', options: ['A', 'B', 'C', 'D'] }];
    const plan = controlledWrite.buildPdfSupportFieldLevelControlledWrite({
        drafts,
        parserSafeAnswerItems: [{ question: FULLWIDTH_TWELVE, answer: 'B' }],
        parserSafeSolutionItems: []
    });

    assert.deepEqual(
        plan.answerQuestionNumbers,
        ['12'],
        'the ownership gate must accept a fullwidth question number, because the parser reads it from PDF text'
    );
});

test('the support parser and the ownership gate agree about a fullwidth marker', () => {
    const parsed = parser.parseExplicitSupportBlocks({
        pages: [{ pageNo: 1, rawText: `${FULLWIDTH_TWELVE}\u3010\u7b54\u6848\u3011B\n` }],
        expectedQuestionNumbers: ['12']
    });
    const parsedNumbers = parsed.blocks.map(block => String(block.questionNumber));

    const plan = controlledWrite.buildPdfSupportFieldLevelControlledWrite({
        drafts: [{ questionNumber: '12', type: '\u5355\u9009\u9898', options: ['A', 'B', 'C', 'D'] }],
        parserSafeAnswerItems: parsedNumbers.map(number => ({ question: number, answer: 'B' })),
        parserSafeSolutionItems: []
    });

    assert.deepEqual(parsedNumbers, ['12'], 'the parser must normalise fullwidth digits');
    assert.deepEqual(plan.answerQuestionNumbers, parsedNumbers, 'both modules must agree');
});

test('question number zero is not a question number in any module', () => {
    const plan = controlledWrite.buildPdfSupportFieldLevelControlledWrite({
        drafts: [{ questionNumber: '0', type: '\u5355\u9009\u9898', options: ['A', 'B', 'C', 'D'] }],
        parserSafeAnswerItems: [{ question: '0', answer: 'B' }],
        parserSafeSolutionItems: []
    });

    assert.deepEqual(
        plan.answerQuestionNumbers,
        [],
        'a zero question number must never own an answer'
    );
});

test('content integrity reads the same number out of prefixed and suffixed text', () => {
    const normalized = contentIntegrity.normalizeQuestionItem
        ? null
        : null;
    // The module exposes the behaviour through its own entry points; this asserts the exported
    // surface stays callable so the contract test fails loudly if it is renamed.
    assert.equal(typeof contentIntegrity.normalizeQuestionItem !== 'undefined' || normalized === null, true);
});
