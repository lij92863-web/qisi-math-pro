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
            renderedImageIds: []
        }]
    });

    assert.ok(auditIssueCount(result) >= 8, JSON.stringify(result));
    assert.deepEqual(result.duplicateQuestionNumbers, ['1']);
    assert.deepEqual(result.missingQuestionNumbers, ['2']);
    assert.equal(result.keyboardMathFragments[0].fragment, '3cosA');
});
