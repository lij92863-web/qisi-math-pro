const test = require('node:test');
const assert = require('node:assert/strict');

const { auditIssueCount, auditPdfImportContent } = require('../scripts/audit-pdf-import-content.js');

test('PDF content audit accepts a clean rendered persistence shape', () => {
    const audit = auditPdfImportContent([{
        questionNumber: '1',
        stem: '集合 $A=\\{0,1\\}$',
        options: ['$A=B$', '$B\\subseteq A$', '$A\\cap B$', '$A-B$'],
        answer: 'B',
        solution: '由定义可得 $B\\subseteq A$。',
        images: [],
        recognizedSolutionImages: []
    }], {
        expectedQuestionNumbers: ['1'],
        expectedAnswerNumbers: ['1'],
        expectedAnalysisNumbers: ['1']
    });
    assert.equal(auditIssueCount(audit), 0, JSON.stringify(audit));
});

test('PDF content audit reports duplicated labels, raw latex, missing fields and crop rejection', () => {
    const audit = auditPdfImportContent([{
        questionNumber: '4',
        stem: '扇形面积 \\frac{1330\\sqrt{2}}{3}\\pi',
        options: ['A. 292π', 'B. 195π', '', ''],
        answer: '',
        solution: '',
        warnings: ['题图裁剪与其他题目区域重叠，已拒绝自动绑定。']
    }], {
        expectedQuestionNumbers: ['4'],
        expectedStemFigureNumbers: ['4'],
        expectedAnswerNumbers: ['4'],
        expectedAnalysisNumbers: ['4']
    });
    assert.equal(audit.duplicateOptionLabels.length, 2);
    assert.equal(audit.missingAnswers.length, 1);
    assert.equal(audit.missingAnalyses.length, 1);
    assert.equal(audit.missingStemFigures.length, 1);
    assert.equal(audit.contaminatedFigureCrops.length, 1);
});

