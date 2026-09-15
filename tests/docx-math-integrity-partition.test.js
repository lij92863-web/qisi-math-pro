const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const loadBatchImporter = () => {
    const window = { Qisi: {} };
    const context = vm.createContext({
        window,
        console,
        fetch: async () => {
            throw new Error('network is forbidden in partition tests');
        }
    });
    const source = fs.readFileSync(
        path.resolve(__dirname, '../qisi-batch-importer.js'),
        'utf8'
    );
    vm.runInContext(source, context, { filename: 'qisi-batch-importer.js' });
    return window.QisiBatchImporter;
};

const { partitionQuestionsByFormulaErrors } = loadBatchImporter();

// The module runs in a separate VM context, so its objects come from another realm and cannot
// be compared by reference with assert.deepEqual. Compare plain data instead.
const plain = value => JSON.parse(JSON.stringify(value));

const questions = [
    { number: 1, diagnostics: [], sourceParagraphRange: [3, 4] },
    { number: 2, diagnostics: [], sourceParagraphRange: [5, 8] },
    { number: 3, diagnostics: [], sourceParagraphRange: [9, 12] }
];

test('one unconvertible formula withholds only the question that contains it', () => {
    const error = { kind: 'formula-error', code: 'MATHTYPE_TRANSLATION_MISSING', rid: 'rId72', paragraphIndex: 6 };
    const { keptQuestions, withheldQuestions, unattributed } = plain(
        partitionQuestionsByFormulaErrors(questions, [error])
    );

    assert.deepEqual(keptQuestions.map(question => question.number), [1, 3]);
    assert.equal(withheldQuestions.length, 1);
    assert.equal(withheldQuestions[0].questionNumber, '2');
    assert.deepEqual(withheldQuestions[0].sourceParagraphRange, [5, 8]);
    assert.deepEqual(withheldQuestions[0].formulaErrors, [{
        code: 'MATHTYPE_TRANSLATION_MISSING',
        rid: 'rId72',
        paragraphIndex: 6
    }]);
    assert.deepEqual(unattributed, []);
});

test('a formula that belongs to no question is never silently ignored', () => {
    const inside = { kind: 'formula-error', code: 'MATHTYPE_TRANSLATION_MISSING', rid: 'rId10', paragraphIndex: 9 };
    const outside = { kind: 'formula-error', code: 'MATHTYPE_TRANSLATION_MISSING', rid: 'rId11', paragraphIndex: 40 };
    const { keptQuestions, withheldQuestions, unattributed } = plain(
        partitionQuestionsByFormulaErrors(questions, [inside, outside])
    );

    assert.deepEqual(keptQuestions.map(question => question.number), [1, 2]);
    assert.deepEqual(withheldQuestions.map(row => row.questionNumber), ['3']);
    assert.deepEqual(unattributed, [outside]);
});

test('a paper with no formula errors keeps every question', () => {
    const { keptQuestions, withheldQuestions, unattributed } = plain(
        partitionQuestionsByFormulaErrors(questions, [])
    );

    assert.deepEqual(keptQuestions.map(question => question.number), [1, 2, 3]);
    assert.deepEqual(withheldQuestions, []);
    assert.deepEqual(unattributed, []);
});

test('a question boundary is inclusive so a formula on the boundary is attributed', () => {
    const firstParagraph = { kind: 'formula-error', code: 'MATHTYPE_TRANSLATION_MISSING', rid: 'rId1', paragraphIndex: 5 };
    const lastParagraph = { kind: 'formula-error', code: 'MATHTYPE_TRANSLATION_MISSING', rid: 'rId2', paragraphIndex: 8 };
    const { withheldQuestions, unattributed } = plain(
        partitionQuestionsByFormulaErrors(questions, [firstParagraph, lastParagraph])
    );

    assert.deepEqual(withheldQuestions.map(row => row.questionNumber), ['2']);
    assert.equal(withheldQuestions[0].formulaErrors.length, 2);
    assert.deepEqual(unattributed, []);
});

test('a question that owns the failing formula diagnostics is withheld without any range data', () => {
    const failing = { kind: 'formula-error', code: 'MATHTYPE_TRANSLATION_MISSING', rid: 'rId72', paragraphIndex: 16 };
    const clean = { kind: 'formula-error', code: 'MATHTYPE_TRANSLATION_MISSING', rid: 'rId99', paragraphIndex: 40 };
    const questionsWithDiagnostics = [
        { number: 5, diagnostics: [] },
        { number: 6, diagnostics: [failing], sourceParagraphRange: [15, 16] }
    ];

    const { keptQuestions, withheldQuestions, unattributed } = plain(
        partitionQuestionsByFormulaErrors(questionsWithDiagnostics, [failing, clean])
    );

    assert.deepEqual(keptQuestions.map(question => question.number), [5]);
    assert.deepEqual(withheldQuestions.map(row => row.questionNumber), ['6']);
    assert.deepEqual(withheldQuestions[0].sourceParagraphRange, [15, 16]);
    assert.deepEqual(unattributed, [clean]);
});
