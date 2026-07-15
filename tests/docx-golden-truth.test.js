const test = require('node:test');
const assert = require('node:assert/strict');

const truth = require('./fixtures/docx-golden/brief-docx-truth.json');

test('manual brief dual-DOCX truth covers questions 1 through 6', () => {
    assert.equal(truth.verifiedBy.startsWith('manual '), true);
    assert.equal(truth.questions.length, 6);
    assert.deepEqual(
        truth.questions.map(question => question.questionKey),
        Array.from({ length: 6 }, (_, index) => `section-1/q-${index + 1}`)
    );
    assert.deepEqual(
        truth.questions.map(question => question.answer),
        ['B', 'C', 'B', 'C', 'D', 'C']
    );
});

test('manual truth locks the reported formula, option, and image regressions', () => {
    const byNumber = new Map(
        truth.questions.map(question => [question.displayNumber, question])
    );

    assert.deepEqual(byNumber.get('4').options[1], {
        label: 'B',
        text: '$\\frac{1330\\sqrt{2}}{3}\\pi$',
        latex: ['\\frac{1330\\sqrt{2}}{3}\\pi']
    });
    assert.equal(byNumber.get('4').stemImageCount, 1);
    assert.equal(byNumber.get('6').analysisImageCount, 1);
    assert.equal(byNumber.get('5').options[3].text, '等腰（非等边）三角形');
    assert.equal(
        byNumber.get('5').options.some(option => /三、填空题/.test(option.text)),
        false
    );

    const serialized = JSON.stringify(truth);
    assert.doesNotMatch(serialized, /\\frac\{1330\$\$\\sqrt\{2\}\}\{3\}\\pi/);
    assert.doesNotMatch(serialized, /support-items-violate-contract/);
});
