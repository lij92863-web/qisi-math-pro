const test = require('node:test');
const assert = require('node:assert/strict');

const { auditDocxImportContent, auditIssueCount } = require('../scripts/audit-docx-import-content.js');

test('DOCX content audit accepts complete renderable aligned content', () => {
    const imageId = 'support:q2:image-1';
    const result = auditDocxImportContent([{
        questionNumber: '1',
        stem: '已知 $\\sin A=1$',
        options: ['甲', '乙', '丙', '丁'],
        answer: 'B',
        solution: '故选 B。',
        recognizedSolutionImages: []
    }, {
        questionNumber: '2',
        stem: '计算 $x+1$',
        options: ['1', '2', '3', '4'],
        answer: 'C',
        solution: `由图可得\n[[IMAGE:${imageId}]]`,
        recognizedSolutionImages: [{ id: imageId }]
    }], {
        expectedQuestionNumbers: ['1', '2'],
        expectedAnalysisImageNumbers: ['2'],
        visualChecks: [
            { questionNumber: '1', renderErrorCount: 0, renderErrorDetails: [], renderedImageIds: [] },
            { questionNumber: '2', renderErrorCount: 0, renderErrorDetails: [], renderedImageIds: [imageId] }
        ]
    });

    assert.equal(auditIssueCount(result), 0, JSON.stringify(result));
});

test('DOCX content audit accepts a layout includegraphics reference only when the same image renders', () => {
    const imageId = 'support:q6:image-1';
    const question = {
        questionNumber: '6',
        stem: '题干',
        options: [],
        answer: 'C',
        solution: `\\includegraphics[width=\\linewidth]{${imageId}}\n由图可得`,
        recognizedSolutionImages: [{ id: imageId }]
    };
    const accepted = auditDocxImportContent([question], {
        expectedQuestionNumbers: ['6'],
        expectedAnalysisImageNumbers: ['6'],
        visualChecks: [{
            questionNumber: '6',
            renderErrorCount: 0,
            renderErrorDetails: [],
            renderedImageIds: [imageId]
        }]
    });
    const notRendered = auditDocxImportContent([question], {
        expectedQuestionNumbers: ['6'],
        expectedAnalysisImageNumbers: ['6'],
        visualChecks: [{
            questionNumber: '6',
            renderErrorCount: 0,
            renderErrorDetails: [],
            renderedImageIds: []
        }]
    });

    assert.equal(auditIssueCount(accepted), 0, JSON.stringify(accepted));
    assert.deepEqual(notRendered.missingAnalysisImages, ['6']);
});

test('DOCX content audit fails closed on structural, formula, image, and leakage regressions', () => {
    const result = auditDocxImportContent([{
        questionNumber: '1',
        stem: '{"question":"leaked"}',
        options: ['A', '三、填空题：本题共4小题', '', ''],
        answer: '',
        solution: '∵，∴，',
        recognizedSolutionImages: [{ id: 'wrong-image' }]
    }, {
        questionNumber: '1',
        stem: '3cosAsinB',
        options: [],
        answer: 'A',
        solution: '公式需要人工复核'
    }], {
        expectedQuestionNumbers: ['1', '2'],
        expectedAnalysisImageNumbers: ['1'],
        visualChecks: [{
            questionNumber: '1',
            renderErrorCount: 1,
            renderErrorDetails: [{ title: 'bad latex' }],
            unrenderedLatexFragments: ['\\frac'],
            renderedImageIds: []
        }]
    });

    assert.ok(auditIssueCount(result) >= 8, JSON.stringify(result));
    assert.deepEqual(result.duplicateQuestionNumbers, ['1']);
    assert.deepEqual(result.missingQuestionNumbers, ['2']);
    assert.equal(result.keyboardMathFragments[0].fragment, '3cosA');
    assert.deepEqual(result.unrenderedLatexFragments, [{ questionNumber: '1', fragment: '\\frac' }]);
});

test('DOCX content audit reports LaTeX commands that escaped math delimiters', () => {
    const result = auditDocxImportContent([{
        questionNumber: '12',
        stem: '题干',
        options: [],
        answer: '$\\frac{\\sqrt{2}+1}{2}$',
        solution: '故\\triangle ABC的面积S=\\frac{1}{2}bc\\sin A。'
    }]);

    assert.deepEqual(result.unwrappedLatexFragments, [
        { questionNumber: '12', field: 'solution', fragment: '\\triangle' },
        { questionNumber: '12', field: 'solution', fragment: '\\frac' },
        { questionNumber: '12', field: 'solution', fragment: '\\sin' }
    ]);
    assert.equal(auditIssueCount(result), 3);
});
